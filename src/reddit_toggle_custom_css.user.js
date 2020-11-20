// ==UserScript==
// @name          Reddit Toggle Custom CSS
// @description   Persistently disable/re-enable custom subreddit styles via a userscript command
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.5.0
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
// @inject-into   auto
// ==/UserScript==

// inspired by: http://userscripts-mirror.org/scripts/show/109818

const CUSTOM_CSS = 'link[ref^="applied_subreddit_"]'
const DEFAULT_DISABLE_CSS = false
const SUBREDDIT = location.pathname.match(/\/r\/(\w+)/)[1]
const DISABLE_CSS = GM_getValue(SUBREDDIT, DEFAULT_DISABLE_CSS)

// the definition of document-start varies across userscript engines and may
// vary for the same userscript engine across different browsers. currently, the
// following userscript-engines/browsers all expose document.documentElement (in
// fact, they all expose document.head as well, though that's not guaranteed [1]
// [2]):
//
//   - Greasemonkey 4 [3]
//   - Tampermonkey for Firefox
//   - Violentmonkey for Chrome
//   - Violentmonkey for Firefox
//
// [1] https://github.com/violentmonkey/violentmonkey/releases/tag/v2.12.8rc16
// [2] https://github.com/Tampermonkey/tampermonkey/issues/211#issuecomment-317116595
// [3] Greasemonkey isn't supported as it doesn't support GM_registerMenuCommand
const { style } = document.documentElement

function toggle (customCss) {
    const disableCss = !GM_getValue(SUBREDDIT, DEFAULT_DISABLE_CSS)

    customCss.disabled = disableCss

    if (disableCss === DEFAULT_DISABLE_CSS) {
        GM_deleteValue(SUBREDDIT)
    } else {
        GM_setValue(SUBREDDIT, disableCss)
    }
}

if (DISABLE_CSS) {
    // 1) hide the page 2) disable the stylesheet 3) unhide the page
    //
    // NOTE we need to use `display: none` rather than `visibility: hidden` as
    // the latter doesn't hide the background (which leads to a flash of styled
    // content (FOSC) on subreddits with a custom background color and/or image)
    //
    // XXX hide the HTML element rather than the BODY element as the latter
    // still results in a FOSC on some subreddits e.g. /r/firefox
    style.display = 'none' // 1) hide the page
}

document.addEventListener('DOMContentLoaded', () => {
    // the custom stylesheet (LINK element) doesn't exist on all subreddit
    // pages, e.g.:
    //
    //   ✔ /r/<subreddit>/about/rules/
    //   x /r/<subreddit>/about/moderators/
    const customCss = document.querySelector(CUSTOM_CSS)

    if (DISABLE_CSS) {
        if (customCss) {
            customCss.disabled = true // 2) disable the stylesheet
        }

        style.removeProperty('display') // 3) unhide the page
    }

    // don't show the toggle command if there's no custom stylesheet to toggle
    if (customCss) {
        GM_registerMenuCommand('Toggle Custom CSS', () => toggle(customCss))
    }
})
