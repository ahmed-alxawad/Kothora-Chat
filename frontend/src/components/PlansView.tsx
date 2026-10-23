import { createResource, createSignal, For, Show } from "solid-js"
import { api } from "../lib/api"
import { formatBdt } from "../lib/citations"
import type { BillingCycle, Plan, Usage } from "../lib/types"

const CYCLES: { id: BillingCycle; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly · 10% off" },
  { id: "yearly", label: "Yearly · 15% off" },
]

const PAYMENT_MESSAGES: Record<string, string> = {
  paid: "Payment received. Your plan is active.",
  pending: "Your payment is being confirmed. This page will show the new plan shortly.",
  review: "Your payment is under review. We will email you once it clears.",
  failed: "The payment did not go through. You have not been charged.",
  cancelled: "Payment cancelled.",
}

export function PlansView(props: { usage: Usage | undefined; paymentResult: string | null }) {
  const [plans] = createResource(api.plans)
  const [cycle, setCycle] = createSignal<BillingCycle>("monthly")
  const [error, setError] = createSignal("")
  const [busyPlan, setBusyPlan] = createSignal<string | null>(null)

  async function buy(plan: Plan, seats: number) {
    setError("")
    setBusyPlan(plan.id)
    try {
      const { gateway_url } = await api.checkout(plan.id, cycle(), seats)
      window.location.assign(gateway_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusyPlan(null)
    }
  }

  return (
    <section class="plans">
      <h2>Plans</h2>
      <p class="muted">
        Pay in BDT with bKash, Nagad, Rocket, cards or net banking through SSLCommerz. Wallet
        payments do not renew automatically; we remind you before your period ends.
      </p>
      <Show when={props.paymentResult}>
        {(result) => <p class="notice">{PAYMENT_MESSAGES[result()] ?? PAYMENT_MESSAGES.failed}</p>}
      </Show>
      <Show when={error()}>
        <p class="error" role="alert">
          {error()}
        </p>
      </Show>
      <div class="cycle-switch" role="radiogroup" aria-label="Billing cycle">
        <For each={CYCLES}>
          {(option) => (
            <button
              role="radio"
              aria-checked={cycle() === option.id}
              classList={{ active: cycle() === option.id }}
              onClick={() => setCycle(option.id)}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
      <Show when={plans.error}>
        <p class="error">Could not load plans: {String(plans.error)}</p>
      </Show>
      <div class="plan-grid">
        <For each={plans()?.filter((plan) => plan.id !== "free")}>
          {(plan) => (
            <PlanCard
              plan={plan}
              cycle={cycle()}
              current={props.usage?.plan_id === plan.id}
              busy={busyPlan() === plan.id}
              onBuy={(seats) => buy(plan, seats)}
            />
          )}
        </For>
      </div>
    </section>
  )
}

function PlanCard(props: {
  plan: Plan
  cycle: BillingCycle
  current: boolean
  busy: boolean
  onBuy: (seats: number) => void
}) {
  const [seats, setSeats] = createSignal(props.plan.min_seats)
  const price = () => props.plan.prices.find((p) => p.cycle === props.cycle)

  return (
    <article class="plan-card" classList={{ current: props.current }}>
      <h3>{props.plan.name}</h3>
      <p class="muted">{props.plan.audience}</p>
      <Show when={price()} fallback={<p class="price">Custom quote</p>}>
        {(p) => (
          <p class="price">
            {formatBdt(p().per_month_bdt)}
            <span class="muted"> / month{props.plan.per_seat ? " per seat" : ""}</span>
            <Show when={props.cycle !== "monthly"}>
              <span class="muted small">
                {formatBdt(p().total_bdt * (props.plan.per_seat ? seats() : 1))} billed{" "}
                {props.cycle === "yearly" ? "yearly" : "per quarter"}
              </span>
            </Show>
          </p>
        )}
      </Show>
      <ul>
        <For each={props.plan.features}>{(feature) => <li>{feature}</li>}</For>
      </ul>
      <Show when={props.plan.per_seat && props.plan.purchasable}>
        <label class="seats">
          Seats
          <input
            type="number"
            min={props.plan.min_seats}
            max={500}
            value={seats()}
            onInput={(e) =>
              setSeats(Math.max(props.plan.min_seats, Number(e.currentTarget.value) || 0))
            }
          />
        </label>
      </Show>
      <Show when={props.plan.requires_verification}>
        <p class="muted small">Needs student or educator verification.</p>
      </Show>
      <Show
        when={props.plan.purchasable}
        fallback={<a href="mailto:sales@kothora.ai">Contact sales</a>}
      >
        <button class="primary" disabled={props.busy} onClick={() => props.onBuy(seats())}>
          {props.current ? "Renew" : "Choose"} {props.plan.name}
        </button>
      </Show>
    </article>
  )
}
