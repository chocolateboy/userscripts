// ==UserScript==
// @name          IMDb Tomatoes
// @description   Add Rotten Tomatoes ratings to IMDb movie and TV show pages
// @author        chocolateboy
// @copyright     chocolateboy
// @version       4.4.2
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       /^https://www\.imdb\.com/title/tt[0-9]+/([#?].*)?$/
// @require       https://code.jquery.com/jquery-3.6.0.min.js
// @require       https://cdn.jsdelivr.net/gh/urin/jquery.balloon.js@8b79aab63b9ae34770bfa81c9bfe30019d9a13b0/jquery.balloon.js
// @require       https://unpkg.com/dayjs@1.10.6/dayjs.min.js
// @require       https://unpkg.com/dayjs@1.10.6/plugin/relativeTime.js
// @require       https://unpkg.com/@chocolateboy/uncommonjs@3.1.2/dist/polyfill.iife.min.js
// @require       https://unpkg.com/bury@0.1.0/dist/bury.js
// @require       https://unpkg.com/fast-dice-coefficient@1.0.3/dice.js
// @require       https://unpkg.com/get-wild@1.5.0/dist/index.umd.min.js
// @resource      api https://pastebin.com/raw/hcN4ysZD
// @resource      overrides https://pastebin.com/raw/SjPAGJuz
// @grant         GM_addStyle
// @grant         GM_deleteValue
// @grant         GM_getResourceText
// @grant         GM_getValue
// @grant         GM_listValues
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// @grant         GM_xmlhttpRequest
// @connect       www.rottentomatoes.com
// @run-at        document-start
// @noframes
// ==/UserScript==

/// <reference types="greasemonkey" />
/// <reference types="jquery" />
/// <reference types="tampermonkey" />

/**
 * @typedef {Object} AsyncGetOptions
 *
 * @prop {Record<string, string | number | boolean>} [params]
 * @prop {string} [title]
 * @prop {Partial<Tampermonkey.Request>} [request]
 */

'use strict';

/* begin */ {

const API_LIMIT             = 100
const DATA_VERSION          = 1
const INACTIVE_MONTHS       = 3
const MAX_YEAR_DIFF         = 3
const METADATA_VERSION      = { stats: 1 }
const NO_CONSENSUS          = 'No consensus yet.'
const NO_MATCH              = 'no matching results'
const ONE_DAY               = 1000 * 60 * 60 * 24
const ONE_WEEK              = ONE_DAY * 7
const RT_BASE               = 'https://www.rottentomatoes.com'
const SCRIPT_NAME           = GM_info.script.name
const TITLE_MATCH_THRESHOLD = 0.6

const BALLOON_OPTIONS = {
    classname: 'rt-consensus-balloon',
    css: {
        fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
        fontSize: '0.9rem',
        lineHeight: '1.26rem',
        maxWidth: '31rem',
        padding: '0.75rem',
    },
    html: true,
    position: 'bottom',
}

const COLOR = {
    tbd: '#d9d9d9',
    fresh: '#67ad4b',
    rotten: '#fb3c3c',
}

const CONNECTION_ERROR = {
    status: 420,
    statusText: 'Connection Error',
}

const RT_TYPE = {
    TVSeries: 'tvSeries',
    Movie: 'movie',
}

const STATS = {
    request: 0,
    hit: 0,
    miss: 0,
    preload: {
        hit:   0,
        miss:  0,
    },
}

const UNSHARED = Object.freeze({
    got: -1,
    want: 1,
    max: 0,
})

/*
 * the minimum number of elements shared between two Sets for them to be
 * deemed similar
 *
 * @type {<T>(smallest: Set<T>, largest: Set<T>) => number}
 */
const MINIMUM_SHARED = smallest => Math.round(smallest.size / 2)

// log a message to the console
const { debug, info, log, warn } = console

/**
 * deep-clone a JSON-serializable value
 *
 * @type {<T>(value: T) => T}
 */
const clone = value => JSON.parse(JSON.stringify(value))

// a custom version of get-wild's `get` function which uses a simpler/faster
// path parser since we don't use the extended syntax
const get = exports.getter({ split: '.' })

/**
 * register a jQuery plugin which extracts and returns JSON-LD data for the
 * loaded document
 *
 * used to extract metadata on IMDb and Rotten Tomatoes
 *
 * @param {string} id
 */
$.fn.jsonLd = function jsonLd (id) {
    const $script = this.find('script[type="application/ld+json"]')

    let data

    if ($script.length) {
        try {
            data = JSON.parse($script.first().text().trim())
        } catch (e) {
            throw new Error(`Can't parse JSON-LD data for ${id}: ${e}`)
        }
    } else {
        throw new Error(`Can't find JSON-LD data for ${id}`)
    }

    return data
}

const MovieMatcher = {
    /**
     * return the consensus from a movie page as a HTML string
     *
     * @param {JQuery<Document>} $rt
     */
    getConsensus ($rt) {
        return $rt.find('[data-qa="score-panel-critics-consensus"], [data-qa="critics-consensus"]')
            .first()
            .html()
    },

    /**
     * get the timestamp (ISO-8601 string) of the last time an RT movie page was
     * updated, e.g. the date of the most-recently published review
     *
     * @param {any} rtMeta
     * @param {string[]} dateProps
     * @return {string | undefined}
     */
    lastModified ({ meta: rtMeta }) {
        let updated

        if (rtMeta.review?.length) {
            debug('reviews:', rtMeta.review.length)

            const [latest] = rtMeta.review
                .flatMap(review => {
                    return review.dateCreated
                        ? [{ review, mtime: dayjs(review.dateCreated).unix() }]
                        : []
                })
                .sort((a, b) => b.mtime - a.mtime)

            if (latest) {
                updated = latest.review.dateCreated
                debug('updated (most recent review):', updated)
            }
        }

        if (!updated && (updated = rtMeta.dateModified)) {
            debug('updated (page modified):', updated)
        }

        return updated
    },

    /**
     * return a movie record ({ url: string }) from the API results which
     * matches the supplied IMDb data
     *
     * @param {any} rtResults
     * @param {any} imdb
     * @return {{ match: { url: string }, verify?: ($rt: JQuery & { meta: any }) => boolean } | void}
     */
    match (rtResults, imdb) {
        const sorted = rtResults.movies
            .flatMap((rt, index) => {
                if (!(rt.name && rt.url && rt.castItems)) {
                    return []
                }

                const { name: title } = rt
                const rtCast = pluck(rt.castItems, 'name').map(stripRtName)

                let castMatch = -1, verify = true

                if (rtCast.length) {
                    const { got, want } = shared(rtCast, imdb.fullCast)

                    if (got >= want) {
                        verify = false
                        castMatch = got
                    } else {
                        return []
                    }
                }

                const yearDiff = (imdb.year && rt.year)
                    ? { value: Math.abs(imdb.year - rt.year) }
                    : null

                if (yearDiff && yearDiff.value > MAX_YEAR_DIFF) {
                    return []
                }

                const titleMatch = titleSimilarity({ imdb, rt: { title } })

                const result = {
                    title,
                    url: rt.url,
                    rating: rt.meterScore,
                    popularity: (rt.meterScore == null ? 0 : 1),
                    cast: rtCast,
                    year: rt.year,
                    index,
                    titleMatch,
                    castMatch,
                    yearDiff,
                    verify,
                }

                return [result]
            })
            .sort((a, b) => {
                // combine the title and the year into a single score
                //
                // being a year or two out shouldn't be a dealbreaker, and it's
                // not uncommon for an RT title to differ from the IMDb title
                // (e.g. an AKA), so we don't want one of these to pre-empt the
                // other (yet)
                const score = new Score()

                score.add(b.titleMatch - a.titleMatch)

                if (a.yearDiff && b.yearDiff) {
                    score.add(a.yearDiff.value - b.yearDiff.value)
                }

                return (b.castMatch - a.castMatch)
                    || (score.b - score.a)
                    || (b.titleMatch - a.titleMatch) // prioritise the title if we're still deadlocked
                    || (b.popularity - a.popularity) // last resort
            })

        debug('matches:', sorted)

        return sorted[0]
    },

    /**
     * return the likely RT path for an IMDb movie title, e.g.:
     *
     *   title: "Bolt"
     *   path:  "/m/bolt"
     *
     * @param {string} title
     */
    rtPath (title) {
        return `/m/${rtName(title)}`
    },

    /**
     * confirm the supplied RT page data matches the IMDb metadata
     *
     * @param {any} imdb
     * @param {JQuery<Document> & { meta: any }} $rt
     */
    verify (imdb, $rt) {
        // in theory, we can verify the cast when the page is loaded. in
        // practice, it doesn't work: if the cast is missing from the
        // API results, it's also missing from the page's metadata
        //
        // when the cast is missing from the metadata, the directors are
        // often missing from the metadata as well, so we try to scrape
        // them instead

        /** @type {string[]} */
        // @ts-ignore
        const rtDirectors = $rt.meta.director?.length
            ? pluck($rt.meta.director, 'name').map(stripRtName)
            : $rt.find('[data-qa="movie-info-director"]').get().map(it => it.textContent?.trim())

        return verifyShared({
            imdb: imdb.directors,
            rt: rtDirectors,
            name: 'directors',
        })
    },
}

const TVMatcher = {
    /**
     * return the consensus from a TV page as a HTML string
     *
     * @param {JQuery<Document>} $rt
     */
    getConsensus ($rt) {
        return $rt.find('season-list-item[consensus]')
            .last()
            .attr('consensus')
    },

    /**
     * return the last-modified date for a TV show
     *
     * we can't extract this value from TV show overview pages, so we return
     * undefined, which selects the default caching period (currently one week).
     *
     * @param {JQuery<Document> & { meta: any, document: Document }} $rt
     * @return {string | undefined}
     */
    lastModified () {
        return undefined
    },

    /**
     * return a TV show record ({ url: string }) from the API results which
     * matches the supplied IMDb data
     *
     * @param {any} rtResults
     * @param {any} imdb
     * @return {{ match: { url: string }, verify?: ($rt: JQuery & { meta: any }) => boolean } | void}
     */
    match (rtResults, imdb) {
        const sorted = rtResults.tvSeries
            .flatMap((rt, index) => {
                const { title, startYear, endYear, url } = rt

                if (!(title && (startYear || endYear) && url)) {
                    return []
                }

                const titleMatch = titleSimilarity({ imdb, rt })

                if (titleMatch < TITLE_MATCH_THRESHOLD) {
                    return []
                }

                const dateDiffs = {}

                for (const dateProp of ['startYear', 'endYear']) {
                    if (imdb[dateProp] && rt[dateProp]) {
                        const diff = Math.abs(imdb[dateProp] - rt[dateProp])

                        if (diff > MAX_YEAR_DIFF) {
                            return []
                        } else {
                            dateDiffs[dateProp] = { value: diff }
                        }
                    }
                }

                let suffix, $url

                const match = url.match(/^(\/tv\/[^/]+)(?:\/(.+))?$/)

                if (match) {
                    suffix = match[2]
                    $url = match[1]
                } else {
                    warn("can't parse RT URL:", url)
                    return []
                }

                const seasonsDiff = (suffix === 's01' && imdb.seasons)
                    ? { value: imdb.seasons - 1 }
                    : null

                const result = {
                    title,
                    url: $url,
                    rating: rt.meterScore,
                    popularity: (rt.meterScore == null ? 0 : 1),
                    startYear,
                    endYear,
                    index,
                    titleMatch,
                    startYearDiff: dateDiffs.startYear,
                    endYearDiff: dateDiffs.endYear,
                    seasonsDiff,
                    verify: true,
                }

                return [result]
            })
            .sort((a, b) => {
                const score = new Score()

                score.add(b.titleMatch - a.titleMatch)

                if (a.startYearDiff && b.startYearDiff) {
                    score.add(a.startYearDiff.value - b.startYearDiff.value)
                }

                if (a.endYearDiff && b.endYearDiff) {
                    score.add(a.endYearDiff.value - b.endYearDiff.value)
                }

                if (a.seasonsDiff && b.seasonsDiff) {
                    score.add(a.seasonsDiff.value - b.seasonsDiff.value)
                }

                return (score.b - score.a)
                    || (b.titleMatch - a.titleMatch) // prioritise the title if we're still deadlocked
                    || (b.popularity - a.popularity) // last resort
            })

        debug('matches:', sorted)

        return sorted[0] // may be undefined
    },

    /**
     * return the likely RT path for an IMDb TV show title, e.g.:
     *
     *   title: "Sesame Street"
     *   path:  "/tv/sesame_street"
     *
     * @param {string} title
     */
    rtPath (title) {
        return `/tv/${rtName(title)}`
    },

    /**
     * confirm the supplied RT page data matches the IMDb metadata
     *
     * @param {any} imdb
     * @param {JQuery<Document> & { meta: any }} $rt
     */
    verify (imdb, $rt) {
        /** @type {string[]} */
        // @ts-ignore
        const rtCast = $rt.meta.actor?.length
            ? pluck($rt.meta.actor, 'name').map(stripRtName)
            : $rt.find('[data-qa="cast-member"]').get().map(it => it.textContent?.trim())

        // compare the RT cast with the partial IMDb cast and the full IMDb cast
        // and select the one which produces the best match
        const partialShared = shared(rtCast, imdb.cast)
        const fullShared = shared(rtCast, imdb.fullCast)
        const partialDiff = partialShared.got - partialShared.want
        const fullDiff = fullShared.got - fullShared.want
        const imdbCast = partialDiff > fullDiff ? imdb.cast : imdb.fullCast

        return verifyShared({ imdb: imdbCast, rt: rtCast })
    }
}

const Matcher = {
    tvSeries: TVMatcher,
    movie: MovieMatcher,
}

/*
 * a helper class which keeps a running total of scores for two values (a and
 * b). used to rank values in a sort function
 */
class Score {
    constructor () {
        this.a = 0
        this.b = 0
    }

    /**
     * add a score to the total
     *
     * @param {number} order
     * @param {number=} points
     */
    add (order, points = 1) {
        if (order < 0) {
            this.a += points
        } else if (order > 0) {
            this.b += points
        }
    }
}

/******************************************************************************/

/**
 * raise a non-error exception indicating no matching result has been found
 *
 * @param {string} message
 * @throws {Error}
 */
function abort (message = NO_MATCH) {
    throw Object.assign(new Error(message), { abort: true })
}

/**
 * add a Rotten Tomatoes widget to the ratings bar
 *
 * @param {JQuery} $ratings
 * @param {JQuery} $imdbRating
 * @param {Object} data
 * @param {string} data.url
 * @param {string} data.consensus
 * @param {number} data.rating
 */
function addWidget ($ratings, $imdbRating, { consensus, rating, url }) {
    let style

    if (rating === -1) {
        style = 'tbd'
    } else if (rating < 60) {
        style = 'rotten'
    } else {
        style = 'fresh'
    }

    // clone the IMDb rating widget
    const $rtRating = $imdbRating.clone()

    // 1) assign a unique ID
    $rtRating.attr('id', 'rt-rating')

    // 2) add a custom stylesheet which:
    //
    //   - sets the star (SVG) to the right color
    //   - restores support for italics in the consensus text
    //   - reorders the appended widget (see attachWidget)
    GM_addStyle(`
        #rt-rating svg { color: ${COLOR[style]}; }
        #rt-rating { order: -1; }
        .rt-consensus-balloon em { font-style: italic; }
    `)

    // 3) remove the review count and its preceding spacer element
    $rtRating
        .find('[class^="AggregateRatingButton__TotalRatingAmount-"]')
        .prev()
        .addBack()
        .remove()

    // 4) replace "IMDb Rating" with "RT Rating"
    $rtRating.find('[class^="RatingBarButtonBase__Header-"]')
        .text('RT RATING')

    // 5) replace the IMDb rating with the RT score and remove the "/ 10" suffix
    const score = rating === -1 ? 'N/A' : `${rating}%`
    $rtRating
        .find('[class^="AggregateRatingButton__RatingScore-"]')
        .text(score)
        .next()
        .remove()

    // 6) rename the testids, e.g.:
    // hero-rating-bar__aggregate-rating -> hero-rating-bar__rt-rating
    $rtRating.find('[data-testid]').addBack().each(function () {
        $(this).attr('data-testid', (_, id) => id.replace('aggregate', 'rt'))
    })

    // 7) update the link's label and URL
    $rtRating
        .find('a[role="button"]')
        .attr({ 'aria-label': 'View RT Rating', href: url })

    // 8) attach the tooltip to the widget
    const balloonOptions = Object.assign({}, BALLOON_OPTIONS, { contents: consensus })
    $rtRating.balloon(balloonOptions)

    // 9) prepend the widget to the ratings bar
    attachWidget($ratings, $rtRating)
}

/**
 * promisified cross-origin HTTP requests
 *
 * @param {string} url
 * @param {AsyncGetOptions} [options]
 */
function asyncGet (url, options = {}) {
    if (options.params) {
        url = url + '?' + $.param(options.params)
    }

    const id = options.title || url
    const request = Object.assign({ method: 'GET', url }, options.request || {})

    return new Promise((resolve, reject) => {
        request.onload = res => {
            if (res.status >= 400) {
                const error = Object.assign(
                    new Error(`error fetching ${id} (${res.status} ${res.statusText})`),
                    { status: res.status, statusText: res.statusText }
                )

                reject(error)
            } else {
                resolve(res)
            }
        }

        // XXX apart from +finalUrl+, the +onerror+ response object doesn't
        // contain any useful info
        request.onerror = _res => {
            const { status, statusText } = CONNECTION_ERROR
            const error = Object.assign(
                new Error(`error fetching ${id} (${status} ${statusText})`),
                { status, statusText },
            )

            reject(error)
        }

        GM_xmlhttpRequest(request)
    })
}

/**
 * attach the RT ratings widget to the ratings bar
 *
 * although the widget appears to be prepended to the bar, we need to append it
 * (and reorder it via CSS) to work around React reconciliation (updating the
 * DOM to match the (virtual DOM representation of the) underlying model) after
 * we've added the RT widget
 *
 * when this synchronisation occurs, React will try to restore nodes
 * (attributes, text, elements) within each widget to match the widget's props,
 * so the first widget will be updated in place to match the data for the IMDb
 * rating etc. this changes some, but not all nodes within an element, and most
 * attributes added to/changed in the RT widget remain in the updated IMDb
 * widget, including its ID attribute (rt-rating) which controls the color of
 * the rating star. as a result, we end up with a restored IMDb widget but with
 * an RT-colored star (and with the RT widget removed since it's not in the
 * ratings-bar model)
 *
 * if we *append* the RT widget, none of the other widgets will need to be
 * changed/updated if the DOM is re-synced so we won't end up with a mangled
 * IMDb widget; however, our RT widget will still be removed since it's not in
 * the model. to rectify this, we use a mutation observer to detect and revert
 * its removal
 *
 * @param {JQuery} $target
 * @param {JQuery} $rtRating
 */
function attachWidget ($target, $rtRating) {
    const init = { childList: true }
    const target = $target.get(0)
    const rtRating = $rtRating.get(0)
    const callback = () => {
        if (target.lastElementChild !== rtRating) {
            observer.disconnect()
            target.appendChild(rtRating)
            observer.observe(target, init)
        }
    }

    const observer = new MutationObserver(callback)
    target.appendChild(rtRating)
    observer.observe(target, init)
}

/**
 * check the override data in case of a failed match, but only use it as a last
 * resort, i.e. try the verifier first in case the data has been fixed/updated
 *
 * @param {any} match
 * @param {string} imdbId
 */
function checkOverrides (match, imdbId) {
    const overrides = JSON.parse(GM_getResourceText('overrides'))
    const url = overrides[imdbId]

    if (url) {
        const $url = JSON.stringify(url)

        if (!match) { // missing result
            debug('fallback:', $url)
            match = { url }
        } else if (match.url !== url) { // wrong result
            const $overridden = JSON.stringify(match.url)
            debug(`override: ${$overridden} -> ${$url}`)
            match.url = url
        }

        Object.assign(match, { verify: true, force: true })
    }

    return match
}

/**
 * extract IMDb metadata from the GraphQL data embedded in the page
 *
 * @param {string} imdbId
 * @param {string} rtType
 */
function getIMDbMetadata (imdbId, rtType) {
    const data = JSON.parse($('#__NEXT_DATA__').text())

    const decorate = data => {
        return { data, size: Object.keys(data).length }
    }

    // there are multiple matching subtrees (with different but partially
    // overlapping keys). order them in descending order of size (number of keys)
    const titles = get(data, 'props.urqlState.*.data.title', [])
        .filter(title => title.id === imdbId)
        .map(decorate)
        .sort((a, b) => b.size - a.size)
        .map(it => it.data)

    const [main, extra] = titles
    const mainCast = get(main, 'principalCast.*.credits.*.name.nameText.text', [])
    const extraCast = get(main, 'cast.edges.*.node.name.nameText.text', [])
    const fullCast = Array.from(new Set([...mainCast, ...extraCast]))
    const title = get(main, 'titleText.text', '')
    const originalTitle = get(main, 'originalTitleText.text', '')
    const year = get(main, 'releaseYear.year') || 0
    const type = get(main, 'titleType.id', '')
    const meta = {
        id: imdbId,
        cast: mainCast,
        fullCast,
        title,
        originalTitle,
        type,
    }

    if (rtType === 'tvSeries') {
        meta.startYear = year
        meta.endYear = get(extra, 'releaseYear.endYear') || 0
        meta.seasons = get(main, 'episodes.seasons.length') || 0
    } else if (rtType === 'movie') {
        meta.directors = get(main, 'directors.*.credits.*.name.nameText.text', [])
        meta.year = year
    }

    return meta
}

/**
 * parse the API's response and extract the RT rating and consensus.
 *
 * if there's no consensus, default to "No consensus yet."
 * if there's no rating, default to -1
 *
 * @param {any} imdb
 * @param {keyof Matcher} rtType
 */
async function getRTData (imdb, rtType) {
    log(`querying API for ${JSON.stringify(imdb.title)}`)

    /** @type {AsyncGetOptions} */
    const apiRequest = {
        params: { t: rtType, q: imdb.title, limit: API_LIMIT },
        request: { responseType: 'json' },
        title: 'API',
    }

    const matcher = Matcher[rtType]

    // we preload the anticipated RT page URL at the same time as the API request.
    // the URL is the obvious path-formatted version of the IMDb title, e.g.:
    //
    //   movie:       "Bolt"
    //   preload URL: https://www.rottentomatoes.com/m/bolt
    //
    //   tvSeries:    "Sesame Street"
    //   preload URL: https://www.rottentomatoes.com/tv/sesame_street
    //
    // this guess produces the correct URL most (e.g. > 80%) of the time
    //
    // preloading this page serves two purposes:
    //
    // 1) it reduces the time spent waiting for the RT widget to be displayed.
    // rather than querying the API and *then* loading the page, the requests
    // run concurrently, effectively halving the waiting time in most cases
    //
    // 2) it serves as a fallback if the API result:
    //
    //   a) is missing
    //   b) is invalid/fails to load
    //   c) loads but fails the verification check
    //
    const preload = (function () {
        const path = matcher.rtPath(imdb.title)
        const url = RT_BASE + path

        debug('preloading fallback URL:', url)

        /** @type {Promise<Tampermonkey.Response>} */
        const promise = asyncGet(url)
            .then(res => {
                debug(`preload response: ${res.status} ${res.statusText}`)
                return res
            })
            .catch(e => {
                debug(`error preloading ${url} (${e.status} ${e.statusText})`)
                preload.error = e
            })

        return {
            unused: false,
            error: null,
            fullUrl: url,
            promise,
            url: path,
        }
    })()

    const api = GM_getResourceText('api')

    /** @type {Tampermonkey.Response} */
    let res = await asyncGet(api, apiRequest)

    log(`API response: ${res.status} ${res.statusText}`)

    let results

    try {
        results = JSON.parse(res.responseText)
    } catch (e) {
        throw new Error(`can't parse response: ${e}`)
    }

    if (!results) {
        throw new Error('invalid JSON type')
    }

    debug('results:', results)

    const matched = matcher.match(results, imdb)
    const match = checkOverrides(matched, imdb.id) || {
        url: preload.url,
        verify: true,
        fallback: true,
    }

    debug('match:', match)
    log('matched:', !match.fallback)

    let url = RT_BASE + match.url
    let requestType = match.fallback ? 'fallback' : 'match'

    log(`loading ${requestType} URL:`, url)

    if (match.url === preload.url) {
        res = await preload.promise

        if (!res) {
            // @ts-ignore
            log(`error loading ${url} (${preload.error.status} ${preload.error.statusText})`)
            abort()
        }
    } else {
        try {
            res = await asyncGet(url)
            preload.unused = true // only set if the request succeeds
        } catch (error) { // bogus URL in API result (or transient server error)
            log(`error loading ${url} (${error.status} ${error.statusText})`)

            if (match.force) { // URL locked in checkOverrides
                abort()
            } else {
                requestType = 'fallback'
                url = preload.fullUrl
                log(`loading ${requestType} URL:`, url)

                res = await preload.promise

                if (!res) {
                    // @ts-ignore
                    log(`error loading ${url} (${preload.error.status} ${preload.error.statusText})`)
                    abort()
                }
            }
        }
    }

    log(`${requestType} response: ${res.status} ${res.statusText}`)

    let $rt = loadRT(res, match.url)

    if (match.verify) {
        let verified = matcher.verify(imdb, $rt)

        if (!verified) {
            if (match.force) {
                log('force:', true)
                verified = true
            } else if (preload.unused) {
                requestType = 'fallback'
                url = preload.fullUrl
                log(`loading ${requestType} URL:`, url)

                res = await preload.promise

                if (res) {
                    log(`${requestType} response: ${res.status} ${res.statusText}`)
                    $rt = loadRT(res, preload.url)
                    verified = matcher.verify(imdb, $rt)
                } else {
                    // @ts-ignore
                    log(`error loading ${url} (${preload.error.status} ${preload.error.statusText})`)
                }
            }

            if (!verified) {
                abort()
            }
        }
    }

    const consensus = matcher.getConsensus($rt)?.trim()?.replace(/--/g, '&#8212;') || NO_CONSENSUS
    const updated = matcher.lastModified($rt)
    const $rating = $rt.meta.aggregateRating
    const rating = Number(($rating.name === 'Tomatometer' ? $rating.ratingValue : null) ?? -1)

    return {
        data: { consensus, rating, url },
        preloadUrl: preload.fullUrl,
        updated,
    }
}

/**
 *
 * take an XHR response object and transform it into a JQuery document wrapper
 * with a +meta+ property containing the page's parsed JSON-LD data
 *
 * @param {Tampermonkey.Response} res
 * @param {string} id
 */
function loadRT (res, id) {
    const parser = new DOMParser()
    const dom = parser.parseFromString(res.responseText, 'text/html')
    const $rt = $(dom)
    const meta = $rt.jsonLd(id)
    return Object.assign($rt, { meta, document: dom })
}

/**
 * normalize names so matches don't fail due to minor differences in casing or
 * punctuation
 *
 * @param {string} name
 */
function normalize (name) {
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036F]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * extract the value of a property (dotted path) from each member of an array
 *
 * @param {any[] | undefined} array
 * @param {string} path
 */
function pluck (array, path) {
    return (array || []).map(it => get(it, path))
}

/**
 * purge expired entries from the cache older than the supplied date
 * (milliseconds since the epoch). if the date is -1, purge all entries
 *
 * @param {number} date
 */
function purgeCached (date) {
    for (const key of GM_listValues()) {
        const json = GM_getValue(key, '{}')
        const value = JSON.parse(json)
        const metadataVersion = METADATA_VERSION[key]

        if (metadataVersion) { // persistent (until the next METADATA_VERSION[key] change)
            if (value.version !== metadataVersion) {
                log(`purging invalid metadata (obsolete version: ${value.version}): ${key}`)
                GM_deleteValue(key)
            }
        } else if (value.version !== DATA_VERSION) {
            log(`purging invalid data (obsolete version: ${value.version}): ${key}`)
            GM_deleteValue(key)
        } else if (date === -1 || (typeof value.expires !== 'number') || date > value.expires) {
            log(`purging expired value: ${key}`)
            GM_deleteValue(key)
        }
    }
}

/**
 * convert an IMDb title into the most likely basename (final part of the URL)
 * for that title on Rotten Tomatoes, e.g.:
 *
 *   "A Stitch in Time" -> "a_stitch_in_time"
 *   "Lilo & Stitch"    -> "lilo_and_stitch"
 *   "Peter's Friends"  -> "peters_friends"
 *
 * @param {string} title
 */
function rtName (title) {
    const name = title
        .replace(/\s+&\s+/g, ' and ')
        .replace(/'/g, '')

    return normalize(name).replace(/\s+/g, '_')
}

/**
 * given two arrays of strings, return an object containing:
 *
 *   - got: the number of shared strings (strings common to both)
 *   - want: the required number of shared strings (minimum: 1)
 *   - max: the maximum possible number of shared strings
 *
 * if either array is empty, the number of strings they have in common is -1
 *
 * @param {Iterable<string>} a
 * @param {Iterable<string>} b
 * @param {Object} [options]
 * @param {(smallest: Set<string>, largest: Set<string>) => number} [options.min]
 * @param {(value: string) => string} [options.map]
 */
function shared (a, b, { min = MINIMUM_SHARED, map: transform = normalize } = {}) {
    const $a = new Set(Array.from(a, transform))

    if ($a.size === 0) {
        return UNSHARED
    }

    const $b = new Set(Array.from(b, transform))

    if ($b.size === 0) {
        return UNSHARED
    }

    const [smallest, largest] = $a.size < $b.size ? [$a, $b] : [$b, $a]

    // we always want at least 1 even if the maximum is 0
    const want = Math.max(min(smallest, largest), 1)

    let count = 0

    for (const value of smallest) {
        if (largest.has(value)) {
            ++count
        }
    }

    return { got: count, want, max: smallest.size }
}

/**
 * return the similarity between two strings, ranging from 0 (no similarity) to
 * 2 (identical)
 *
 *   similarity("John Woo", "John Woo")                   // 2
 *   similarity("Matthew Macfadyen", "Matthew MacFadyen") // 1
 *   similarity("Alan Arkin", "Zazie Beetz")              // 0
 *
 * @param {string} a
 * @param {string} b
 * @return {number}
 */
function similarity (a, b, map = normalize) {
    return a === b ? 2 : exports.dice(map(a), map(b))
}

/**
 * strip trailing sequence numbers in names in RT metadata, e.g.
 *
 *   - "Meng Li (IX)"       -> "Meng Li"
 *   - "Michael Dwyer (X) " -> "Michael Dwyer"
 *
 * @param {string} name
 */
function stripRtName (name) {
    return name.replace(/\s+\([IVXLCDM]+\)\s*$/, '')
}

/**
 * measure the similarity of an IMDb title and an RT title returned by the API
 *
 * RT titles for foreign-language films/shows sometimes contain the original
 * title at the end in brackets, so we take that into account
 *
 * note, we only use this if the original IMDb title differs from the main
 * IMDb title
 *
 *   similarity("The Swarm", "The Swarm (La Nuée)")                    // 0.66
 *   titleSimilarity({ imdb: "The Swarm", rt: "The Swarm (La Nuée)" }) // 2
 *
 * @param {Object} options
 * @param {{ title: string, originalTitle: string }} options.imdb
 * @param {{ title: string }} options.rt
 */
function titleSimilarity ({ imdb, rt }) {
    const rtTitle = rt.title
        .trim()
        .replace(/\s+/, ' ') // remove extraneous spaces, e.g. tt2521668
        .replace(/\s+\((?:US|UK|(?:(?:19|20)\d\d))\)$/, '')

    if (imdb.originalTitle && imdb.title !== imdb.originalTitle) {
        const match = rtTitle.match(/^(.+?)\s+\(([^)]+)\)$/)

        if (match) {
            const s1 = similarity(imdb.title, match[1])
            const s2 = similarity(imdb.title, match[2])
            const s3 = similarity(imdb.title, rtTitle)
            return Math.max(s1, s2, s3)
        } else {
            const s1 = similarity(imdb.title, rtTitle)
            const s2 = similarity(imdb.originalTitle, rtTitle)
            return Math.max(s1, s2)
        }
    }

    return similarity(imdb.title, rtTitle)
}

/**
 * return true if the supplied arrays are similar (sufficiently overlap), false
 * otherwise
 *
 * @param {Object} options
 * @param {string[]} options.imdb
 * @param {string=} options.name
 * @param {string[]} options.rt
 */
function verifyShared ({ imdb, rt, name = 'cast' }) {
    debug(`verifying ${name}`)
    debug(`imdb ${name}:`, imdb)
    debug(`rt ${name}:`, rt)
    const $shared = shared(rt, imdb)
    debug(`shared ${name}:`, $shared)
    const verified = $shared.got >= $shared.want
    log('verified:', verified)
    return verified
}

/******************************************************************************/

async function run () {
    const now = Date.now()

    // purgeCached(-1) // disable the cache
    purgeCached(now)

    const imdbId = $(`meta[property="imdb:pageConst"]`).attr('content')

    if (!imdbId) {
        // XXX shouldn't get here
        console.error("can't find IMDb ID:", location.href)
        return
    }

    log('id:', imdbId)

    // we clone the IMDb widget, so make sure it exists before navigating up to
    // its container
    const $imdbRating = $('[data-testid="hero-rating-bar__aggregate-rating"]').first()

    if (!$imdbRating.length) {
        info(`can't find IMDb rating for ${imdbId}`)
        return
    }

    const $ratings = $imdbRating.parent()

    // get the cached result for this page
    const cached = JSON.parse(GM_getValue(imdbId, 'null'))

    if (cached) {
        const expires = new Date(cached.expires).toLocaleString()

        if (cached.error) {
            log(`cached error (expires: ${expires}):`, cached.error)
        } else {
            log(`cached result (expires: ${expires}):`, cached.data)
            addWidget($ratings, $imdbRating, cached.data)
        }

        return
    } else {
        log('not cached')
    }

    const imdbType = $(document).jsonLd(location.href)?.['@type']
    const rtType = RT_TYPE[imdbType]

    if (!rtType) {
        info(`invalid type for ${imdbId}: ${imdbType}`)
        return
    }

    const imdb = getIMDbMetadata(imdbId, rtType)

    // do a basic sanity check to make sure it's valid
    if (!imdb?.type) {
        console.error(`can't find metadata for ${imdbId}`)
        return
    }

    log('metadata:', imdb)

    // add a { version, expires, data|error } entry to the cache
    const store = (dataOrError, ttl) => {
        const expires = now + ttl
        const cached = { version: DATA_VERSION, expires, ...dataOrError }
        const json = JSON.stringify(cached)
        GM_setValue(imdbId, json)
    }

    /** @type {{ version: number, data: typeof STATS }} */
    const stats = JSON.parse(GM_getValue('stats', 'null')) || {
        version: METADATA_VERSION.stats,
        data: clone(STATS),
    }

    /** @type {(path: string) => void} */
    const bump = path => {
        exports.bury(stats.data, path, get(stats.data, path, 0) + 1)
    }

    bump('request')

    try {
        const { data, updated: $updated, preloadUrl } = await getRTData(imdb, rtType)

        log('RT data:', data)
        bump('hit')
        bump(data.url === preloadUrl ? 'preload.hit' : 'preload.miss')

        let active = false

        if ($updated) {
            dayjs.extend(dayjs_plugin_relativeTime)

            const updated = dayjs($updated)
            const date = dayjs()
            const ago = date.to(updated)
            const delta = date.diff(updated, 'month', /* float */ true)

            active = delta <= INACTIVE_MONTHS

            log(`last update: ${updated.format('YYYY-MM-DD')} (${ago})`)
        }

        if (active) {
            log('caching result for: one day')
            store({ data }, ONE_DAY)
        } else {
            log('caching result for: one week')
            store({ data }, ONE_WEEK)
        }

        addWidget($ratings, $imdbRating, data)
    } catch (error) {
        bump('miss')
        bump('preload.miss')

        const message = error.message || String(error) // stringify

        log(`caching error for one day: ${message}`)
        store({ error: message }, ONE_DAY)

        if (!error.abort) {
            console.error(error)
        }
    } finally {
        debug('stats:', stats.data)
        GM_setValue('stats', JSON.stringify(stats))
    }
}

// register these first so data can be cleared even if there's an error
GM_registerMenuCommand(`${SCRIPT_NAME}: clear cache`, () => {
    purgeCached(-1)
})

GM_registerMenuCommand(`${SCRIPT_NAME}: clear stats`, () => {
    if (confirm('Clear stats?')) {
        log('clearing stats')
        GM_deleteValue('stats')
    }
})

// DOMContentLoaded typically fires several seconds after the IMDb ratings
// widget is displayed, which leads to an unacceptable delay if the result is
// already cached, so we hook into the earliest event which fires after the
// widget is loaded.
//
// this occurs when document.readyState transitions from "loading" to
// "interactive", which should be the first readystatechange event a userscript
// sees. on my system, this can occur up to 4 seconds before DOMContentLoaded
$(document).one('readystatechange', run)

/* end */ }
