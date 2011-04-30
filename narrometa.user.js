// ==UserScript==
// @name           NarrOMeta
// @namespace      http://chocolatey.com/code/js
// @description    Fit the OMeta workspace in a 1024-pixel-wide page
// @author         chocolateboy <chocolate@cpan.org>
// @include        http://www.tinlizzie.org/ometa-js/*
// @include        http:/tinlizzie.org/ometa-js/*
// @version        0.01 (2009-01-22)
// ==/UserScript==

const $xpath = '//textarea[@cols="132"]';
var $textareas = document.evaluate($xpath, document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);

for (var $i = 0; $i < $textareas.snapshotLength; ++$i) {
    $textareas.snapshotItem($i).setAttribute('cols', '120');
}
