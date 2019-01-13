// ==UserScript==
// @name        IMDb Full Summary
// @description Automatically show the full plot summary on IMDb
// @author      chocolateboy
// @copyright   chocolateboy
// @version     1.5.1
// @namespace   https://github.com/chocolateboy/userscripts
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     http://*.imdb.tld/title/tt*
// @include     http://*.imdb.tld/*/title/tt*
// @include     https://*.imdb.tld/title/tt*
// @include     https://*.imdb.tld/*/title/tt*
// @require     https://code.jquery.com/jquery-3.3.1.min.js
// @grant       GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

/*
 * Tests
 *
 *     truncated:     https://www.imdb.com/title/tt0067961/
 *     refspam URL:   https://www.imdb.com/title/tt0067961/?ref_=fn_tt_tt_1
 *     not truncated: https://www.imdb.com/title/tt0062474/
 */

// the truncated summary
const $summary = $('.summary_text').has('a[href*="/plotsummary"]')

if ($summary.length) {
    // the full summary (usually)
    const $storyline = $('span[itemprop="description"]')

    if ($storyline.length) {
        $summary.html($storyline.text().trim())
    }
}
