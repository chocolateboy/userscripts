// ==UserScript==
// @name          Read Reddit, Yellow Reddit
// @description   Highlight new stories on the Reddit front page
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.1.2
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.reddit.com/
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.0.2/jquery.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_setValue
// ==/UserScript==

/*
 * @requires:
 *
 * jQuery 2.0.2
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/2.0.2/jquery.js
 */

const DAYS = 3;
const HIGHLIGHT_COLOR = '#FFFF00';
const KEY = 'cache';
const NOW = new Date().getTime();
const OLD_KEYS = [ 'Reddit_homepage', 'Reddit_Front_Page', 'article_ids' ];
const TTL = 1000 * 60 * 60 * 24 * DAYS; // time-to-live: how long (in milliseconds) to cache IDs for

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
    if (cache[id] < NOW) {
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
