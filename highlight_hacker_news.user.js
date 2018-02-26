// ==UserScript==
// @name          Hacker News Highlighter
// @description   Highlight new stories on the Hacker News front page
// @author        chocolateboy
// @author        Shaun G (original)
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.9.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://news.ycombinator.com/
// @include       /^https://news\.ycombinator\.com/(active|ask|best|front|newest|news|noobstories|show|shownew)\b/
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.rawgit.com/chocolateboy/jquery-highlighter/v2.1.0/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({
    ttl:    { days: 3 },
    item:   function () { return $('td a[id^=up_]').closest('tr') },
    target: 'td.title a[href]',
    id:     function () { return $(this).find('td a[id^=up_]').attr('id').replace('up_', '') }
});
