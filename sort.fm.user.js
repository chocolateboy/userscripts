// ==UserScript==
// @name          sort.fm
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       1.1.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @description   Sort last.fm tracklists by track number, duration or number of listeners
// @include       http://www.last.fm/music/*
// @include       http://cn.last.fm/music/*
// @include       http://www.lastfm.tld/music/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
// @grant         none
// ==/UserScript==

/*
 * @requires:
 *
 * jQuery 2.0.3
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
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
const COLUMN_CONFIG = {
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

function stripe (index, row) {
    $(row).removeClass('first last odd');

    if ((index + 1) % 2) { // index is 0-based, so index == 0 is the first row (odd) &c.
        $(row).addClass('odd');
    }
}

/*
 * Initialize, toggle or restore the sort order for the supplied column.
 *
 * Note: the column by which the table is initially sorted (i.e. track) is
 * special-cased as it has effectively been "pre-clicked" to ascending order by last.fm.
 */
sortOrder = function() { // create a scope for variables that are local (i.e. private) to this function
    var lastSelectedColumn = INITIAL_SORTED_COLUMN, sort_order = {};
    sort_order[lastSelectedColumn] = COLUMN_CONFIG[lastSelectedColumn][2];

    return function (column) {
        if (!sort_order[column]) { // initialize
            sort_order[column] = COLUMN_CONFIG[column][2]; // initial sort order
        } else if (column === lastSelectedColumn) { // toggle
            sort_order[column] = sort_order[column] * -1;
        } // else restore

        lastSelectedColumn = column;
        return sort_order[column];
    };
}();

// returns a function that sorts the table rows by the specified column
function makeSortBy($rowContainer, column) {
    var extractor = COLUMN_CONFIG[column][1];

    return function() {
        var $rows = $rowContainer.children('tr');
        var order = sortOrder(column); // ascending (1) or descending (-1)
        var compare = makeCompare(extractor, order); // compare(a, b) function which honours the specified order
        var $sortedRows = $rows.detach().sort(compare);

        // fix up the CSS
        $sortedRows.each(stripe);
        $sortedRows.first().addClass('first');
        $sortedRows.last().addClass('last');

        // attach the sorted rows (TRs) to the row container (TBODY)
        $sortedRows.appendTo($rowContainer);
    };
}

/******************************************************************************/

var $table = $('table.tracklist');

if ($table.length) {
    var $rows = $('tbody', $table).children('tr');

    // prepend a hidden track-number cell to each row so that the original sort order
    // can be reversed/restored by clicking the "Track" header (or its localized equivalent)
    // note: these cells already exist (and are visible) on album tracklists (below)
    $rows.prepend(function (index, html) {
        var position = index + 1; // index is 0-based
        return '<span class="positionCell" style="display: none">' + position + '</span>';
    });
} else {
    $table = $('table#albumTracklist');
}

if ($table.length) {
    var $tbody = $('tbody', $table);

    $.each(COLUMN_CONFIG, function(column, data) {
        var $header = $('thead td.' + data[0], $table);
        $header.css('cursor', 'pointer');
        $header.click(makeSortBy($tbody, column));
    });
}
