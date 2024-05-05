import {
    isNumber,
    isObject,
    isPlainObject,
    isString,
    Dict,
    Json,
    JsonObject,
} from './util'

type FullTextContext = Dict & {
    entities?: any;
    lang?: string;
}

type Target = { target: Dict, key: string };

type URLData = {
    url: string;
    expanded_url: string;
    indices: [number, number];
}

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
 * keys of "legacy" objects which URL data is known to be found in/under, e.g.
 * we're interested in legacy.user_refs.* and legacy.retweeted_status.*, but not
 * legacy.created_at or legacy.reply_count.
 *
 * legacy objects typically contain dozens of keys, but t.co URLs only exist in
 * a handful of them. typically this reduces the number of keys to traverse in a
 * legacy object from 30 on average (max 39) to 2 or 3.
 */
const LEGACY_KEYS = [
    'binding_values',
    'entities',
    'extended_entities',
    'full_text',
    'lang',
    'quoted_status_permalink',
    'retweeted_status',
    'retweeted_status_result',
    'user_refs',
]

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
    return (value: unknown) => urlPattern.test(value as string) && value as string
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
    return (value: unknown): value is string => urlPattern.test(value as string)
})()

const isURLData = (value: unknown): value is URLData => {
    return isPlainObject(value)
        && isString(value.url)
        && isString(value.expanded_url)
        && Array.isArray(value.indices)
        && isNumber(value.indices[0])
        && isNumber(value.indices[1])
}

class Replacer {
    private readonly seen = new Map<string, string>();
    private readonly unresolved = new Map<string, Target[]>();
    private count = 0;

    public static transform (data: JsonObject, path: string): number {
        const replacer = new Replacer()
        return replacer.transform(data, path)
    }

    /*
     * replace t.co URLs with the original URL in all locations in the document
     * which may contain them
     *
     * returns the number of substituted URLs
     */
    public transform (data: JsonObject, path: string): number {
        const { seen, unresolved } = this

        // [1] top-level tweet or user data (e.g. /favorites/create.json)
        if (Array.isArray(data) || ('id_str' in data) /* [1] */) {
            this.traverse(data)
        } else {
            for (const key of DOCUMENT_ROOTS) {
                if (key in data) {
                    this.traverse(data[key])
                }
            }
        }

        for (const [url, targets] of unresolved) {
            const expandedUrl = seen.get(url)

            if (expandedUrl) {
                for (const { target, key } of targets) {
                    target[key] = expandedUrl
                    ++this.count
                }

                unresolved.delete(url)
            }
        }

        if (unresolved.size) {
            console.warn(`unresolved URIs (${path}):`, Object.fromEntries(unresolved))
        }

        return this.count
    }

    /*
     * reduce the large binding_values array/object to the one property we care
     * about (card_url)
     */
    private onBindingValues (value: Json): Json {
        if (Array.isArray(value)) {
            const found = value.find(it => (it as Dict)?.key === 'card_url')
            return found ? [found] : 0
        } else if (isPlainObject(value) && isPlainObject(value.card_url)) {
            return [value.card_url]
        } else {
            return 0
        }
    }

    /*
     * handle cases where the t.co URL is already expanded, e.g.:
     *
     * {
     *     "entities": {
     *         "urls": [
     *             {
     *                 "display_url":  "example.com",
     *                 "expanded_url": "https://www.example.com",
     *                 "url":          "https://www.example.com",
     *                 "indices":      [16, 39]
     *             }
     *         ]
     *     },
     *     "full_text": "I'm on the bus! https://t.co/abcde12345"
     * }
     *
     * extract the corresponding t.co URLs from the text via the entities.urls
     * records and register the t.co -> expanded URL mappings so they can be
     * used later, e.g. https://t.co/abcde12345 -> https://www.example.com
     */
    private onFullText (context: FullTextContext, message: string): string {
        const seen = this.seen
        const urls = context.entities?.urls

        if (!(Array.isArray(urls) && urls.length)) {
            return message
        }

        for (let i = 0; i < urls.length; ++i) {
            const $url = urls[i]

            if (!isURLData($url)) {
                break
            }

            const {
                url,
                expanded_url: expandedUrl,
                indices: [start, end]
            } = $url

            const alreadyExpanded = !isTrackedUrl(url) && expandedUrl === url

            if (!alreadyExpanded) {
                continue
            }

            const trackedUrl = (context.lang === 'zxx') // just a URL
                ? message
                : Array.from(message).slice(start, end).join('')

            seen.set(trackedUrl, expandedUrl)
        }

        return message
    }

    /*
     * reduce the keys under context.legacy (typically around 30) to the
     * handful we care about
     */
    private onLegacyObject (value: Dict): Dict {
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
     * expand t.co URL nodes in place, either $.url or $.string_value in
     * binding_values arrays/objects
     */
    private onTrackedURL (context: Dict, key: string, url: string): string {
        const { seen, unresolved } = this

        let expandedUrl

        if ((expandedUrl = seen.get(url))) {
            context[key] = expandedUrl
            ++this.count
        } else if ((expandedUrl = checkUrl(context.expanded_url || context.expanded))) {
            seen.set(url, expandedUrl)
            context[key] = expandedUrl
            ++this.count
        } else {
            let targets = unresolved.get(url)

            if (!targets) {
                unresolved.set(url, targets = [])
            }

            targets.push({ target: context, key })
        }

        return url
    }

    /*
     * traverse an object by hijacking JSON.stringify's visitor (replacer).
     * dispatches each node to the +visit+ function
     */
    private traverse (data: Json): void {
        if (!isObject(data)) {
            return
        }

        const self = this
        const replacer = function (this: JsonObject, key: string, value: Json) {
            return Array.isArray(this) ? value : self.visit(this, key, value)
        }

        JSON.stringify(data, replacer)
    }

    /*
     * visitor callback which replaces a t.co +url+ property in an object with
     * its expanded URL
     */
    private visit (context: Dict, key: string, value: Json): Json {
        // exclude subtrees which never contain t.co URLs
        if (PRUNE_KEYS.has(key)) {
            return 0 // a terminal value to stop traversal
        }

        switch (key) {
            case 'binding_values':
                // we only care about the "card_url" property in binding_values
                // objects/arrays. exclude the other 24 properties
                return this.onBindingValues(value)

            case 'full_text':
                // if a URL is already expanded, extract its t.co URL and link
                // it to the expansion
                if (isString(value)) {
                    return this.onFullText(context, value)
                }
                break

            case 'legacy':
                // reduce the keys under context.legacy (typically around 30) to
                // the handful we care about
                if (isPlainObject(value)) {
                    return this.onLegacyObject(value)
                }
                break

            case 'string_value':
            case 'url':
                // expand t.co URL nodes in place
                if (isTrackedUrl(value)) {
                    return this.onTrackedURL(context, key, value)
                }
                break
        }

        return value
    }
}

export default Replacer
