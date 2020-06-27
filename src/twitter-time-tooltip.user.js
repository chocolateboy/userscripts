// ==UserScript==
// @name          Twitter Time Tooltip
// @description   Restore timestamp tooltips when hovering over post dates on Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.1.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/eclecto/jQuery-onMutate@79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @require       https://unpkg.com/dayjs@1.8.28/dayjs.min.js
// @grant         GM_log
// @inject-into   auto
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

// format the date as (English) "7:55 PM - 18 Dec 2019"
//
// XXX ideally, we'd support ALL locales, but that would require moment (dayjs
// doesn't ship a bundle with all locales), which would bump the dependency size
// up from ~ 7K [1] to ~ 350K [2]
//
// [1] https://unpkg.com/browse/dayjs@1.8.28/
// [2] https://unpkg.com/browse/moment@2.26.0/min/
const FORMAT = 'h:mm A - D MMM YYYY'

// there were no timestamp tooltips when this was created (2020-06-12), but
// there have been tooltips before and after this date [1], and it's not clear
// what causes them to go AWOL (A/B testing? a bug?), so rather than adding them
// unconditionally, we only add them if they're missing.
//
// [1] https://github.com/chocolateboy/userscripts/issues/10#issuecomment-650631903
const SELECTOR = 'a[href]:not([title]) > time[datetime]:only-child'

function onLinks ($links) {
    for (const el of $links) {
        const $time = $(el)
        const $link = $time.parent()
        const timestamp = $time.attr('datetime')
        const title = dayjs(timestamp).format(FORMAT)

        $link.attr('title', title)
    }
}

$.onCreate(SELECTOR, onLinks, true /* multi */)
