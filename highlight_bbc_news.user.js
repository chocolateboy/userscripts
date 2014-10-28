// ==UserScript==
// @name          BBC News Highlighter
// @description   Highlight new stories on the BBC News homepage
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.1.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.bbc.co.uk/news/
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.js
// @require       https://raw.github.com/chocolateboy/userscripts/master/jquery/highlighter.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

var WHITE = 'rgb(255, 255, 255)';

function links() {
    return $('a.story, a.headline-anchor').not(
        function () { return $(this).css('color') === WHITE }
    );
}

$.highlight({
    item: links,
    id:   function ($item) { return $item.attr('href').replace(/\/+$/, '').split('/').pop() }
});
