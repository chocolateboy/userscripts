// ==UserScript==
// @name        More Tomatoes
// @description Automatically show the full "Movie Info" plot synopsis on Rotten Tomatoes
// @author      chocolateboy
// @copyright   chocolateboy
// @version     1.2.0
// @namespace   https://github.com/chocolateboy/userscripts
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     http://rottentomatoes.com/m/*
// @include     http://*.rottentomatoes.com/m/*
// @include     https://rottentomatoes.com/m/*
// @include     https://*.rottentomatoes.com/m/*
// @require     https://code.jquery.com/jquery-3.4.1.min.js
// @grant       GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

// Test:
//
//   - https://www.rottentomatoes.com/m/hobo_with_a_shotgun

// expand the synopsis and hide the trailing "Show More" link
$('#movieSynopsis')
    .removeClass('clamp clamp-6')
    .next('.clamp-toggle__container').hide()
