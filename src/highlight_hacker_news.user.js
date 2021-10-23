// ==UserScript==
// @name          Hacker News Highlighter
// @description   Highlight new stories on Hacker News
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.1.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://news.ycombinator.com/
// @include       /^https://news\.ycombinator\.com/(active|ask|best|front|newest|news|noobstories|show|shownew)\b/
// @require       https://code.jquery.com/jquery-3.6.0.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/jquery-highlighter@63adeb7dea43c47e210fd17b0589e648239e97f0/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_listValues
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({
    item: 'tr.athing[id]:has(> td.votelinks)',
    target: 'td.title a.titlelink[href]',
})
