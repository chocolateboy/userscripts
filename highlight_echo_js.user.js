// ==UserScript==
// @name          Echo JS Highlighter
// @description   Highlight new stories on Echo JS
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.3.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.echojs.com/
// @require       https://code.jquery.com/jquery-3.1.1.min.js
// @require       https://cdn.rawgit.com/chocolateboy/userscripts/master/jquery/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({
    item:   'article[data-news-id]',
    target: 'h2 a',
    id:     'data-news-id',
    color:  '#FFFFAB',
    ttl:    { days: 14 }
});
