import { constant } from './util.js'

export type ObserverCallbackState<T extends Element = HTMLElement> = {
    mutations: MutationRecord[];
    observer: MutationObserver;
    target: T;
    init: MutationObserverInit;
}

export type ObserverCallback = <T extends Element = HTMLElement>(state: ObserverCallbackState<T>) => unknown;

interface Observe {
    (target: Element, init: MutationObserverInit, callback: ObserverCallback): MutationObserver;
    (target: Element, callback: ObserverCallback): MutationObserver;
}

const INIT: MutationObserverInit = { childList: true, subtree: true }

export const done = constant(true)
export const resume = constant(false)

// a Mutation Observer wrapper without the boilerplate
export const observe: Observe = (
    target: Element,
    ...args: [MutationObserverInit, ObserverCallback] | [ObserverCallback]
) => {
    const [init, callback] = args.length === 1 ? [INIT, args[0]] : args

    const $callback: MutationCallback = (mutations, observer) => {
        observer.disconnect()

        const result = callback({ mutations, observer, target, init })

        if (!result) {
            observer.observe(target, init)
        }
    }

    const observer = new MutationObserver($callback)

    queueMicrotask(() => $callback([], observer))

    return observer
}
