// ==UserScript==
// @name          Read Reddit, Yellow Reddit
// @description   Highlight new stories on the Reddit front page
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.0.4
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.reddit.com/
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.0.2/jquery.js
// @grant         GM_getValue
// @grant         GM_setValue
// ==/UserScript==

/*
 * @requires:
 *
 * jQuery 2.0.2
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/2.0.2/jquery.js
 */

const HIGHLIGHT_COLOR = '#FFFF00';
const KEY = 'article_ids';

var old_array = [], new_array = [];
var old_string = GM_getValue(KEY, '');

if (old_string.indexOf(',') != -1) {
    old_array = old_string.split(',');
}

$('div.thing[data-fullname]').each(function() {
    var id = $(this).attr('data-fullname');

    if ($.inArray(id, old_array) == -1) {
        $('a.title', this).css('background-color', HIGHLIGHT_COLOR);
    }

    new_array.push(id);
});

var new_string = new_array.join(',');
GM_setValue(KEY, new_string);
