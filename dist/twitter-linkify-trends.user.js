// ==UserScript==
// @name          Twitter Linkify Trends
// @description   Make Twitter trends links (again)
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.1.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://mobile.x.com/
// @include       https://mobile.x.com/*
// @include       https://x.com/
// @include       https://x.com/*
// @require       https://code.jquery.com/jquery-3.7.1.slim.min.js
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @require       https://unpkg.com/@chocolateboy/uncommonjs@3.2.1/dist/polyfill.iife.min.js
// @require       https://unpkg.com/get-wild@3.0.2/dist/index.umd.min.js
// @require       https://unpkg.com/flru@1.0.2/dist/flru.min.js
// @grant         GM_log
// @run-at        document-start
// ==/UserScript==

// NOTE This file is generated from src/twitter-linkify-trends.user.ts and should not be edited directly.

"use strict";
(() => {
  // src/lib/util.ts
  var constant = (value) => (..._args) => value;

  // src/lib/observer.ts
  var INIT = { childList: true, subtree: true };
  var done = constant(false);
  var resume = constant(true);
  var observe = (...args) => {
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
  };

  // src/twitter-linkify-trends.user.ts
  // @license       GPL
  var CACHE = exports.default(128);
  var DISABLED_EVENTS = "click touch";
  var EVENT_DATA = "data.explore_page.body.initialTimeline.timeline.timeline.instructions[-1].entries.*.content.items.*.item.itemContent";
  var EVENT_DATA_ENDPOINT = "/ExplorePage";
  var EVENT = 'div[role="link"][data-testid="trend"]:has([data-testid^="UserAvatar-Container"]):not([data-linked])';
  var TREND = 'div[role="link"][data-testid="trend"]:not(:has([data-testid^="UserAvatar-Container"])):not([data-linked])';
  var VIDEO = 'div[role="presentation"] div[role="link"][data-testid^="media-tweet-card-"]:not([data-linked])';
  var SELECTOR = [EVENT, TREND, VIDEO].join(", ");
  function disableAll(e) {
    e.stopPropagation();
  }
  function disableSome(e) {
    const $target = $(e.target);
    const $caret = $target.closest('[data-testid="caret"]', this);
    if (!$caret.length) {
      e.stopPropagation();
    }
  }
  function hookXHROpen(oldOpen) {
    return function open(_method, url) {
      const $url = URL.parse(url);
      if ($url.pathname.endsWith(EVENT_DATA_ENDPOINT)) {
        this.addEventListener("load", () => processEventData(this.responseText));
      }
      return GMCompat.apply(this, oldOpen, arguments);
    };
  }
  function linkFor(href) {
    return $("<a></a>").attr({ href, role: "link", "data-focusable": true }).css({ color: "inherit", textDecoration: "inherit" });
  }
  function onElement(el) {
    const $el = $(el);
    let fixPointer = true;
    let linked = true;
    if ($el.is(EVENT)) {
      $el.on(DISABLED_EVENTS, disableAll);
      linked = onEventElement($el);
    } else if ($el.is(TREND)) {
      $el.on(DISABLED_EVENTS, disableSome);
      onTrendElement($el);
    } else if ($el.is(VIDEO)) {
      fixPointer = false;
      $el.on(DISABLED_EVENTS, disableAll);
      onVideoElement($el);
    }
    if (linked) {
      $el.attr("data-linked", "true");
    }
    if (fixPointer) {
      $el.css("cursor", "auto");
    }
  }
  function onEventElement($event) {
    const { target, title } = targetFor($event);
    const url = CACHE.get(title);
    if (!url) {
      return false;
    }
    console.debug(`element (event):`, JSON.stringify(title));
    const $link = linkFor(url);
    $(target).parent().wrap($link);
    return true;
  }
  function onTrendElement($trend) {
    const { target, title } = targetFor($trend);
    const trend = /\s/.test(title) ? `"${title.replace(/"/g, "")}"` : title;
    console.debug("element (trend):", trend);
    const query = encodeURIComponent(trend);
    const url = `${location.origin}/search?q=${query}&src=trend_click&vertical=trends`;
    $(target).wrap(linkFor(url));
  }
  function onVideoElement($link) {
    const id = $link.data("testid").split("-").at(-1);
    const url = `${location.origin}/i/web/status/${id}`;
    $link.wrap(linkFor(url));
  }
  function processEventData(json) {
    const data = JSON.parse(json);
    const events = exports.get(data, EVENT_DATA, []);
    for (const event of events) {
      if (event.itemType !== "TimelineTrend") {
        break;
      }
      const { name: title, trend_url: { url: uri } } = event;
      const url = uri.replace(/^twitter:\/\//, `${location.origin}/i/`);
      console.debug("data (event):", { title, url });
      CACHE.set(title, url);
    }
  }
  function targetFor($el) {
    const targets = $el.find('div[dir="ltr"] > span').filter((_, el) => {
      const fontWeight = Number($(el).parent().css("fontWeight") || 0);
      return fontWeight >= 700;
    });
    const target = targets.get().pop();
    const title = $(target).text().trim();
    return { target, title };
  }
  function run() {
    const target = document.getElementById("react-root");
    if (!target) {
      console.warn("can't find react-root element");
      return;
    }
    observe(target, () => {
      for (const el of $(SELECTOR)) {
        onElement(el);
      }
    });
  }
  var xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype;
  xhrProto.open = GMCompat.export(hookXHROpen(xhrProto.open));
  $(run);
})();
