export * from './util/assign.js'
export * from './util/constant.js'
export * from './util/pipe.js'
export * from './util/tap.js'

export type Json =
    | null
    | boolean
    | number
    | string
    | Json[]
    | { [key: string]: Json };

export type Maybe<T> = T | null | undefined;
