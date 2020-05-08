// ==UserScript==
// @name          BBC News Highlighter
// @description   Highlight new stories on BBC News
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.14.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       http://www.bbc.co.uk/news
// @include       https://www.bbc.co.uk/news
// @include       http://www.bbc.com/news
// @include       https://www.bbc.com/news
// @include       /https?://www\.bbc\.co(m|\.uk)/news/([^-])+$/
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/eclecto/jQuery-onMutate@79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/jquery-highlighter@63adeb7dea43c47e210fd17b0589e648239e97f0/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_listValues
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

// a mapping from item selectors to target selectors on the main news page
// e.g. https://www.bbc.co.uk/news
const MAIN_PAGE_LINKS = {
    // almost all links apart from the (static) "Watch Live"/"Listen Live"
    // links
    ':not(.nw-c-watch-listen__body) > a.gs-c-promo-heading:visible': '.gs-c-promo-heading__title',

    // links in the panel at the bottom of the page
    'a.np-link:visible': 'h3',

    // bullets under the main story
    '.nw-o-bullet\\+ > a.nw-o-link-split__anchor:visible': '.nw-o-link-split__text',

    // promoted feature-articles hoisted to the left of the third row of
    // articles
    'a.nw-c-feature-promo:visible': '.nw-c-feature-promo__line',

    // live-ticker links for breaking news stories
    'a.lx-c-dynamic-promo__link:visible': '.lx-c-dynamic-promo__title',
}

// a mapping from item selectors to target selectors on news subpages e.g.
// https://www.bbc.co.uk/news/world
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

// return a unique identifier for each link: a cleaned up, cross-site version
// of the link's href
//
// remove the hash, if any, and any trailing non-word characters from the
// path of the resolved URL. this treats the following pairs as equivalent:
//
//     "/sport/cricket/37815544/#story-footer"
//     "/sport/cricket/37815544"
//
//     "/news/video_and_audio/headlines/37804620#video-37804620"
//     "/news/video_and_audio/headlines/37804620"
function id () {
    const href = $(this).attr('href')
    const url = new URL(href, location.href)

    return url.pathname.replace(/\W+$/, '')
}

$.highlight({ item: ITEMS, id, target, onHighlight })
