export const tap = <T>(value: T, fn: (value: T) => void) => (fn(value), value)
