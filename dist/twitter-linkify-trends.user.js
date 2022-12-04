// ==UserScript==
// @name          Twitter Linkify Trends
// @description   Make Twitter trends links (again)
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.0.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://code.jquery.com/jquery-3.6.1.slim.min.js
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @require       https://unpkg.com/@chocolateboy/uncommonjs@3.2.1/dist/polyfill.iife.min.js
// @require       https://unpkg.com/get-wild@3.0.0/dist/index.umd.min.js
// @require       https://unpkg.com/flru@1.0.2/dist/flru.min.js
// @grant         GM_log
// @run-at        document-start
// ==/UserScript==

// NOTE This file is generated from src/twitter-linkify-trends.user.ts and should not be edited directly.

"use strict";
(() => {
  // src/twitter-linkify-trends.user.ts
  // @license       GPL
  var CACHE = new exports.default(128);
  var DEBUG = {};
  var DISABLED_EVENTS = "click touch";
  var EVENT_DATA = "/i/api/2/guide.json";
  var EVENT_PATH = "timeline.instructions.*.addEntries.entries.*.content.timelineModule.items.*.item.content.eventSummary";
  var EVENT_HERO_PATH = "timeline.instructions.*.addEntries.entries.*.content.item.content.eventSummary";
  var LIVE_EVENT_KEY = "/lex/placeholder_live_nomargin";
  var EVENT = 'div[role="link"]:not([data-testid]):not([data-linked]):not([href])';
  var EVENT_IMAGE = `${EVENT} > div > div:nth-child(2):last-child img[src]:not([src=""])`;
  var EVENT_HERO = 'div[role="link"][data-testid="eventHero"]:not([data-linked])';
  var EVENT_HERO_IMAGE = `${EVENT_HERO} > div:first-child [data-testid="image"] > img[src]:not([src=""])`;
  var TREND = 'div[role="link"][data-testid="trend"]:not([data-linked])';
  var EVENT_ANY = [EVENT, EVENT_HERO].join(", ");
  var SELECTOR = [EVENT_IMAGE, EVENT_HERO_IMAGE, TREND].join(", ");
  var pluck = exports.getter({ default: [], split: "." });
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
      const $url = new URL(url);
      if ($url.pathname === EVENT_DATA) {
        this.addEventListener("load", () => processEventData(this.responseText));
      }
      return GMCompat.apply(this, oldOpen, arguments);
    };
  }
  function keyFor(url) {
    const path = new URL(url).pathname.replace(/\.\w+$/, "");
    return path === LIVE_EVENT_KEY ? path : path.split("/")[2];
  }
  function linkFor(href) {
    return $("<a></a>").attr({ href, role: "link", "data-focusable": true }).css({ color: "inherit", textDecoration: "inherit" });
  }
  function onElement(el) {
    const $el = $(el);
    let $target;
    let type;
    if ($el.is(TREND)) {
      [$target, type] = [$el, "trend"];
      $el.on(DISABLED_EVENTS, disableSome);
      onTrendElement($el);
    } else {
      const $event = $el.closest(EVENT_ANY);
      const wrapImage = $event.is(EVENT);
      [$target, type] = [$event, "event"];
      $event.on(DISABLED_EVENTS, disableAll);
      onEventElement($event, $el, { wrapImage });
    }
    $target.attr("data-linked", "true");
    $target.css("cursor", "auto");
    if (DEBUG[type]) {
      $target.css("backgroundColor", DEBUG[type]);
    }
  }
  function onEventElement($event, $image, options = {}) {
    const { target, title } = targetFor($event);
    const key = keyFor($image.attr("src"));
    console.debug("element (event):", JSON.stringify(title));
    const url = key === LIVE_EVENT_KEY ? CACHE.get(title) : CACHE.get(key);
    if (url) {
      const $link = linkFor(url);
      $(target).parent().wrap($link);
      if (options.wrapImage) {
        $image.wrap($link);
      }
    } else {
      console.warn("Can't find URL for event (element):", JSON.stringify(title));
    }
  }
  function onTrendElement($trend) {
    const { target, title } = targetFor($trend);
    const param = /\s+/.test(title) ? '"' + title.replace(/"/g, "") + '"' : title;
    console.debug("element (trend):", param);
    const query = encodeURIComponent(param);
    const url = `${location.origin}/search?q=${query}&src=trend_click&vertical=trends`;
    $(target).wrap(linkFor(url));
  }
  function processEventData(json) {
    const data = JSON.parse(json);
    const events = pluck(data, EVENT_PATH);
    const eventHero = pluck(data, EVENT_HERO_PATH);
    const $events = eventHero.concat(events);
    const nEvents = $events.length;
    if (!nEvents) {
      return;
    }
    for (const event of $events) {
      const { title, url: { url } } = event;
      const imageURL = event.image?.url;
      if (!imageURL) {
        console.warn("Can't find image for event (data):", title);
        continue;
      }
      const key = keyFor(imageURL);
      console.debug("data (event):", JSON.stringify(title));
      if (key === LIVE_EVENT_KEY) {
        CACHE.set(title, url);
      } else {
        CACHE.set(key, url);
      }
    }
  }
  function targetFor($el) {
    const targets = $el.find('div[dir="ltr"] > span').filter((_, el) => {
      const fontWeight = $(el).parent().css("fontWeight") || 0;
      return fontWeight >= 700;
    });
    const target = targets.get().pop();
    const title = $(target).text().trim();
    return { target, title };
  }
  function run() {
    const init = { childList: true, subtree: true };
    const target = document.getElementById("react-root");
    if (!target) {
      console.warn("can't find react-root element");
      return;
    }
    const callback = (_mutations, observer) => {
      observer.disconnect();
      for (const el of $(SELECTOR)) {
        onElement(el);
      }
      observer.observe(target, init);
    };
    new MutationObserver(callback).observe(target, init);
  }
  var xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype;
  xhrProto.open = GMCompat.export(hookXHROpen(xhrProto.open));
  $(run);
})();
