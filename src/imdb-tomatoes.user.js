// ==UserScript==
// @name          IMDb Tomatoes
// @description   Add Rotten Tomatoes ratings to IMDb movie pages
// @author        chocolateboy
// @copyright     chocolateboy
// @version       4.0.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       http://*.imdb.tld/title/tt*
// @include       http://*.imdb.tld/*/title/tt*
// @include       https://*.imdb.tld/title/tt*
// @include       https://*.imdb.tld/*/title/tt*
// @require       https://code.jquery.com/jquery-3.6.0.min.js
// @require       https://cdn.jsdelivr.net/gh/urin/jquery.balloon.js@8b79aab63b9ae34770bfa81c9bfe30019d9a13b0/jquery.balloon.js
// @require       https://unpkg.com/dayjs@1.10.5/dayjs.min.js
// @require       https://unpkg.com/dayjs@1.10.5/plugin/relativeTime.js
// @require       https://unpkg.com/@chocolateboy/uncommonjs@3.1.2/dist/polyfill.iife.min.js
// @require       https://unpkg.com/get-wild@1.5.0/dist/index.umd.min.js
// @resource      query https://pastebin.com/raw/rynukt2g
// @resource      fallback https://cdn.jsdelivr.net/gh/chocolateboy/corrigenda@0.2.2/data/omdb-tomatoes.json
// @grant         GM_addStyle
// @grant         GM_deleteValue
// @grant         GM_getResourceText
// @grant         GM_getValue
// @grant         GM_listValues
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// @grant         GM_xmlhttpRequest
// @run-at        document-start
// @noframes
// ==/UserScript==

/*
 * Fixed:
 *
 *   RT/OMDb alias [1]:
 *
 *     - https://www.imdb.com/title/tt0120755/ - Mission: Impossible II
 */

/// <reference type="greasemonkey/v3">
/// <reference types="jquery" />
/// <reference type="tampermonkey">

// [1] unaliased and incorrectly aliased titles are common:
// http://web.archive.org/web/20151105080717/http://developer.rottentomatoes.com/forum/read/110751/2

// XXX metadata mismatch: Zéro de conduite [2] is a "Movie" in the old UI, but a
// "Short" in the new one
//
// [2] https://www.imdb.com/title/tt0024803/

'use strict';

/* begin */ {

const INACTIVE_MONTHS = 6
const NO_CONSENSUS    = 'No consensus yet.'
const NO_RESULTS      = 'no results found'
const ONE_DAY         = 1000 * 60 * 60 * 24
const ONE_WEEK        = ONE_DAY * 7
const SCRIPT_NAME     = GM_info.script.name
const SCRIPT_VERSION  = GM_info.script.version
const THIS_YEAR       = new Date().getFullYear()

const COLOR = {
    tbd: '#d9d9d9',
    favorable: '#66cc33',
    unfavorable: '#ff0000',
}

// the version of each cached record is a combination of the schema version and
// the major part of the script's (SemVer) version, and an additional number
// (the cache-generation) which can be incremented to force the cache to be
// cleared. the generation is reset when the schema or major versions change
//
// e.g. 4 (schema) + 3 (major) + 0 (generation) gives a version of "4/3.0"
//
// this means cached records are invalidated either a) when the schema changes,
// b) when the major version of the script changes, or c) when the generation is
// bumped
const SCHEMA_VERSION = 4
const SCRIPT_MAJOR = SCRIPT_VERSION.split('.')[0]
const CACHE_GENERATION = 0
const DATA_VERSION = `${SCHEMA_VERSION}/${SCRIPT_MAJOR}.${CACHE_GENERATION}`

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

// log a message to the console
const { debug, info, log } = console

// a custom version of get-wild's `get` function which uses a simpler/faster
// path parser since we don't use the extended syntax
const pluck = exports.getter({ split: '.' })

// register a jQuery plugin which extracts and returns JSON-LD data for the
// current page.
//
// used to extract metadata on Rotten Tomatoes
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

// take a record (object) from the OMDb fallback data (object) and convert it
// into the parsed format we expect to get back from the API, e.g.:
//
// before:
//
//     {
//         Title: "Example",
//         Ratings: [
//             {
//                 Source: "Rotten Tomatoes",
//                 Value: "42%"
//             }
//         ],
//         tomatoURL: "https://www.rottentomatoes.com/m/example"
//     }
//
// after:
//
//     {
//         CriticRating: 42,
//         RTConsensus: undefined,
//         RTUrl: "https://www.rottentomatoes.com/m/example",
//     }

function adaptOmdbData (data) {
    const ratings = data.Ratings || []
    const rating = ratings.find(it => it.Source === 'Rotten Tomatoes') || {}
    const score = rating.Value && parseInt(rating.Value)

    return {
        CriticRating: (Number.isInteger(score) ? score : null),
        RTConsensus: rating.tomatoConsensus,
        RTUrl: data.tomatoURL,
    }
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
    const balloonOptions = Object.assign({}, BALLOON_OPTIONS, { contents: consensus })

    let style

    if (rating === -1) {
        style = 'tbd'
    } else if (rating < 60) {
        style = 'unfavorable'
    } else {
        style = 'favorable'
    }

    // clone the IMDb rating widget
    const $rtRating = $imdbRating.clone()

    // 1) assign a unique ID
    $rtRating.attr('id', 'rt-rating')

    // 2) add a custom stylesheet which:
    //
    // - sets the star (SVG) to the right color
    // - restores support for italics in the consensus text
    // - reorders the appended widget (see attachWidget)
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

    // 7) add the tooltip class to the link and update its label and URL
    $rtRating.find('a[role="button"]')
        .addClass('rt-consensus')
        .balloon(balloonOptions)
        .attr('aria-label', 'View RT Rating')
        .attr('href', url)

    // 8) prepend the element to the ratings bar
    attachWidget($ratings, $rtRating)
}

// promisified cross-origin HTTP requests
function asyncGet (url, options = {}) {
    if (options.params) {
        url = url + '?' + encodeParams(options.params)
    }

    const request = Object.assign({ method: 'GET', url }, options.request || {})

    return new Promise((resolve, reject) => {
        request.onload = resolve

        // XXX the +onerror+ response object doesn't contain any useful info
        request.onerror = _res => {
            reject(new Error(`error fetching ${options.title || url}`))
        }

        GM_xmlhttpRequest(request)
    })
}

/*
 * attach the RT ratings widget to the ratings bar
 *
 * although the widget appears to be prepended to the bar, we need to append it
 * (and reorder it via CSS) to work around React reconciliation (syncing the DOM
 * to its underlying model (props)) after we've added the RT widget
 *
 * when this synchronisation is performed, React will try to restore nodes
 * (attributes, text, elements) within each widget to match the widget's props,
 * so the first widget will be updated in place to match the data for the IMDb
 * rating etc. this changes some, but not all nodes within an element, and most
 * (all?) attributes added to/changed in the RT widget remain in the updated
 * IMDb widget, including its ID attribute (rt-rating) which controls the color
 * of the rating star. as a result, we end up with a restored IMDb widget but
 * with an RT-colored star (and with the RT widget removed since it's not in the
 * ratings-bar model)
 *
 * if we *append* the RT widget, none of the other widgets will need to be
 * changed/updated if the DOM is re-synced so we won't end up with a mangled
 * IMDb widget; however, our RT widget will still be removed since it's not in
 * the model. to rectify this, we use a mutation observer to detect the deletion
 * and reinstate the widget
 *
 * @param {JQuery} $target
 * @param {JQuery} $rtRating
 */
function attachWidget ($target, $rtRating) {
    const init = { childList: true }
    const target = $target.get(0)
    const rtRating = $rtRating.get(0)
    const callback = mutations => {
        debug('mutations:', mutations)

        // we could detect it in mutations[*].removedNodes, but this is simpler
        if (target.lastElementChild !== rtRating) {
            observer.disconnect()
            target.appendChild(rtRating)
            observer.observe(target, init)
            debug('restored widget')
        }
    }

    const observer = new MutationObserver(callback)
    debug('added widget')
    target.appendChild(rtRating)
    observer.observe(target, init)
}

// URL-encode the supplied query parameter and replace encoded spaces ("%20")
// with plus signs ("+")
function encodeParam (param) {
    return encodeURIComponent(param).replace(/%20/g, '+')
}

// encode a dictionary of params as a query parameter string. this is similar to
// jQuery.params, but we additionally replace spaces ("%20") with plus signs
// ("+")
function encodeParams (params) {
    const pairs = []

    for (const [key, value] of Object.entries(params)) {
        pairs.push(`${encodeParam(key)}=${encodeParam(value)}`)
    }

    return pairs.join('&')
}

// parse the API's response and extract the RT rating and consensus.
//
// if there's no consensus, default to "No consensus yet."
// if there's no rating, default to -1
async function getRTData ({ response, imdbId, fallback }) {
    function fail (message) {
        throw new Error(message)
    }

    let results

    try {
        results = JSON.parse(JSON.parse(response)) // ಠ_ಠ
    } catch (e) {
        fail(`can't parse response: ${e}`)
    }

    if (!results) {
        fail('no response')
    }

    if (!Array.isArray(results)) {
        const type = {}.toString.call(results)
        fail(`invalid response: ${type}`)
    }

    let movie = results.find(it => it.imdbID === imdbId)

    if (!movie) {
        if (fallback) {
            log(`no results for ${imdbId} - using fallback data`)
            movie = adaptOmdbData(fallback)
        } else {
            fail(NO_RESULTS)
        }
    }

    let { RTConsensus: consensus, CriticRating: rating, RTUrl: rtUrl } = movie
    let updated, url

    if (rtUrl) {
        /*
         * remove cruft from the RT URL:
         *
         * - before:
         *
         *     https://www.rottentomatoes.com/m/foo&amp;bar=123abc
         *
         * - after:
         *
         *     https://www.rottentomatoes.com/m/foo
         */
        url = rtUrl.split('&')[0]

        log(`loading RT URL: ${url}`)
        const res = await asyncGet(url)
        log(`response: ${res.status} ${res.statusText}`)

        const parser = new DOMParser()
        const dom = parser.parseFromString(res.responseText, 'text/html')
        const $rt = $(dom)
        const $consensus = $rt.find('.what-to-know__section-body > span')

        if ($consensus.length) {
            consensus = $consensus.html().trim()
        }

        // update the rating
        const meta = $rt.jsonLd(url)
        const newRating = meta.aggregateRating.ratingValue

        if (newRating != rating) { // string != number
            log(`updating rating: ${rating} -> ${newRating}`)
            rating = newRating
        }

        if (meta.review?.length) {
            debug('reviews:', meta.review.length)
            const [latest] = meta.review
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

        if (!updated && (updated = meta.dateModified)) {
            debug('updated (page modified):', updated)
        }
    } else {
        fail(NO_RESULTS)
    }

    if (rating == null) {
        rating = -1
    }

    consensus = consensus ? consensus.replace(/--/g, '&#8212;') : NO_CONSENSUS

    return { data: { consensus, rating, url }, updated }
}

// extract metadata from the GraphQL data embedded in the page
function getMetadata (imdbId) {
    const meta = JSON.parse($('#__NEXT_DATA__').text())
    const pageType = pluck(meta, 'props.requestContext.pageType')

    // there are multiple matching subtrees (with different but partially
    // overlapping keys). select the first one with the required properties
    let title, type

    const found = pluck(meta, 'props.urqlState.*.data', [])
        .find(it => {
            return pluck(it, 'title.id') === imdbId
                && (title = pluck(it, 'title.titleText.text'))
                && (type = pluck(it, 'title.titleType.text'))
        })

    if (!found) {
        if (!title) {
            throw new TypeError("Can't find title in metadata")
        }

        if (!type) {
            throw new TypeError("Can't find type in metadata")
        }
    }

    return { pageType, title, type }
}

// purge expired entries
function purgeCached (date) {
    for (const key of GM_listValues()) {
        const json = GM_getValue(key)
        const value = JSON.parse(json)

        if (value.version !== DATA_VERSION) {
            log(`purging invalid value (obsolete data version (${value.version})): ${key}`)
            GM_deleteValue(key)
        } else if (date === -1 || (typeof value.expires !== 'number') || (date > value.expires)) {
            log(`purging expired value: ${key}`)
            GM_deleteValue(key)
        }
    }
}

async function run () {
    const imdbId = $('meta[property="imdb:pageConst"]').attr('content')

    if (!imdbId) {
        // XXX shouldn't get here
        console.error("can't find IMDb ID:", location.href)
        return
    }

    log('id:', imdbId)

    // we clone the IMDb widget, so make sure it exists before navigating up to
    // its container
    const $imdbRating = $('[data-testid="hero-rating-bar__aggregate-rating"]:visible')

    if (!$imdbRating.length) {
        info(`can't find IMDb rating for ${imdbId}`)
        return
    }

    const $ratings = $imdbRating.parent()
    const meta = getMetadata(imdbId)

    if (!meta) {
        console.error(`can't find metadata for ${imdbId}`)
        return
    }

    log('metadata:', meta)

    const { pageType, title, type } = meta

    if (type !== 'Movie') {
        info(`invalid type for ${imdbId}: ${type}`)
        return
    }

    if (pageType !== 'title') {
        info(`invalid page type for ${imdbId}: ${pageType}`)
        return
    }

    const now = Date.now()

    debug('data version:', DATA_VERSION)
    purgeCached(now)

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

    // add a { version, expires, data|error } entry to the cache
    const store = (dataOrError, ttl) => {
        const expires = now + ttl
        const cached = { version: DATA_VERSION, expires, ...dataOrError }
        const json = JSON.stringify(cached)

        GM_setValue(imdbId, json)
    }

    const query = JSON.parse(GM_getResourceText('query'))

    Object.assign(query.params, { title, yearMax: THIS_YEAR })

    try {
        log(`querying API for ${JSON.stringify(title)}`)

        const requestOptions = Object.assign({}, query, { title: `data for ${imdbId}` })
        const response = await asyncGet(query.api, requestOptions)
        const fallback = JSON.parse(GM_getResourceText('fallback'))

        log(`response: ${response.status} ${response.statusText}`)

        const { data, updated: $updated } = await getRTData({
            response: response.responseText,
            imdbId,
            fallback: fallback[imdbId],
        })

        log('RT data:', data)

        dayjs.extend(dayjs_plugin_relativeTime)

        const updated = dayjs($updated)
        const date = dayjs()
        const delta = date.diff(updated, 'month')
        const ago = date.to(updated)

        log(`last update: ${updated.format('YYYY-MM-DD')} (${ago})`)

        if (delta <= INACTIVE_MONTHS) {
            log(`caching result for: one day`)
            store({ data }, ONE_DAY)
        } else {
            log(`caching result for: one week`)
            store({ data }, ONE_WEEK)
        }

        addWidget($ratings, $imdbRating, data)
    } catch (error) {
        const message = error.message || String(error) // stringify

        log(`caching error for one day: ${message}`)
        store({ error: message }, ONE_DAY)

        if (message !== NO_RESULTS) {
            console.error(error)
        }
    }
}

// register this first so data can be cleared even if there's an error
GM_registerMenuCommand(SCRIPT_NAME + ': clear cache', () => { purgeCached(-1) })

$(window).on('DOMContentLoaded', run)

/* end */ }
