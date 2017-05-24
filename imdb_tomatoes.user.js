// ==UserScript==
// @name          IMDb Tomatoes
// @description   Add Rotten Tomatoes ratings to IMDb movie pages
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       2.0.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.imdb.tld/title/tt*
// @include       http://*.imdb.tld/*/title/tt*
// @require       https://code.jquery.com/jquery-3.2.1.min.js
// @require       https://cdn.rawgit.com/urin/jquery.balloon.js/8b79aab63b9ae34770bfa81c9bfe30019d9a13b0/jquery.balloon.js
// @resource      query https://git.io/vHOqh
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
 *     http://www.imdb.com/title/tt0104070/ - Death Becomes Her
 *     http://www.imdb.com/title/tt0057115/ - The Great Escape
 *     http://www.imdb.com/title/tt0120755/ - Mission: Impossible II
 *     http://www.imdb.com/title/tt0120768/ - The Negotiator
 *     http://www.imdb.com/title/tt0910936/ - Pineapple Express
 *     http://www.imdb.com/title/tt0448134/ - Sunshine
 *     http://www.imdb.com/title/tt0451279/ - Wonder Woman (2017)
 *
 * Not on RT:
 *
 *     http://www.imdb.com/title/tt5642184/
 */

// [1] unaliased and incorrectly aliased titles are common:
// http://web.archive.org/web/20151105080717/http://developer.rottentomatoes.com/forum/read/110751/2

'use strict';

const API             = 'https://cinesift.com/api/values/getFilms'
const COMMAND_NAME    = GM_info.script.name + ': clear cache'
const COMPACT_LAYOUT  = '.plot_summary_wrapper .minPlotHeightWithPoster'
const DATA_VERSION    = 2 // version of each cached record; updated whenever the schema changes
const DEBUG           = false
const NO_CONSENSUS    = 'No consensus yet.'
const NOW             = Date.now()
const ONE_DAY         = 1000 * 60 * 60 * 24
const ONE_WEEK        = ONE_DAY * 7
const STATUS_TO_STYLE = { 'N/A': 'tbd', Fresh: 'favorable', Rotten: 'unfavorable' }
const THIS_YEAR       = new Date().getFullYear()

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
function get (url, params) {
    if (params) {
        url = url + '?' + $.param(params)
    }

    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            onload: function (res) { resolve(res.responseText) },
            // XXX the onerror response object doesn't contain any useful info
            onerror: function (res) { reject(`error loading ${url}`) },
        })
    })
}

// purge expired entries
function purgeCached (date) {
    for (let key of GM_listValues()) {
        let value = JSON.parse(GM_getValue(key))

        if (value.version !== DATA_VERSION) {
            debug(`purging invalid value (obsolete version): ${key}`)
            GM_deleteValue(key)
        } else if (date === -1 || date > value.expires) {
            debug(`purging expired value: ${key}`)
            GM_deleteValue(key)
        } else {
            debug(`cached: ${key} => ${JSON.stringify(value)}`)
        }
    }
}

// prepend a widget to the review bar or append a link to the star box
// XXX the review bar now appears to be the default for all users
function affixRT ($target, data) {
    let { consensus, score, url } = data
    let status

    if (score === -1) {
        status = 'N/A'
    } else if (score < 60) {
        status = 'Rotten'
    } else {
        status = 'Fresh'
    }

    let style = STATUS_TO_STYLE[status]

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
            let $clear = $('<div class="clear">&nbsp;</div>')

            $('.plot_summary_wrapper').after($target.remove())

            $target.before($clear).after($clear).css({
                'float':          'left',
                'padding-top':    '11px',
                'padding-bottom': '0px'
            })
        }

        let rating = score === -1 ? 'N/A' : score

        let html = `
            <div class="titleReviewBarItem">
                <a href="${url}"><div
                    class="rt-consensus metacriticScore score_${style} titleReviewBarSubItem"><span>${rating}</span></div></a>
               <div class="titleReviewBarSubItem">
                   <div>
                       <a href="${url}">Tomatometer</a>
                   </div>
                   <div>
                       <span class="subText">
                           From <a href="http://www.rottentomatoes.com" target="_blank">Rotten Tomatoes</a>
                       </span>
                   </div>
                </div>
            </div>
            <div class="divider"></div>
        `
        $target.prepend(html)
    } else {
        let rating = score === -1 ? 'N/A' : `${score}%`

        let html = `
            <span class="ghost">|</span>
            Rotten Tomatoes:&nbsp;<a class="rt-consensus" href="${url}">${rating}</a>
        `
        $target.append(html)
    }

    let balloonOptions = $.extend({}, BALLOON_OPTIONS, { contents: consensus })

    $target.find('.rt-consensus').balloon(balloonOptions)
}

// process the API's JSON response and extract
// the RT score and consensus.
//
// if there's no consensus, set it to "No consensus yet."
// if the score is null, set it to -1
function getRTData (json, imdb) {
    function error (msg) {
        throw `error querying data for ${imdb.id}: ${msg}`
    }

    let response

    try {
        response = JSON.parse(JSON.parse(json)) // ಠ_ಠ
    } catch (e) {
        error(`can't parse response: ${response}`)
    }

    if (!response) {
        error('no response')
    }

    if (!$.isArray(response)) {
        error(`invalid response: ${{}.toString.call(response)}`)
    }

    let movie = $.grep(response, it => it.imdbID === imdb.id)

    if (movie && movie.length) {
        let consensus = movie[0].RTConsensus || NO_CONSENSUS
        let score = movie[0].RTCriticMeter
        let url = `https://www.rottentomatoes.com/search/?search=${imdb.title}`

        consensus = consensus.replace(/--/g, '—')

        if (score == null) {
            score = -1
        }

        return { consensus, score, url }
    } else {
        throw `No results found for ${imdb.id}`
    }
}

// register this first so data can be cleared even if there's an error
GM_registerMenuCommand(COMMAND_NAME, function () { purgeCached(-1) })

// make the background color more legible (darker) if the score is N/A
GM_addStyle('.score_tbd { background-color: #d9d9d9 }')

let $type = $('meta[property="og:type"')
let $titleReviewBar = $('.titleReviewBar')
let $starBox = $('.star-box-details')
let $target = ($titleReviewBar.length && $titleReviewBar) || ($starBox.length && $starBox)

if ($target && $type.attr('content') === 'video.movie') {
    let $link = $('link[rel=canonical]')

    if ($link.length) {
        purgeCached(NOW)

        let imdbId = $link.attr('href').match(/\/title\/(tt\d+)\//)[1]
        let cached = JSON.parse(GM_getValue(imdbId, 'null'))

        if (cached) {
            if (cached.error) {
                // couldn't retrieve any RT data so there's nothing
                // more we can do
                console.warn(cached.error)
            } else {
                affixRT($target, cached.data)
            }
        } else {
            let title = $('meta[property="og:title"]')
                .attr('content')
                .match(/^(.+?)\s+\(\d{4}\)$/)[1]

            let imdb = { id: imdbId, title }
            let imdbYear = 0 | $('meta[property="og:title"]')
                .attr('content')
                .match(/\((\d{4})\)$/)[1]

            let expires = NOW + (imdbYear === THIS_YEAR ? ONE_DAY : ONE_WEEK)
            let version = DATA_VERSION

            // create or replace an { expires, version, data|error } entry in
            // the cache
            function store (data, key = 'data') {
                let json = JSON.stringify({ expires, version, [key]: data })
                GM_setValue(imdbId, json)
            }

            let params = JSON.parse(GM_getResourceText('query'))

            params.title = title
            params.yearMax = THIS_YEAR

            get(API, params)
                .then(json => getRTData(json, imdb))
                .then(data => {
                    store(data)
                    affixRT($target, data)
                })
                .catch(error => {
                    store(error, 'error')
                    console.error(error)
                })
        }
    }
}
