// ==UserScript==
// @name          Pagerize Hacker News
// @description   Mark up Hacker News with pager metadata
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.0.2
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://news.ycombinator.com/*
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/jquery-pagerizer@v1.0.0/dist/pagerizer.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

$('a.morelink').addRel('next')
