export type Json =
    | null
    | boolean
    | number
    | string
    | Json[]
    | { [key: string]: Json };

export type Maybe<T> = T | null | undefined;

interface Update {
    <T extends {}>(target: T, ...sources: Partial<T>[]): T;
}

// strict Object.assign
export const { assign } = Object as { assign: Update }
export { assign as update }

export const constant = <const T>(value: T) => (..._args: unknown[]) => value
export const pipe = <T, U>(value: T, fn: (value: T) => U) => fn(value)
export const tap = <T>(value: T, fn: (value: T) => void) => (fn(value), value)
