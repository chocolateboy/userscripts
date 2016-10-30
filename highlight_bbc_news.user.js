// ==UserScript==
// @name          BBC News Highlighter
// @description   Highlight new stories on the BBC News homepage
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.8.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.bbc.co.uk/news
// @include       http://www.bbc.com/news
// @require       https://code.jquery.com/jquery-3.1.1.min.js
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
var SITE = /^https?:\/\/www\.bbc\.co(?:m|\.uk)/;

var ITEMS = any(
    'a.title-link:visible',
    'a.nw-o-link-split__anchor:visible',
    'a.most-popular-list-item__link:visible'
);

var TARGETS = any(
    '.title-link__title-text',
    '.nw-o-link-split__text',
    '.most-popular-list-item__headline'
);

function any () {
    return [].slice.apply(arguments).join(', ');
}

function onHighlight ($target) {
    if ($target.css('color') === 'rgb(255, 255, 255)') {
        $target.css('color', 'rgb(34, 34, 34)');
    }
}

function target () {
    var $this = $(this);
    var $target = $this.find(TARGETS);

    return $target.length ? $target : $this;
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
// We get them before they're changed, which is handy as the same links
// can appear (with the original href) in the "Most Popular" block
function id () {
    return $(this).attr('href')
        .replace(SITE, '')
        // don't treat a comment link as a new link e.g. identify:
        //
        // "/sport/cricket/37815544/#story-footer"                   as "/sport/cricket/37815544"
        // "/news/video_and_audio/headlines/37804620#video-37804620" as "/news/video_and_audio/headlines/37804620"
        .replace(/\/?#[^/]+$/, '');
}

$.highlight({
    item:        ITEMS,
    id:          id,
    target:      target,
    onHighlight: onHighlight,
});
