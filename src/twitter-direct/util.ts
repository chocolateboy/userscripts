export type Json =
    | null
    | boolean
    | number
    | string
    | Array<Json>
    | { [key: string]: Json };

export type Dict = Record<string, Json>;
export type JsonObject = Dict | Array<Json>;

export type TypeMap = {
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
 * return a truthy value (the URL itself) if the supplied value is a valid URL
 * (string), falsey otherwise
 */
export const checkUrl = (function () {
    // this is faster than using the URL constructor (in v8), which incurs
    // the overhead of using a try/catch block
    const urlPattern = /^https?:\/\/\w/i

    // no need to coerce the value to a string as RegExp#test does that
    // automatically
    //
    // https://tc39.es/ecma262/#sec-regexp.prototype.test
    return (value: unknown) => urlPattern.test(value as string) && value as string
})()

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

/*
 * return true if the supplied value is a t.co URL (string), false otherwise
 */
export const isTrackedUrl = (function () {
    // this is faster (in v8) than using the URL constructor (and a try/catch
    // block)
    const urlPattern = /^https?:\/\/t\.co\/\w+$/

    // no need to coerce the value to a string as RegExp#test does that
    // automatically
    return (value: unknown): value is string => urlPattern.test(value as string)
})()
