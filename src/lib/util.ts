export type Json =
    | null
    | boolean
    | number
    | string
    | Json[]
    | { [key: string]: Json };

export type Maybe<T> = T | null | undefined;

export const constant = <const T>(value: T) => (..._args: unknown[]) => value
export const pipe = <T, U>(value: T, fn: (value: T) => U) => fn(value)
export const tap = <T>(value: T, fn: (value: T) => void) => (fn(value), value)
