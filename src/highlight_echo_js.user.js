// ==UserScript==
// @name          Echo JS Highlighter
// @description   Highlight new stories on Echo JS
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.0.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://echojs.com/
// @include       http://www.echojs.com/
// @include       https://www.echojs.com/
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/jquery-highlighter@63adeb7dea43c47e210fd17b0589e648239e97f0/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_listValues
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
