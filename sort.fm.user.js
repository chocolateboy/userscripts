// ==UserScript==
// @name          sort.fm
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       2.0.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @description   Sort last.fm tracklists by track number, track name, duration or number of listeners
// @include       http://www.last.fm/music/*
// @include       http://cn.last.fm/music/*
// @include       http://www.lastfm.tld/music/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

var INITIAL_SORTED_COLUMN = 'position';
var ASCENDING = 1, DESCENDING = -1;
var LEXICOGRAPHICAL = 1, NUMERIC = 2;

/*
 * key (string):
 *
 *     internal identifier for each column e.g. 'track', 'duration'
 *
 * value:
 *
 *     0: CSS class name identifying the table header cell to attach the click event to and table body cell to sort by
 *     1: extractor function that takes a row and returns a sortable value from its designated field
 *     2: initial sort order i.e. the sort order we should use the first time we sort the column
 *     3: sort type: how the value extracted from a particular column is sorted: lexicographical for strings (e.g. track name),
 *        numeric for numbers (e.g. listeners)
 */
var COLUMN_CONFIG = {
    'position':  [ 'positionCell', extractPosition,  ASCENDING,  NUMERIC         ],
    'track':     [ 'subjectCell',  extractTrack,     ASCENDING,  LEXICOGRAPHICAL ],
    'duration':  [ 'durationCell', extractDuration,  ASCENDING,  NUMERIC         ],
    'listeners': [ 'reachCell',    extractListeners, DESCENDING, NUMERIC         ]
};

// --------------------------- extractors ------------------------------

// extract the track position from a row
function extractPosition(row, selector) {
    return $.trim($(row).find(selector).text()) * 1;
}

// extract the track name from a row
function extractTrack(row, selector) {
    return $.trim($(row).find(selector).text());
}

// extract the track length from a row
function extractDuration(row, selector) {
    var duration = $(row).find(selector).text().match(/(\d+):(\d+)/);
    return duration[1] * 60 + duration[2] * 1;
}

// extract the number of listeners from a row
function extractListeners(row, selector) {
    return $(row).find(selector).text().replace(/\D+/g, '') * 1;
}

// ------------------------------ helpers -------------------------------

// take a column spec and an order (ascending or descending) and return a
// function which takes two rows (a and b), extracts the values from the
// specified column, and returns an integer which represents the ordering
// of the rows: -1 if a should precede b, 0 if they're equal, and 1 if a
// should follow b.
function makeCompare(config, order) {
    var extract = config[1];
    var selector = '.' + config[0];
    var sortType = config[3];

    if (sortType == LEXICOGRAPHICAL) {
        return function(a, b) {
            var cmp;
            var aValue = extract(a, selector);
            var bValue = extract(b, selector);

            if (aValue == bValue) {
                cmp = 0;
            } else {
                cmp = aValue < bValue ? -1 : 1;
            }

            return cmp * order;
        };
    } else { // numeric
        return function(a, b) {
            return (extract(a, selector) - extract(b, selector)) * order;
        };
    }
}

/*
 * Initialize, toggle or restore the sort order for the supplied column.
 *
 * Note: the column by which the table is initially sorted (i.e. position) is
 * special-cased as it has effectively been "pre-clicked" to ascending order by last.fm.
 */
sortOrder = function() { // create a scope for variables that are persistent but local to this function
    var lastSelectedColumn = INITIAL_SORTED_COLUMN;
    var cache = {};

    cache[lastSelectedColumn] = COLUMN_CONFIG[lastSelectedColumn][2];

    return function (column) {
        if (!cache[column]) { // initialize
            cache[column] = COLUMN_CONFIG[column][2]; // initial sort order
        } else if (column === lastSelectedColumn) { // toggle
            cache[column] = cache[column] * -1;
        } // else restore

        lastSelectedColumn = column;
        return cache[column];
    };
}();

// return a function that sorts rows in the supplied container by the specified column
function makeSortBy($rowContainer, column, config) {
    return function() {
        var $rows = $rowContainer.children('tr');

        // ascending (1) or descending (-1)
        var order = sortOrder(column);

        // compare(a, b) function (where a and b are rows) which honours
        // the specified order (ascending or descending)
        var compare = makeCompare(config, order);

        var $sortedRows = $rows.detach().sort(compare);

        // fix up the CSS
        $sortedRows.removeClass('first last odd');
        // XXX jQuery's :odd and :even selectors are 0-based, so -- confusingly --
        // to select the odd rows, we need to use the :even selector i.e.
        // index 0: first row (odd), index 1: second row (even) &c.
        $sortedRows.filter(':even').addClass('odd');
        $sortedRows.first().addClass('first');
        $sortedRows.last().addClass('last');

        // re-attach the sorted rows (TRs) to the row container (TBODY)
        $sortedRows.appendTo($rowContainer);
    };
}

/******************************************************************************/

var $table = $('table.chart, table.tracklist').has('thead');

if ($table.length) {
    // add/populate position cells so we can reverse/restore the original sort order
    if ($table.is('.tracklist')) {
        $('thead tr', $table).prepend('<td class="positionCell">#</td>');
        $('tbody tr', $table).prepend(function (index, oldHtml) {
            return '<td class="positionCell">' + (index + 1) + '</td>'
        });
    } else { // .chart: position cells already exist but may be empty
        // the header cell is always empty (&nbsp;)
        $('thead td.positionCell', $table).text('#');

        // the body cells are already correctly populated for album tracklists
        if (!$table.is('#albumTracklist')) {
            $('tbody td.positionCell', $table).text(function (index, oldText) {
                return index + 1;
            });
        }
    }

    var $tbody = $('tbody', $table);

    $.each(COLUMN_CONFIG, function(column, config) {
        var $header = $('thead td.' + config[0], $table);

        if ($header.length) {
            $header.css('cursor', 'pointer');
            $header.click(makeSortBy($tbody, column, config));
        }
    });
}
