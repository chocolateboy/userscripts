// ==UserScript==
// @name          Pagerize Amazon
// @description   Mark up Amazon search results with pager metadata
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.0.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.amazon.tld/*
// @include       https://*.amazon.tld/*
// @require       https://code.jquery.com/jquery-3.1.1.min.js
// @require       https://cdn.rawgit.com/chocolateboy/userscripts/master/jquery/pagerizer.min.js
// @require       https://cdn.rawgit.com/eclecto/jQuery-onMutate/v1.4.2/src/jquery.onmutate.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

// union the selectors to work around a jQuery-onMutate bug:
// https://github.com/eclecto/jQuery-onMutate/issues/18

function onLinks ($links) {
    $links.filter('a#pagnPrevLink').addRel('prev');
    $links.filter('a#pagnNextLink').addRel('next');
}

$.onCreate('a#pagnPrevLink, a#pagnNextLink', onLinks, true /* multi */);
