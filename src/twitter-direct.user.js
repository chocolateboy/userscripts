// ==UserScript==
// @name          Twitter Direct
// @description   Remove t.co tracking links from Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.2.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://unpkg.com/@chocolateboy/uncommonjs@0.2.0
// @require       https://cdn.jsdelivr.net/npm/just-safe-set@2.1.0
// @run-at        document-start
// @inject-into   auto
// ==/UserScript==

const { set } = module.exports // grab the default export from just-safe-set

/*
 * the domain we expect metadata (JSON) to come from. if responses come from
 * this domain, we strip it before passing the document's URI to the transformer.
 */
const TWITTER_API = 'api.twitter.com'

/*
 * default locations to search for URL metadata (arrays of objects) within tweet
 * nodes
 */
const TWEET_PATHS = [
    'entities.media',
    'entities.urls',
    'extended_entities.media',
    'extended_entities.urls',
]

/*
 * default locations to search for URL metadata (arrays of objects) within
 * user/profile nodes
 */
const USER_PATHS = [
    'entities.description.urls',
    'entities.url.urls',
]

/*
 * an immutable array used in various places as a default value. reused to avoid
 * unnecessary allocations.
 */
const EMPTY_ARRAY = []

/*
 * paths into the JSON data in which we can find context objects, i.e. objects
 * which have an `entities` (and/or `extended_entities`) property which contains
 * URL metadata
 *
 * options:
 *
 *   - uri: optional URI filter: string (equality) or regex (match)
 *
 *   - root: a path (string or array) into the document under which to begin
 *     searching (required)
 *
 *   - collect: a function which takes a root node and turns it into an array of
 *     context nodes to scan for URL data (default: Object.values)
 *
 *   - scan: an array of paths to probe for arrays of { url, expanded_url }
 *     pairs in a context node (default: USER_PATHS)
 *
 *   - assign: an array of paths to string nodes in the context containing
 *     unexpanded URLs (e.g. for cards inside tweets). these are replaced with
 *     expanded URLs gathered during the scan (default: EMPTY_ARRAY)
 */
const QUERIES = [
    {
        uri: /\/users\/lookup\.json$/,
        root: [], // returns self
    },
    {
        uri: /\/Following$/,
        root: 'data.user.following_timeline.timeline.instructions.*.entries.*.content.itemContent.user.legacy',
    },
    {
        uri: /\/Followers$/,
        root: 'data.user.followers_timeline.timeline.instructions.*.entries.*.content.itemContent.user.legacy',
    },
    {
        // found in /graphql/<query-id>/UserByScreenName
        // used for hovercard data
        root: 'data.user.legacy',
        collect: Array.of,
    },
    {
        root: 'globalObjects.tweets',
        scan: TWEET_PATHS,
        assign: [
            'card.binding_values.card_url.string_value',
            'card.url',
        ],
    },
    {
        // spotted in list.json and all.json (used for hovercard data).
        // may exist in other documents
        root: 'globalObjects.tweets.*.card.users.*',
    },
    {
        root: 'globalObjects.users',
    },
]

/*
 * a pattern which matches the content-type header of responses we scan for
 * tweets: "application/json" or "application/json; charset=utf-8"
 */
const CONTENT_TYPE = /^application\/json\b/

/*
 * compatibility shim needed for Violentmonkey:
 * https://github.com/violentmonkey/violentmonkey/issues/997#issuecomment-637700732
 */
const Compat = { unsafeWindow }

/*
 * a function which takes an object and a path into that object (a string of
 * dot-separated property names or an array of property names) and returns the
 * value at that position within the object, or the (optional) default value if
 * it can't be reached.
 *
 * based on just-safe-get by Angus Croll [1] (which in turn is an implementation
 * of Lodash's function of the same name), but with added support for
 * wildcard props, e.g.:
 *
 *    foo.*.bar.baz.*.quux
 *
 * is roughly equivalent to:
 *
 *    obj.foo
 *        |> Object.values(#)
 *        |> #.flatMap(value => get(value, "bar.baz", []))
 *        |> Object.values(#)
 *        |> #.flatMap(value => get(value, "quux", []))
 *
 * [1] https://www.npmjs.com/package/just-safe-get
 */

// TODO release as an NPM module (just-safe-get is ES5 only, but this
// requires ES6 for Array#flatMap and Object.values, though both could be
// polyfilled
function get (obj, path, $default) {
    if (!obj) {
        return $default
    }

    let props, prop

    if (Array.isArray(path)) {
        props = Array.from(path) // clone
    } else if (typeof path === 'string') {
        props = path.split('.')
    } else {
        throw new Error('path must be an array or string')
    }

    while (props.length) {
        if (!obj) {
            return $default
        }

        prop = props.shift()

        if (prop === '*') {
            // Object.values is very forgiving and works with anything that
            // can be turned into an object via Object(...), i.e. everything
            // but undefined and null, which we've guarded against above.
            return Object.values(obj).flatMap(value => {
                return get(value, Array.from(props), EMPTY_ARRAY)
            })
        }

        obj = obj[prop]

        if (obj === undefined) {
            return $default
        }
    }

    return obj
}

/*
 * replace t.co URLs with the original URL in all locations within the document
 * which contain URLs
 */
function transformLinks (data, uri) {
    const stats = new Map()

    for (const query of QUERIES) {
        const wantUri = query.uri

        if (wantUri) {
            const match = (typeof wantUri === 'string')
                ? uri === wantUri
                : wantUri.test(uri)

            if (!match) {
                continue
            }
        }

        const root = get(data, query.root)

        // may be an array (e.g. lookup.json)
        if (!(root && (typeof root === 'object'))) {
            continue
        }

        const {
            collect = Object.values,
            scan = USER_PATHS,
            assign = EMPTY_ARRAY,
        } = query

        const contexts = collect(root)

        for (const context of contexts) {
            const cache = new Map()

            // scan the context nodes for { url, expanded_url } pairs, replace
            // each t.co URL with its expansion, and cache the mappings
            for (const path of scan) {
                const items = get(context, path, [])

                for (const item of items) {
                    cache.set(item.url, item.expanded_url)
                    item.url = item.expanded_url
                    stats.set(query.root, (stats.get(query.root) || 0) + 1)
                }
            }

            // now pinpoint isolated URLs in the context which don't have a
            // corresponding expansion, and replace them using the mappings we
            // created during the scan
            for (const path of assign) {
                const url = get(context, path)

                if (typeof url === 'string') {
                    const expandedUrl = cache.get(url)

                    if (expandedUrl) {
                        set(context, path, expandedUrl)
                        stats.set(query.root, (stats.get(query.root) || 0) + 1)
                    }
                }
            }
        }
    }

    if (stats.size) {
        // format: "expanded 1 URL in "a.b" and 2 URLs in "c.d" in /2/example.json"
        const summary = Array.from(stats).map(([path, count]) => {
            const quantity = count === 1 ? '1 URL' : `${count} URLs`
            return `${quantity} in ${JSON.stringify(path)}`
        }).join(' and ')

        console.debug(`expanded ${summary} in ${uri}`)
    }

    return data
}

/*
 * parse and transform the JSON response, handling (catching and logging) any
 * errors
 */
function transformResponse (json, path) {
    let parsed

    try {
        parsed = JSON.parse(json)
    } catch (e) {
        console.error("Can't parse response:", e)
        return
    }

    let transformed

    try {
        transformed = transformLinks(parsed, path)
    } catch (e) {
        console.error('Error transforming JSON:', e)
        return
    }

    return transformed
}

/*
 * replacement for Twitter's default response handler. we transform the response
 * if it's a) JSON and b) contains URL data; otherwise, we leave it unchanged
 */
function onReadyStateChange (xhr, url) {
    const contentType = xhr.getResponseHeader('Content-Type')

    if (!CONTENT_TYPE.test(contentType)) {
        return
    }

    const parsed = new URL(url)
    const path = parsed.hostname === TWITTER_API ? parsed.pathname : parsed.origin + parsed.pathname
    const transformed = transformResponse(xhr.responseText, path)

    if (transformed) {
        const descriptor = { value: JSON.stringify(transformed) }
        const clone = Compat.cloneInto(descriptor, Compat.unsafeWindow)
        Compat.unsafeWindow.Object.defineProperty(xhr, 'responseText', clone)
    }
}

/*
 * replace the built-in XHR#send method with our custom version which swaps in
 * our custom response handler. once done, we delegate to the original handler
 * (this.onreadystatechange)
 */
function hookXHRSend (oldSend) {
    return function send () {
        const oldOnReadyStateChange = this.onreadystatechange

        this.onreadystatechange = function () {
            if (this.readyState === this.DONE && this.responseURL && this.status === 200) {
                onReadyStateChange(this, this.responseURL)
            }

            oldOnReadyStateChange.apply(this, arguments)
        }

        return oldSend.apply(this, arguments)
    }
}

/*
 * set up a cross-engine API to shield us from differences between engines so we
 * don't have to clutter the code with conditionals.
 *
 * XXX the functions are only needed by Violentmonkey for Firefox, and are
 * no-ops in other engines
 */
if ((typeof cloneInto === 'function') && (typeof exportFunction === 'function')) {
    // Greasemonkey 4 (Firefox) and Violentmonkey (Firefox + Chrome)
    Object.assign(Compat, { cloneInto, exportFunction })

    // Violentmonkey for Firefox
    if (unsafeWindow.wrappedJSObject) {
        Compat.unsafeWindow = unsafeWindow.wrappedJSObject
    }
} else {
    Compat.cloneInto = Compat.exportFunction = value => value
}

/*
 * replace the default XHR#send with our custom version, which scans responses
 * for tweets and expands their URLs
 */
console.debug('hooking XHR#send:', Compat.unsafeWindow.XMLHttpRequest.prototype.send)

Compat.unsafeWindow.XMLHttpRequest.prototype.send = Compat.exportFunction(
    hookXHRSend(window.XMLHttpRequest.prototype.send),
    Compat.unsafeWindow
)
