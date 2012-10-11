// ==UserScript==
// @name          Google Unsafe Search Without Cookies
// @description   Disable Google SafeSearch without cookies
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.1.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.google.tld
// @include       http://www.google.tld/*
// @include       https://www.google.tld
// @include       https://www.google.tld/*
// @include       http://images.google.tld
// @include       http://images.google.tld/*
// @run-at        document-start
// ==/UserScript==

// Google's use of AJAX to load results without reloading the page makes things interesting...
//
// This script gets called when child nodes are added to the top-level document
// (the child node's document's location is empty or "about:blank").
// The URL used to fetch the JSON that populates these nodes is buried in
// Google's obfuscated JavaScript, so we can't intercept it.
//
// Fortunately, when results are loaded via AJAX, the page state is stored/reflected in the URL hash.
// Currently, we rewrite this "AJAX URL" as a real search URL and replace the page.
// It may be possible to just update the hash, but that requires the use of e.g. replaceState():
// https://developer.mozilla.org/en-US/docs/DOM/Manipulating_the_browser_history
//
// This solution is good enough for now and avoids portability woes.
//
// See the notes in the source of Jordon Kalilich's Google Preferences Without
// Cookies for more background: http://userscripts.org/scripts/show/64112

// Images, Video, or Shopping
const SEARCH_RE = new RegExp('\\btbm=(?:isch|vid|shop)\\b');

// like params.split('&'), but return an empty array if params is empty
function splitParams(params) {
    if (!params) {
        return [];
    } else {
        return params.split("&");
    }
}

// if the current URL has query or hash parameters that allow SafeSearch to be disabled,
// normalize the parameters to query parameters, disable SafeSearch (set safe=off), and
// replace the current URL
function checkURL(e) {
    if (location.search.match(SEARCH_RE) || location.hash.match(SEARCH_RE)) {
        var search = location.search ? location.search.substring(1) : '';
        var hash = location.hash ? location.hash.substring(1) : '';
        var oldParams = splitParams(search).concat(splitParams(hash)).join('&');
        var newParams = oldParams.replace(/\bsafe=(?:\w+)?/g, 'safe=off');

        if (!newParams.match(/\bsafe=off\b/)) {
            newParams = 'safe=off&' + newParams;
        }

        if (newParams != oldParams) {
            var newURL =
                location.protocol +
                '//' +
                location.hostname +
                '/search' +
                '?' +
                newParams;
            location.replace(newURL);
        }
    }
}

if (top.location == location) {
    checkURL(null);
    // can't use jQuery with @run-at document-start:
    // http://code.google.com/p/chromium/issues/detail?id=109272
    window.addEventListener("hashchange", checkURL);
}
