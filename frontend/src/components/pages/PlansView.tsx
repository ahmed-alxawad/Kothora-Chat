import { createSignal, For, Show } from "solid-js"
import { safeResource } from "../../lib/resource"
import { api } from "../../lib/api"
import { formatBdt } from "../../lib/format"
import type { BillingCycle, Plan, Usage } from "../../lib/types"
import { Icon } from "../ui/Icon"

const CYCLES: { id: BillingCycle; label: string; saving?: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly", saving: "10% off" },
  { id: "yearly", label: "Yearly", saving: "15% off" },
]

const PAYMENT_MESSAGES: Record<string, string> = {
  paid: "Payment received. Your plan is active.",
  pending: "Your payment is being confirmed. Your plan updates here once it clears.",
  review: "Your payment is under review. We will email you once it clears.",
  failed: "The payment did not go through, and you were not charged.",
  cancelled: "Payment cancelled. You were not charged.",
}

const INDIVIDUAL = ["basic", "pro", "premium", "education"]
const TEAM = ["business_basic", "business_premium", "enterprise"]
const RECOMMENDED = "pro"

export function PlansView(props: { usage: Usage | undefined; paymentResult: string | null }) {
  const [plans] = safeResource(api.plans)
  const [cycle, setCycle] = createSignal<BillingCycle>("monthly")
  const [audience, setAudience] = createSignal<"individual" | "team">("individual")
  const [error, setError] = createSignal("")
  const [busyPlan, setBusyPlan] = createSignal<string | null>(null)

  const shown = () => {
    const ids = audience() === "individual" ? INDIVIDUAL : TEAM
    return (plans() ?? []).filter((plan) => ids.includes(plan.id))
  }

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
    <div class="plans-page">
      <header class="plans-head">
        <h1>Plans that fit how you use Kothora</h1>
        <p>
          Prices in taka. Pay with bKash, Nagad, Rocket, a card or net banking through SSLCommerz.
        </p>
      </header>

      <Show when={props.paymentResult}>
        {(result) => (
          <p class="banner" role="status">
            {PAYMENT_MESSAGES[result()] ?? PAYMENT_MESSAGES.failed}
          </p>
        )}
      </Show>
      <Show when={error()}>
        <p class="banner error" role="alert">
          {error()}
        </p>
      </Show>

      <div class="plans-controls">
        <div class="segmented" role="radiogroup" aria-label="Who the plan is for">
          <button
            type="button"
            role="radio"
            aria-checked={audience() === "individual"}
            classList={{ active: audience() === "individual" }}
            onClick={() => setAudience("individual")}
          >
            Personal
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={audience() === "team"}
            classList={{ active: audience() === "team" }}
            onClick={() => setAudience("team")}
          >
            Teams
          </button>
        </div>
        <div class="segmented" role="radiogroup" aria-label="Billing cycle">
          <For each={CYCLES}>
            {(option) => (
              <button
                type="button"
                role="radio"
                aria-checked={cycle() === option.id}
                classList={{ active: cycle() === option.id }}
                onClick={() => setCycle(option.id)}
              >
                {option.label}
                <Show when={option.saving}>
                  <span class="saving">{option.saving}</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={plans.error}>
        <p class="banner error">Could not load plans. {String(plans.error)}</p>
      </Show>
      <div class="plan-grid">
        <For each={shown()}>
          {(plan) => (
            <PlanCard
              plan={plan}
              cycle={cycle()}
              current={props.usage?.plan_id === plan.id}
              recommended={plan.id === RECOMMENDED}
              busy={busyPlan() === plan.id}
              onBuy={(seats) => buy(plan, seats)}
            />
          )}
        </For>
      </div>
      <p class="plans-foot">
        Wallet payments do not renew on their own. Renew from this page before your period ends.
      </p>
    </div>
  )
}

function PlanCard(props: {
  plan: Plan
  cycle: BillingCycle
  current: boolean
  recommended: boolean
  busy: boolean
  onBuy: (seats: number) => void
}) {
  const [seats, setSeats] = createSignal(props.plan.min_seats)
  const price = () => props.plan.prices.find((p) => p.cycle === props.cycle)
  const total = () => (price()?.total_bdt ?? 0) * (props.plan.per_seat ? seats() : 1)

  return (
    <article
      class="plan-card"
      classList={{ current: props.current, recommended: props.recommended }}
    >
      <header>
        <h2>{props.plan.name}</h2>
        <Show when={props.recommended && !props.current}>
          <span class="badge">Most popular</span>
        </Show>
        <Show when={props.current}>
          <span class="badge current">Your plan</span>
        </Show>
      </header>
      <p class="plan-audience">{props.plan.audience}</p>
      <Show when={price()} fallback={<p class="plan-price">Custom pricing</p>}>
        {(p) => (
          <div class="plan-price">
            <span class="amount numeric">{formatBdt(p().per_month_bdt)}</span>
            <span class="per">/ month{props.plan.per_seat ? " per seat" : ""}</span>
            <Show when={props.cycle !== "monthly"}>
              <span class="billed numeric">
                {formatBdt(total())} billed {props.cycle === "yearly" ? "yearly" : "every 3 months"}
              </span>
            </Show>
          </div>
        )}
      </Show>
      <Show when={props.plan.per_seat && props.plan.purchasable}>
        <label class="seats" for={`seats-${props.plan.id}`}>
          Seats
          <input
            id={`seats-${props.plan.id}`}
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
      <Show
        when={props.plan.purchasable}
        fallback={<p class="contact">Email sales@kothora.ai for a quote.</p>}
      >
        <button
          type="button"
          class={props.recommended ? "primary block" : "secondary block"}
          disabled={props.busy}
          onClick={() => props.onBuy(seats())}
        >
          {props.busy ? "Opening checkout…" : props.current ? "Renew" : `Get ${props.plan.name}`}
        </button>
      </Show>
      <ul class="plan-features">
        <For each={props.plan.features}>
          {(feature) => (
            <li>
              <Icon name="check" size={16} />
              <span>{feature}</span>
            </li>
          )}
        </For>
      </ul>
      <Show when={props.plan.requires_verification}>
        <p class="plan-note">Needs student or educator verification.</p>
      </Show>
    </article>
  )
}
