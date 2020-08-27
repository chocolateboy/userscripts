// ==UserScript==
// @name          Twitter Direct
// @description   Remove t.co tracking links from Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.4.2
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://unpkg.com/@chocolateboy/uncommonjs@2.0.1
// @require       https://cdn.jsdelivr.net/npm/just-safe-set@2.1.0
// @run-at        document-start
// @inject-into   auto
// ==/UserScript==

/*
 * the domain we expect data (JSON) to come from. responses that aren't from
 * this domain are ignored.
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
 * an immutable array used in various places as a way to indicate "no values".
 * static to avoid unnecessary allocations.
 */
const NONE = []

/*
 * paths into the JSON data in which we can find context objects, i.e. objects
 * which have an `entities` (and/or `extended_entities`) property which contains
 * URL metadata
 *
 * options:
 *
 *   - uri: optional URI filter: string (equality) or regex (match)
 *
 *   - root (required): a path (string or array) into the document under which
 *     to begin searching
 *
 *   - collect (default: Object.values): a function which takes a root node and
 *     turns it into an array of context nodes to scan for URL data
 *
 *   - scan (default: USER_PATHS): an array of paths to probe for arrays of
 *     { url, expanded_url } pairs in a context node
 *
 *   - targets (default: NONE): an array of paths to standalone URLs (URLs that
 *     don't have an accompanying expansion), e.g. for URLs in cards embedded in
 *     tweets. these URLs are replaced by expanded URLs gathered during the
 *     scan. target paths can point directly to a URL node (string) or to an
 *     array of objects. in the latter case, we find the URL object in the array
 *     (.key == "card_url") and replace its URL node (obj.value.string_value)
 */
const QUERIES = [
    {
        uri: /\/users\/lookup\.json$/,
        root: [], // returns self
    },
    {
        uri: /\/Conversation$/,
        root: 'data.conversation_timeline.instructions.*.moduleItems.*.item.itemContent.tweet.core.user.legacy',
    },
    {
        uri: /\/Conversation$/,
        root: 'data.conversation_timeline.instructions.*.moduleItems.*.item.itemContent.tweet.legacy',
        scan: TWEET_PATHS,
        targets: ['card.binding_values', 'card.url'],
    },
    {
        uri: /\/Conversation$/,
        root: 'data.conversation_timeline.instructions.*.entries.*.content.items.*.item.itemContent.tweet.legacy',
        scan: TWEET_PATHS,
        targets: ['card.binding_values', 'card.url'],
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
        // spotted in list.json and all.json (used for hovercard data).
        // may exist in other documents
        root: 'globalObjects.tweets.*.card.users.*',
    },
    {
        root: 'globalObjects.users',
    },
    {
        root: 'globalObjects.tweets',
        scan: TWEET_PATHS,
        targets: ['card.binding_values.card_url.string_value', 'card.url'],
    },
    {
        // DMs (/dm/conversation/<id>.json)
        root: 'conversation_timeline.entries.*.message.message_data',
        scan: TWEET_PATHS,
        targets: [
            'attachment.card.binding_values.card_url.string_value',
            'attachment.card.url',
        ],
    },
    {   // DMs (/dm/user_updates.json and /dm/inbox_initial_state.json)
        root: 'inbox_initial_state.entries.*.message.message_data',
        scan: TWEET_PATHS,
        targets: [
            'attachment.card.binding_values.card_url.string_value',
            'attachment.card.url',
        ],
    },
]

/*
 * a pattern which matches the content-type header of responses we scan for
 * URLs: "application/json" or "application/json; charset=utf-8"
 */
const CONTENT_TYPE = /^application\/json\b/

/*
 * compatibility shim needed for Violentmonkey for Firefox and Greasemonkey 4:
 * https://github.com/violentmonkey/violentmonkey/issues/997#issuecomment-637700732
 */
const GMCompat = { unsafeWindow }

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
        props = path.slice(0) // clone
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
                return get(value, props.slice(0), NONE)
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
 * replace t.co URLs with the original URL in all locations in the document
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
            targets = NONE,
        } = query

        const contexts = collect(root)

        for (const context of contexts) {
            const cache = new Map()

            // scan the context nodes for { url, expanded_url } pairs, replace
            // each t.co URL with its expansion, and cache the mappings
            for (const path of scan) {
                const items = get(context, path, NONE)

                for (const item of items) {
                    cache.set(item.url, item.expanded_url)
                    item.url = item.expanded_url
                    stats.set(query.root, (stats.get(query.root) || 0) + 1)
                }
            }

            // now pinpoint isolated URLs in the context which don't have a
            // corresponding expansion, and replace them using the mappings we
            // collected during the scan
            for (const target of targets) {
                let url, $context = context, $target = target

                const node = get(context, target)

                // if the target points to an array rather than a string, locate
                // the URL object within the array automatically
                if (Array.isArray(node)) {
                    if ($context = node.find(it => it.key === 'card_url')) {
                        $target = 'value.string_value'
                        url = get($context, $target)
                    }
                } else {
                    url = node
                }

                if (typeof url === 'string') {
                    const expandedUrl = cache.get(url)

                    if (expandedUrl) {
                        exports.set($context, $target, expandedUrl)
                        stats.set(query.root, (stats.get(query.root) || 0) + 1)
                    }
                }
            }
        }
    }

    if (stats.size) {
        // format: "expanded 1 URL in "a.b" and 2 URLs in "c.d" in /2/example.json"
        const summary = Array.from(stats).map(([path, count]) => {
            const urls = count === 1 ? '1 URL' : `${count} URLs`
            return `${urls} in ${JSON.stringify(path)}`
        }).join(' and ')

        console.debug(`expanded ${summary} in ${uri}`)
    }

    return data
}

/*
 * parse and transform a JSON response, handling (catching and logging) any
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

    // exclude e.g. the config-<date>.json file from pbs.twimg.com, which is the
    // second biggest document (~500K) after home_latest.json (~700K)
    if (parsed.hostname !== TWITTER_API) {
        return
    }

    const transformed = transformResponse(xhr.responseText, parsed.pathname)

    if (transformed) {
        const descriptor = { value: JSON.stringify(transformed) }
        const clone = GMCompat.cloneInto(descriptor, GMCompat.unsafeWindow)
        GMCompat.unsafeWindow.Object.defineProperty(xhr, 'responseText', clone)
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
 * XXX the functions are only needed by Violentmonkey for Firefox and
 * Greasemonkey 4, though Violentmonkey for Chrome also defines them (as
 * identity functions) for compatibility
 */
if ((typeof cloneInto === 'function') && (typeof exportFunction === 'function')) {
    Object.assign(GMCompat, { cloneInto, exportFunction })

    // Violentmonkey for Firefox
    if (unsafeWindow.wrappedJSObject) {
        GMCompat.unsafeWindow = unsafeWindow.wrappedJSObject
    }
} else {
    GMCompat.cloneInto = value => value

    // we don't use the third argument, but may as well define this correctly in
    // case we break this out into a separate helper.
    //
    // this is the same implementation as Violentmonkey's compatibility shim for
    // Chrome: https://git.io/JJziH
    GMCompat.exportFunction = (fn, target, { defineAs } = {}) => {
        if (defineAs) {
            target[defineAs] = fn
        }

        return fn
    }
}

/*
 * replace the default XHR#send with our custom version, which scans responses
 * for tweets and expands their URLs
 */
GMCompat.unsafeWindow.XMLHttpRequest.prototype.send = GMCompat.exportFunction(
    hookXHRSend(window.XMLHttpRequest.prototype.send),
    GMCompat.unsafeWindow
)
