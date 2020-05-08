// ==UserScript==
// @name          IMDb Full Summary
// @description   Automatically show the full plot summary on IMDb
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.6.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       http://*.imdb.tld/title/tt*
// @include       http://*.imdb.tld/*/title/tt*
// @include       https://*.imdb.tld/title/tt*
// @include       https://*.imdb.tld/*/title/tt*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

/*
 * Tests:
 *
 *     - truncated movie:   https://www.imdb.com/title/tt4920360/
 *     - truncated TV show: https://www.imdb.com/title/tt4507204/
 *     - not truncated:     https://www.imdb.com/title/tt7131622/
 */

// the truncated summary
const $summary = $('.summary_text').has('a[href*="/plotsummary"]')

if ($summary.length) {
    // the full summary (usually)
    const $storyline = $('#titleStoryLine > div.inline').first()

    if ($storyline.length) {
        $summary.html($storyline.text().trim())
    }
}
