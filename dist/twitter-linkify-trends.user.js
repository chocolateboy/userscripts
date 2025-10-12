// ==UserScript==
// @name          Twitter Linkify Trends
// @description   Make Twitter trends links (again)
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.3.0
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

  // src/twitter-linkify-trends.user.ts
  // @license       GPL
  var CACHE = exports.default(128);
  var DISABLED_EVENTS = "click touch";
  var EVENT_DATA_HANDLERS = /* @__PURE__ */ new Map([
    [
      "ExplorePage",
      "data.explore_page.body.initialTimeline.timeline.timeline.instructions[-1].entries.*.content.items.*.item.itemContent"
    ],
    [
      "GenericTimelineById",
      "data.timeline.timeline.instructions[-1].entries.*.content.items.*.item.itemContent"
    ],
    [
      "SearchTimeline",
      "data.search_by_raw_query.search_timeline.timeline.instructions[-1].entries.*.content.items.*.item.itemContent"
    ],
    [
      "useStoryTopicQuery",
      {
        path: "data.story_topic.stories.items.*.trend_results.result",
        handler: onSidebarEventData
      }
    ]
  ]);
  var CARET = '[data-testid="caret"]';
  var IS_TREND = '[data-testid="trend"]';
  var HAS_MENU = `:has(${CARET})`;
  var TIMELINE_EVENT = `${IS_TREND}:not(${HAS_MENU})`;
  var SIDEBAR_EVENT = '[data-testid^="news_sidebar_article_"]';
  var EVENT = `:is(${TIMELINE_EVENT}, ${SIDEBAR_EVENT})`;
  var TREND = `${IS_TREND}${HAS_MENU}`;
  var SELECTOR = [EVENT, TREND].map((it) => `div[role="link"]${it}:not([data-linked])`).join(", ");
  function disableAll(e) {
    e.stopPropagation();
  }
  function disableSome(e) {
    const $target = $(e.target);
    const $caret = $target.closest(CARET, this);
    if (!$caret.length) {
      e.stopPropagation();
    }
  }
  function hookXHROpen(oldOpen) {
    return function open(_method, url) {
      const endpoint = URL.parse(url)?.pathname.split("/").at(-1);
      for (const [$endpoint, $path] of EVENT_DATA_HANDLERS) {
        if ($endpoint !== endpoint) {
          continue;
        }
        const [path, handler] = typeof $path === "string" ? [$path, onTimelineEventData] : [$path.path, $path.handler];
        this.addEventListener("load", () => handler(this.responseText, path));
        break;
      }
      return GMCompat.apply(this, oldOpen, arguments);
    };
  }
  function linkFor(href) {
    return $("<a></a>").attr({ href, role: "link", "data-focusable": true }).css({ color: "inherit", textDecoration: "inherit" });
  }
  function onElement(el) {
    const $el = $(el);
    let linked = true;
    if ($el.is(EVENT)) {
      $el.on(DISABLED_EVENTS, disableAll);
      linked = onEventElement($el);
    } else if ($el.is(TREND)) {
      $el.on(DISABLED_EVENTS, disableSome);
      onTrendElement($el);
    }
    if (linked) {
      $el.css("cursor", "auto");
      $el.attr("data-linked", "true");
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
  function onSidebarEventData(json, path) {
    const data = JSON.parse(json);
    const events = exports.get(data, path, []);
    for (const event of events) {
      const { core: { name: title }, rest_id: id } = event;
      const url = `${location.origin}/i/trending/${id}`;
      console.debug("data (sidebar event):", { title, url });
      CACHE.set(title, url);
    }
  }
  function onTimelineEventData(json, path) {
    const data = JSON.parse(json);
    const events = exports.get(data, path, []);
    for (const event of events) {
      if (event.itemType !== "TimelineTrend") {
        break;
      }
      const { name: title, trend_url: { url: uri } } = event;
      const url = uri.replace(/^twitter:\/\//, `${location.origin}/i/`);
      console.debug("data (timeline event):", { title, url });
      CACHE.set(title, url);
    }
  }
  function onTrendElement($trend) {
    const { target, title } = targetFor($trend);
    const trend = /\s/.test(title) ? `"${title.replace(/"/g, "")}"` : title;
    console.debug("element (trend):", trend);
    const query = encodeURIComponent(trend);
    const url = `${location.origin}/search?q=${query}&src=trend_click&vertical=trends`;
    $(target).wrap(linkFor(url));
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
