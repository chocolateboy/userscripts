// ==UserScript==
// @name          Pagerize Ars Technica
// @description   Mark up Ars Technica with Pager metadata
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.0.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://arstechnica.com/*
// @include       http://*.arstechnica.com/*
// @include       https://arstechnica.com/*
// @include       https://*.arstechnica.com/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
// @require       https://raw.github.com/chocolateboy/userscripts/master/jquery/pagerizer.js
// @grant         none
// ==/UserScript==

/*
 * @requires:
 *
 * jQuery 2.0.3
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
 */

/*
    http://arstechnica.com/information-technology/2010/01/video-editing-in-linux-a-look-at-pitivi-and-kdenlive/2/

    <nav class="page-numbers subheading">
        Page:
        <span class="numbers">
            <a href="http://arstechnica.com/information-technology/2010/01/video-editing-in-linux-a-look-at-pitivi-and-kdenlive/">1</a>
            2
            <a href="http://arstechnica.com/information-technology/2010/01/video-editing-in-linux-a-look-at-pitivi-and-kdenlive/3">3</a>
            <a href="http://arstechnica.com/information-technology/2010/01/video-editing-in-linux-a-look-at-pitivi-and-kdenlive/4">4</a>
            <a href="http://arstechnica.com/information-technology/2010/01/video-editing-in-linux-a-look-at-pitivi-and-kdenlive/3">
                <span class="next">Next <span class="arrow">→</span></span>
            </a>
        </span>
    </nav>
*/

function getPageLinks($navbar) {
    var $previousLink, $nextLink;
    var $pageNumber = $navbar.contents().filter(function() {
        return this.nodeType == 3 && $.trim(this.nodeValue).match(/^\d+$/)
    });

    $previousLink = $pageNumber.prev();
    $nextLink = $pageNumber.next();

    return [ $previousLink, $nextLink ];
}

var $navbar = $('nav.page-numbers span.numbers');
var pageLinks = getPageLinks($navbar);
var $previousPageLink = pageLinks[0];
var $nextPageLink = pageLinks[1];

if ($previousPageLink.length) {
    $previousPageLink.addRel('prev');
}

if ($nextPageLink.length) {
    $nextPageLink.addRel('next');
}
