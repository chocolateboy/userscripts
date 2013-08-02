// ==UserScript==
// @name          Wikipedia SmartQuotes
// @description   Convert typewriter quotation marks into "smart" quotes on Wikipedia
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       1.0.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.wikipedia.org/*
// @include       https://*.wikipedia.org/*
// @exclude       *Quotation_mark*
// @exclude       *diff=*
// @exclude       *action=edit*
// @grant         none
// ==/UserScript==
//
// --------------------------------------------------------------------
//
// This script is loosely based on DumbQuotes by Mark Pilgrim:
// http://diveintogreasemonkey.org/casestudy/dumbquotes.html

var currentQM = "\u201d";

var toggleQM = {
    "\u201c" : "\u201d",
    "\u201d" : "\u201c"
};

var replacements = [
    [ /\.\.\./g, "\u2026" ] // Horizontal ellipsis
];

var textnodes = document.evaluate(
    "//body//text()[not(ancestor::pre or ancestor::code)]",
    document,
    null,
    XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
    null
);

for (var i = 0; i < textnodes.snapshotLength; ++i) {
    var node = textnodes.snapshotItem(i);
    var s = node.data;

    for (var j = 0; j < replacements.length; ++j) {
        var key = replacements[j][0];
        var val = replacements[j][1];
        s = s.replace(key, val);
    }

    while (s.indexOf('"') != -1) {
        currentQM = toggleQM[currentQM];
        s = s.replace('"', currentQM);
    }

    node.data = s;
}
