// ==UserScript==
// @name        IMDb Full Summary
// @namespace   https://github.com/chocolateboy/userscripts
// @description Automatically show the full plot summary on IMDb
// @author      chocolateboy
// @version     0.0.1
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     http://*.imdb.com/title/*/
// @include     http://*.imdb.de/title/*/
// @include     http://*.imdb.es/title/*/
// @include     http://*.imdb.fr/title/*/
// @include     http://*.imdb.it/title/*/
// @include     http://*.imdb.pt/title/*/
// @require     https://ajax.googleapis.com/ajax/libs/jquery/1.6.4/jquery.js
// @require     https://raw.github.com/documentcloud/underscore/master/underscore-min.js
// ==/UserScript==

/*
 * jQuery 1.6.4
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/1.6.4/jquery.js
 *
 * Underscore.js utility library
 *
 *     http://documentcloud.github.com/underscore/
 */

/*
 * Test
 *
 * http://www.imdb.com/title/tt0109374/
 * http://www.imdb.com/title/tt0062474/
 * http://www.imdb.fr/title/tt0111161/
 * http://www.imdb.de/title/tt0111161/
 */

var $summary = _.find( // i.e. find first result with length > 0
    [
        $('p[itemprop=description]').has('a[href$="plotsummary"], a[href$="synopsis"]'),
        $('div.info-content').has('a[href$="/plotsummary"]')
    ],
    function (it) { return it.length }
);

if ($summary && $summary.clone().children().remove().end().text().match(/\S/)) {
    $.ajaxSetup({
        beforeSend: function(xhr) {
            xhr.overrideMimeType('text/html; charset=ISO-8859-1');
        },
    });

    var path = $summary.find('a:last').attr('href');
    var url;

    if (path[0] == '/') { // absolute path
        url = location.protocol + '//' + location.host + path;
    } else { // relative path
        url = location.href.replace(/(?:\/)*$/, '/' + path);
    }

    // need to use get() rather than load() because we're modifying the result
    // XXX: unlike load() this doesn't remove scripts from data, which may cause issues with IE
    // XXX: unfortunately, jQuery doesn't expose the sanitization (regex)
    $.get(url, function(data) {
        var $data = $(data);
        var $plotpar = $data.find('.plotpar:first');

        if ($plotpar.length) {
            $summary.html($plotpar.find('i:last').remove().end());
        } else {
            var $swiki = $data.find('#swiki\\.2\\.1');

            if ($swiki.length) {
                $summary.html($swiki);
            }
        }
    });
}
