// ==UserScript==
// @name          Linkify Twitter Trends
// @description   Make Twitter trends links (again)
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.0.2
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://twitter.com/*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/eclecto/jQuery-onMutate@79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @grant         GM_log
// @inject-into   auto
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

function onTrends ($trends) {
    for (const el of $trends) {
        const $trend = $(el)
        const quoted = $trend.text().replace(/"/g, '')
        const query = encodeURIComponent('"' + quoted + '"')
        const href = `${location.origin}/search?q=${query}`
        const $link = $('<a></a>').attr('href', href)
        $trend.wrap($link)
    }
}

$.onCreate('[data-testid="trend"] [dir="ltr"] > span', onTrends, true /* multi */)
