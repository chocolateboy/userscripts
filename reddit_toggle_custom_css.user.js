// ==UserScript==
// @name         Reddit - Toggle Custom CSS
// @description  Persistently disable/re-enable subreddit-specific CSS via a userscript command
// @author       chocolateboy
// @namespace    https://github.com/chocolateboy/userscripts
// @include      http://reddit.com/r/*
// @include      https://reddit.com/r/*
// @include      http://*.reddit.com/r/*
// @include      https://*.reddit.com/r/*
// @require      https://code.jquery.com/jquery-3.2.1.min.js
// @version      1.0.0
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

// inspired by: http://userscripts-mirror.org/scripts/show/109818

const SUBREDDIT = location.pathname.match(/\/r\/(\w+)/)[1]
const CUSTOM_CSS = 'link[ref^="applied_subreddit_"]'

function toggle () {
    const oldDisableCss = GM_getValue(SUBREDDIT, false)
    const disableCss = !oldDisableCss

    $(CUSTOM_CSS).prop('disabled', disableCss)

    if (disableCss) {
        GM_setValue(SUBREDDIT, true)
    } else {
        GM_deleteValue(SUBREDDIT)
    }
}

const disableCss = GM_getValue(SUBREDDIT, false)

if (disableCss) {
    // https://wiki.greasespot.net/DOMContentLoaded#Workaround

    // NOTE we need to disable the display rather than setting its
    // visibility to hidden as the latter doesn't hide the background
    // (which leads to a flash of styled content on subreddits with a custom
    // background color and/or image)
    GM_addStyle('body { display: none !important }')

    $(document).on('DOMContentLoaded', function () {
        $(CUSTOM_CSS).prop('disabled', true)
        GM_addStyle('body { display: initial !important }')
    })
}

GM_registerMenuCommand('Toggle Custom CSS', toggle)
