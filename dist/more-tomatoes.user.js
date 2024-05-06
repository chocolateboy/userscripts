// ==UserScript==
// @name          More Tomatoes
// @description   Automatically show the full "Movie Info" plot synopsis on Rotten Tomatoes
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.0.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       http://rottentomatoes.com/m/*
// @include       http://*.rottentomatoes.com/m/*
// @include       https://rottentomatoes.com/m/*
// @include       https://*.rottentomatoes.com/m/*
// @run-at        document-start
// @grant         none
// ==/UserScript==

// NOTE This file is generated from src/more-tomatoes.user.ts and should not be edited directly.

"use strict";
(() => {
  // src/more-tomatoes.user.ts
  // @license       GPL
  var run = () => {
    const synopsis = document.querySelector('[data-qa="section:media-scorecard"]');
    if (!synopsis) {
      return;
    }
    const readLess = synopsis.querySelector('[slot="ctaClose"]');
    if (readLess) {
      readLess.style.display = "none";
    }
    const readMore = synopsis.querySelector('[slot="ctaOpen"]');
    if (readMore) {
      readMore.click();
    }
  };
  window.addEventListener("load", run);
})();
