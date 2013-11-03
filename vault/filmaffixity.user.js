// ==UserScript==
// @name           FilmAffixity
// @namespace      http://chocolatey.com/code/js
// @description    Sane names for FilmAffinity rankings
// @author         chocolateboy <chocolate@cpan.org>
// @include        http://www.filmaffinity.com/*
// @version        0.1 (2006-11-26)
// @grant          none
// ==/UserScript==

var xpath = '//select[starts-with(@id, "rate")]';
var selects = document.evaluate(xpath, document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);

var map = {
    '10': "10/10: As Good As It Gets",
    '9': '9/10: Extremely Good',
    '8': '8/10: Very Good',
    '7': '7/10: Good',
    '6': '6/10: Above Average',
    '5': '5/10: Below Average',
    '4': '4/10: Bad',
    '3': '3/10: Very Bad',
    '2': '2/10: Extremely Bad',
    '1': '1/10: As Bad As It Gets'
};

for (var i = 0; i < selects.snapshotLength; ++i) {
    var $select = selects.snapshotItem(i);
    var options = $select.options;

    for (var j = 1; j < options.length; ++j) {
        options[j].text = map[options[j].value];
    }
}
