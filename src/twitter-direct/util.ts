export type Json =
    | null
    | boolean
    | number
    | string
    | Array<Json>
    | { [key: string]: Json };

export type Dict = Record<string, Json>;
export type JsonObject = Dict | Array<Json>;

type TypeMap = {
    'bigint':    bigint;
    'boolean':   boolean;
    'function':  Function;
    'null':      null;
    'number':    number;
    'object':    object;
    'string':    string;
    'symbol':    symbol;
    'undefined': undefined;
}

/*
 * return true if the supplied value is an array or plain object, false otherwise
 */
export const isObject = (value: unknown): value is JsonObject => !!value && (typeof value === 'object')

/*
 * return true if the supplied value is a plain object, false otherwise
 *
 * only used with JSON data, so doesn't need to be foolproof
 */
export const isPlainObject = (function () {
    const toString = {}.toString
    return (value: unknown): value is Dict => toString.call(value) === '[object Object]'
})()

const typeOf = (value: unknown) => value === null ? 'null' : typeof value

const isType = <T extends keyof TypeMap>(type: T) => {
    return <U extends TypeMap[T] = TypeMap[T]>(value: unknown): value is U => {
        return typeOf(value) === type
    }
}

export const isString = isType('string')
export const isNumber = isType('number')
