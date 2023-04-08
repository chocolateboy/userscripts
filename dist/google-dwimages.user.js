// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.10.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.google.tld/*tbm=isch*
// @include       https://encrypted.google.tld/*tbm=isch*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.4/dist/cash.min.js
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @require       https://unpkg.com/@chocolateboy/uncommonjs@3.2.1/dist/polyfill.iife.min.js
// @require       https://unpkg.com/get-wild@3.0.2/dist/index.umd.min.js
// @grant         GM.registerMenuCommand
// @grant         GM.setClipboard
// @run-at        document-start
// ==/UserScript==

// NOTE This file is generated from src/google-dwimages.user.ts and should not be edited directly.

"use strict";
(() => {
  // src/google-dwimages.user.ts
  // @license       GPL
  var CACHE = /* @__PURE__ */ new Map();
  var EVENTS = "auxclick click contextmenu focus focusin keydown mousedown touchstart";
  var IMAGE_METADATA = 1;
  var IMAGE_METADATA_ENDPOINT = /\/batchexecute\?rpcids=/;
  var INITIAL_DATA;
  var NODE_TYPE = 0;
  var RESULT_INDEX = 4;
  var UNPROCESSED_RESULTS = "div[data-ri][data-ved][jsaction]";
  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }
  function hookXhrOpen(oldOpen, $container) {
    return function open(method, url) {
      if (isImageDataRequest(method, url)) {
        this.addEventListener("load", () => {
          onLoad(this, $container);
        });
      }
      GMCompat.apply(this, oldOpen, arguments);
    };
  }
  function isImageDataRequest(method, url) {
    return method.toUpperCase() === "POST" && IMAGE_METADATA_ENDPOINT.test(url);
  }
  function mergeImageMetadata(root) {
    const nodes = root[56] ? exports.get(clone(root[56]), "[1][0][-1][1][0].**[0][0][0]") : exports.get(clone(root[31]), "[-1][12][2]");
    for (const node of nodes) {
      const type = node[NODE_TYPE];
      if (type !== IMAGE_METADATA) {
        continue;
      }
      const index = node[RESULT_INDEX];
      const imageUrl = node[1][3][0];
      CACHE.set(index, imageUrl);
    }
  }
  function onLoad(xhr, $container) {
    let parsed;
    try {
      const cooked = xhr.responseText.match(/"\[[\s\S]+\](?:\\n)?"/)[0];
      const raw = JSON.parse(cooked);
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("Can't parse response:", e);
      return;
    }
    try {
      mergeImageMetadata(parsed);
      $container.find(UNPROCESSED_RESULTS).each(onResult);
    } catch (e) {
      console.error("Can't merge new metadata:", e);
    }
  }
  function stopPropagation(e) {
    e.stopPropagation();
  }
  function init() {
    const container = document.querySelector(UNPROCESSED_RESULTS)?.parentElement;
    if (!container) {
      throw new Error("Can't find results container");
    }
    const $container = $(container);
    mergeImageMetadata(INITIAL_DATA = GMCompat.unsafeWindow.AF_initDataChunkQueue[1].data);
    const callback = (_mutations, observer2) => {
      const $results = $container.find(UNPROCESSED_RESULTS);
      for (const result of $results) {
        const index = $(result).data("ri");
        if (CACHE.has(index)) {
          onResult.call(result);
        } else {
          observer2.disconnect();
          break;
        }
      }
    };
    const $initial = $container.find(UNPROCESSED_RESULTS);
    const observer = new MutationObserver(callback);
    const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype;
    $initial.each(onResult);
    observer.observe(container, { childList: true });
    xhrProto.open = GMCompat.export(hookXhrOpen(xhrProto.open, $container));
  }
  function onResult() {
    const $result = $(this);
    const index = $result.data("ri");
    const imageUrl = CACHE.get(index);
    if (!imageUrl) {
      console.error(`Can't find image URL for result (${index})`);
      return;
    }
    $result.find("[jsaction]").add($result).each(function() {
      $(this).removeAttr("jsaction").on(EVENTS, stopPropagation);
    });
    $result.find("a").eq(0).attr("href", imageUrl);
    CACHE.delete(index);
  }
  function run() {
    try {
      init();
    } catch (e) {
      console.error("Initialisation error:", e);
    }
  }
  GM.registerMenuCommand("Copy image metadata to the clipboard", () => {
    GM.setClipboard(JSON.stringify(INITIAL_DATA));
  });
  document.addEventListener("readystatechange", run, { once: true });
})();
