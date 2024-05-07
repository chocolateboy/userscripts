// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.0.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.google.tld/search?*tbm=isch*
// @include       https://www.google.tld/search?*udm=2*
// @grant         none
// ==/UserScript==

// NOTE This file is generated from src/google-dwimages.user.ts and should not be edited directly.

"use strict";
(() => {
  // src/google-dwimages.user.ts
  // @license       GPL
  var DUMMY_MUTATIONS = [];
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
    image.parentElement.replaceChild(image, image);
    result.dataset.status = "fixed" /* FIXED */;
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
    const init = { attributeFilter: ["href"] };
    const callback = (_mutations, observer) => {
      observer.disconnect();
      if (imageLink.href) {
        return onImageLink(imageLink, result);
      }
      observer.observe(imageLink, init);
    };
    callback(DUMMY_MUTATIONS, new MutationObserver(callback));
  };
  var run = () => {
    const init = { childList: true };
    const results = document.querySelector(RESULTS);
    if (!results) {
      console.warn("Can't find result container");
      return;
    }
    const callback = (_mutations, observer) => {
      observer.disconnect();
      for (const result of results.querySelectorAll(RESULT)) {
        onResult(result);
      }
      observer.observe(results, init);
    };
    callback(DUMMY_MUTATIONS, new MutationObserver(callback));
  };
  run();
})();
