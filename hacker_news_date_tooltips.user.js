// ==UserScript==
// @name          Hacker News Date Tooltips
// @description   Decrypt the "n days ago" timestamps on Hacker News with YYYY-MM-DD tooltips
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.0.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://news.ycombinator.com/*
// @require       https://code.jquery.com/jquery-3.1.0.min.js
// @require       https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.15.0/moment.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

var DELTA = 1, UNIT = 2;

var DATES = $('html').attr('op') == 'user' ?
    'table:eq(-1) tr:eq(1) td:eq(-1)' :
    'span.age a';

function isoDate (ago) {
    var match = ago.match(/^(\d+)\s+(\w+)\s+ago$/);
    var date;

    if (match) {
        date = moment().subtract(match[DELTA], match[UNIT]).format('YYYY-MM-DD');
    }

    return date;
}

$(DATES).each(function () {
    var $this = $(this);
    var ago   = $.trim($this.text());
    var date  = isoDate(ago);

    if (date) {
        $this.attr('title', date);
    }
});
