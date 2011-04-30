// ==UserScript==
// @name        WhedoneSQL
// @namespace   http://www.chocolatey.com/code/js
// @description Links the banner quote on Whedonesque to the Buffyverse Dialogue Database or the next best source
// @author      chocolateboy <chocolate@cpan.org>
// @version     0.3 (2008-08-28)
// @include     http://whedonesque.com/*
// ==/UserScript==

/*
    ChangeLog

    2008-08-28 - 0.3 - added en.wikiquote.org
    2006-01-04 - 0.2 - added "\u2019" to replacements to catch "smart" apostrophes
    2006-01-03 - 0.1

*/

const $xpath = '//div[@class="topquote"]';

const $replacements = {
    "\u2019"   : "'",
    "\u2026"   : "...",
    "^\\s*"    : "",
    "\\s*$"    : "",
    "\\*"      : ""
};

var $div = document.evaluate($xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

if ($div) {
    var $quote = $div.textContent;
    for (var $key in $replacements) {
        $quote = $quote.replace(new RegExp($key, 'g'), $replacements[$key]);
    }

    $div.innerHTML = '<a href="http://www.google.com/search?hl=en&q='
        + escape($quote)
        + '+site%3Avrya.net+%7C+site%3Abuffyguide.com+%7C+site%3Aen.wikiquote.org'
	+ '+%7C+%22firefly+%7C+serenity+quotes+%7C+quotations%22+'
        + '-site%3Awhedonesque.com+-%22fireflyfan+%7C+fireflyfans%22'
        + '&btnI=I%27m+Feeling+Lucky&meta=">'
        + $quote
        + '</a>';
}
