// ==UserScript==
// @name          Reddit Highlighter
// @description   Highlight new stories on Reddit
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.0.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://*.reddit.com/
// @include       https://*.reddit.com/?count=*
// @include       /^https://[^.]+\.reddit\.com/(r/[^/]+/)?($|(best|controversial|hot|new|rising|top)/)/
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/jquery-highlighter@63adeb7dea43c47e210fd17b0589e648239e97f0/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_listValues
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({
    item:   'div#siteTable div.thing[data-fullname]',
    target: 'a.title',
    id:     'data-fullname',
})
