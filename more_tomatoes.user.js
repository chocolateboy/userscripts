// ==UserScript==
// @name        More Tomatoes
// @namespace   https://github.com/chocolateboy/userscripts
// @description Automatically show the full "Movie Info" plot synopsis on Rotten Tomatoes
// @author      chocolateboy
// @version     0.1.0
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     http://rottentomatoes.com/m/*
// @include     http://*.rottentomatoes.com/m/*
// @include     https://rottentomatoes.com/m/*
// @include     https://*.rottentomatoes.com/m/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.js
// ==/UserScript==

/*
 * jQuery 1.7.1
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.js
 */

$('#showMoreSynopsis').get(0).click();
