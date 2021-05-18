// ==UserScript==
// @name          Twitter Direct
// @description   Remove t.co tracking links from Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.1.1
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
 * some densely-populated top-level paths don't contain t.co URLs, e.g.
 * $.timeline.
 */
const DOCUMENT_ROOTS = [
    'data',
    'globalObjects',
    'inbox_initial_state',
    'users',
]

/*
 * keys of "legacy" objects which URL data is known to be found in/under,
 * e.g. we're interested in legacy.user_refs.*, legacy.retweeted_status.* and
 * legacy.url, but not in legacy.created_at or legacy.reply_count etc.
 *
 * objects under the "legacy" key typically contain dozens of keys, but we only
 * need to probe/traverse a handful to find t.co URLs.
 *
 * typically this reduces the number of keys to iterate in a legacy object from
 * 30 on average (max 39) to 2 or 3
 */
const LEGACY_KEYS = [
    'binding_values',
    'entities',
    'extended_entities',
    'quoted_status_permalink',
    'retweeted_status',
    'user_refs',
]

/*
 * the minimum size (in bytes) of documents we deem to be "not small"
 *
 * we log (to the console) misses (i.e. no URLs ever found/replaced) in
 * documents whose size is greater than or equal to this value
 */
const LOG_THRESHOLD = 1024

/*
 * nodes under these keys never contain t.co URLs so we can speed up traversal
 * by pruning (not descending) them
 */
const PRUNE_KEYS = new Set([
    'advertiser_account_service_levels',
    'card_platform',
    'clientEventInfo',
    'ext',
    'ext_media_color',
    'features',
    'feedbackInfo',
    'hashtags',
    'original_info',
    'player_image_color',
    'profile_banner_extensions',
    'profile_banner_extensions_media_color',
    'profile_image_extensions',
    'profile_image_extensions_media_color',
    'responseObjects',
    'sizes',
    'user_mentions',
    'video_info',
])

/*
 * a map from URI paths (strings) to the replacement count for each path. used
 * to keep a running total of the number of replacements in each document type
 */
const STATS = {}

/*
 * a pattern which matches the domain(s) we expect data (JSON) to come from.
 * responses which don't come from a matching domain are ignored.
 */
const TWITTER_API = /^(?:(?:api|mobile)\.)?twitter\.com$/

/*
 * a list of document URIs (paths) which are known to not contain t.co URLs and
 * which therefore don't need to be processed
 */
const URL_BLACKLIST = new Set([
    '/i/api/2/badge_count/badge_count.json',
    '/i/api/graphql/articleNudgeDomains',
    '/i/api/graphql/TopicToFollowSidebar',
])

/*
 * object keys whose corresponding values may be t.co URLs
 */
const URL_KEYS = new Set(['url', 'string_value'])

/*
 * return a truthy value (the URL itself) if the supplied value is a valid URL
 * (string), falsey otherwise
 */
const checkUrl = (function () {
    // this is faster than using the URL constructor (in v8), which incurs
    // the overhead of using a try/catch block
    const urlPattern = /^https?:\/\/\w/i

    // no need to coerce the value to a string as RegExp#test does that
    // automatically
    //
    // https://tc39.es/ecma262/#sec-regexp.prototype.test
    return value => urlPattern.test(value) && value
})()

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
 * return true if the supplied value is an array or plain object, false otherwise
 */
const isObject = value => value && (typeof value === 'object')

/*
 * return true if the supplied value is a plain object, false otherwise
 *
 * only used with JSON data, so doesn't need to be foolproof
 */
const isPlainObject = (function () {
    const toString = {}.toString
    return value => toString.call(value) === '[object Object]'
})()

/*
 * return true if the supplied value is a t.co URL (string), false otherwise
 */
const isTrackedUrl = (function () {
    // this is faster (in v8) than using the URL constructor (and a try/catch
    // block)
    const urlPattern = /^https?:\/\/t\.co\/\w+$/

    // no need to coerce the value to a string as RegExp#test does that
    // automatically
    return value => urlPattern.test(value)
})()

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

    if (!isObject(data)) {
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
    // exclude subtrees which never contain t.co URLs
    if (PRUNE_KEYS.has(key)) {
        return 0 // a terminal value to stop traversal
    }

    // we only care about the "card_url" property in binding_values
    // objects/arrays. exclude the other 24 properties
    if (key === 'binding_values') {
        if (Array.isArray(value)) {
            const found = value.find(it => it?.key === 'card_url')
            return found ? [found] : 0
        } else if (isPlainObject(value)) {
            return { card_url: (value.card_url || 0) }
        }
    }

    // expand t.co URL nodes in place
    //
    // note this comes before the "legacy" check because legacy.url is a common
    // location and it needs to be modified in place rather than transferred to
    // a new object with a subset of the keys. this doesn't apply to the other
    // legacy keys as they all point to objects/arrays
    if (URL_KEYS.has(key) && isTrackedUrl(value)) {
        const { seen, unresolved } = state

        let expandedUrl

        if ((expandedUrl = seen.get(value))) {
            this[key] = expandedUrl
            ++state.count
        } else if ((expandedUrl = checkUrl(this.expanded_url || this.expanded))) {
            seen.set(value, expandedUrl)
            this[key] = expandedUrl
            ++state.count
        } else {
            let targets = unresolved.get(value)

            if (!targets) {
                unresolved.set(value, targets = [])
            }

            targets.push({ target: this, key })
        }
    }

    // reduce the keys under this.legacy (typically around 30) to the handful we
    // care about
    if (key === 'legacy' && isPlainObject(value)) {
        // we could use an array, but it doesn't appear to be faster (in v8)
        const filtered = {}

        for (let i = 0; i < LEGACY_KEYS.length; ++i) {
            const key = LEGACY_KEYS[i]

            if (key in value) {
                filtered[key] = value[key]
            }
        }

        return filtered
    }

    // shrink terminals (don't waste space/memory in the (discarded) JSON)
    return isObject(value) ? value : 0
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

    // [1] top-level tweet or user data (e.g. /favorites/create.json)
    if (Array.isArray(data) || ('id_str' in data) /* [1] */) {
        JSON.stringify(data, replacer)
    } else {
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
