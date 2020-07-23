// ==UserScript==
// @name          Twitter Direct
// @description   Remove t.co tracking links from Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.1.2
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://unpkg.com/@chocolateboy/uncommonjs@0.2.0
// @require       https://cdn.jsdelivr.net/npm/just-safe-get@2.0.0
// @run-at        document-start
// @inject-into   auto
// ==/UserScript==

const { get } = module.exports // grab the default export from just-safe-get

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
 * paths into the JSON data in which we can find context objects, i.e. objects
 * which have an `entities` (and/or `extended_entities`) property which contains
 * URL metadata
 */
const SCHEMAS = [
    {
        match: /\/users\/lookup\.json$/,
        root: [], // returns self
    },
    {
        // found in /graphql/<query-id>/UserByScreenName
        // used for hovercard data
        root: 'data.user.legacy',
        collect: Array.of,
    },
    {
        root: 'globalObjects.tweets',
        paths: TWEET_PATHS
    },
    {
        // spotted in list.json (used for hovercard data).
        // may exist in some/all other tweet objects
        root: 'globalObjects.tweets',
        collect: fetchTweetUsers,
    },
    {
        root: 'globalObjects.users'
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
 * given a root node located at:
 *
 *     globalObjects.tweets // { tweet ID => tweet, ... }
 *
 * return an array of its nested user objects located at:
 *
 *    globalObjects.tweets.*.card.users.* // { user ID => user, ... }
 *
 * if the subtree doesn't exist, return an empty array
 */
function fetchTweetUsers (root, _uri) {
    const tweets = Object.values(root)

    return tweets.flatMap(tweet => {
        const users = get(tweet, 'card.users', {})
        return Object.values(users)
    })
}

/*
 * replace t.co URLs with the original URL in all locations within the document
 * which contain URL data
 */
function transformLinks (data, uri) {
    for (const schema of SCHEMAS) {
        const want = schema.match

        if (want) {
            const match = (typeof want === 'string') ? uri === want : want.test(uri)

            if (!match) {
                continue
            }
        }

        const root = get(data, schema.root)

        if (!(root && (typeof root === 'object'))) { // may be an array (e.g. lookup.json)
            continue
        }

        const { collect = Object.values, paths = USER_PATHS } = schema
        const contexts = collect(root)

        let count = 0

        for (const context of contexts) {
            for (const path of paths) {
                const items = get(context, path, [])

                for (const item of items) {
                    item.url = item.expanded_url
                    ++count
                }
            }
        }

        if (count) {
            const quantity = count === 1 ? '1 URL' : `${count} URLs`
            console.debug(`replaced ${quantity} in ${uri}`)
        }
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
        console.error('error transforming JSON:', e)
        return
    }

    return transformed
}

/*
 * replacement for Twitter's default response handler. we transform the response
 * if it's a) JSON and b) contains tweet data; otherwise, we leave it unchanged
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
