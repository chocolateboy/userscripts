export const pipe = <T, U>(value: T, fn: (value: T) => U) => fn(value)
