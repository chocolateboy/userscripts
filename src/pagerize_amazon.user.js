// ==UserScript==
// @name          Pagerize Amazon
// @description   Mark up Amazon search results with pager metadata
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.1.2
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       http://*.amazon.tld/*
// @include       https://*.amazon.tld/*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/jquery-pagerizer@v1.0.0/dist/pagerizer.min.js
// @require       https://cdn.jsdelivr.net/gh/eclecto/jQuery-onMutate@79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
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
