// ==UserScript==
// @name          IMDb Tomatoes
// @description   Add Rotten Tomatoes ratings to IMDb movie pages
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.0.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       http://*.imdb.tld/title/tt*
// @include       http://*.imdb.tld/*/title/tt*
// @include       https://*.imdb.tld/title/tt*
// @include       https://*.imdb.tld/*/title/tt*
// @require       https://code.jquery.com/jquery-3.5.1.min.js
// @require       https://cdn.jsdelivr.net/gh/urin/jquery.balloon.js@8b79aab63b9ae34770bfa81c9bfe30019d9a13b0/jquery.balloon.js
// @require       https://unpkg.com/@chocolateboy/uncommonjs@3.1.2/dist/polyfill.iife.min.js
// @require       https://unpkg.com/get-wild@1.4.0/dist/index.umd.min.js
// @resource      query https://pastebin.com/raw/EdgTfhij
// @resource      fallback https://cdn.jsdelivr.net/gh/chocolateboy/corrigenda@0.2.2/data/omdb-tomatoes.json
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
 *   - https://www.imdb.com/title/tt0309698/ - 4 widgets
 *   - https://www.imdb.com/title/tt0086312/ - 3 widgets
 *   - https://www.imdb.com/title/tt0037638/ - 2 widgets
 *
 * Fixed:
 *
 *   layout:
 *
 *     - https://www.imdb.com/title/tt0162346/  - 4 widgets
 *     - https://www.imdb.com/title/tt0159097/  - 4 widgets
 *     - https://www.imdb.com/title/tt0129387/ - 2 .plot_summary_wrapper DIVs
 *
 *   RT/OMDb alias [1]:
 *
 *     - https://www.imdb.com/title/tt0120755/ - Mission: Impossible II
 */

// [1] unaliased and incorrectly aliased titles are common:
// http://web.archive.org/web/20151105080717/http://developer.rottentomatoes.com/forum/read/110751/2

// XXX metadata mismatch: Zéro de conduite [2] is a "Movie" in the old UI, but a
// "Short" in the new one
//
// [2] https://www.imdb.com/title/tt0024803/

'use strict';

const NO_CONSENSUS    = 'No consensus yet.'
const NOW             = Date.now()
const ONE_DAY         = 1000 * 60 * 60 * 24
const ONE_WEEK        = ONE_DAY * 7
const SCRIPT_NAME     = GM_info.script.name
const SCRIPT_VERSION  = GM_info.script.version
const STATUS_TO_STYLE = { 'N/A': 'tbd', Fresh: 'favorable', Rotten: 'unfavorable' }
const THIS_YEAR       = new Date().getFullYear()

const COLOR = {
    tbd: '#d9d9d9',
    favorable: '#66cc33',
    unfavorable: '#ff0000',
}

const COMPACT_LAYOUT = [
    '.plot_summary_wrapper .minPlotHeightWithPoster', // XXX probably obsolete
    '.plot_summary_wrapper .minPlotHeightWithPosterAndWatchlistButton', // XXX probably obsolete
    '.minPosterWithPlotSummaryHeight .plot_summary_wrapper',
].join(', ')

// the version of each cached record is a combination of the schema version and
// the <major>.<minor> parts of the script's (SemVer) version, e.g. 3 (schema
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
        fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
        fontSize: '0.9rem',
        padding: '0.75rem',
    },
    html: true,
    position: 'bottom',
}

// a custom version of get-wild's `get` function which uses a simpler/faster
// path parser since we don't use the extended syntax
const pluck = exports.getter({ split: '.' })

// log a debug message to the console
const debug = console.debug

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

// promisified cross-origin HTTP requests
function httpGet (url, options = {}) {
    if (options.params) {
        url = url + '?' + encodeParams(options.params)
    }

    const request = Object.assign({ method: 'GET', url }, options.request || {})

    return new Promise((resolve, reject) => {
        request.onload = resolve

        // XXX the onerror response object doesn't contain any useful info
        request.onerror = _res => {
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

// add an RT widget to the review bar
function addWidget ($target, data) {
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
    const score = rating === -1 ? 'N/A' : rating

    if ($target.hasClass('titleReviewBar')) {
        // reduce the amount of space taken up by the Metacritic widget
        // and make it consistent with our style (i.e. site name rather
        // than domain name)
        $target.find('a[href="http://www.metacritic.com"]').text('Metacritic')

        // 4 review widgets is too many for the "compact" layout (i.e.
        // a poster but no trailer). it's designed for a maximum of 3.
        // to work around this, we hoist the review bar out of the
        // movie-info block (.plot_summary_wrapper) and float it left
        // beneath the poster, e.g.:
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

            // sometimes there are two Info (.plot_summary_wrapper) DIVs (e.g.
            // [1]). the first is (currently) empty and the second contains the
            // actual markup. this may be a transient error in the markup, or
            // may be used somehow (e.g. for mobile). if targeted, the first one
            // is displayed above the visible Plot/Info row, whereas the second
            // one is to the right of the poster, as expected, so we target that
            //
            // [1] https://www.imdb.com/title/tt0129387/
            $('.plot_summary_wrapper').last().after($target.remove())

            $target.before($clear).after($clear).css({
                'float':          'left',
                'padding-top':    '11px',
                'padding-bottom': '0px',
            })
        }

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
    } else { // new UI
        // clone the IMDb rating widget: https://git.io/JtXpQ
        const $rtRating = $target.children().first().clone()

        // 1) set the star (SVG) to the right color
        $rtRating.find('svg').css('color', COLOR[style])

        // 2) remove the review count and its preceding spacer element
        const $reviewCount = $rtRating.find('[class^="AggregateRatingButton__TotalRatingAmount-"]')

        $reviewCount.add($reviewCount.prev()).remove()

        // 3) replace "IMDb Rating" with "RT Rating"
        $rtRating.find('[class^="TitleBlockButtonBase__Header-"]').text('RT RATING')

        // 4) remove the "/ 10" suffix
        const $score = $rtRating.find('[data-testid="hero-title-block__aggregate-rating__score"]')
            .children()

        $score.last().remove()

        // 5) replace the IMDb rating with the RT score
        $score.first().text(score)

        // 6) add the tooltip class to the link and update its label and URL
        $rtRating.find('a[role="button"]')
            .addClass('rt-consensus')
            .attr('aria-label', 'View RT Rating')
            .attr('href', url)

        // 7) prepend the element to the review bar
        $target.prepend($rtRating)
    }

    const balloonOptions = Object.assign({}, BALLOON_OPTIONS, { contents: consensus })

    $target.find('.rt-consensus').balloon(balloonOptions)
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

// parse the API's response and extract the RT rating and consensus.
//
// if there's no consensus, default to "No consensus yet."
// if there's no rating, default to -1
async function getRTData ({ response, imdbId, title, fallback }) {
    function fail (msg) {
        throw new Error(`error querying data for ${imdbId}: ${msg}`)
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
            debug(`no results for ${imdbId} - using fallback data`)
            movie = adaptOmdbData(fallback)
        } else {
            fail('no results found')
        }
    }

    let { RTConsensus: consensus, CriticRating: rating, RTUrl: url } = movie
    let updated = false

    if (url) {
        // the new way: the RT URL is provided: scrape the consensus from
        // that page

        debug(`loading RT URL for ${imdbId}: ${url}`)
        const res = await httpGet(url)
        debug(`response for ${url}: ${res.status} ${res.statusText}`)

        const parser = new DOMParser()
        const dom = parser.parseFromString(res.responseText, 'text/html')
        const $rt = $(dom)
        const $consensus = $rt.find('.what-to-know__section-body > span')

        if ($consensus.length) {
            consensus = $consensus.html().trim()
        }

        // update the rating
        // @ts-ignore
        const meta = $rt.jsonLd(url)
        const newRating = meta.aggregateRating.ratingValue

        if (newRating !== rating) {
            debug(`updating rating for ${url}: ${rating} -> ${newRating}`)
            rating = newRating
            updated = true
        }
    } else {
        // the old way: a rating but no RT URL (or consensus).
        // may still be used for some old and new releases
        debug(`no Rotten Tomatoes URL for ${imdbId}`)
        url = `https://www.rottentomatoes.com/search/?search=${encodeURIComponent(title)}`
    }

    if (rating == null) {
        rating = -1
    }

    consensus = consensus ? consensus.replace(/--/g, '&#8212;') : NO_CONSENSUS

    return { data: { consensus, rating, url }, updated }
}

// extract a property from a META element, or return null if the property is
// not defined
function prop (name) {
    const $meta = $(`meta[property="${name}"]`)
    return $meta.length ? $meta.attr('content') : null
}

// extract metadata from the JSON+LD data embedded in the page and from metadata
// elements
function jsonLdMetadata (imdbId) {
    // @ts-ignore
    const meta = $(document).jsonLd(imdbId)

    // override the original title (e.g. "Le fabuleux destin d'Amélie Poulain")
    // with the English language (US) title (e.g. "Amélie") if available
    // (the API only supports English-language titles)
    const title = $('#star-rating-widget').data('title') || meta.name

    return {
        pageType: prop('pageType'),
        title,
        type: meta['@type']
    }
}

// extract metadata from the GraphQL data embedded in the page
function graphQlMetadata (imdbId) {
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

async function main () {
    // @ts-ignore
    const imdbId = location.pathname.match(/\/title\/(tt\d+)/)[1]

    const $classicReviewBar = $('.titleReviewBar')
    const $darkReviewBar = $('[class^="TitleBlock__ButtonContainer-"]')
    const $target = ($classicReviewBar.length && $classicReviewBar)
        || ($darkReviewBar.length && $darkReviewBar)

    if (!$target) {
        console.warn(`Can't find target for ${location.href}`)
        return
    }

    let meta

    if ($target === $classicReviewBar) {
        meta = jsonLdMetadata(imdbId)

        /* make the background color more legible (darker) if the rating is N/A */
        GM_addStyle(`.score_tbd { background-color: ${COLOR.tbd} }`)
    } else if ($target === $darkReviewBar) {
        meta = graphQlMetadata(imdbId)
    } else {
        console.warn(`can't find metadata for ${imdbId}`)
        return
    }

    debug('metadata:', meta)

    const { pageType, title, type } = meta

    if (type !== 'Movie') {
        debug(`invalid type for ${imdbId}: ${type}`)
        return
    }

    if (pageType !== 'title') {
        console.warn(`invalid page type for ${imdbId}: ${pageType}`)
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
            addWidget($target, cached.data)
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

    Object.assign(query.params, { searchTerm: title, yearMax: THIS_YEAR })

    try {
        debug(`querying API for ${imdbId} (${JSON.stringify(title)})`)
        const requestOptions = Object.assign({}, query, { title: `data for ${imdbId}` })
        const response = await httpGet(query.api, requestOptions)
        const fallback = JSON.parse(GM_getResourceText('fallback'))

        debug(`response for ${imdbId}: ${response.status} ${response.statusText}`)

        const { data, updated } = await getRTData({
            response: response.responseText,
            imdbId,
            title,
            fallback: fallback[imdbId],
        })

        if (updated) {
            debug(`caching ${imdbId} result for one day`)
            store({ data }, ONE_DAY)
        } else {
            debug(`caching ${imdbId} result for one week`)
            store({ data }, ONE_WEEK)
        }

        addWidget($target, data)
    } catch (error) {
        const message = error.message || String(error) // stringify
        debug(`caching ${imdbId} error for one day`)
        store({ error: message }, ONE_DAY)
        console.error(message)
    }
}

// register a jQuery plugin which extracts and returns JSON-LD data for
// the specified document
// @ts-ignore
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

// register this first so data can be cleared even if there's an error
GM_registerMenuCommand(SCRIPT_NAME + ': clear cache', () => { purgeCached(-1) })

$(window).on('pageshow', main)
