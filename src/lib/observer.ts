import { constant } from './util'

export type ObserverCallbackState<T extends Element> = {
    mutations: MutationRecord[];
    observer: MutationObserver;
    target: T;
    init: MutationObserverInit;
}

export type ObserverCallback<T extends Element = Element> = (state: ObserverCallbackState<T>) => unknown;

interface Observe {
    <T extends Element>(target: T, init: MutationObserverInit, callback: ObserverCallback<T>): MutationObserver;
    <T extends Element>(target: T, callback: ObserverCallback<T>): MutationObserver;
    (init: MutationObserverInit, callback: ObserverCallback<HTMLBodyElement>): MutationObserver;
    (callback: ObserverCallback<HTMLBodyElement>): MutationObserver;
}

type ObserveArgs =
    | [Element, MutationObserverInit, ObserverCallback]
    | [Element, ObserverCallback]
    | [MutationObserverInit, ObserverCallback]
    | [ObserverCallback]

const INIT: MutationObserverInit = { childList: true, subtree: true }

export const done = constant(false)
export const resume = constant(true)

// a Mutation Observer wrapper without the boilerplate
export const observe = <Observe>((...args: ObserveArgs) => {
    const $ = document

    const [target, init, callback] =
        args.length === 3 ? args :
        args.length === 2 ? (
            args[0] instanceof Element ?
                [args[0], INIT, args[1]] :
                [$.body, args[0], args[1]]
        ) :
        [$.body, INIT, args[0]]

    const $callback: MutationCallback = (mutations, observer) => {
        observer.disconnect()

        const resume = callback({ mutations, observer, target, init })

        if (resume !== false) {
            observer.observe(target, init)
        }
    }

    const observer = new MutationObserver($callback)

    queueMicrotask(() => $callback([], observer))

    return observer
})
