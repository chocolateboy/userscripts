// ==UserScript==
// @name        More Tomatoes
// @namespace   https://github.com/chocolateboy/userscripts
// @description Automatically show the full "Movie Info" plot synopsis on Rotten Tomatoes
// @author      chocolateboy
// @version     0.3.1
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     http://rottentomatoes.com/m/*
// @include     http://*.rottentomatoes.com/m/*
// @include     https://rottentomatoes.com/m/*
// @include     https://*.rottentomatoes.com/m/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
// @grant       GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

function expand_synopsis() {
    $('#showMoreSynopsis').get(0).click();
}

// execute as late as possible - needed for the latest version of the site
$(window).on('load', expand_synopsis);
