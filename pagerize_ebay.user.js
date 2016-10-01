// ==UserScript==
// @name          Pagerize eBay
// @description   Mark up eBay search results with pager metadata
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.1.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.ebay.tld/*
// @include       https://*.ebay.tld/*
// @require       https://code.jquery.com/jquery-3.1.1.min.js
// @require       https://cdn.rawgit.com/chocolateboy/userscripts/master/jquery/pagerizer.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

$('a.gspr.prev').addRel('prev');
$('a.gspr.next').addRel('next');
