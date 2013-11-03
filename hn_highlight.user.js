// ==UserScript==
// @name          Highlight new stories on HN homepage
// @description   Highlight new stories on the Hacker News front page
// @author        Shaun G
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.1.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://news.ycombinator.com/
// @include       https://news.ycombinator.com/
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
// @grant         GM_getValue
// @grant         GM_setValue
// ==/UserScript==

/*
 * @requires:
 *
 * jQuery 2.0.3
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
 */

var DAYS = 3;
var HIGHLIGHT_COLOR = '#FFFF00';
var KEY = 'cache';
var NOW = new Date().getTime();
var TTL = 1000 * 60 * 60 * 24 * DAYS; // time-to-live: how long (in milliseconds) to cache IDs for

// HN article ID -> cache expiry timestamp (epoch milliseconds)
var cache = JSON.parse(GM_getValue(KEY, '{}'));

// purge expired IDs
for (var id in cache) {
    if (cache[id] < NOW) {
        delete cache[id];
    }
}

$('span[id^=down_]').each(function() {
    var id = $(this).attr('id').replace('^down_', '');

    if (!cache[id]) {
        $(this).parent().parent().next().css('background-color', HIGHLIGHT_COLOR);
        cache[id] = NOW + TTL;
    }
});

GM_setValue(KEY, JSON.stringify(cache));
