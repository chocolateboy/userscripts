// ==UserScript==
// @name          Hacker News Highlighter
// @description   Highlight new stories on the Hacker News front page
// @author        Shaun G (original)
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.6.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://news.ycombinator.com/
// @include       http://news.ycombinator.com/news
// @include       https://news.ycombinator.com/
// @include       https://news.ycombinator.com/news
// @require       https://code.jquery.com/jquery-3.1.0.min.js
// @require       https://raw.github.com/chocolateboy/userscripts/master/jquery/highlighter.js
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
