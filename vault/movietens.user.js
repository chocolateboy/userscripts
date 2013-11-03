// ==UserScript==
// @name           MovieTens
// @namespace      http://chocolatey.com/code/js
// @description    Rate MovieLens movies on a scale of 1/10 to 10/10 (with descriptions) rather than 0.5 to 5.0
// @author         chocolateboy <chocolate@cpan.org>
// @version        0.3 (2009-07-02)
// @include        http://movielens.umn.edu/*
// @include        http://www.movielens.org/*
// @include        http://movielens.org/*
// @grant          none
// ==/UserScript==

/*
 * 0.3 (2009-07-02) fix rating for 0.5 stars on movie detail pages
 * 0.2 (2008-12-18) add movielens.org
 * 0.1 (2006-05-29) initial version
*/

var $xpath = '//select[starts-with(@name, "rate")]';
var $selects = document.evaluate($xpath, document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);

var $map = {
    '5.0 stars': "10/10: As Good As It Gets",
    '4.5 stars': '9/10: Extremely Good',
    '4.0 stars': '8/10: Very Good',
    '3.5 stars': '7/10: Good',
    '3.0 stars': '6/10: Above Average',
    '2.5 stars': '5/10: Below Average',
    '2.0 stars': '4/10: Bad',
    '1.5 stars': '3/10: Very Bad',
    '1.0 stars': '2/10: Extremely Bad',
    '0.5 stars': '1/10: As Bad As It Gets'
};

for (var $i = 0; $i < $selects.snapshotLength; ++$i) {
    var $select = $selects.snapshotItem($i);
    var $options = $select.options;

    /*
     * some select boxes have 12 options ("Not seen", "Hide this", &c.) while others
     * have 11 (no "Hide this"). Rather than hardwiring the start offset, simply
     * modify the last 10 options
     */
    for (var $j = $options.length - 10; $j < $options.length; ++$j) {
        $options[$j].text = $map[$options[$j].text];
    }
}
