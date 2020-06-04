// ==UserScript==
// @name          Twitter Direct
// @description   Remove t.co tracking links from Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.0.2
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @run-at        document-start
// @inject-into   auto
// ==/UserScript==

/*
 * scan a JSON response for tweets if its URL matches this pattern
 */
const PATTERN = /^https:\/\/api\.twitter\.com\/([^/]+\/[^.]+\.json)\?/

/*
 * compatibility shim needed for Violentmonkey:
 * https://github.com/violentmonkey/violentmonkey/issues/997#issuecomment-637700732
 */
const Compat = { unsafeWindow }

/*
 * replace t.co URLs with the original URL in all locations within the document
 * which contain tweets
 */
function transformLinks (path, data) {
    // XXX avoid using the optional-chaining operator for now because GreasyFork
    // can't parse it:
    //
    // const tweets = (data.globalObjects || data.twitter_objects)?.tweets
    const objects = data.globalObjects || data.twitter_objects
    const tweets = objects ? objects.tweets : objects

    if (!tweets) {
        console.debug("can't find tweets in:", path)
        return
    }

    console.info(`scanning links in ${path}:`, data)

    for (const tweet of Object.values(tweets)) {
        const { entities, extended_entities = {} } = tweet
        const { urls = [], media = [] } = entities
        const { urls: extendedUrls = [], media: extendedMedia = [] } = extended_entities
        const locations = [urls, media, extendedUrls, extendedMedia]

        for (const location of locations) {
            for (const item of location) {
                item.url = item.expanded_url
            }
        }
    }

    return data
}

/*
 * parse and transform the JSON response, handling (catching and reporting) any
 * parse or processing errors
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
        transformed = transformLinks(path, parsed)
    } catch (e) {
        console.error('error transforming JSON:', e)
        return
    }

    return transformed
}

/*
 * replacement for Twitter's default response handler which transforms the
 * response if it's a) JSON and b) contains tweet data; otherwise, we leave it
 * unchanged
 */
function onReadyStateChange (xhr, url) {
    const match = url.match(PATTERN)

    if (!match) {
        return
    }

    const path = match[1]
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
            if (this.readyState === 4 && this.responseURL && this.status === 200) {
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
 * effectively no-ops in other engines
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
