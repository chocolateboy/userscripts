// ==UserScript==
// @name          IMDb Tomatoes
// @description   Add Rotten Tomatoes ratings to IMDb movie pages
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.10.2
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.imdb.tld/title/tt*
// @include       http://*.imdb.tld/*/title/tt*
// @include       https://*.imdb.tld/title/tt*
// @include       https://*.imdb.tld/*/title/tt*
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.jsdelivr.net/gh/urin/jquery.balloon.js@8b79aab63b9ae34770bfa81c9bfe30019d9a13b0/jquery.balloon.js
// @resource      query https://pastebin.com/raw/Ck86mQXs
// @grant         GM_addStyle
// @grant         GM_deleteValue
// @grant         GM_getResourceText
// @grant         GM_getValue
// @grant         GM_listValues
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// @grant         GM_xmlhttpRequest
// @noframes
// ==/UserScript==

/*
 * OK:
 *
 *     http://www.imdb.com/title/tt0309698/ - 4 widgets
 *     http://www.imdb.com/title/tt0086312/ - 3 widgets
 *     http://www.imdb.com/title/tt0037638/ - 2 widgets
 *
 * Fixed (layout):
 *
 *     http://www.imdb.com/title/tt0162346/ - 4 widgets
 *     http://www.imdb.com/title/tt0159097/ - 4 widgets
 *
 * Broken (incorrect RT/OMDb alias [1]):
 *
 *     http://www.imdb.com/title/tt0120755/ - Mission: Impossible II
 */

// [1] unaliased and incorrectly aliased titles are common:
// http://web.archive.org/web/20151105080717/http://developer.rottentomatoes.com/forum/read/110751/2

'use strict';

const NO_CONSENSUS    = 'No consensus yet.'
const NOW             = Date.now()
const ONE_DAY         = 1000 * 60 * 60 * 24
const ONE_WEEK        = ONE_DAY * 7
const SCRIPT_NAME     = GM_info.script.name
const SCRIPT_VERSION  = GM_info.script.version
const STATUS_TO_STYLE = { 'N/A': 'tbd', Fresh: 'favorable', Rotten: 'unfavorable' }
const THIS_YEAR       = new Date().getFullYear()

const COMPACT_LAYOUT = [
    '.plot_summary_wrapper .minPlotHeightWithPoster',
    '.plot_summary_wrapper .minPlotHeightWithPosterAndWatchlistButton'
].join(', ')

// the version of each cached record is a combination of the schema version and
// the <major>.<minor> parts of the script's (SemVer) version e.g. 3 (schema
// version) + 1.7.0 (script version) gives a version of "3/1.7"
//
// this means cached records are invalidated either a) when the schema changes
// or b) when the major or minor version (i.e. not the patch version) of the
// script changes
const SCHEMA_VERSION = 4
const DATA_VERSION = SCHEMA_VERSION + '/' + SCRIPT_VERSION.replace(/\.\d+$/, '') // e.g. 3/1.7

const BALLOON_OPTIONS = {
    classname: 'rt-consensus-balloon',
    css: {
        maxWidth: '31rem',
        fontFamily: 'sans-serif',
        fontSize: '0.9rem',
        padding: '0.75rem',
    },
    html: true,
    position: 'bottom',
}

// log a debug message to the console
function debug (message) {
    console.debug(message)
}

// promisified cross-origin HTTP requests
function get (url, options = {}) {
    if (options.params) {
        url = url + '?' + $.param(options.params)
    }

    const request = Object.assign({ method: 'GET', url }, options.request || {})

    return new Promise((resolve, reject) => {
        request.onload = resolve

        // XXX the onerror response object doesn't contain any useful info
        request.onerror = res => {
            reject(new Error(`error fetching ${options.title || url}`))
        }

        GM_xmlhttpRequest(request)
    })
}

// purge expired entries
function purgeCached (date) {
    for (const key of GM_listValues()) {
        const json = GM_getValue(key)
        const value = JSON.parse(json)

        if (value.expires === -1) { // persistent storage (currently unused)
            if (value.version !== SCHEMA_VERSION) {
                debug(`purging invalid value (obsolete schema version): ${key}`)
                GM_deleteValue(key)
            }
        } else if (value.version !== DATA_VERSION) {
            debug(`purging invalid value (obsolete data version): ${key}`)
            GM_deleteValue(key)
        } else if (date === -1 || (typeof value.expires !== 'number') || (date > value.expires)) {
            debug(`purging expired value: ${key}`)
            GM_deleteValue(key)
        }
    }
}

// prepend a widget to the review bar or append a link to the star box
// XXX the review bar now appears to be the default for all users
function affixRT ($target, data) {
    const { consensus, rating, url } = data

    let status

    if (rating === -1) {
        status = 'N/A'
    } else if (rating < 60) {
        status = 'Rotten'
    } else {
        status = 'Fresh'
    }

    const style = STATUS_TO_STYLE[status]

    if ($target.hasClass('titleReviewBar')) {
        // reduce the amount of space taken up by the Metacritic widget
        // and make it consistent with our style (i.e. site name rather
        // than domain name)
        $target.find('a[href="http://www.metacritic.com"]').text('Metacritic')

        // 4 review widgets is too many for the "compact" layout (i.e.
        // a poster but no trailer). it's designed for a maximum of 3.
        // to work around this, we hoist the review bar out of the
        // movie-info block (.plot_summary_wrapper) and float it left
        // beneath the poster e.g.:
        //
        // before:
        //
        // [  [        ] [                    ] ]
        // [  [        ] [                    ] ]
        // [  [ Poster ] [        Info        ] ]
        // [  [        ] [                    ] ]
        // [  [        ] [ [MC] [IMDb] [etc.] ] ]
        //
        // after:
        //
        // [  [        ] [                    ] ]
        // [  [        ] [                    ] ]
        // [  [ Poster ] [        Info        ] ]
        // [  [        ] [                    ] ]
        // [  [        ] [                    ] ]
        // [                                    ]
        // [  [RT] [MC] [IMDb] [etc.]           ]

        if ($(COMPACT_LAYOUT).length && $target.find('.titleReviewBarItem').length > 2) {
            const $clear = $('<div class="clear">&nbsp;</div>')

            $('.plot_summary_wrapper').after($target.remove())

            $target.before($clear).after($clear).css({
                'float':          'left',
                'padding-top':    '11px',
                'padding-bottom': '0px'
            })
        }

        const score = rating === -1 ? 'N/A' : rating

        const html = `
            <div class="titleReviewBarItem">
                <a href="${url}"><div
                    class="rt-consensus metacriticScore score_${style} titleReviewBarSubItem"><span>${score}</span></div></a>
               <div class="titleReviewBarSubItem">
                   <div>
                       <a href="${url}">Tomatometer</a>
                   </div>
                   <div>
                       <span class="subText">
                           From <a href="https://www.rottentomatoes.com" target="_blank">Rotten Tomatoes</a>
                       </span>
                   </div>
                </div>
            </div>
            <div class="divider"></div>
        `
        $target.prepend(html)
    } else {
        const score = rating === -1 ? 'N/A' : `${rating}%`

        const html = `
            <span class="ghost">|</span>
            Rotten Tomatoes:&nbsp;<a class="rt-consensus" href="${url}">${score}</a>
        `
        $target.append(html)
    }

    const balloonOptions = Object.assign({}, BALLOON_OPTIONS, { contents: consensus })

    $target.find('.rt-consensus').balloon(balloonOptions)
}

// parse the API's JSON response and extract the RT rating and consensus.
//
// if there's no consensus, default to "No consensus yet."
// if there's no rating, default to -1
async function getRTData (json, imdbId, title) {
    function fail (msg) {
        throw new Error(`error querying data for ${imdbId}: ${msg}`)
    }

    let response

    try {
        response = JSON.parse(JSON.parse(json)) // ಠ_ಠ
    } catch (e) {
        fail(`can't parse response: ${e}`)
    }

    if (!response) {
        fail('no response')
    }

    if (!$.isArray(response)) {
        const type = {}.toString.call(response)
        fail(`invalid response: ${type}`)
    }

    const [movie] = $.grep(response, it => it.imdbID === imdbId)

    if (!movie) {
        fail('no results found')
    }

    let { RTConsensus: consensus, RTCriticMeter: rating, RTUrl: url } = movie
    let updated = false

    if (url) {
        // the new way: the RT URL is provided: scrape the consensus from
        // that page

        debug(`loading RT URL for ${imdbId}: ${url}`)
        const res = await get(url)
        debug(`response for ${url}: ${res.status} ${res.statusText}`)

        const parser = new DOMParser()
        const dom = parser.parseFromString(res.responseText, 'text/html')
        const $rt = $(dom)
        const $consensus = $rt.find('.mop-ratings-wrap__text--concensus')

        if ($consensus.length) {
            consensus = $consensus.html().trim()
        }

        // update the rating
        const meta = $rt.jsonLd(url)
        const newRating = meta.aggregateRating.ratingValue

        if (Number.isInteger(newRating) && (newRating !== rating)) {
            debug(`updating rating for ${url}: ${rating} -> ${newRating}`)
            rating = newRating
            updated = true
        }
    } else {
        // the old way: a rating but no RT URL (or consensus).
        // this is still used for some old and new releases
        debug(`no Rotten Tomatoes URL for ${imdbId}`)
        url = `https://www.rottentomatoes.com/search/?search=${escape(title)}`
    }

    if (rating == null) {
        rating = -1
    }

    consensus = consensus ? consensus.replace(/--/g, '&#8212;') : NO_CONSENSUS

    return [{ consensus, rating, url }, updated]
}

// extract a property from a META element, or return null if the property is
// not defined
function prop (name) {
    const $meta = $(`meta[property="${name}"]`)
    return $meta.length ? $meta.attr('content') : null
}

async function main () {
    const pageType = prop('pageType')

    if (pageType !== 'title') {
        console.warn(`invalid page type for ${location.href}: ${pageType}`)
        return
    }

    const imdbId = prop('pageId')

    if (!imdbId) {
        console.warn(`Can't find IMDb ID for ${location.href}`)
        return
    }

    const meta = $(document).jsonLd(imdbId)
    const title = meta.name
    const type = meta['@type']

    if (type !== 'Movie') {
        debug(`invalid type for ${imdbId}: ${type}`)
        return
    }

    const $titleReviewBar = $('.titleReviewBar')
    const $starBox = $('.star-box-details')
    const $target = ($titleReviewBar.length && $titleReviewBar)
        || ($starBox.length && $starBox)

    if (!$target) {
        console.warn(`Can't find target for ${imdbId}`)
        return
    }

    purgeCached(NOW)

    const cached = JSON.parse(GM_getValue(imdbId, 'null'))

    if (cached) {
        const expires = new Date(cached.expires).toLocaleString()

        if (cached.error) {
            debug(`cached error (expires: ${expires}): ${imdbId}`)

            // couldn't retrieve any RT data so there's nothing
            // more we can do
            console.warn(cached.error)
        } else {
            debug(`cached result (expires: ${expires}): ${imdbId}`)
            affixRT($target, cached.data)
        }

        return
    } else {
        debug(`not cached: ${imdbId}`)
    }

    // add an { expires, version, data|error } entry to the cache
    function store (dataOrError, ttl) {
        const cached = Object.assign({
            expires: NOW + ttl,
            version: DATA_VERSION
        }, dataOrError)

        const json = JSON.stringify(cached)

        GM_setValue(imdbId, json)
    }

    const query = JSON.parse(GM_getResourceText('query'))

    Object.assign(query.params, { title, yearMax: THIS_YEAR })

    try {
        debug(`querying API for ${imdbId}`)
        const options = Object.assign({}, query, { title: `data for ${imdbId}` })
        const res = await get(query.api, options)
        debug(`response for ${imdbId}: ${res.status} ${res.statusText}`)

        const [data, updated] = await getRTData(res.responseText, imdbId, title)

        if (updated) {
            debug(`caching ${imdbId} result for one day`)
            store({ data }, ONE_DAY)
        } else {
            debug(`caching ${imdbId} result for one week`)
            store({ data }, ONE_WEEK)
        }

        affixRT($target, data)
    } catch (error) {
        const message = error.message || String(error) // stringify
        debug(`caching ${imdbId} error for one day`)
        store({ error: message }, ONE_DAY)
        console.error(message)
    }
}

// register a jQuery plugin which extracts and returns JSON-LD data for
// the specified document
$.fn.jsonLd = function jsonLd (id) {
    const $script = $(this).find('script[type="application/ld+json"]')

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

// register this first so data can be cleared even if there's an error
GM_registerMenuCommand(SCRIPT_NAME + ': clear cache', () => { purgeCached(-1) })

// make the background color more legible (darker) if the rating is N/A
GM_addStyle('.score_tbd { background-color: #d9d9d9 }')

main()
