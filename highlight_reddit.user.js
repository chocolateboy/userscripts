// ==UserScript==
// @name          Reddit Highlighter
// @description   Highlight new stories on Reddit
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.7.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://reddit.com/
// @include       https://reddit.com/
// @include       http://*.reddit.com/
// @include       https://*.reddit.com/
// @include       /^http(s)?:\/\/([^.]+\.)?reddit\.com\/r\/[^\/]+\/$/
// @include       /^http(s)?:\/\/([^.]+\.)?reddit\.com\/r\/[^\/]+$/
// @include       /^http(s)?:\/\/([^.]+\.)?reddit\.com\/r\/[^\/]+/(hot|new|rising|controversial|top)\/$/
// @include       /^http(s)?:\/\/([^.]+\.)?reddit\.com\/r\/[^\/]+/(hot|new|rising|controversial|top)$/
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.js
// @require       https://raw.github.com/chocolateboy/userscripts/master/jquery/highlighter.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({
    item:   'div#siteTable div.thing[data-fullname]',
    target: 'a.title',
    id:     'data-fullname',
    site:   'Reddit'
});
