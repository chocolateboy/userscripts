// ==UserScript==
// @name          Pagerize Ars Technica
// @description   Mark up Ars Technica with pager metadata
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.6.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://arstechnica.com/*
// @include       http://*.arstechnica.com/*
// @include       https://arstechnica.com/*
// @include       https://*.arstechnica.com/*
// @require       https://code.jquery.com/jquery-3.1.1.min.js
// @require       https://cdn.rawgit.com/chocolateboy/jquery-pagerizer/v1.0.0/dist/pagerizer.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

/*
    http://arstechnica.com/information-technology/2010/01/video-editing-in-linux-a-look-at-pitivi-and-kdenlive/2/

    <nav class="page-numbers">
        Page:
        <span class="numbers">
            <a href="video-editing-in-linux-a-look-at-pitivi-and-kdenlive/">1</a>
            2
            <a href="video-editing-in-linux-a-look-at-pitivi-and-kdenlive/3">3</a>
            <a href="video-editing-in-linux-a-look-at-pitivi-and-kdenlive/4">4</a>
            <a href="video-editing-in-linux-a-look-at-pitivi-and-kdenlive/3">
                <span class="next">Next <span class="arrow">→</span></span>
            </a>
        </span>
    </nav>
*/

var $navbar = $('nav.page-numbers span.numbers');
var $pageNumber = $navbar.contents().filter(function () {
    return this.nodeType == 3 && $.trim(this.nodeValue).match(/^\d+$/)
});

if ($pageNumber.prev().length) {
    // remove the rel from the "Previous Story" link
    $('a[rel="prev"], a[rel="previous"]').removeRel('prev', 'previous');
    // use "previous" rather than "prev" (or both) to work around a bug in Vimperator:
    // https://github.com/vimperator/vimperator-labs/pull/570
    $pageNumber.prev().addRel('previous');
}

if ($pageNumber.next().length) {
    // remove the rel from the "Next Story" link
    $('a[rel="next"]').removeRel('next');
    $pageNumber.next().addRel('next');
}
