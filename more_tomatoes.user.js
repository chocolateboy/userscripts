// ==UserScript==
// @name        More Tomatoes
// @namespace   https://github.com/chocolateboy/userscripts
// @description Automatically show the full "Movie Info" plot synopsis on Rotten Tomatoes
// @author      chocolateboy
// @version     0.2.0
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     http://rottentomatoes.com/m/*
// @include     http://*.rottentomatoes.com/m/*
// @include     https://rottentomatoes.com/m/*
// @include     https://*.rottentomatoes.com/m/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.js
// @grant       none
// ==/UserScript==

/*
 * jQuery 1.8.3
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.js
 */

function expand_synopsis() {
    $('#showMoreSynopsis').get(0).click();
}

// run this script as late as possible to handle dynamically loaded content e.g. cracked.com
window.addEventListener('load', expand_synopsis, false);
