// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.0.3
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.google.tld/search?*tbm=isch*
// @include       https://www.google.tld/search?*udm=2*
// @grant         none
// ==/UserScript==

// NOTE This file is generated from src/google-dwimages.user.ts and should not be edited directly.

"use strict";
(() => {
  // src/lib/util.ts
  var constant = (value) => (..._args) => value;

  // src/lib/observer.ts
  var INIT = { childList: true, subtree: true };
  var done = constant(false);
  var resume = constant(true);
  var observe = (...args) => {
    const $ = document;
    const [target, init, callback] = args.length === 3 ? args : args.length === 2 ? args[0] instanceof Element ? [args[0], INIT, args[1]] : [$.body, args[0], args[1]] : [$.body, INIT, args[0]];
    const $callback = (mutations, observer2) => {
      observer2.disconnect();
      const resume2 = callback({ mutations, observer: observer2, target, init });
      if (resume2 !== false) {
        observer2.observe(target, init);
      }
    };
    const observer = new MutationObserver($callback);
    queueMicrotask(() => $callback([], observer));
    return observer;
  };

  // src/google-dwimages.user.ts
  // @license       GPL
  var EVENTS = [
    "auxclick",
    "click",
    "contextmenu",
    "focus",
    "focusin",
    "keydown",
    "mousedown",
    "touchstart"
  ];
  var LINK_TARGET = "_blank";
  var RESULT = ":scope > :is([data-lpage], [data-ri]):not([data-status])";
  var RESULTS = ":has(> :is([data-lpage], [data-ri]))";
  var stopPropagation = (e) => {
    e.stopPropagation();
  };
  var onImageLink = (link, result) => {
    const { searchParams: params } = new URL(link.href);
    const src = params.get("imgurl");
    if (!src) {
      console.warn("Can't find image URL in result link:", { result, link, params });
      return;
    }
    const image = link.querySelector(":scope img");
    if (!image) {
      console.warn("Can't find image in result link:", { result, link });
      return;
    }
    link.href = src;
    link.title = image.alt;
    link.target = LINK_TARGET;
    result.dataset.status = "fixed" /* FIXED */;
    image.parentElement.replaceChild(image, image);
  };
  var onResult = (result) => {
    result.dataset.status = "pending" /* PENDING */;
    for (const event of EVENTS) {
      result.addEventListener(event, stopPropagation);
    }
    const imageLink = result.querySelector(":scope a");
    if (!imageLink) {
      console.warn("Can't find image link in result:", result);
      return;
    }
    observe(imageLink, { attributeFilter: ["href"] }, () => {
      return imageLink.href && done(onImageLink(imageLink, result));
    });
  };
  var run = () => {
    const results = document.querySelector(RESULTS);
    if (!results) {
      console.warn("Can't find result container");
      return;
    }
    observe(results, { childList: true }, () => {
      results.querySelectorAll(RESULT).forEach(onResult);
    });
  };
  run();
})();
