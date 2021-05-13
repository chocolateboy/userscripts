// ==UserScript==
// @name          Twitter Direct
// @description   Remove t.co tracking links from Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.8.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://unpkg.com/@chocolateboy/uncommonjs@3.1.2/dist/polyfill.iife.min.js
// @require       https://unpkg.com/get-wild@1.5.0/dist/index.umd.min.js
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @require       https://unpkg.com/just-safe-set@2.2.1/index.js
// @run-at        document-start
// ==/UserScript==

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
 * an immutable array used in various places as a way to indicate "no values".
 * static to avoid unnecessary allocations.
 */
const NONE = []

/*
 * used to keep track of which queries (don't) have matching URIs and which URIs
 * (don't) have matching queries
 */
const STATS = { root: {}, uri: {} }

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
 * a router which matches URIs (pathnames) to queries. each query contains a
 * root path (required) and some additional options which specify the locations
 * under the root path to substitute URLs in.
 *
 * implemented as an array of pairs with URI-pattern keys (string(s) or
 * regexp(s)) and one or more queries as the value. if a query is a string
 * (path), it is converted into an object with the path as its `root`
 * property.
 *
 * options:
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
 *     tweets. these URLs are replaced by expanded URLs gathered during
 *     preceding scans.
 *
 *     target paths can point directly to a URL node (string), or to an array
 *     or plain object, in which case the URL is located inside the array/object
 *     and replaced
 *
 *     if a target path is an object containing a { url: path, expanded_url: path }
 *     pair, the URL is expanded directly in the same way as scanned paths.
 */
const MATCH = [
    [
        /\/Bookmarks$/, [
            'data.bookmark_timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.card.legacy.user_refs.*.legacy',
            'data.bookmark_timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.core.user.legacy',
            {
                root: 'data.bookmark_timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
                targets: [
                    {
                        url: 'quoted_status_permalink.url',
                        expanded_url: 'quoted_status_permalink.expanded',
                    }
                ]
            },
            {
                root: 'data.bookmark_timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.card.legacy',

                // just expand the URLs in the specified locations within the
                // card; there's no user or tweet data under this root
                scan: NONE,

                targets: ['binding_values', 'url'],
            },
        ],
    ],
    [
        /\/Conversation$/, [
            'data.conversation_timeline.instructions.*.moduleItems.*.item.itemContent.tweet.core.user.legacy',
            'data.conversation_timeline.instructions.*.entries.*.content.items.*.item.itemContent.tweet.core.user.legacy',
            {
                root: 'data.conversation_timeline.instructions.*.moduleItems.*.item.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
                targets: ['card.binding_values', 'card.url'],
            },
            {
                root: 'data.conversation_timeline.instructions.*.entries.*.content.items.*.item.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
                targets: ['card.binding_values', 'card.url'],
            },
        ]
    ],
    [
        /\/Favoriters$/,
        'data.favoriters_timeline.timeline.instructions.*.entries.*.content.itemContent.user.legacy',
    ],
    [
        /\/Following$/,
        'data.user.following_timeline.timeline.instructions.*.entries.*.content.itemContent.user.legacy',
    ],
    [
        /\/Followers$/,
        'data.user.followers_timeline.timeline.instructions.*.entries.*.content.itemContent.user.legacy',
    ],
    [
        /\/FollowersYouKnow$/,
        'data.user.friends_following_timeline.timeline.instructions.*.entries.*.content.itemContent.user.legacy',
    ],
    [
        // "List" page, e.g. /i/api/graphql/abcd1234/ListLatestTweetsTimeline
        /\/ListLatestTweetsTimeline$/, [
            'data.list.tweets_timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.core.user.legacy',
            {
                root: 'data.list.tweets_timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
            },
            {
                root: 'data.list.tweets_timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy.retweeted_status.legacy',
                scan: TWEET_PATHS,
            },
            {
                root: 'data.list.tweets_timeline.timeline.instructions.*.entries.*.content.itemContent.tweet',
                scan: NONE,
                targets: [
                    'card.legacy.binding_values',
                    'card.legacy.url',
                    'legacy.retweeted_status.card.legacy.binding_values',
                    'legacy.retweeted_status.card.legacy.url',
                ],
            },
        ]
    ],
    [
        // "Likes" page, e.g. /i/api/graphql/abcd1234/Likes
        /\/Likes$/, [
            'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.core.user.legacy',
            'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.quoted_status.card.legacy.user_refs.*.legacy',
            'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.quoted_status.core.user.legacy',
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.quoted_status.legacy',
                scan: TWEET_PATHS,
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
                targets: [
                    {
                        url: 'quoted_status_permalink.url',
                        expanded_url: 'quoted_status_permalink.expanded',
                    },
                ],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet',
                scan: NONE,
                targets: [
                    'card.legacy.binding_values',
                    'card.legacy.url',
                    'quoted_status.card.legacy.binding_values',
                    'quoted_status.card.legacy.url',
                ],
            },
        ],
    ],
    [
        /\/ListMembers$/,
        'data.list.members_timeline.timeline.instructions.*.entries.*.content.itemContent.user.legacy'
    ],
    [
        /\/ListSubscribers$/,
        'data.list.subscribers_timeline.timeline.instructions.*.entries.*.content.itemContent.user.legacy',
    ],
    [
        /\/Retweeters/,
        'data.retweeters_timeline.timeline.instructions.*.entries.*.content.itemContent.user.legacy'
    ],
    [
        /\/TweetDetail$/, [
            'data.threaded_conversation_with_injections.instructions.*.entries.*.content.itemContent.tweet.card.legacy.user_refs.*.legacy',
            {
                root: 'data.threaded_conversation_with_injections.instructions.*.entries.*.content.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
            },
            {
                root: 'data.threaded_conversation_with_injections.instructions.*.entries.*.content.items.*.item.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
            },
            {
                root: 'data.threaded_conversation_with_injections.instructions.*.entries.*.content.items.*.item.itemContent.tweet.core.user.legacy',
                targets: ['url'],
            },
            {
                root: 'data.threaded_conversation_with_injections.instructions.*.entries.*.content.itemContent.tweet.card.legacy',
                scan: NONE,
                targets: ['binding_values', 'url', 'user_refs.*.legacy.url'],
            }
        ],
    ],
    [
        // used for hovercard data
        /\/UserByScreenName$/, {
            root: 'data.user.legacy',
            collect: Array.of,
        }
    ],
    [
        /\/UserByScreenNameWithoutResults$/, {
            root: 'data.user.legacy',
            collect: Array.of,
        },
    ],
    [
        // e.g. /i/api/graphql/abcd1234/UserMedia
        /\/UserMedia$/, [
            'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.core.user.legacy',
            'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.quoted_status.card.legacy.user_refs.*.legacy',
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.quoted_status.legacy',
                scan: TWEET_PATHS,
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
                targets: [
                    {
                        url: 'quoted_status_permalink.url',
                        expanded_url: 'quoted_status_permalink.expanded',
                    },
                ],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.card.legacy.user_refs.*.legacy',
                targets: ['url'],
            },
        ]
    ],
    [
        // e.g. /i/api/graphql/abcd1234/UserTweets
        /\/UserTweets$/, [
            'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.core.user.legacy',
            'data.user.result.timeline.timeline.instructions.*.entries.*.content.items.*.item.itemContent.tweet.core.user.legacy',
            'data.user.result.timeline.timeline.instructions.*.entries.*.content.items.*.item.itemContent.user.legacy',
            'data.user.result.timeline.timeline.instructions.*.entry.content.itemContent.tweet.core.user.legacy',
            {
                root: 'data.user.legacy',
                collect: Array.of,
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.items.*.item.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy.retweeted_status.quoted_status.legacy',
                scan: TWEET_PATHS,
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entry.content.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy.retweeted_status.quoted_status.card.legacy',
                targets: ['binding_values', 'url'],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.items.*.item.itemContent.tweet.card.legacy.user_refs.*.legacy',
                targets: ['url'],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy.retweeted_status.quoted_status.card.legacy.user_refs.*.legacy',
                targets: ['url'],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy.retweeted_status.card.legacy.user_refs.*.legacy',
                targets: ['url'],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy.retweeted_status.core.user.legacy',
                targets: ['url'],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.card.legacy.user_refs.*.legacy',
                targets: ['url'],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
                targets: [
                    {
                        url: 'quoted_status_permalink.url',
                        expanded_url: 'quoted_status_permalink.expanded',
                    },
                ],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy.retweeted_status.legacy',
                scan: TWEET_PATHS,
                targets: [
                    {
                        url: 'quoted_status_permalink.url',
                        expanded_url: 'quoted_status_permalink.expanded',
                    },
                ],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.card.legacy',
                scan: NONE,
                targets: ['binding_values', 'url'],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy.retweeted_status.card.legacy',
                scan: NONE,
                targets: ['binding_values', 'url'],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.items.*.item.itemContent.tweet.card.legacy',
                scan: NONE,
                targets: ['binding_values', 'url'],
            },
        ]
    ],
    [
        // e.g. /i/api/graphql/abcd1234/UserTweetsAndReplies
        /\/UserTweetsAndReplies$/, [
            'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.core.user.legacy',
            'data.user.result.timeline.timeline.instructions.*.entries.*.content.items.*.item.itemContent.tweet.core.user.legacy',
            'data.user.result.timeline.timeline.instructions.*.entry.content.itemContent.tweet.core.user.legacy',
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.items.*.item.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
                targets: [
                    {
                        url: 'quoted_status_permalink.url',
                        expanded_url: 'quoted_status_permalink.expanded',
                    },
                ]
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy.retweeted_status.legacy',
                scan: TWEET_PATHS,
                targets: [
                    {
                        url: 'quoted_status_permalink.url',
                        expanded_url: 'quoted_status_permalink.expanded',
                    },
                ],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entry.content.itemContent.tweet.legacy',
                scan: TWEET_PATHS,
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy.retweeted_status.core.user.legacy',
                targets: ['url'],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.items.*.item.itemContent.tweet.card.legacy',
                scan: NONE,
                targets: ['binding_values', 'url'],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.card.legacy',
                scan: NONE,
                targets: ['binding_values', 'url'],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.legacy.retweeted_status.card.legacy',
                scan: NONE,
                targets: ['binding_values', 'url'],
            },
            {
                root: 'data.user.result.timeline.timeline.instructions.*.entries.*.content.itemContent.tweet.card.legacy.user_refs.*.legacy',
                targets: ['url'],
            },
        ]
    ],
    [
        // DMs
        // e.g. '/1.1/dm/inbox_initial_state.json' and '/1.1/dm/user_updates.json'
        /\/(?:inbox_initial_state|user_updates)\.json$/, {
            root: 'inbox_initial_state.entries.*.message.message_data',
            scan: TWEET_PATHS,
            targets: ['attachment.card.binding_values', 'attachment.card.url'],
        }
    ],
    [
        // e.g. '/1.1/friends/following/list.json',
        /\/list\.json$/, {
            root: 'users.*'
        },
    ],
    [
        // e.g. '/1.1/users/lookup.json',
        /\/lookup\.json$/, {
            root: NONE, // the document itself (an array of users) is the root
        }
    ],
    [
        // "Who to follow"
        // e.g. '/1.1/users/recommendations.json'
        /\/recommendations\.json$/, {
            root: '*.user',
        }
    ],
]

/*
 * a single { pattern => queries } pair for the router which is run against all
 * documents
 */
const WILDCARD = [
    /./,
    [
        'globalObjects.users',
        'globalObjects.tweets.*.card.users',
        {
            root: 'globalObjects.tweets',
            scan: TWEET_PATHS,
            targets: [
                {
                    url: 'card.binding_values.website_shortened_url.string_value',
                    expanded_url: 'card.binding_values.website_url.string_value',
                },
                'card.binding_values',
                'card.url',
            ],
        },
    ]
]

/*
 * a custom version of get-wild's `get` function which uses a simpler/faster
 * path parser since we don't use the extended syntax
 */
const get = exports.getter({ split: '.' })

/*
 * a helper function which returns true if the supplied value is a plain object,
 * false otherwise
 */
const isPlainObject = (function () {
    const toString = {}.toString
    // only used with JSON data, so we don't need this to be foolproof
    return value => toString.call(value) === '[object Object]'
})()

/*
 * a helper function which iterates over the supplied iterable, filtering out
 * missing (undefined) values.
 *
 * this is done in one pass (rather than map + filter) as there may potentially
 * be dozens or even hundreds of values, e.g. contexts (tweet/user objects)
 * under a root node
 */
function eachDefined (iterable, fn) {
    for (const value of iterable) {
        if (value) fn(value)
    }
}

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
function replacer (_key, value) {
    return (value instanceof Set) ? Array.from(value) : value
}

/*
 * a generator which returns { pattern => queries } pairs where patterns are
 * strings/regexps which match a URI and queries are objects which define
 * substitutions to perform in the matched document.
 *
 * this forms the basis of a simple "router" which tries all URI patterns until
 * one matches (or none match) and then additionally performs a wildcard match
 * which works on all URIs.
 *
 * the URI patterns are disjoint, so there's no need to try them all if one
 * matches. in addition to these, some substitutions are non URI-specific, i.e.
 * they work on documents that aren't matched by URI (e.g. profile.json) and
 * documents that are (e.g. list.json). currently these cross-document nodes can
 * be found under obj.globalObjects, so we check for the existence of that
 * property before yielding these catch-all queries
 */
function* router (data, state) {
    for (const [key, value] of MATCH) {
        yield [key, value]

        if (state.matched) {
            break
        }
    }

    if ('globalObjects' in data) {
        yield WILDCARD
    }
}

/*
 * a helper class which implements document-specific (MATCH) and generic
 * (WILDCARD) URL substitutions in nodes (subtrees) within a JSON-formatted
 * document returned by the Twitter API.
 *
 * a transformer is instantiated for each query and its methods are passed a
 * context (node within the document tree) and the value of an option from the
 * query, e.g. the `scan` option is handled by the `_scan` method and the
 * `targets` option is processed by the `_assign` method
 */
class Transformer {
    constructor ({ cache, onReplace, root, uri }) {
        this._cache = cache
        this._onReplace = onReplace
        this._root = root
        this._uri = uri
    }

    /*
     * expand URLs in context nodes in the locations specified by the query's
     * `scan` and `targets` options
     */
    // @ts-ignore https://github.com/microsoft/TypeScript/issues/14279
    transform (contexts, scan, targets) {
        // scan the context nodes for { url, expanded_url } pairs, replace
        // each t.co URL with its expansion, and add the mappings to the
        // cache
        eachDefined(contexts, context => this._scan(context, scan))

        // do a separate pass for targets because the scan may have added more
        // mappings to the cache
        if (targets.length) {
            eachDefined(contexts, context => this._assign(context, targets))
        }
    }

    /*
     * scan the context node for { url, expanded_url } pairs, replace each t.co
     * URL with its expansion, and add the mappings to the cache
     */
    _scan (context, paths) {
        const { _cache: cache, _onReplace: onReplace } = this

        for (const path of paths) {
            const items = get(context, path, NONE)

            for (const item of items) {
                if (item.url && item.expanded_url) {
                    if (isTracked(item.url)) {
                        cache.set(item.url, item.expanded_url)
                        item.url = item.expanded_url
                        onReplace()
                    }
                } else {
                    console.warn("can't find url/expanded_url pair for:", {
                        uri: this._uri,
                        root: this._root,
                        path,
                        item,
                    })
                }
            }
        }
    }

    /*
     * replace URLs in the context which weren't substituted during the scan.
     *
     * these are either standalone URLs whose expansion we retrieve from the
     * cache, or URLs whose expansion exists in the context in a location not
     * covered by the scan
     */
    _assign (context, targets) {
        for (const target of targets) {
            if (isPlainObject(target)) {
                this._assignFromPath(context, target)
            } else {
                this._assignFromCache(context, target)
            }
        }
    }

    /*
     * replace a short URL in the context with an expanded URL defined in the
     * context, e.g. context.foo.url = context.bar.baz.expanded_url
     *
     * this is similar to the replacements performed during the scan, but rather
     * than using a fixed set of locations/paths, the paths to the short and
     * expanded URLs are supplied as a parameter
     */
    _assignFromPath (context, paths) {
        const { url: urlPath, expanded_url: expandedUrlPath } = paths

        let url, expandedUrl

        if (
               (url = get(context, urlPath))
            && isTracked(url)
            && (expandedUrl = get(context, expandedUrlPath))
        ) {
            this._cache.set(url, expandedUrl)
            exports.set(context, urlPath, expandedUrl)
            this._onReplace()
        }
    }

    /*
     * pinpoint an isolated URL in the context which doesn't have a
     * corresponding expansion, and replace it using the mappings collected
     * during preceding scans
     */
    _assignFromCache (context, path) {
        const node = get(context, path)

        let url

        // special-case card URLs
        //
        // if the target is an array or plain object, locate its target URL
        // automatically. used to resolve "binding" nodes, which represent
        // properties (key/value pairs) as an array or object

        if (Array.isArray(node)) {
            const found = node.find(it => it?.key === 'card_url')

            if (found) {
                context = found
                path = 'value.string_value'
                url = get(context, path)
            }
        } else if (isPlainObject(node)) {
            if (node.card_url) {
                context = node
                path = 'card_url.string_value'
                url = get(context, path)
            }
        } else {
            url = node
        }

        if (typeof url === 'string' && isTracked(url)) {
            const expandedUrl = this._cache.get(url)

            if (expandedUrl) {
                exports.set(context, path, expandedUrl)
                this._onReplace()
            } else {
                console.warn(`can't find expanded URL for ${url} in ${this._uri}`)
            }
        }
    }
}

/*
 * replace t.co URLs with the original URL in all locations in the document
 * which contain URLs
 *
 * returns the number of substituted URLs
 */
function transform (data, uri) {
    let count = 0 // keep track of and return the number of expanded URLs

    if (!STATS.uri[uri]) {
        STATS.uri[uri] = new Set()
    }

    // t.co -> expanded URL mapping for all queries in this document. used to
    // fill in isolated URLs (usually in cards) which don't have a corresponding
    // `expanded_url`
    const cache = new Map()

    // used to notify the router when a pattern matches so it can stop trying
    // URI matches and transition to the wildcard match
    const state = { matched: false }

    // an iterator which yields { pattern => queries } pairs for this document.
    // if a document's URI matches the pattern, the corresponding queries
    // (search + replace) are executed
    const it = router(data, state)

    for (const [key, value] of it) {
        const uris = NONE.concat(key) // coerce to an array
        const queries = NONE.concat(value)
        const match = uris.some(want => {
            return (typeof want === 'string') ? (uri === want) : want.test(uri)
        })

        if (match) {
            // stop matching URIs after this and switch to the wildcard queries
            state.matched = true
        } else {
            // try the next URI pattern, or switch to the wildcard queries if
            // there are no more patterns to match against
            continue
        }

        for (const $query of queries) {
            const query = isPlainObject($query) ? $query : { root: $query }
            const { root: rootPath } = query

            if (!STATS.root[rootPath]) {
                STATS.root[rootPath] = new Set()
            }

            const root = get(data, rootPath)

            // might be an array (e.g. lookup.json)
            if (!root || typeof root !== 'object') {
                continue
            }

            const {
                collect = Object.values,
                scan = USER_PATHS,
                targets = NONE,
            } = query

            const updateStats = () => {
                ++count
                STATS.uri[uri].add(rootPath)
                STATS.root[rootPath].add(uri)
            }

            const contexts = collect(root)

            const transformer = new Transformer({
                cache,
                onReplace: updateStats,
                root: rootPath,
                uri,
            })

            // @ts-ignore https://github.com/microsoft/TypeScript/issues/14279
            transformer.transform(contexts, scan, targets)
        }
    }

    return count
}

/*
 * replacement for Twitter's default handler for XHR requests. we transform the
 * response if it's a) JSON and b) contains URL data; otherwise, we leave it
 * unchanged
 */
function onResponse (xhr, uri) {
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

    // fold URIs which differ only in the user ID, e.g.:
    // /2/timeline/profile/1234.json -> /2/timeline/profile.json
    const path = url.pathname.replace(/\/\d+\.json$/, '.json')

    let data

    try {
        data = JSON.parse(json)
    } catch (e) {
        console.error(`Can't parse JSON for ${uri}:`, e)
        return
    }

    const oldStats = JSON.stringify(STATS, replacer)
    const count = transform(data, path)

    if (!count) {
        if (STATS.uri[path].size === 0 && size >= LOG_THRESHOLD) {
            console.debug(`no replacements in ${path} (${size} B)`)
        }

        return
    }

    const descriptor = { value: JSON.stringify(data) }
    const clone = GMCompat.export(descriptor)

    GMCompat.unsafeWindow.Object.defineProperty(xhr, 'responseText', clone)

    const newStats = JSON.stringify(STATS, replacer)

    if (newStats !== oldStats) {
        const replacements = 'replacement' + (count === 1 ? '' : 's')
        console.debug(`${count} ${replacements} in ${path} (${size} B)`)
        console.log(JSON.parse(newStats))
    }
}

/*
 * replace the built-in XHR#send method with our custom version which swaps in
 * our custom response handler. once done, we delegate to the original handler
 * (this.onreadystatechange)
 */
function hookXHRSend (oldSend) {
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
 * replace the default XHR#send with our custom version, which scans responses
 * for tweets and expands their URLs
 */
const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype

xhrProto.send = GMCompat.export(hookXHRSend(xhrProto.send))
