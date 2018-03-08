// ==UserScript==
// @name          Hacker News Highlighter
// @description   Highlight new stories on Hacker News
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.11.2
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://news.ycombinator.com/
// @include       /^https://news\.ycombinator\.com/(active|ask|best|front|newest|news|noobstories|show|shownew)\b/
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.rawgit.com/chocolateboy/jquery-highlighter/478971a2a6e279f73cc65680e1e25ae0b62a3820/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({
    item () { return $('td a[id^=up_]').closest('tr') },
    target: 'td.title a[href].storylink',
    id () { return $(this).find('td a[id^=up_]').attr('id').replace('up_', '') },
})
