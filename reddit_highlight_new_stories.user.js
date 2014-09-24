// ==UserScript==
// @name          Highlight new stories on Reddit
// @description   Highlight new front page and subreddit stories on Reddit
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.5.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://reddit.com/
// @include       https://reddit.com/
// @include       http://*.reddit.com/
// @include       https://*.reddit.com/
// @include       /^http(s)?:\/\/([^.]+\.)?reddit\.com\/r\/[^\/]+\/?$/
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.js
// @grant         GM_getValue
// @grant         GM_setValue
// ==/UserScript==

var DAYS = 7;
var HIGHLIGHT_COLOR = '#FFFD66';
var KEY = 'seen';
var NOW = new Date().getTime();
var TTL = 1000 * 60 * 60 * 24 * DAYS; // time-to-live: how long (in milliseconds) to cache IDs for

// Reddit article ID -> cache expiry timestamp (epoch milliseconds)
var seen = JSON.parse(GM_getValue(KEY, '{}'));

// purge expired IDs
for (var id in seen) {
    if (NOW > seen[id]) {
        delete seen[id];
    }
}

$('div#siteTable div.thing[data-fullname]').each(function() {
    var id = $(this).attr('data-fullname');

    if (!seen[id]) {
        $('a.title', this).css('background-color', HIGHLIGHT_COLOR);
        seen[id] = NOW + TTL;
    }
});

GM_setValue(KEY, JSON.stringify(seen));
