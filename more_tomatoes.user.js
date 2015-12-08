// ==UserScript==
// @name        More Tomatoes
// @namespace   https://github.com/chocolateboy/userscripts
// @description Automatically show the full "Movie Info" plot synopsis on Rotten Tomatoes
// @author      chocolateboy
// @version     0.6.0
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     http://rottentomatoes.com/m/*
// @include     http://*.rottentomatoes.com/m/*
// @include     https://rottentomatoes.com/m/*
// @include     https://*.rottentomatoes.com/m/*
// @grant       none
// ==/UserScript==

document.getElementById('movieSynopsis').removeAttribute('id');
