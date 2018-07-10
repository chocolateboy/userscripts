// ==UserScript==
// @name          Echo JS Highlighter
// @description   Highlight new stories on Echo JS
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.8.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://echojs.com/
// @include       http://www.echojs.com/
// @include       https://www.echojs.com/
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.rawgit.com/chocolateboy/jquery-highlighter/478971a2a6e279f73cc65680e1e25ae0b62a3820/dist/highlighter.min.js
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
    ttl:    { days: 28 }
});
