// ==UserScript==
// @name          IMDb Tomatoes
// @description   Add Rotten Tomatoes ratings to IMDb movie pages
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       2.7.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.imdb.tld/title/tt*
// @include       http://*.imdb.tld/*/title/tt*
// @include       https://*.imdb.tld/title/tt*
// @include       https://*.imdb.tld/*/title/tt*
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.rawgit.com/urin/jquery.balloon.js/8b79aab63b9ae34770bfa81c9bfe30019d9a13b0/jquery.balloon.js
// @resource      query https://pastebin.com/raw/3FrfvxqX
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

const COMMAND_NAME    = GM_info.script.name + ': clear cache'
const COMPACT_LAYOUT  = '.plot_summary_wrapper .minPlotHeightWithPoster'
const DEBUG           = false
const NO_CONSENSUS    = 'No consensus yet.'
const NOW             = Date.now()
const ONE_DAY         = 1000 * 60 * 60 * 24
const ONE_WEEK        = ONE_DAY * 7
const STATUS_TO_STYLE = { 'N/A': 'tbd', Fresh: 'favorable', Rotten: 'unfavorable' }
const THIS_YEAR       = new Date().getFullYear()

// the version of each cached record is a combination of the schema and the
// <major>.<minor> parts of the script's (SemVer) version e.g. 3 (schema) +
// 1.7.0 (script version) gives a version of "3/1.7"
//
// this means cached records are invalidated either a) when the schema changes
// or b) when the major or minor version (i.e. not the patch version) of the
// script changes
const SCHEMA_VERSION = 3
const DATA_VERSION = SCHEMA_VERSION + '/' + GM_info.script.version.replace(/\.\d+$/, '') // e.g. 3/1.7

const BALLOON_OPTIONS = {
    classname: 'rt-consensus-balloon',
    css: {
        maxWidth: '500px',
        fontFamily: 'sans-serif',
        fontSize: '0.9rem',
        padding: '12px',
    },
    html: true,
    position: 'bottom',
}

function debug (message) {
    if (DEBUG) {
        console.warn(message)
    }
}

// promisified cross-origin HTTP requests
function get (url, options = {}) {
    if (options.params) {
        url = url + '?' + $.param(options.params)
    }

    const request = Object.assign({ method: 'GET', url }, options.request || {})

    return new Promise((resolve, reject) => {
        request.onload = res => { resolve(res.responseText) }

        // XXX the onerror response object doesn't contain any useful info
        request.onerror = res => { reject(`error loading ${url}`) }

        GM_xmlhttpRequest(request)
    })
}

// purge expired entries
function purgeCached (date) {
    for (const key of GM_listValues()) {
        const json = GM_getValue(key)
        const value = JSON.parse(json)

        if (value.version !== DATA_VERSION) {
            debug(`purging invalid value (obsolete version): ${key}`)
            GM_deleteValue(key)
        } else if (date === -1 || date > value.expires) {
            debug(`purging expired value: ${key}`)
            GM_deleteValue(key)
        } else {
            debug(`cached: ${key} => ${json}`)
        }
    }
}

// prepend a widget to the review bar or append a link to the star box
// XXX the review bar now appears to be the default for all users
function affixRT ($target, data) {
    const { consensus, score, url } = data

    let status

    if (score === -1) {
        status = 'N/A'
    } else if (score < 60) {
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
        // movie-info block (plot_summary_wrapper) and float it left
        // beneath the poster e.g.:
        //
        // before:
        //
        // [  [        ] [                   ] ]
        // [  [        ] [                   ] ]
        // [  [ Poster ] [        Info       ] ]
        // [  [        ] [                   ] ]
        // [  [        ] [ [MC] [IMDb] [&c.] ] ]
        //
        // after:
        //
        // [  [        ] [                   ] ]
        // [  [        ] [                   ] ]
        // [  [ Poster ] [        Info       ] ]
        // [  [        ] [                   ] ]
        // [  [        ] [                   ] ]
        // [                                   ]
        // [  [RT] [MC] [IMDb] [&c.]           ]

        if ($(COMPACT_LAYOUT).length && $target.find('.titleReviewBarItem').length > 2) {
            const $clear = $('<div class="clear">&nbsp;</div>')

            $('.plot_summary_wrapper').after($target.remove())

            $target.before($clear).after($clear).css({
                'float':          'left',
                'padding-top':    '11px',
                'padding-bottom': '0px'
            })
        }

        const rating = score === -1 ? 'N/A' : score

        const html = `
            <div class="titleReviewBarItem">
                <a href="${url}"><div
                    class="rt-consensus metacriticScore score_${style} titleReviewBarSubItem"><span>${rating}</span></div></a>
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
        const rating = score === -1 ? 'N/A' : `${score}%`

        const html = `
            <span class="ghost">|</span>
            Rotten Tomatoes:&nbsp;<a class="rt-consensus" href="${url}">${rating}</a>
        `
        $target.append(html)
    }

    const balloonOptions = Object.assign({}, BALLOON_OPTIONS, { contents: consensus })

    $target.find('.rt-consensus').balloon(balloonOptions)
}

// parse the API's JSON response and extract
// the RT score and consensus.
//
// if there's no consensus, default to "No consensus yet."
// if there's no score, default to -1
function getRTData (json, imdb) {
    function error (msg) {
        throw `error querying data for ${imdb.id}: ${msg}`
    }

    let response

    try {
        response = JSON.parse(JSON.parse(json)) // ಠ_ಠ
    } catch (e) {
        error(`can't parse response: ${e}`)
    }

    if (!response) {
        error('no response')
    }

    if (!$.isArray(response)) {
        const type = {}.toString.call(response)
        error(`invalid response: ${type}`)
    }

    const [movie] = $.grep(response, it => it.imdbID === imdb.id)

    if (movie) {
        const title = escape(imdb.title)
        const url = `https://www.rottentomatoes.com/search/?search=${title}`

        let consensus = movie.RTConsensus || NO_CONSENSUS
        let score = movie.RTCriticMeter

        consensus = consensus.replace(/--/g, '&#8212;')

        if (score == null) {
            score = -1
        }

        return { consensus, score, url }
    } else {
        throw `No results found for ${imdb.id}`
    }
}

function main () {
    const $type = $('meta[property="og:type"')

    if ($type.attr('content') !== 'video.movie') {
        return
    }

    const $titleReviewBar = $('.titleReviewBar')
    const $starBox = $('.star-box-details')
    const $target = ($titleReviewBar.length && $titleReviewBar)
        || ($starBox.length && $starBox)

    if (!$target) {
        return
    }

    const $link = $('link[rel=canonical]')

    if (!$link.length) {
        return
    }

    purgeCached(NOW)

    const imdbId = $link.attr('href').match(/\/title\/(tt\d+)\//)[1]
    const cached = JSON.parse(GM_getValue(imdbId, 'null'))

    if (cached) {
        if (cached.error) {
            // couldn't retrieve any RT data so there's nothing
            // more we can do
            console.warn(cached.error)
        } else {
            affixRT($target, cached.data)
        }

        return
    }

    const title = $('meta[property="og:title"]')
        .attr('content')
        .match(/^(.+?)\s+\(\d{4}\)$/)[1]

    const imdb = { id: imdbId, title }
    const imdbYear = 0 | $('meta[property="og:title"]')
        .attr('content')
        .match(/\((\d{4})\)$/)[1]

    const expires = NOW + (imdbYear === THIS_YEAR ? ONE_DAY : ONE_WEEK)
    const version = DATA_VERSION

    // create or replace an { expires, version, data|error } entry in
    // the cache
    function store (data) {
        const cached = Object.assign({ expires, version }, data)
        const json = JSON.stringify(cached)

        GM_setValue(imdbId, json)
    }

    const params = JSON.parse(GM_getResourceText('query'))
    const { api, request } = params._

    delete params._

    params.title = title
    params.yearMax = THIS_YEAR

    get(api, { params, request })
        .then(json => {
            const data = getRTData(json, imdb)
            store({ data })
            affixRT($target, data)
        })
        .catch(error => {
            store({ error })
            console.error(error)
        })
}

// register this first so data can be cleared even if there's an error
GM_registerMenuCommand(COMMAND_NAME, () => { purgeCached(-1) })

// make the background color more legible (darker) if the score is N/A
GM_addStyle('.score_tbd { background-color: #d9d9d9 }')

main()
