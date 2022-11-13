// ==UserScript==
// @name          IMDb Full Summary
// @description   Automatically show the full plot summary on IMDb
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.0.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.imdb.com/title/tt*
// @run-at        document-start
// @grant         none
// ==/UserScript==

// NOTE This file is generated from src/imdb-full-summary.user.ts and should not be edited directly.

"use strict";
(() => {
  // src/imdb-full-summary.user.ts
  // @license       GPL
  var $ = document;
  var init = { childList: true };
  var run = () => {
    const summary = $.querySelector('meta[name="description"][content]:not([content=""])');
    if (!summary) {
      return;
    }
    for (const target of $.querySelectorAll('[data-testid="plot"] [data-testid^="plot-"]')) {
      const callback = () => {
        observer.disconnect();
        target.textContent = summary.content;
        observer.observe(target, init);
      };
      const observer = new MutationObserver(callback);
      callback();
    }
  };
  $.addEventListener("readystatechange", run, { once: true });
})();
