/// <reference path="../../types/gm-compat.d.ts" />

// common base class for Twitter Direct and TweetDeck Direct
//
// this class registers an override of the XHR#send method
// (Transformer.register) which intercepts API requests to expand
// t.co URLs in the returned JSON

import {
    checkUrl,
    isObject,
    isPlainObject,
    isTrackedUrl,
    Dict,
    Json,
    JsonObject,
    isNumber,
    isString
} from './util'

type Entity = {
    fromIndex: number;
    toIndex: number;
    ref: {
        type: string;
        url: string;
        urlType: string;
    }
}

type Options = {
    urlBlacklist?: Set<string>;
}

type State = {
    path: string;
    count: number;
    seen: Map<string, string>;
    unresolved: Map<string, Target[]>;
}

type Summary = {
    text: string;
    entities: Entity[];
}

type Target = { target: Dict, key: string };

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
    'modules', // TweetDeck
    'users',
]

/*
 * keys of "legacy" objects which URL data is known to be found in/under, e.g.
 * we're interested in legacy.user_refs.* and legacy.retweeted_status.*, but not
 * in legacy.created_at or legacy.reply_count.
 *
 * legacy objects typically contain dozens of keys, but t.co URLs only exist in
 * a handful of them. typically this reduces the number of keys to traverse in a
 * legacy object from 30 on average (max 39) to 2 or 3.
 */
const LEGACY_KEYS = [
    'binding_values',
    'entities',
    'extended_entities',
    'quoted_status_permalink',
    'retweeted_status',
    'retweeted_status_result',
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
    'indices',
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
const STATS: Record<string, number> = {}

/*
 * a pattern which matches the domain(s) we expect data (JSON) to come from.
 * responses which don't come from a matching domain are ignored.
 */
const TWITTER_API = /^(?:(?:api|mobile)\.)?twitter\.com$/

const isSummary = (value: unknown): value is Summary => {
    return isPlainObject(value)
        && isString(value.text)
        && Array.isArray(value.entities)
}

const isEntity = (value: unknown): value is Entity => {
    return isPlainObject(value)
        && isNumber(value.fromIndex)
        && isNumber(value.toIndex)
        && isPlainObject(value.ref)
        && isString(value.ref.url)
}

export class Transformer {
    private urlBlacklist: Set<string>;

    /*
     * replace the default XHR#send with our custom version, which scans responses
     * for tweets and expands their URLs
     */
    public static register (options: Options): Transformer {
        const transformer = new this(options)
        const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype
        const send = transformer.hookXHRSend(xhrProto.send)

        xhrProto.send = GMCompat.export(send)

        return transformer
    }

    constructor (options: Options) {
        this.urlBlacklist = options.urlBlacklist || new Set()
    }

    /*
     * replacement for Twitter's default handler for XHR requests. we transform the
     * response if it's a) JSON and b) contains URL data; otherwise, we leave it
     * unchanged
     */
    private onResponse (xhr: XMLHttpRequest, uri: string): void {
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

        if (this.urlBlacklist.has(path)) {
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
        const count = this.transform(data, path)

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
     * replace t.co URLs with the original URL in all locations in the document
     * which may contain them
     *
     * returns the number of substituted URLs
     */
    private transform (data: JsonObject, path: string): number {
        const seen: State['seen'] = new Map()
        const unresolved: State['unresolved'] = new Map()
        const state = { path, count: 0, seen, unresolved }

        // [1] top-level tweet or user data (e.g. /favorites/create.json)
        if (Array.isArray(data) || ('id_str' in data) /* [1] */) {
            this.traverse(state, data)
        } else {
            for (const key of DOCUMENT_ROOTS) {
                if (key in data) {
                    this.traverse(state, data[key])
                }
            }
        }

        for (const [url, targets] of unresolved) {
            const expandedUrl = seen.get(url)

            if (expandedUrl) {
                for (const { target, key } of targets) {
                    target[key] = expandedUrl
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
     * reduce the large binding_values array/object to the one property we care
     * about (card_url)
     */
    private transformBindingValues (value: Json): Json {
        if (Array.isArray(value)) {
            const found = value.find(it => (it as Dict)?.key === 'card_url')
            return found ? [found] : 0
        } else if (isPlainObject(value)) {
            return { card_url: (value.card_url || 0) }
        } else {
            return 0
        }
    }

    /*
     * reduce the keys under context.legacy (typically around 30) to the
     * handful we care about
     */
    private transformLegacyObject (value: Dict): Dict {
        // XXX don't expand legacy.url: leaving it unexpanded results in media
        // URLs (e.g. YouTube URLs) appearing as clickable links in the tweet
        // (which we want)

        // we could use an array, but it doesn't appear to be faster (in v8)
        const filtered: Dict = {}

        for (let i = 0; i < LEGACY_KEYS.length; ++i) {
            const key = LEGACY_KEYS[i]

            if (key in value) {
                filtered[key] = value[key]
            }
        }

        return filtered
    }

    /*
     * extract expanded URLs from a summary object
     *
     * the expanded URLs are only extracted here; they're substituted when the
     * +url+ property within the summary is visited
     */
    private transformSummary (state: State, summary: Summary): Summary {
        const { entities, text } = summary

        for (const entity of entities) {
            if (!isEntity(entity)) {
                console.warn('invalid entity:', entity)
                break
            }

            const { url } = entity.ref

            if (isTrackedUrl(url)) {
                const expandedUrl = text.slice(entity.fromIndex, entity.toIndex)
                state.seen.set(url, expandedUrl)
            }
        }

        return summary
    }

    /*
     * expand t.co URL nodes in place, either obj.url or obj.string_value in
     * binding_values arrays/objects
     */
    private transformURL (state: State, context: Dict, key: string, url: string): string {
        const { seen, unresolved } = state
        const writable = this.isWritable(context)

        let expandedUrl

        if ((expandedUrl = seen.get(url))) {
            if (writable) {
                context[key] = expandedUrl
                ++state.count
            }
        } else if ((expandedUrl = checkUrl(context.expanded_url || context.expanded))) {
            seen.set(url, expandedUrl)

            if (writable) {
                context[key] = expandedUrl
                ++state.count
            }
        } else {
            let targets = unresolved.get(url)

            if (!targets) {
                unresolved.set(url, targets = [])
            }

            if (writable) {
                targets.push({ target: context, key })
            }
        }

        return url
    }

    /*
     * replace the built-in XHR#send method with a custom version which swaps
     * in our custom response handler. once done, we delegate to the original
     * handler (this.onreadystatechange)
     */
    protected hookXHRSend (oldSend: XMLHttpRequest['send']): XMLHttpRequest['send'] {
        const self = this

        return function send (this: XMLHttpRequest, body = null) {
            const oldOnReadyStateChange = this.onreadystatechange

            this.onreadystatechange = function (event) {
                if (this.readyState === this.DONE && this.responseURL && this.status === 200) {
                    self.onResponse(this, this.responseURL)
                }

                if (oldOnReadyStateChange) {
                    oldOnReadyStateChange.call(this, event)
                }
            }

            oldSend.call(this, body)
        }
    }

    /*
     * a hook which a subclass can use to veto an expansion.
     *
     * used by TweetDeck Direct to preserve t.co URLs which are expanded in the
     * UI (via a data-full-url attribute on the link)
     */
    protected isWritable (_context: JsonObject): boolean {
        return true
    }

    /*
     * traverse an object by hijacking JSON.stringify's visitor (replacer).
     * dispatches each node to the +visit+ method
     */
    protected traverse (state: State, data: Json): void {
        if (!isObject(data)) {
            return
        }

        const self = this
        const replacer = function (this: JsonObject, key: string, value: Json) {
            return Array.isArray(this) ? value : self.visit(state, this, key, value)
        }

        JSON.stringify(data, replacer)
    }

    /*
     * visitor callback which replaces a t.co +url+ property in an object with
     * its expanded version
     */
    protected visit (state: State, context: Dict, key: string, value: Json): Json {
        // exclude subtrees which never contain t.co URLs
        if (PRUNE_KEYS.has(key)) {
            return 0 // a terminal value to stop traversal
        }

        switch (key) {
            case 'binding_values':
                // we only care about the "card_url" property in binding_values
                // objects/arrays. exclude the other 24 properties
                return this.transformBindingValues(value)

            case 'legacy':
                // reduce the keys under context.legacy (typically around 30) to
                // the handful we care about
                if (isPlainObject(value)) {
                    return this.transformLegacyObject(value)
                }
                break

            case 'string_value':
            case 'url':
                // expand t.co URL nodes in place
                if (isTrackedUrl(value)) {
                    return this.transformURL(state, context, key, value)
                }
                break

            case 'summary':
                // extract expanded URLs from a summary object (used in
                // Community Notes)
                if (isSummary(value)) {
                    return this.transformSummary(state, value)
                }
        }

        return value
    }
}
