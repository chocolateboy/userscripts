// ==UserScript==
// @name          IMDb Full Summary
// @description   Automatically show the full plot summary on IMDb
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.0.2
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
    let summary = "";
    try {
      const { textContent: metadata } = $.getElementById("__NEXT_DATA__");
      summary = JSON.parse(metadata).props.pageProps.aboveTheFoldData.plot.plotText.plainText;
    } catch (e) {
      console.warn("Can't extract summary from JSON metadata:", e);
    }
    if (!summary) {
      return;
    }
    for (const target of $.querySelectorAll('[data-testid="plot"] [data-testid^="plot-"]')) {
      const callback = () => {
        observer.disconnect();
        target.textContent = summary;
        observer.observe(target, init);
      };
      const observer = new MutationObserver(callback);
      callback();
    }
  };
  $.addEventListener("readystatechange", run, { once: true });
})();
