// ==UserScript==
// @name           NarrOMeta
// @namespace      http://chocolatey.com/code/js
// @description    Fit the OMeta workspace in a 1024-pixel-wide page
// @author         chocolateboy <chocolate@cpan.org>
// @include        http://www.tinlizzie.org/ometa-js/*
// @include        http:/tinlizzie.org/ometa-js/*
// @version        0.2.0
// @grant          none
// ==/UserScript==

var $xpath = '//textarea[@cols="132"]';
var $textareas = document.evaluate($xpath, document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);

for (var $i = 0; $i < $textareas.snapshotLength; ++$i) {
    $textareas.snapshotItem($i).setAttribute('cols', '120');
}
