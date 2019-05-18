// ==UserScript==
// @name         Reddit - Toggle Custom CSS
// @description  Persistently disable/re-enable subreddit-specific styles via a userscript command
// @author       chocolateboy
// @copyright    chocolateboy
// @version      1.2.0
// @namespace    https://github.com/chocolateboy/userscripts
// @license      GPL: http://www.gnu.org/copyleft/gpl.html
// @include      http://reddit.com/r/*
// @include      https://reddit.com/r/*
// @include      http://*.reddit.com/r/*
// @include      https://*.reddit.com/r/*
// @require      https://code.jquery.com/jquery-3.4.1.min.js
// @require      https://cdn.jsdelivr.net/gh/eclecto/jQuery-onMutate@79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

// inspired by: http://userscripts-mirror.org/scripts/show/109818

const CUSTOM_CSS = 'link[ref^="applied_subreddit_"]'
const DISABLE_CSS = false
const SUBREDDIT = location.pathname.match(/\/r\/(\w+)/)[1]

function toggle () {
    const oldDisableCss = GM_getValue(SUBREDDIT, DISABLE_CSS)
    const disableCss = !oldDisableCss

    $(CUSTOM_CSS).prop('disabled', disableCss)

    if (disableCss) {
        GM_setValue(SUBREDDIT, true)
    } else {
        GM_deleteValue(SUBREDDIT)
    }
}

// NOTE we need to disable the display rather than setting its visibility to
// hidden as the latter doesn't hide the background (which leads to a flash of
// styled content (FOSC) on subreddits with a custom background color and/or
// image)
//
// XXX hide the html element rather than the body element as the latter still
// results in a FOSC on some subreddits e.g. /r/firefox
function hidePage () {
    GM_addStyle('html { display: none !important }')
}

const disableCss = GM_getValue(SUBREDDIT, DISABLE_CSS)

if (disableCss) {
    $(document).onCreate('head', hidePage)

    // https://wiki.greasespot.net/DOMContentLoaded#Workaround
    $(document).on('DOMContentLoaded', () => {
        $(CUSTOM_CSS).prop('disabled', true)
        GM_addStyle('html { display: initial !important }')
    })
}

GM_registerMenuCommand('Toggle Custom CSS', toggle)
