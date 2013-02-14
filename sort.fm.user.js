// ==UserScript==
// @name          sort.fm
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       1.0.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @description   Sort last.fm tracklists by track number, duration or number of listeners
// @include       http://*.last.fm/music/*
// @include       http://last.fm/music/*
// @include       http://*.lastfm.*/music/*
// @include       http://lastfm.*/music/*
// @include       http://*.lastfm.com.*/music/*
// @include       http://lastfm.com.*/music/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.js
// @grant         none
// ==/UserScript==

/*
 * @requires:
 *
 * jQuery 1.9.1
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.js
 */

const INITIAL_SORTED_COLUMN = 'track';
const ASCENDING = 1, DESCENDING = -1;

/*
 * key (string):
 *
 *     internal identifier for each column e.g. 'track', 'duration'
 *
 * value (triple):
 *
 *     0: CSS class name identifying the table header cell to attach the click event to
 *     1: extractor function that takes a row and returns the value of its designated column as a sortable number
 *     2: initial sort order
 */
const MODEL = {
    'track':     [ 'subjectCell',  extract_track,     ASCENDING  ],
    'duration':  [ 'durationCell', extract_duration,  ASCENDING  ],
    'listeners': [ 'reachCell',    extract_listeners, DESCENDING ]
};

// --------------------------- extractors ------------------------------

function extract_track(row) {
    return $(row).find('.positionCell').text().replace(/\D+/g, '') * 1;
}

function extract_duration(row) {
    var duration = $(row).find('.durationCell').text().match(/(\d+):(\d+)/);
    return duration[1] * 60 + duration[2] * 1;
}

function extract_listeners(row) {
    return $(row).find('.reachCell').text().replace(/\D+/g, '') * 1;
}

// ------------------------------ helpers -------------------------------

function makeCompare(extractor, order) {
    return function(a, b) {
        return (extractor(a) - extractor(b)) * order;
    };
}

function stripe (i, row) {
    $(row).removeClass('first last odd');

    if ((i + 1) % 2) { // 0-based
        $(row).addClass('odd');
    }
}

/*
 * This function assigns a) a sensible initial sort order (i.e ascending or descending)
 * for each column the first time it's clicked, and b) remembers/restores the last
 * sort order selected for each column (for as long as the page is loaded).
 *
 * Note: the column by which the table is initially sorted (i.e. track) is
 * special-cased as it has effectively been "pre-clicked" to ascending order by last.fm.
 */
sortOrder = function() { // create a scope for variables that are local (i.e. private) to this function
    var lastColumn = INITIAL_SORTED_COLUMN, memo = {};
    memo[lastColumn] = MODEL[lastColumn][2];

    return function (column) {
        if (!memo[column]) { // initialise
            memo[column] = MODEL[column][2]; // initial sort order
        } else if (column === lastColumn) { // toggle
            memo[column] = memo[column] * -1;
        } // else restore

        lastColumn = column;
        return memo[column];
    };
}();

function makeSortBy($rowContainer, column) {
    var extractor = MODEL[column][1];

    return function() {
        var $rows = $rowContainer.children('tr');
        var order = sortOrder(column); // ascending (1) or descending (-1)
        var compare = makeCompare(extractor, order); // compare(a, b) function which honours the specified order
        var $sortedRows = $rows.detach().sort(compare);

        // fix up the stripes
        $sortedRows.each(stripe);
        $sortedRows.first().addClass('first');
        $sortedRows.last().addClass('last');

        // attach the sorted rows (TR) to the row container (TBODY)
        $sortedRows.appendTo($rowContainer);
    };
}

/******************************************************************************/

var $table = $('table.tracklist');

if ($table.length) {
    var $rows = $('tbody', $table).children('tr');
    $rows.prepend(function (index, html) {
        var position = index + 1;
        return '<span class="positionCell" style="display: none">' + position + '</span>';
    });
} else {
    $table = $('table#albumTracklist');
}

if ($table.length) {
    var $tbody = $('tbody', $table);

    $.each(MODEL, function(column, data) {
        var $cell = $('thead td.' + data[0], $table);
        $cell.css('cursor', 'pointer');
        $cell.click(makeSortBy($tbody, column));
    });
}
