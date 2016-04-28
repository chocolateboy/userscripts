// ==UserScript==
// @name           Reddit - Toggle Custom CSS
// @description    Enable/disable subreddit-specific CSS via a userscript command
// @author         chocolateboy
// @namespace      https://github.com/chocolateboy/userscripts
// @include        http://reddit.com/r/*
// @include        https://reddit.com/r/*
// @include        http://*.reddit.com/r/*
// @include        https://*.reddit.com/r/*
// @require        https://ajax.googleapis.com/ajax/libs/jquery/2.2.2/jquery.js
// @version        0.0.1
// @run-at         document-start
// @grant          GM_addStyle
// @grant          GM_deleteValue
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_registerMenuCommand
// ==/UserScript==

// original: http://userscripts.org/scripts/show/109818 AKA
// https://github.com/chocolateboy/userscripts/blob/master/maintenance/reddit_toggle_custom_styles.user.js

// XXX jQuery 2.2.3 was released on 2016-04-05. Why isn't it available on Google's CDN
// on 2016-04-28?

// Why this remix? Because a) I don't use the other toggles (and the Unix philosophy
// suggests they should be separate userscripts) and b) several subreddits mangle the
// extra buttons so it's impossible to see/click them e.g. /r/ConTalks/
// Also, this is much easier to understand/maintain.

var SUBREDDIT = location.pathname.match(/\/r\/(\w+)/)[1];
var CUSTOM_CSS = 'link[title="applied_subreddit_stylesheet"]'

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
