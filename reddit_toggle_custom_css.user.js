// ==UserScript==
// @name           Reddit - Toggle Custom CSS
// @description    Persistently enable/disable subreddit-specific CSS via a userscript command
// @author         chocolateboy
// @namespace      https://github.com/chocolateboy/userscripts
// @include        http://reddit.com/r/*
// @include        https://reddit.com/r/*
// @include        http://*.reddit.com/r/*
// @include        https://*.reddit.com/r/*
// @require        https://code.jquery.com/jquery-3.1.1.min.js
// @version        0.0.3
// @run-at         document-start
// @grant          GM_addStyle
// @grant          GM_deleteValue
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_registerMenuCommand
// ==/UserScript==

// original: http://userscripts-mirror.org/scripts/show/109818

// Why this remix? Because a) I don't use the other toggles (and the Unix philosophy
// suggests they should be separate userscripts) and b) several subreddits mangle the
// extra buttons so it's impossible to see/click them e.g. /r/ConTalks/
// Also, this is much easier to understand/maintain.

var SUBREDDIT = location.pathname.match(/\/r\/(\w+)/)[1];
var CUSTOM_CSS = 'link[title="applied_subreddit_stylesheet"]';

function toggle () {
    var disableCss = !GM_getValue(SUBREDDIT, false);

    $(CUSTOM_CSS).prop('disabled', disableCss);

    if (disableCss) {
        GM_setValue(SUBREDDIT, true);
    } else {
        GM_deleteValue(SUBREDDIT);
    }
}

var disableCss = GM_getValue(SUBREDDIT, false);

if (disableCss) {
    // https://wiki.greasespot.net/DOMContentLoaded#Workaround
    GM_addStyle("body { visibility: hidden }");

    $(document).on('DOMContentLoaded', function () {
        $(CUSTOM_CSS).prop('disabled', true)
        GM_addStyle("body { visibility: visible !important }");
    });
}

GM_registerMenuCommand('Toggle Custom CSS', toggle);
