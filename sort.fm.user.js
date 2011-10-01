// ==UserScript==
// @name          sort.fm
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.0.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @description   Sort last.fm tracklists by track number, duration or listeners
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

function listeners(row) {
    return $(row).find('.reachCell').text().replace(/\D+/g, '') * 1;
}

function track(row) {
    return $(row).find('.positionCell').text().replace(/\D+/g, '') * 1;
}

function duration(row) {
    var time = $(row).find('.durationCell').text().match(/(\d+):(\d+)/);
    return time[1] * 60 + time[2] * 1;
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

// declare the variables used to manage sort order
// state private to the (enclosing scope of the)
// function that uses them
order = function() {
    var memo = {}, lastCell;

    return function (cell, orders) {
        if (!lastCell) { // initialise (first click)
            memo[cell] = orders[0];
        } else if (!memo[cell]) { // initialise (after the first click)
            memo[cell] = orders[1];
        } else if (cell === lastCell) { // toggle
            memo[cell] = memo[cell] * -1;
        } // else restore memo[cell]

        lastCell = cell;
        return memo[cell];
    };
}();

function sortBy(container, children, extractor, orders, transform) {
    return function() {
        var cell = $(this).text(); // unique identifier for the clicked header e.g. 'Track', 'Duration' &c.
        var $order = order(cell, orders);
        var sort = sorter(extractor, $order);
        var sorted = children.detach().sort(sort);

        if (transform) {
            transform(sorted);
        }

        sorted.appendTo(container);
    };
}

/*
 * key (string):
 *
 *     prefix of the CSS class name identifying the header cell to attach the click event to
 *     e.g. 'reach' -> $('thead td.reachCell')
 *
 * value (pair):
 *
 *     0: function to extract the number to sort by
 *     1: pair of sort orders (1: ascending, -1: descending)
 *
 * orders (pair):
 *
 *     0: initial sort order for this column if no header has been clicked
 *     1: initial sort order for this column after a header has been clicked
 */
const ASCENDING = 1, DESCENDING = -1;
const map = {
    'subject':  [ track,     [ DESCENDING, ASCENDING ] ],
    'duration': [ duration,  [ ASCENDING,  ASCENDING ] ],
    'reach':    [ listeners, [ DESCENDING, DESCENDING ] ]
};

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

    $.each(map, function(name, pair) {
        var cell = $('thead td.' + name + 'Cell', table);
        cell.css('cursor', 'pointer');
        cell.click(sortBy(tbody, rows, pair[0], pair[1], transform));
    });
}
