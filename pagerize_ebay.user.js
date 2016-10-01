// ==UserScript==
// @name          Pagerize eBay
// @description   Mark up eBay search results with pager metadata
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.0.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.ebay.tld/*
// @include       https://*.ebay.tld/*
// @require       https://code.jquery.com/jquery-3.1.1.min.js
// @require       https://raw.github.com/chocolateboy/userscripts/master/jquery/pagerizer.js
// @grant         none
// ==/UserScript==

$('a.gspr.prev').addRel('prev');
$('a.gspr.next').addRel('next');
