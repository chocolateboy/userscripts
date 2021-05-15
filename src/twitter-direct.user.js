// ==UserScript==
// @name          Twitter Direct
// @description   Remove t.co tracking links from Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.0.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @run-at        document-start
// ==/UserScript==

/*
 * a pattern which matches the content-type header of responses we scan for
 * URLs: "application/json" or "application/json; charset=utf-8"
 */
const CONTENT_TYPE = /^application\/json\b/

/*
 * document keys under which t.co URL nodes can be found when the document is a
 * plain object. not used when the document is an array.
 *
 * some populous top-level paths don't contain t.co URLs, e.g. $.timeline.
 */
const DOCUMENT_ROOTS = [
    'data',
    'globalObjects',
    'inbox_initial_state',
    'users',
]

/*
 * the minimum size (in bytes) of documents we deem to be "not small"
 *
 * we log (to the console) misses (i.e. no URLs ever found/replaced) in
 * documents whose size is greater than or equal to this value
 */
const LOG_THRESHOLD = 1024

/*
 * nodes under these keys don't contain t.co URLs so we can speed up traversal
 * by pruning (not descending) them
 */
const PRUNE_KEYS = new Set([
    'ext_media_color',
    'features',
    'hashtags',
    'original_info',
    'player_image_color',
    'profile_banner_extensions',
    'profile_banner_extensions_media_color',
    'profile_image_extensions',
    'sizes',
])

/*
 * a map from URI paths (strings) to the replacement count for each path. used
 * to keep a running total of the number of replacements in each document type
 */
const STATS = {}

/*
 * the domain intercepted links are routed through
 *
 * not all links are intercepted. exceptions include links to twitter (e.g.
 * https://twitter.com) and card URIs (e.g. card://123456)
 */
const TRACKING_DOMAIN = 't.co'

/*
 * a pattern which matches the domain(s) we expect data (JSON) to come from.
 * responses which don't come from a matching domain are ignored.
 */
const TWITTER_API = /^(?:(?:api|mobile)\.)?twitter\.com$/

/*
 * a list of document paths which are known to not contain t.co URLs and which
 * therefore don't need to be processed
 */
const URL_BLACKLIST = new Set([
    '/i/api/2/badge_count/badge_count.json',
    '/i/api/graphql/TopicToFollowSidebar',
])

/*
 * object keys whose corresponding values may contain t.co URLs
 */
const URL_KEYS = new Set(['url', 'string_value'])

/*
 * return a truthy value (a URL instance) if the supplied value is a valid
 * URL (string), falsey otherwise
 */
const checkUrl = value => {
    let url

    if (typeof value === 'string') {
        try {
            url = new URL(value)
        } catch {}
    }

    return url
}

/*
 * replace the built-in XHR#send method with a custom version which swaps in our
 * custom response handler. once done, we delegate to the original handler
 * (this.onreadystatechange)
 */
const hookXHRSend = oldSend => {
    return /** @this {XMLHttpRequest} */ function send (body = null) {
        const oldOnReadyStateChange = this.onreadystatechange

        this.onreadystatechange = function (event) {
            if (this.readyState === this.DONE && this.responseURL && this.status === 200) {
                onResponse(this, this.responseURL)
            }

            if (oldOnReadyStateChange) {
                oldOnReadyStateChange.call(this, event)
            }
        }

        oldSend.call(this, body)
    }
}

/*
 * returns true if the supplied value is a plain object,
 * false otherwise
 *
 * only used with JSON data, so doesn't need to be foolproof
 */
const isPlainObject = (function () {
    const toString = {}.toString
    return value => toString.call(value) === '[object Object]'
})()

/*
 * return true if the domain of the supplied URL (string) is t.co, false
 * otherwise
 */
const isTracked = value => checkUrl(value)?.hostname === TRACKING_DOMAIN

/*
 * replacement for Twitter's default handler for XHR requests. we transform the
 * response if it's a) JSON and b) contains URL data; otherwise, we leave it
 * unchanged
 */
const onResponse = (xhr, uri) => {
    const contentType = xhr.getResponseHeader('Content-Type')

    if (!CONTENT_TYPE.test(contentType)) {
        return
    }

    const url = new URL(uri)

    // exclude e.g. the config-<date>.json file from pbs.twimg.com, which is the
    // second biggest document (~500K) after home_latest.json (~700K)
    if (!TWITTER_API.test(url.hostname)) {
        return
    }

    const json = xhr.responseText
    const size = json.length

    // fold paths which differ only in the user or query ID, e.g.:
    //
    //   /2/timeline/profile/1234.json    -> /2/timeline/profile.json
    //   /i/api/graphql/abc123/UserTweets -> /i/api/graphql/UserTweets
    //
    const path = url.pathname
        .replace(/\/\d+\.json$/, '.json')
        .replace(/^(.+?\/graphql\/)[^\/]+\/(.+)$/, '$1$2')

    if (URL_BLACKLIST.has(path)) {
        return
    }

    let data

    try {
        data = JSON.parse(json)
    } catch (e) {
        console.error(`Can't parse JSON for ${uri}:`, e)
        return
    }

    const newPath = !(path in STATS)
    const count = transform(data, path)

    STATS[path] = (STATS[path] || 0) + count

    if (!count) {
        if (!STATS[path] && size > LOG_THRESHOLD) {
            console.debug(`no replacements in ${path} (${size} B)`)
        }

        return
    }

    const descriptor = { value: JSON.stringify(data) }
    const clone = GMCompat.export(descriptor)

    GMCompat.unsafeWindow.Object.defineProperty(xhr, 'responseText', clone)

    const replacements = 'replacement' + (count === 1 ? '' : 's')

    console.debug(`${count} ${replacements} in ${path} (${size} B)`)

    if (newPath) {
        console.log(STATS)
    }
}

/*
 * JSON.stringify +replace+ function used by +transform+ to traverse documents
 * and update their URL nodes in place.
 */
const replacerFor = state => /** @this {any} */ function replacer (key, value) {
    if (PRUNE_KEYS.has(key)) {
        return null // a terminal value to stop traversal
    }

    if (URL_KEYS.has(key) && isTracked(value)) {
        const { seen, unresolved } = state
        const expandedUrl = checkUrl(this.expanded_url || this.expanded)

        if (expandedUrl) {
            seen.set(value, expandedUrl)
            this[key] = expandedUrl
            ++state.count
        } else if (seen.has(value)) {
            this[key] = seen.get(value)
            ++state.count
        } else {
            let targets = unresolved.get(value)

            if (!targets) {
                unresolved.set(value, targets = [])
            }

            targets.push({ target: this, key })
        }
    }

    return value
}

/*
 * replace t.co URLs with the original URL in all locations in the document
 * which may contain them
 *
 * returns the number of substituted URLs
 */
const transform = (data, path) => {
    const seen = new Map()
    const unresolved = new Map()
    const state = { count: 0, seen, unresolved }
    const replacer = replacerFor(state)

    if (Array.isArray(data)) {
        JSON.stringify(data, replacer)
    } else if (data) {
        for (const key of DOCUMENT_ROOTS) {
            if (key in data) {
                JSON.stringify(data[key], replacer)
            }
        }
    }

    for (const [url, targets] of unresolved) {
        const expandedUrl = seen.get(url)

        if (expandedUrl) {
            for (const target of targets) {
                target.target[target.key] = expandedUrl
                ++state.count
            }

            unresolved.delete(url)
        }
    }

    if (unresolved.size) {
        console.warn(`unresolved URIs (${path}):`, Object.fromEntries(state.unresolved))
    }

    return state.count
}

/*
 * replace the default XHR#send with our custom version, which scans responses
 * for tweets and expands their URLs
 */
const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype

xhrProto.send = GMCompat.export(hookXHRSend(xhrProto.send))
