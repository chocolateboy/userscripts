// ==UserScript==
// @name          GitHub My Issues
// @description   Add a link to issues you've contributed to on GitHub
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.0.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://github.com/
// @include       https://github.com/*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @grant         GM_log
// @inject-into   auto
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

const user = $('meta[name="user-login"]').attr('content')
const $issues = $('[aria-label="Global"] a[href="/issues"]')

if (user && $issues.length) {
    const repo = $('meta[name="octolytics-dimension-repository_nwo"]').attr('content')
    const query = escape(`involves:${user}`)
    const href = repo ? `/${repo}/issues?q=${query}` : `/issues?q=${query}`
    const $link = $issues.clone()
        .attr({ href, 'data-hotkey': 'g I' })
        .text('My Issues')

    $issues.after($link)
}
