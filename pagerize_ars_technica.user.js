// ==UserScript==
// @name          Pagerize Ars Technica
// @description   Mark up Ars Technica with pager metadata
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.4.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://arstechnica.com/*
// @include       http://*.arstechnica.com/*
// @include       https://arstechnica.com/*
// @include       https://*.arstechnica.com/*
// @require       https://code.jquery.com/jquery-3.1.0.min.js
// @require       https://raw.github.com/chocolateboy/userscripts/master/jquery/pagerizer.js
// @grant         none
// ==/UserScript==

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

var $navbar = $('nav.page-numbers span.numbers');
var $pageNumber = $navbar.contents().filter(function () {
    return this.nodeType == 3 && $.trim(this.nodeValue).match(/^\d+$/)
});
$pageNumber.prev().addRel('prev');
$pageNumber.next().addRel('next');
