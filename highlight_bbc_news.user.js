// ==UserScript==
// @name          BBC News Highlighter
// @description   Highlight new stories on the BBC News homepage
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.4.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.bbc.co.uk/news
// @include       http://www.bbc.com/news
// @require       https://code.jquery.com/jquery-2.2.4.min.js
// @require       https://raw.githubusercontent.com/eclecto/jQuery-onMutate/master/jquery.onmutate.min.js
// @require       https://raw.github.com/chocolateboy/userscripts/master/jquery/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

function onHighlight ($target) {
    if ($target.css('color') === 'rgb(255, 255, 255)') {
        $target.css('color', 'rgb(34, 34, 34)');
    }
}

$.highlight({
    item:        'a.title-link',
    id:          'href',
    target:      '.title-link__title-text',
    onHighlight: onHighlight,
});
