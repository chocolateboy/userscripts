// ==UserScript==
// @name          IMDb Tomatoes
// @description   Add Rotten Tomatoes ratings to IMDb movie pages
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       1.6.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.imdb.tld/title/tt*
// @include       http://*.imdb.tld/*/title/tt*
// @require       https://code.jquery.com/jquery-3.2.0.min.js
// @grant         GM_addStyle
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_listValues
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// @grant         GM_xmlhttpRequest
// @noframes
// ==/UserScript==

/*
 * Broken:
 *
 *     No RT link:
 *
 *         http://www.imdb.com/title/tt5642184/
 *
 *     Link to the wrong movie:
 *
 *         http://www.imdb.com/title/tt0104070/ - Death Becomes Her
 *         http://www.imdb.com/title/tt0057115/ - The Great Escape
 *         http://www.imdb.com/title/tt0120755/ - Mission: Impossible II
 *         http://www.imdb.com/title/tt0120768/ - The Negotiator
 *         http://www.imdb.com/title/tt0910936/ - Pineapple Express
 *         http://www.imdb.com/title/tt0448134/ - Sunshine
 *         http://www.imdb.com/title/tt0451279/ - Wonder Woman (2017)
 *
 * OK:
 *
 *     http://www.imdb.com/title/tt0309698/ - 4 widgets
 *     http://www.imdb.com/title/tt0086312/ - 3 widgets
 *     http://www.imdb.com/title/tt0037638/ - 2 widgets
 *
 * Fixed:
 *
 *     Layout:
 *
 *         http://www.imdb.com/title/tt0162346/ - 4 widgets
 *         http://www.imdb.com/title/tt0159097/ - 4 widgets
 */

// XXX unaliased and incorrectly aliased titles are common:
// http://web.archive.org/web/20151105080717/http://developer.rottentomatoes.com/forum/read/110751/2

'use strict';

const COMMAND_NAME    = GM_info.script.name + ': clear cache'
const COMPACT_LAYOUT  = '.plot_summary_wrapper .minPlotHeightWithPoster'
const NOW             = Date.now()
const ONE_DAY         = 1000 * 60 * 60 * 24
const ONE_WEEK        = ONE_DAY * 7
const STATUS_TO_STYLE = { 'N/A': 'tbd', Fresh: 'favorable', Rotten: 'unfavorable' }
const THIS_YEAR       = new Date().getFullYear()

// promisified cross-origin HTTP requests
function get (url) {
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
        let entry = JSON.parse(GM_getValue(key))
        if (date === -1 || date > entry.expires) GM_deleteValue(key)
    }
}

// prepend a widget to the review bar or append a link to the star box
function affixRT ($target, { consensus, score, url }) {
    let status

    if (score === -1) {
        status = 'N/A'
    } else if (score < 60) {
        status = 'Rotten'
    } else {
        status = 'Fresh'
    }

    let altText = (consensus && consensus !== 'N/A')
        ? consensus.replace(/--/g, '—').replace(/"/g, '&#34;')
        : status

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
                <a href="${url}" title="${altText}"><div
                    class="metacriticScore score_${style} titleReviewBarSubItem"><span>${rating}</span></div></a>
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
            Rotten Tomatoes:&nbsp;<a href="${url}" title="${altText}">${rating}</a>
        `
        $target.append(html)
    }
}

// extract the Rotten Tomatoes rating for a film from the OMDB JSON response.
// return the rating as an integer >= 0, or -1 if it's not found or not a number.
function getRating (omdb) {
    let rating = -1
    let ratings = omdb.Ratings || []
    let rtRating = $.grep(ratings, it => it.Source === 'Rotten Tomatoes')[0]

    if (rtRating && rtRating.Value) {
        let value = parseInt(rtRating.Value)

        if (value === value) { // not NaN
            rating = value
        }
    }

    return rating
}

// process the OMDb API's JSON response. returning data rather than HTML allows the
// same (cached) data to be rendered in the two targets (one of which — the
// review bar — is only visible to logged-in users)
function processJSON (json, imdb) {
    let omdb = JSON.parse(json)
    let error

    if (!omdb) {
        error = `unexpected response from the OMDb API: ${JSON.stringify(omdb)}`
    } else if (omdb.Error) {
        error = `can't retrieve JSON from the OMDb API: ${omdb.Error}`
    } else if (!omdb.tomatoURL || omdb.tomatoURL === 'N/A') {
        error = 'no Rotten Tomatoes URL defined'
    }

    if (error) {
        error = `error querying data for tt${imdb.id}: ${error}`
        throw error
    }

    let score = getRating(omdb)

    return { consensus: 'N/A', score, url: omdb.tomatoURL }
}

// register this first so data can be cleared even if there's an error
GM_registerMenuCommand(COMMAND_NAME, function () { purgeCached(-1) })

// make the background color more legible (darker) if the score is N/A
GM_addStyle('.score_tbd { background-color: #D9D9D9 }')

let $type = $('meta[property="og:type"')
let $titleReviewBar = $('.titleReviewBar')
let $starBox = $('.star-box-details')
let $target = ($titleReviewBar.length && $titleReviewBar) || ($starBox.length && $starBox)

if ($target && $type.attr('content') === 'video.movie') {
    let $link = $('link[rel=canonical]')

    if ($link.length) {
        purgeCached(NOW)

        let imdbId = $link.attr('href').match(/\/title\/tt(\d{7})\//)[1]
        let cached = JSON.parse(GM_getValue(imdbId, 'null'))

        if (cached) {
            if (cached.error) {
                console.warn(cached.error)
            } else {
                affixRT($target, cached.data)
            }
        } else {
            let title = $('meta[property="og:title"]').attr('content').match(/^(.+?)\s+\(\d{4}\)$/)[1]
            let imdb = { id: imdbId, title }
            let url = `https://www.omdbapi.com/?i=tt${imdbId}&r=json&tomatoes=true`
            let imdbYear = 0 | $('meta[property="og:title"]').attr('content').match(/\((\d{4})\)$/)[1]
            let expires = NOW + (imdbYear === THIS_YEAR ? ONE_DAY : ONE_WEEK)

            get(url)
                .then(json => processJSON(json, imdb))
                .then(data => {
                    let json = JSON.stringify({ expires, data })
                    GM_setValue(imdbId, json)
                    affixRT($target, data)
                })
                .catch(error => {
                    console.error(error)
                    let json = JSON.stringify({ expires, error })
                    GM_setValue(imdbId, json)
                })
        }
    }
}
