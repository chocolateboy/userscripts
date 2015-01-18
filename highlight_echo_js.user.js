// ==UserScript==
// @name          Echo JS Highlighter
// @description   Highlight new stories on Echo JS
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.0.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.echojs.com/
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.js
// @require       https://raw.github.com/chocolateboy/userscripts/master/jquery/highlighter.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({
    item:   'article[data-news-id]',
    target: 'h2 a',
    id:     'data-news-id',
    color:  '#FEFEE6'
});
