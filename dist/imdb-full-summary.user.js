// ==UserScript==
// @name          IMDb Full Summary
// @description   Automatically show the full plot summary on IMDb
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.2.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       /^https://www\.imdb\.com(/[^/]+)?/title/tt[0-9]+(/([#?].*)?)?$/
// @run-at        document-start
// @grant         none
// ==/UserScript==

// NOTE This file is generated from src/imdb-full-summary.user.ts and should not be edited directly.

"use strict";
(() => {
  // src/lib/util/constant.ts
  var constant = (value) => (..._args) => value;

  // src/lib/observer.ts
  var INIT = { childList: true, subtree: true };
  var done = constant(false);
  var resume = constant(true);
  var observe = ((...args) => {
    const [target, init, callback] = args.length === 3 ? args : args.length === 2 ? args[0] instanceof Element ? [args[0], INIT, args[1]] : [document.body, args[0], args[1]] : [document.body, INIT, args[0]];
    const onMutate = (mutations, observer2) => {
      observer2.disconnect();
      const resume2 = callback({ mutations, observer: observer2, target });
      if (resume2 !== false) {
        observer2.observe(target, init);
      }
    };
    const observer = new MutationObserver(onMutate);
    queueMicrotask(() => onMutate([], observer));
    return observer;
  });

  // src/imdb-full-summary.user.ts
  // @license       GPL
  var SUMMARY = '[data-testid="plot"] [data-testid^="plot-"]:not([data-expanded])';
  var $ = document;
  var run = () => {
    let $summary = "";
    try {
      const { textContent: metadata } = $.getElementById("__NEXT_DATA__");
      $summary = JSON.parse(metadata).props.pageProps.aboveTheFoldData.plot.plotText.plainText;
    } catch (e) {
      console.warn("Can't extract summary from JSON metadata:", e.message);
    }
    if (!$summary) {
      console.log("no summary found");
      return;
    }
    observe(document.body, () => {
      for (const summary of $.querySelectorAll(SUMMARY)) {
        summary.textContent = $summary;
        summary.dataset.expanded = "true";
      }
    });
  };
  $.addEventListener("readystatechange", run, { once: true });
})();
