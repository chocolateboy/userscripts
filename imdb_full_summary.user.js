// ==UserScript==
// @name        IMDb Full Summary
// @namespace   https://github.com/chocolateboy/userscripts
// @description Automatically show the full plot summary on IMDb
// @author      chocolateboy
// @version     1.1.0
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     http://*.imdb.tld/title/*/
// @include     http://*.imdb.tld/title/*/?*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
// @grant       GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

/*
 * Tests
 *
 *     truncated:     http://www.imdb.com/title/tt0109374/
 *     not truncated: http://www.imdb.com/title/tt0062474/
 *     no summary:    http://www.imdb.com/title/tt0162757/
 *     refspam URL:   http://www.imdb.com/title/tt1776222/?ref_=fn_tt_tt_1
 */

// the truncated summary
var $summary = $('p[itemprop=description]').has('a[href*="/plotsummary"]');

if ($summary.length && $summary.clone().children().remove().end().text().match(/\S/)) {
    // the full summary (usually)
    var $storyline = $('div[itemprop="description"]');
    if ($storyline.length) {
        $summary.html($storyline.clone().find('em.nobr').remove().end());
    }
}
