// ==UserScript==
// @name          Google Unsafe Search
// @description   Disable SafeSearch on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.0.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.google.tld/search?*tbm=isch*
// @include       http://images.google.tld/search?*tbm=isch*
// @include       https://www.google.tld/search?*tbm=isch*
// @include       https://encrypted.google.tld/search?*tbm=isch*
// @run-at        document-start
// ==/UserScript==

// work around Scriptish (@run-at?) bug that causes this script
// to be run for a matched page and then triggered again for an
// empty location (with the @run-at directive removed, the location
// is about:blank)
if (location.search) {
    var oldQuery = location.search.substring(1);
    var newQuery = oldQuery;

    newQuery = newQuery.replace(/\bsafe=(?:\w+)?/g, 'safe=off');

    if (!newQuery.match(/\bsafe=off\b/)) {
        newQuery = 'safe=off&' + newQuery;
    }

    if (newQuery != oldQuery) {
        location.replace(
            location.protocol +
            '//' +
            location.hostname +
            location.pathname +
            '?' +
            newQuery +
            location.hash
        );
    }
}
