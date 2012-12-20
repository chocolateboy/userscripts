// ==UserScript==
// @name           ISO 8601 Dates
// @namespace      https://github.com/chocolateboy/userscripts
// @description    Convert US (MM/DD/YY, MM/DD/YYYY, MM-DD-YY, MM-DD-YYYY) dates to the ISO 8601 YYYY-MM-DD format
// @version        1.0.0
// @author         chocolateboy
// @license        GPL: http://www.gnu.org/copyleft/gpl.html
// @grant          none
// ==/UserScript==

const XPATH = '//body//text()';
const DATE  = new RegExp(
      '(?:\\b(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-(\\d{4}|\\d{2})\\b(?!-))'
    + '|'
    + '(?:\\b(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])/(\\d{4}|\\d{2})\\b(?!/))',
    'g'
);

//             Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
const days = [ 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];

function leap_year (year) {
    if ((year % 400) == 0) {           // multiples of 400 are leap years
        return true;
    } else if ((year % 100) == 0) {    // the remaining multiples of 100 are not leap years
        return false;
    } else if ((year % 4) == 0) {      // the remaining multiples of 4 are leap years
        return true;
    } else {                           // the rest are common years
        return false;
    }
}

// https://bugzilla.mozilla.org/show_bug.cgi?id=392378
function replace (match, m1, d1, y1, m2, d2, y2, offset, string) {
    var year  = y1 || y2; // depending on the above, non-matches are either empty or undefined, both of which are false
    var month = m1 || m2;
    var day   = d1 || d2;

    // manual negative look-behind: see: http://blog.stevenlevithan.com/archives/mimic-lookbehind-javascript
    if (offset > 0) {
        var prefix = string[offset - 1];
        if ((prefix == '-') || (prefix == '/')) {
            return match;
        }
    }

    if (day > days[month - 1]) {
        return match;
    }

    if (year.length == 2) {
        // Internet Founding Fathers, forgive us. From the epoch to 1999, we knew not what to do...
        year = (((year >= 70) && (year <= 99)) ? '19' : '20') + year;
    }

    if ((month == '02') && (day == '29') && !leap_year(year)) {
        return match;
    }

    return year + '-' + month + '-' + day;
}

function fix_dates() {
    var nodes = document.evaluate(XPATH, document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);

    for (var i = 0; i < nodes.snapshotLength; ++i) {
        var text = nodes.snapshotItem(i);
        text.data = text.data.replace(DATE, replace);
    }
}

// add a menu command for that pesky, hard-to-reach, lazily-loaded content
GM_registerMenuCommand('US -> ISO 8601 Dates', fix_dates);

// run this script as late as possible to handle dynamically loaded content e.g. cracked.com
window.addEventListener('load', fix_dates, false);
