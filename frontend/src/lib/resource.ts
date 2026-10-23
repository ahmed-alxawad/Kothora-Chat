import { createResource, type Accessor } from "solid-js"

/**
 * Like Solid's createResource, but reading it never throws. A failed load gives
 * `undefined` and sets `.error`; screens check `.error` to show "could not load" or
 * "not available on this server yet". (Reading a plain resource after a failed fetch
 * throws, which would take down the whole screen, not just the part that needed it.)
 */
export type SafeResource<T> = {
  (): T | undefined
  readonly error: unknown
  readonly loading: boolean
}

export type SafeResourceActions<T> = {
  mutate: (next: T | undefined | ((previous: T | undefined) => T | undefined)) => void
  refetch: () => void
}

type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown }

export function safeResource<T>(
  fetcher: () => Promise<T>,
): [SafeResource<T>, SafeResourceActions<T>]
export function safeResource<T, S>(
  source: Accessor<S | false | null | undefined>,
  fetcher: (source: S) => Promise<T>,
): [SafeResource<T>, SafeResourceActions<T>]
export function safeResource<T, S>(
  first: Accessor<S | false | null | undefined> | (() => Promise<T>),
  second?: (source: S) => Promise<T>,
): [SafeResource<T>, SafeResourceActions<T>] {
  const run = async (load: () => Promise<T>): Promise<Outcome<T>> => {
    try {
      return { ok: true, value: await load() }
    } catch (error) {
      return { ok: false, error }
    }
  }
  const [outcome, actions] = second
    ? createResource(first as Accessor<S | false | null | undefined>, (source: S) =>
        run(() => second(source)),
      )
    : createResource(() => run(first as () => Promise<T>))

  const read = (() => {
    const current = outcome()
    return current?.ok ? current.value : undefined
  }) as SafeResource<T>
  Object.defineProperties(read, {
    error: {
      get: () => {
        const current = outcome()
        return current && !current.ok ? current.error : undefined
      },
    },
    loading: { get: () => outcome.loading },
  })

  return [
    read,
    {
      mutate: (next) =>
        actions.mutate((previous) => {
          const before = previous?.ok ? previous.value : undefined
          const value =
            typeof next === "function"
              ? (next as (p: T | undefined) => T | undefined)(before)
              : next
          return value === undefined ? previous : { ok: true, value }
        }),
      refetch: () => void actions.refetch(),
    },
  ]
}
