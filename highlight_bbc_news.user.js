// ==UserScript==
// @name          BBC News Highlighter
// @description   Highlight new stories on the BBC News homepage
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.10.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.bbc.co.uk/news
// @include       http://www.bbc.com/news
// @require       https://code.jquery.com/jquery-3.2.1.min.js
// @require       https://cdn.rawgit.com/eclecto/jQuery-onMutate/v1.4.2/src/jquery.onmutate.min.js
// @require       https://cdn.rawgit.com/chocolateboy/jquery-highlighter/v2.1.0/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

// a few hrefs are absolute URLs even though they link
// to internal articles. This regex is used to
// make them relative by stripping the site prefix e.g.:
//
// "http://www.bbc.com/sport/cricket/37815544" -> "/sport/cricket/37815544"
//
// some articles on bbc.com link to bbc.co.uk,
// so to ensure an article seen on bbc.co.uk
// is also seen on bbc.com, we remove both rather than
// just the current site
var SITE = /^https?:\/\/www\.bbc\.co(?:m|\.uk)/

var ITEMS = any(
    // almost all links apart from the (static) "Watch Live"/"Listen Live"
    // links
    ':not(.nw-c-watch-listen__body) > a.gs-c-promo-heading:visible',

    // links in the panel at the bottom of the page
    'a.np-link:visible',

    // bullets under the main story
    '.nw-o-bullet\\+ > a.nw-o-link-split__anchor:visible'
)

// these correspond to the links in ITEMS
var TARGETS = any(
    '.gs-c-promo-heading__title',
    'h3',
    '.nw-o-link-split__text'
)

function any () {
    return [].join.call(arguments, ', ')
}

function onHighlight ($target) {
    if ($target.css('color') === 'rgb(255, 255, 255)') {
        $target.css('color', 'rgb(34, 34, 34)')
    }
}

function target () {
    var $item = $(this)
    var $target = $item.find(TARGETS)

    return $target.length ? $target : $item
}

// links in the "Watch/Listen" blocks (two are defined in the markup,
// but only one is displayed) are dynamically changed (by a `replaceUrls`
// method defined in all.js) from e.g
//
// "/news/magazine-<asset-id>" to:
//
//      "<headlines>/<asset-id>"                  # wide
//      "<headlines>/<asset-id>#video-<asset-id>" # compact
//
// where <headlines> is the href of the "More Video Top Stories"
// link, currently "/news/video_and_audio/headlines"
//
// e.g.:
//
// "/news/magazine-37804620" -> "/news/video_and_audio/headlines/37804620"
//
// we get them before they're changed, which is handy as the same links
// can appear (with the original href) in the "Most Popular" block
function id () {
    return $(this).attr('href')
        .replace(SITE, '')
        // don't treat hrefs with fragments as new e.g. identify:
        //
        // "/sport/cricket/37815544/#story-footer" as:
        //
        //     "/sport/cricket/37815544"
        //
        // and "/news/video_and_audio/headlines/37804620#video-37804620" as:
        //
        //     "/news/video_and_audio/headlines/37804620"
        .replace(/\/?#[^/]+$/, '')
}

$.highlight({
    item:        ITEMS,
    id:          id,
    target:      target,
    onHighlight: onHighlight,
})
