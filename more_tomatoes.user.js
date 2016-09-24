// ==UserScript==
// @name        More Tomatoes
// @namespace   https://github.com/chocolateboy/userscripts
// @description Automatically show the full "Movie Info" plot synopsis on Rotten Tomatoes
// @author      chocolateboy
// @version     1.0.0
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     http://rottentomatoes.com/m/*
// @include     http://*.rottentomatoes.com/m/*
// @include     https://rottentomatoes.com/m/*
// @include     https://*.rottentomatoes.com/m/*
// @require     https://code.jquery.com/jquery-3.1.0.min.js
// @grant       GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

$('#movieSynopsis').removeClass('clamp clamp-6');
