// ==UserScript==
// @name          sort.fm
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.1.3
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @description   Sort last.fm tracklists by track number, duration or number of listeners
// @include       http://*.last.fm/music/*
// @include       http://last.fm/music/*
// @include       http://*.lastfm.*/music/*
// @include       http://lastfm.*/music/*
// @include       http://*.lastfm.com.*/music/*
// @include       http://lastfm.com.*/music/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.js
// ==/UserScript==

/*
 * @requires:
 *
 * jQuery 1.6.2
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.js
 */

const INITIAL_SORTED_COLUMN = 'track';
const ASCENDING = 1, DESCENDING = -1;

/*
 * key (string):
 *
 *     unique identifier for each column e.g. 'track', 'duration'
 *
 * value (triple):
 *
 *     0: CSS class name identifying the table header cell to attach the click event to
 *     1: function to extract the number to sort by
 *     2: initial sort order
 */
const MODEL = {
    'track':     [ 'subjectCell',  track,     ASCENDING  ],
    'duration':  [ 'durationCell', duration,  ASCENDING  ],
    'listeners': [ 'reachCell',    listeners, DESCENDING ]
};

function compare(a, b, order) {
    order || (order = 1);
    var ret;

    if (a < b) {
        ret = -1;
    } else if (a > b) {
        ret = 1;
    } else {
        ret = 0;
    }

    return ret * order;
}

function track(row) {
    return $(row).find('.positionCell').text().replace(/\D+/g, '') * 1;
}

function duration(row) {
    var time = $(row).find('.durationCell').text().match(/(\d+):(\d+)/);
    return time[1] * 60 + time[2] * 1;
}

function listeners(row) {
    return $(row).find('.reachCell').text().replace(/\D+/g, '') * 1;
}

function sorter(extractor, order) {
    return function(a, b) {
        return compare(extractor(a), extractor(b), order);
    };
}

function stripe (i, row) {
    $(row).removeClass('first last odd');
    if ((i + 1) % 2) { // 0-based
        $(row).addClass('odd');
    }
}

/*
 * this wrapper ensures that variables used to manage
 * sort-order state are private to the
 * (enclosing scope of the) function that uses them
 */
order = function() {
    /*
     * This function assigns a) a sensible initial sort order (i.e ascending or descending)
     * for each column the first time it's clicked, and b) remembers/restores the last
     * sort order selected for each column (for as long as the page is loaded).
     *
     * Note: the column by which the table is initially sorted (i.e. track) is
     * special-cased as it has effectively been "pre-clicked" to ascending order by last.fm.
     */
    var lastColumn = INITIAL_SORTED_COLUMN, memo = {};
    memo[lastColumn] = MODEL[lastColumn][2];

    return function (column, initialSortOrder) {
        if (!memo[column]) { // initialise
            memo[column] = initialSortOrder;
        } else if (column === lastColumn) { // toggle
            memo[column] = memo[column] * -1;
        } // else restore

        lastColumn = column;
        return memo[column];
    };
}();

function sortBy(container, children, column, extractor, initialSortOrder, transform) {
    return function() {
        var $order = order(column, initialSortOrder);
        var sort = sorter(extractor, $order);
        var sorted = children.detach().sort(sort);

        if (transform) {
            transform(sorted);
        }

        sorted.appendTo(container);
    };
}

/******************************************************************************/

var table = $('table.tracklist');

if (table.length) {
    var rows = $('tbody', table).children('tr');
    rows.prepend(function (index, html) {
        var position = index + 1;
        return '<span class="positionCell" style="display: none">' + position + '</span>';
    });
} else {
    table = $('table#albumTracklist');
}

if (table.length) {
    var tbody = $('tbody', table);
    var rows = tbody.children('tr');
    var transform = function(rows) {
        rows.each(stripe);
        rows.first().addClass('first');
        rows.last().addClass('last');
    };

    $.each(MODEL, function(column, triple) {
        var cell = $('thead td.' + triple[0], table);
        cell.css('cursor', 'pointer');
        // sortBy: container, children, column, extractor, initialSortOrder, transform
        cell.click(sortBy(tbody, rows, column, triple[1], triple[2], transform));
    });
}
