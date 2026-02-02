// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       4.0.3
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.google.tld/search?*tbm=isch*
// @include       https://www.google.tld/search?*udm=2*
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// ==/UserScript==

// NOTE This file is generated from src/google-dwimages.user.ts and should not be edited directly.

"use strict";
(() => {
  // src/lib/util.ts
  var { assign } = Object;
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

  // src/lib/xhr.ts
  var hookXHRSend = (oldSend, onResponse2) => {
    return function send(body = null) {
      const oldOnReadyStateChange = this.onreadystatechange;
      this.onreadystatechange = function(event) {
        if (this.readyState === this.DONE && this.responseURL && this.status === 200) {
          onResponse2(this, this.responseURL);
        }
        if (oldOnReadyStateChange) {
          oldOnReadyStateChange.call(this, event);
        }
      };
      oldSend.call(this, body);
    };
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
  var IMAGE_DATA = /\[("[^"]+"),\d+,\d+\],[^,]+,[^,]+,"rgb\(\d+,\d+,\d+\)"/g;
  var LINK_TARGET = "_blank";
  var RESULT = `:scope > :is([data-lpage], [data-ri]):not([data-gd-status="${"done" /* DONE */}"])`;
  var RESULTS = ":has(> :is([data-lpage], [data-ri]))";
  var RESULTS_ENDPOINT = "/search";
  var SEEN = /* @__PURE__ */ new Map();
  var DATA_ID = 0;
  var RESULT_ID = 0;
  var stopPropagation = (e) => {
    e.stopPropagation();
  };
  var extractImageUrls = (text) => {
    const imageUrls = text.matchAll(IMAGE_DATA).flatMap((match, i) => {
      if (i % 2) {
        return [];
      }
      const $url = JSON.parse(match[1]);
      const url = JSON.parse(`"${$url}"`);
      return [url];
    });
    for (const url of imageUrls) {
      SEEN.set(++DATA_ID, url);
    }
  };
  var onResponse = (xhr, uri) => {
    if (URL.parse(uri)?.pathname === RESULTS_ENDPOINT) {
      extractImageUrls(xhr.responseText.replaceAll('\\"', '"'));
    }
  };
  var onResult = (result) => {
    const data = result.dataset;
    data.gdStatus ||= "pending" /* PENDING */;
    const id = Number(data.gdId ||= String(++RESULT_ID));
    const imageLink = result.querySelector(":scope a");
    if (!imageLink) {
      console.warn("can't find image link in result:", result);
      return;
    }
    const image = imageLink.querySelector(":scope img");
    if (!image) {
      console.warn("can't find image in result link:", { result, link: imageLink });
      return;
    }
    const href = SEEN.get(id);
    if (!href) {
      console.debug(`can't find URL for result ${id}`);
      return;
    }
    for (const event of EVENTS) {
      result.addEventListener(event, stopPropagation);
    }
    assign(imageLink, {
      href,
      title: image.alt,
      target: LINK_TARGET
      // make it consistent with the page link
    });
    SEEN.delete(id);
    data.gdStatus = "done" /* DONE */;
  };
  var run = () => {
    const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype;
    const send = hookXHRSend(xhrProto.send, onResponse);
    xhrProto.send = GMCompat.export(send);
    const results = document.querySelector(RESULTS);
    if (!results) {
      console.warn("can't find results container");
      return;
    }
    const script = [...document.scripts].findLast((it) => !it.src && IMAGE_DATA.test(it.textContent));
    if (!script) {
      console.warn("can't find initial data");
      return;
    }
    extractImageUrls(script.textContent);
    observe(results, { childList: true }, () => {
      results.querySelectorAll(RESULT).forEach(onResult);
    });
  };
  run();
})();
