// ==UserScript==
// @name          Reddit Highlighter
// @description   Highlight new stories on Reddit
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.13.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       /^https?:\/\/([^.]+\.)?reddit\.com(\/r\/[^\/]+(/(hot|new|rising|controversial|top))?)?\/?$/
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.rawgit.com/chocolateboy/jquery-highlighter/478971a2a6e279f73cc65680e1e25ae0b62a3820/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({
    item:   'div#siteTable div.thing[data-fullname]',
    target: 'a.title',
    id:     'data-fullname'
});
