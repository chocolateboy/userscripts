// ==UserScript==
// @name          BBC News Highlighter
// @description   Highlight new stories on the BBC News homepage
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.11.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.bbc.co.uk/news
// @include       http://www.bbc.com/news
// @include       /http://www\.bbc\.co\.uk/news/([^-])+$/
// @include       /http://www\.bbc\.com/news/([^-])+$/
// @require       https://code.jquery.com/jquery-3.2.1.min.js
// @require       https://cdn.rawgit.com/eclecto/jQuery-onMutate/v1.4.2/src/jquery.onmutate.min.js
// @require       https://cdn.rawgit.com/chocolateboy/jquery-highlighter/v2.1.0/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

// a few hrefs are absolute URLs even though they link to internal articles.
// This regex is used to make them relative by stripping the site prefix e.g.:
//
//     "http://www.bbc.com/sport/cricket/37815544" -> "/sport/cricket/37815544"
//
// some articles on bbc.com link to bbc.co.uk, so to ensure an article seen on
// bbc.co.uk is also seen on bbc.com, we remove both rather than just the
// current site
const SITE = /^https?:\/\/www\.bbc\.co(?:m|\.uk)/

// a mapping from item selectors to target selectors on the main news page
// e.g. http://www.bbc.co.uk/news
const MAIN_PAGE_LINKS = {
    // almost all links apart from the (static) "Watch Live"/"Listen Live"
    // links
    ':not(.nw-c-watch-listen__body) > a.gs-c-promo-heading:visible': '.gs-c-promo-heading__title',

    // links in the panel at the bottom of the page
    'a.np-link:visible': 'h3',

    // bullets under the main story
    '.nw-o-bullet\\+ > a.nw-o-link-split__anchor:visible': '.nw-o-link-split__text',
}

// a mapping from item selectors to target selectors on news subpages e.g.
// http://www.bbc.co.uk/news/world
const SUBPAGE_LINKS = {
    // almost all links on subpages, apart from the bulleted lists of links
    // under main stories, which are captured by the 'a.links-list__link'
    // selector below.
    //
    // we also need to exclude the (fixed, non-news) links in the
    // "Elsewhere on the BBC" widget (.heron) and the links to radio programmes
    // in the "World Service radio" widget (.waterfowl).
    'a.title-link:visible:not(.heron a, .waterfowl a)': '.title-link__title-text',

    // the bulleted list of links under main stories. the falsey target
    // instructs the target-resolver to use the item itself as the target
    'a.links-list__link:visible': null,

    // some subpages (e.g. /news/business/companies and /news/politics) have a
    // section called "Our Experts" with these links
    '.correspondent-promo__latest-story a:visible': 'h3',

    // the "From across the website" widget on /news/explainers
    'a.bold-image-promo': '.bold-image-promo__title',
}

// a mapping from item selectors to their corresponding target selectors on all
// news pages
const LINKS = Object.assign({}, MAIN_PAGE_LINKS, SUBPAGE_LINKS)

// a selector which matches all of the news links on the main news page
// and its subpages. the matched items are mapped to their corresponding
// targets by the `target` function
const ITEMS = Object.keys(LINKS).join(', ')

// if the text is inverted (white on black), make it dark so that it remains
// legible on a yellow background
function onHighlight ($target) {
    if ($target.css('color') === 'rgb(255, 255, 255)') {
        $target.css('color', 'rgb(34, 34, 34)')
    }
}

// given an item (i.e. a link) find and return the node inside it (e.g. span
// or header) that should be highlighted. the item is passed as `this`
function target () {
    const $item = $(this)

    for (const [item, target] of Object.entries(LINKS)) {
        if ($item.is(item)) {
            return target ? $item.find(target) : $item
        }
    }

    return $item
}

// return a unique identifier for each link: a cleaned up, site-agnostic version
// of the link's href
//
// links in the "Watch/Listen" blocks (two are defined in the markup,
// but only one is displayed) are dynamically changed (by a `replaceUrls`
// method defined in all.js)
//
// from (e.g.):
//
//     "/news/magazine-<asset-id>"
//
// to:
//
//      "<headlines>/<asset-id>"                  # wide
//      "<headlines>/<asset-id>#video-<asset-id>" # compact
//
// where <headlines> is the href of the "More Video Top Stories"
// link, currently "/news/video_and_audio/headlines"
//
// e.g.:
//
//     "/news/magazine-37804620" -> "/news/video_and_audio/headlines/37804620"
//
// we get them before they're changed, which is handy as the same links
// can appear (with the original href) in the "Most Popular" block
function id () {
    return $(this).attr('href')
        .replace(SITE, '')
        // don't treat hrefs with fragments as new e.g. treat the following
        // as equivalent:
        //
        //     "/sport/cricket/37815544/#story-footer"
        //     "/sport/cricket/37815544"
        //
        //     "/news/video_and_audio/headlines/37804620#video-37804620"
        //     "/news/video_and_audio/headlines/37804620"
        .replace(/\/?#[^/]+$/, '')
}

$.highlight({ item: ITEMS, id, target, onHighlight })
