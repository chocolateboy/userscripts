// ==UserScript==
// @name          Hacker News Date Tooltips
// @description   Deobfuscate the "n days ago" dates on Hacker News with YYYY-MM-DD tooltips
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.0.2
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://news.ycombinator.com/*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://unpkg.com/dayjs@1.5.11/dist/dayjs.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

const DELTA = 1, UNIT = 2

const DATES = $('html').attr('op') === 'user' ?
    'table:eq(-1) tr:eq(1) td:eq(-1)' :
    'span.age a'

function isoDate (ago) {
    const match = ago.match(/^(\d+)\s+(\w+)\s+ago$/)
    let date

    if (match) {
        date = dayjs().subtract(match[DELTA], match[UNIT]).format('YYYY-MM-DD')
    }

    return date
}

$(DATES).each(function () {
    const $this = $(this)
    const ago   = $.trim($this.text())
    const date  = isoDate(ago)

    if (date) {
        $this.attr('title', date)
    }
})
