// ==UserScript==
// @name          Twitter Direct
// @description   Remove t.co tracking links from Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.7.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://unpkg.com/@chocolateboy/uncommonjs@2.0.1/index.min.js
// @require       https://unpkg.com/get-wild@1.2.0/dist/index.umd.min.js
// @require       https://unpkg.com/just-safe-set@2.1.0/index.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/gm-compat@a26896b85770aa853b2cdaf2ff79029d8807d0c0/index.min.js
// @run-at        document-start
// @inject-into   auto
// ==/UserScript==

/*
 * the domain we expect data (JSON) to come from. responses that aren't from
 * this domain are ignored.
 */
const TWITTER_API = 'api.twitter.com'

/*
 * the domain intercepted links are routed through
 *
 * not all links are intercepted. exceptions include links to twitter (e.g.
 * https://twitter.com) and card URIs (e.g. card://123456)
 */
const TRACKING_DOMAIN = 't.co'

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
 *   - uri: optional URI filter: one or more strings (equality) or regexps (match)
 *
 *   - root (required): a path (string or array of steps) into the document
 *     under which to begin searching
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
 *     scan.
 *
 *     target paths can point directly to a URL node (string) or to an
 *     array of objects. in the latter case, we find the URL object in the array
 *     (obj.key === "card_url") and replace its URL node (obj.value.string_value)
 *
 *     if a target path is an object containing a { url: path, expanded_url: path }
 *     pair, the URL is expanded directly in the same way as scanned paths.
 */
const QUERIES = [
    {
        uri: '/1.1/users/lookup.json',
        root: [], // returns self
    },
    {
        uri: /\/Conversation$/,
        root: 'data.conversation_timeline.instructions.*.moduleItems.*.item.itemContent.tweet.core.user.legacy',
    },
    {
        uri: /\/Conversation$/,
        root: 'data.conversation_timeline.instructions.*.entries.*.content.items.*.item.itemContent.tweet.core.user.legacy',
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
        // used for hovercard data
        uri: /^\/graphql\/[^\/]+\/UserByScreenName$/,
        root: 'data.user.legacy',
        collect: Array.of,
    },
    {   // DMs
        uri: ['/1.1/dm/inbox_initial_state.json', '/1.1/dm/user_updates.json'],
        root: 'inbox_initial_state.entries.*.message.message_data',
        scan: TWEET_PATHS,
        targets: [
            'attachment.card.binding_values.card_url.string_value',
            'attachment.card.url',
        ],
    },
    {
        root: 'globalObjects.tweets',
        scan: TWEET_PATHS,
        targets: [
            {
                url: 'card.binding_values.website_shortened_url.string_value',
                expanded_url: 'card.binding_values.website_url.string_value',
            },
            'card.binding_values.card_url.string_value',
            'card.url',
        ],
    },
    {
        root: 'globalObjects.tweets.*.card.users.*',
    },
    {
        root: 'globalObjects.users',
    },
]

/*
 * a pattern which matches the content-type header of responses we scan for
 * URLs: "application/json" or "application/json; charset=utf-8"
 */
const CONTENT_TYPE = /^application\/json\b/

/*
 * the minimum size (in bytes) of documents we deem to be "not small"
 *
 * we log misses (i.e. no URLs ever found/replaced) in documents whose size is
 * greater than or equal to this value
 *
 * if we keep failing to find URLs in large documents, we may be able to speed
 * things up by blacklisting them, at least in theory
 *
 * (in practice, URL data is optional in most of the matched document types
 * (contained in arrays that can be empty), so an absence of URLs doesn't
 * necessarily mean URL data will never be included...)
 */
const LOG_THRESHOLD = 1024

/*
 * used to keep track of which roots (don't) have matching URIs and which URIs
 * (don't) have matching roots
 */
const STATS = { root: {}, uri: {} }

/*
 * a custom version of get-wild's `get` function which uses a simpler/faster
 * path parser since we don't use the extended syntax
 */
const get = exports.getter({ split: '.' })

/**
 * a helper function which returns true if the supplied URL is tracked by
 * Twitter, false otherwise
 */
function isTracked (url) {
    return (new URL(url)).hostname === TRACKING_DOMAIN
}

/*
 * JSON.stringify helper used to serialize stats data
 */
function replacer (key, value) {
    return (value instanceof Set) ? Array.from(value) : value
}

/*
 * replace t.co URLs with the original URL in all locations in the document
 * which contain URLs
 */
function transformLinks (json, uri) {
    let data, count = 0

    if (!STATS.uri[uri]) {
        STATS.uri[uri] = new Set()
    }

    try {
        data = JSON.parse(json)
    } catch (e) {
        console.error(`Can't parse JSON for ${uri}:`, e)
        return
    }

    for (const query of QUERIES) {
        if (query.uri) {
            const uris = [].concat(query.uri)
            const match = uris.some(want => {
                return (typeof want === 'string')
                    ? (uri === want)
                    : want.test(uri)
            })

            if (!match) {
                continue
            }
        }

        if (!STATS.root[query.root]) {
            STATS.root[query.root] = new Set()
        }

        const root = get(data, query.root)

        // may be an array (e.g. lookup.json)
        if (!root || typeof root !== 'object') {
            continue
        }

        const updateStats = () => {
            ++count
            STATS.uri[uri].add(query.root)
            STATS.root[query.root].add(uri)
        }

        const {
            collect = Object.values,
            scan = USER_PATHS,
            targets = NONE,
        } = query

        const cache = new Map()
        const contexts = collect(root)

        for (const context of contexts) {
            if (!context) {
                continue
            }

            // scan the context nodes for { url, expanded_url } pairs, replace
            // each t.co URL with its expansion, and add the mappings to the
            // cache
            for (const path of scan) {
                const items = get(context, path, NONE)

                for (const item of items) {
                    if (item.url && item.expanded_url) {
                        if (isTracked(item.url)) {
                            cache.set(item.url, item.expanded_url)
                            item.url = item.expanded_url
                            updateStats()
                        }
                    } else {
                        console.warn("can't find url/expanded_url pair for:", { uri, root: query.root, path })
                    }
                }
            }
        }

        if (!targets.length) {
            continue
        }

        // do a separate pass for targets because some nested card URLs are
        // expanded in other (earlier) tweets under the same root
        for (const context of contexts) {
            for (const targetPath of targets) {
                // this is similar to the url/expanded_url pairs handled in the
                // scan, but with custom property-names (paths)
                if (targetPath && typeof targetPath === 'object') {
                    const { url: urlPath, expanded_url: expandedUrlPath } = targetPath

                    let url, expandedUrl

                    if (
                           (url = get(context, urlPath))
                        && isTracked(url)
                        && (expandedUrl = get(context, expandedUrlPath))
                    ) {
                        cache.set(url, expandedUrl)
                        exports.set(context, urlPath, expandedUrl)
                        updateStats()
                    }

                    continue
                }

                // pinpoint isolated URLs in the context which don't have a
                // corresponding expansion, and replace them using the mappings
                // we collected during the scan

                let url, $context = context, $targetPath = targetPath

                const node = get(context, targetPath)

                // if the target points to an array rather than a string, locate
                // the URL object within the array automatically
                if (Array.isArray(node)) {
                    if ($context = node.find(it => it.key === 'card_url')) {
                        $targetPath = 'value.string_value'
                        url = get(context, $targetPath)
                    }
                } else {
                    url = node
                }

                if (typeof url === 'string' && isTracked(url)) {
                    const expandedUrl = cache.get(url)

                    if (expandedUrl) {
                        exports.set($context, $targetPath, expandedUrl)
                        updateStats()
                    } else {
                        console.warn(`can't find expanded URL for ${url} in ${uri}`)
                    }
                }
            }
        }
    }

    return { count, data }
}

/*
 * replacement for Twitter's default response handler. we transform the response
 * if it's a) JSON and b) contains URL data; otherwise, we leave it unchanged
 */
function onResponse (xhr, uri) {
    const contentType = xhr.getResponseHeader('Content-Type')

    if (!CONTENT_TYPE.test(contentType)) {
        return
    }

    const url = new URL(uri)

    // exclude e.g. the config-<date>.json file from pbs.twimg.com, which is the
    // second biggest document (~500K) after home_latest.json (~700K)
    if (url.hostname !== TWITTER_API) {
        return
    }

    const json = xhr.responseText
    const size = json.length

    // fold URIs which differ only in the user ID, e.g.:
    // /2/timeline/profile/1234.json -> /2/timeline/profile.json
    const path = url.pathname.replace(/\/\d+\.json$/, '.json')

    const oldStats = JSON.stringify(STATS, replacer)
    const transformed = transformLinks(json, path)

    let count

    if (transformed && (count = transformed.count)) {
        const descriptor = { value: JSON.stringify(transformed.data) }
        const clone = GMCompat.export(descriptor)

        GMCompat.unsafeWindow.Object.defineProperty(xhr, 'responseText', clone)
    }

    if (count) {
        const newStats = JSON.stringify(STATS, replacer)

        if (newStats !== oldStats) {
            const replacements = 'replacement' + (count === 1 ? '' : 's')
            console.debug(`${count} ${replacements} in ${path} (${size} B)`)
            console.log(JSON.parse(newStats))
        }
    } else if (STATS.uri[path].size === 0 && size >= LOG_THRESHOLD) {
        console.debug(`no replacements in ${path} (${size} B)`)
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
                onResponse(this, this.responseURL)
            }

            return oldOnReadyStateChange.apply(this, arguments)
        }

        return oldSend.apply(this, arguments)
    }
}

/*
 * replace the default XHR#send with our custom version, which scans responses
 * for tweets and expands their URLs
 */
GMCompat.unsafeWindow.XMLHttpRequest.prototype.send = GMCompat.export(
    hookXHRSend(XMLHttpRequest.prototype.send)
)
