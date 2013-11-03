// ==UserScript==
// @name          Highlight new stories on the Reddit front page
// @description   Highlight stories promoted to the Reddit front page since the last visit
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.4.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://reddit.com/
// @include       https://reddit.com/
// @include       http://*.reddit.com/
// @include       https://*.reddit.com/
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
// @grant         GM_deleteValue
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
var HIGHLIGHT_COLOR = '#FFFD66';
var KEY = 'cache';
var NOW = new Date().getTime();
var OLD_KEYS = [ 'Reddit_homepage', 'Reddit_Front_Page', 'article_ids' ];
var TTL = 1000 * 60 * 60 * 24 * DAYS; // time-to-live: how long (in milliseconds) to cache IDs for

// remove obsolete keys
$.each(OLD_KEYS, function(index, value) {
    if (GM_getValue(value)) {
        GM_deleteValue(value);
    }
});

// Reddit article ID -> cache expiry timestamp (epoch milliseconds)
var cache = JSON.parse(GM_getValue(KEY, '{}'));

// purge expired IDs
for (var id in cache) {
    if (NOW > cache[id]) {
        delete cache[id];
    }
}

$('div#siteTable div.thing[data-fullname]').each(function() {
    var id = $(this).attr('data-fullname');

    if (!cache[id]) {
        $('a.title', this).css('background-color', HIGHLIGHT_COLOR);
        cache[id] = NOW + TTL;
    }
});

GM_setValue(KEY, JSON.stringify(cache));
