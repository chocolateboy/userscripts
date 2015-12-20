// ==UserScript==
// @name          IMDb Tomatoes
// @description   Add Rotten Tomatoes ratings to IMDb movie pages
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.1.2
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.imdb.tld/title/tt*
// @include       http://*.imdb.tld/*/title/tt*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.js
// @grant         GM_addStyle
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_listValues
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// @grant         GM_xmlhttpRequest
// ==/UserScript==

/*
 * OK:
 *
 * http://www.imdb.com/title/tt0309698/ - 4 items
 * http://www.imdb.com/title/tt0086312/ - 3 items
 * http://www.imdb.com/title/tt0037638/ - 2 items
 *
 * Fixed:
 *
 * http://www.imdb.com/title/tt0162346/ - 4 items
 * http://www.imdb.com/title/tt0159097/ - 4 items
 *
 * Not aliased (yet):
 *
 * http://www.imdb.com/awards-central/title/tt2402927/
 */

'use strict';

const COMMAND_NAME    = GM_info.script.name + ': clear data'
const COMPACT_LAYOUT  = '.plot_summary_wrapper .minPlotHeightWithPoster'
const CURRENT_YEAR    = new Date().getFullYear()
const NOW             = Date.now()
const ONE_HOUR        = 1000 * 60 * 60
const ONE_DAY         = ONE_HOUR * 24
const STATUS_TO_STYLE = { 'N/A': 'tbd', Fresh: 'favorable', Rotten: 'unfavorable' }

// purge expired entries
function purgeCached (date) {
    for (let key of GM_listValues()) {
        let entry = JSON.parse(GM_getValue(key))

        if (date === -1 || date > entry.expires) {
            GM_deleteValue(key)
        }
    }
}

// prepend an item to the review bar or append a link to the star box
function render ($target, { url, status, score }) {
    let style = STATUS_TO_STYLE[status]

    if ($target.hasClass('titleReviewBar')) {
        // reduce the amount of space taken up by the Metacritic item
        // and make it consistent with our style (i.e. site name rather
        // than domain name)
        $target.find('a[href="http://www.metacritic.com"]').text('Metacritic')

        // 4 review items is too many for the "compact" layout (e.g.
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
                <a href="${url}" title="${status}"><div
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
            Rotten Tomatoes:&nbsp;<a href="${url}" title="${status}">${rating}</a>
        `
        $target.append(html)
    }
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
    let $url = $('link[rel=canonical]')

    if ($url.length) {
        purgeCached(NOW)

        let imdbId = $url.attr('href').match(/\/title\/tt(\d{7})\//)[1]
        let cached = JSON.parse(GM_getValue(imdbId, 'null'))

        if (cached) {
            if (!cached.error) render($target, cached.data)
        } else {
            let callback = (error, data, year) => {
                if (error) {
                    console.warn(error)
                    let json = JSON.stringify({ expires: NOW + ONE_DAY, error })
                    GM_setValue(imdbId, json)
                } else {
                    let expires = (year && year >= CURRENT_YEAR) ? NOW + ONE_HOUR : NOW + ONE_DAY
                    let json = JSON.stringify({ expires, data })
                    GM_setValue(imdbId, json)
                    render($target, data)
                }
            }

            GM_xmlhttpRequest({
                method: 'GET',
                url: `http://api.rottentomatoes.com/api/public/v1.0/movie_alias.json?type=imdb&id=${imdbId}`,
                onload: function (response) { extractData(response, callback) },
            })
        }
    }
}

// process the RT response and call a callback with the extracted data
// and the film's year. returning data rather than HTML allows the same
// (cached) data to be rendered in the two targets (one of which — the
// review bar — is only visible to logged-in users)
function extractData (response, callback) {
    let rt = JSON.parse(response.responseText)

    if (rt.error) {
        callback(rt.error)
        return
    }

    let score = rt.ratings.critics_score
    let status

    if (score === -1) {
        status = 'N/A'
    } else if (score < 60) {
        status = 'Rotten'
    } else {
        status = 'Fresh'
    }

    let data = { url: rt.links.alternate, status, score }

    callback(null, data, rt.year)
}
