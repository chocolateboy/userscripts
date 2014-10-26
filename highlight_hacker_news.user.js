// ==UserScript==
// @name          Hacker News Highlighter
// @description   Highlight new stories on the Hacker News front page
// @author        Shaun G (original)
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.3.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://news.ycombinator.com/
// @include       http://news.ycombinator.com/news
// @include       https://news.ycombinator.com/
// @include       https://news.ycombinator.com/news
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.js
// @require       https://raw.github.com/chocolateboy/userscripts/master/jquery/highlighter.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({
    ttl:    { days: 3 },
    color:  '#FFFF00',
    item:   'span[id^=down_]',
    target: function($item) { return $item.parent().parent().next() },
    id:     function($item) { return $item.attr('id').replace('^down_', '') },
    site:   'Hacker News'
});
