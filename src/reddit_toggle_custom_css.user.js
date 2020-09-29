// ==UserScript==
// @name          Reddit Toggle Custom CSS
// @description   Persistently disable/re-enable custom subreddit styles via a userscript command
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.4.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://reddit.com/r/*
// @include       https://reddit.com/r/*
// @include       http://*.reddit.com/r/*
// @include       https://*.reddit.com/r/*
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_registerMenuCommand
// @run-at        document-start
// @inject-into   content
// ==/UserScript==

// inspired by: http://userscripts-mirror.org/scripts/show/109818

const CUSTOM_CSS = 'link[ref^="applied_subreddit_"]'
const DISABLE_CSS = false
const SUBREDDIT = location.pathname.match(/\/r\/(\w+)/)[1]

function disableCss () {
    // NOTE we need to disable the display rather than setting its visibility to
    // hidden as the latter doesn't hide the background (which leads to a flash
    // of styled content (FOSC) on subreddits with a custom background color
    // and/or image)

    // XXX hide the HTML element rather than the BODY element as the latter
    // still results in a FOSC on some subreddits e.g. /r/firefox

    // the definition of document-start varies between userscript engines and
    // may vary for the same userscript engine across different browser engines.
    // currently, the following userscript-engines/browsers all expose
    // document.documentElement (in fact, they all expose document.head as well,
    // currently, though that is not guaranteed [1] [2]):
    //
    // - Greasemonkey 4 [3]
    // - Tampermonkey for Firefox
    // - Violentmonkey for Chrome
    // - Violentmonkey for Firefox
    //
    // [1] https://github.com/violentmonkey/violentmonkey/releases/tag/v2.12.8rc16
    // [2] https://github.com/Tampermonkey/tampermonkey/issues/211#issuecomment-317116595
    // [3] Greasemonkey isn't supported as it doesn't support GM_registerMenuCommand

    const { style } = document.documentElement

    style.display = 'none'

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelector(CUSTOM_CSS).disabled = true
        style.removeProperty('display')
    })
}

function toggle () {
    const disableCss = !GM_getValue(SUBREDDIT, DISABLE_CSS)

    document.querySelector(CUSTOM_CSS).disabled = disableCss

    if (disableCss === DISABLE_CSS) {
        GM_deleteValue(SUBREDDIT)
    } else {
        GM_setValue(SUBREDDIT, disableCss)
    }
}

if (GM_getValue(SUBREDDIT, DISABLE_CSS)) {
    disableCss()
}

GM_registerMenuCommand('Toggle Custom CSS', toggle)
