// ==UserScript==
// @name        More Tomatoes
// @namespace   https://github.com/chocolateboy/userscripts
// @description Automatically show the full "Movie Info" plot synopsis on Rotten Tomatoes
// @author      chocolateboy
// @version     0.0.1
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     http://rottentomatoes.com/m/*
// @include     http://*.rottentomatoes.com/m/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/1.6.4/jquery.js
// ==/UserScript==

/*
 * jQuery 1.6.4
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/1.6.4/jquery.js
 */

$('#showMoreSynopsis').get(0).click();
