// ==UserScript==
// @name          Twitter Direct
// @description   Remove t.co tracking links from Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.1.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://x.com/
// @include       https://x.com/*
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @run-at        document-start
// ==/UserScript==

/// <reference path="../types/gm-compat.d.ts" />

import Replacer     from './twitter-direct/replacer'
import { isObject } from './twitter-direct/util'

/*
 * a list of document URIs (paths) which are known to not contain t.co URLs and
 * which therefore don't need to be transformed
 */
const URL_BLACKLIST = new Set([
    '/hashflags.json',
    '/badge_count/badge_count.json',
    '/graphql/articleNudgeDomains',
    '/graphql/TopicToFollowSidebar',
])

/*
 * a pattern which matches the content-type header of responses we scan for
 * URLs: "application/json" or "application/json; charset=utf-8"
 */
const CONTENT_TYPE = /^application\/json\b/

/*
 * the minimum size (in bytes) of documents we deem to be "not small"
 *
 * we log (to the console) misses (i.e. no URLs ever found/replaced) in
 * documents whose size is greater than or equal to this value
 */
const LOG_THRESHOLD = 1024

/*
 * a map from URI paths (strings) to the replacement count for each path. used
 * to keep a running total of the number of replacements in each document type
 */
const STATS: Record<string, number> = {}

/*
 * a pattern which matches the domain(s) we expect data (JSON) to come from.
 * responses which don't come from a matching domain are ignored.
 */
const TWITTER_API = /^(?:(?:api|mobile)\.)?(?:twitter|x)\.com$/

/*
 * replacement for the default handler for XHR requests. we transform the
 * response if it's a) JSON and b) contains URL data; otherwise, we leave it
 * unchanged
 */
const onResponse = (xhr: XMLHttpRequest, uri: string): void => {
    const contentType = xhr.getResponseHeader('Content-Type')

    if (!contentType || !CONTENT_TYPE.test(contentType)) {
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

    // fold paths which differ only in the API version, user ID or query
    // ID, e.g.:
    //
    //   /2/timeline/profile/1234.json    -> /timeline/profile.json
    //   /i/api/graphql/abc123/UserTweets -> /graphql/UserTweets
    //
    const path = url.pathname
        .replace(/^\/i\/api\//, '/')
        .replace(/^\/\d+(\.\d+)*\//, '/')
        .replace(/(\/graphql\/)[^\/]+\/(.+)$/, '$1$2')
        .replace(/\/\d+\.json$/, '.json')

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
    const count = Replacer.transform(data, path)

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
 * replace the built-in XHR#send method with a custom version which swaps
 * in our custom response handler. once done, we delegate to the original
 * handler (this.onreadystatechange)
 */
const hookXHRSend = (oldSend: XMLHttpRequest['send']): XMLHttpRequest['send'] => {
    return function send (this: XMLHttpRequest, body = null) {
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

// replace the default XHR#send method with our custom version, which scans
// responses for t.co URLs and expands them
const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype
const send = hookXHRSend(xhrProto.send)

xhrProto.send = GMCompat.export(send)
