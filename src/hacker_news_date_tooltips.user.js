// ==UserScript==
// @name          Hacker News Date Tooltips
// @description   Deobfuscate the "n days ago" dates on Hacker News with YYYY-MM-DD tooltips
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.1.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://news.ycombinator.com/*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.0/dist/cash.min.js
// @require       https://unpkg.com/dayjs@1.10.4/dayjs.min.js
// @grant         GM_log
// ==/UserScript==

const DATES = 'span.age a'
const DELTA = 1, UNIT = 2

function isoDate (ago) {
    const match = ago.match(/^(\d+)\s+(\w+)\s+ago$/)

    return match
        ? dayjs().subtract(match[DELTA], match[UNIT]).format('YYYY-MM-DD')
        : null
}

$(DATES).each(function () {
    const $this = $(this)
    const ago   = $this.text().trim()
    const date  = isoDate(ago)

    if (date) {
        $this.attr('title', date)
    }
})
