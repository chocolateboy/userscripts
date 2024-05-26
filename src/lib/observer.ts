// an empty array of mutations, used for initial/simulated mutation callbacks
const DUMMY_MUTATIONS: MutationRecord[] = []

// like MutationCallback, but with an optional return type rather than void
type ObserveCallback = (mutations: MutationRecord[], observer: MutationObserver) => unknown;

interface Observe {
    (target: Element, init: MutationObserverInit, callback: ObserveCallback): MutationObserver;
    (target: Element, callback: ObserveCallback): MutationObserver;
}

const INIT: MutationObserverInit = { childList: true, subtree: true }

// a Mutation Observer wrapper without the boilerplate
export const observe: Observe = (
    target: Element,
    ...args: [MutationObserverInit, ObserveCallback] | [ObserveCallback]
) => {
    const [init, callback] = args.length === 1 ? [INIT, args[0]] : args

    const $callback: MutationCallback = (mutations, observer) => {
        observer.disconnect()

        const result = callback(mutations, observer)

        if (!result) {
            observer.observe(target, init)
        }
    }

    const observer = new MutationObserver($callback)

    queueMicrotask(() => $callback(DUMMY_MUTATIONS, observer))

    return observer
}
