// ==UserScript==
// @name          Twitter Direct
// @description   Remove t.co tracking links from Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.0.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @run-at        document-start
// ==/UserScript==

// NOTE This file is generated from src/twitter-direct.user.ts and should not be edited directly.

"use strict";
(() => {
  // src/twitter-direct/util.ts
  var isObject = (value) => !!value && typeof value === "object";
  var isPlainObject = function() {
    const toString = {}.toString;
    return (value) => toString.call(value) === "[object Object]";
  }();
  var typeOf = (value) => value === null ? "null" : typeof value;
  var isType = (type) => {
    return (value) => {
      return typeOf(value) === type;
    };
  };
  var isString = isType("string");
  var isNumber = isType("number");

  // src/twitter-direct/replacer.ts
  var DOCUMENT_ROOTS = [
    "data",
    "globalObjects",
    "inbox_initial_state",
    "users"
  ];
  var LEGACY_KEYS = [
    "binding_values",
    "entities",
    "extended_entities",
    "full_text",
    "lang",
    "quoted_status_permalink",
    "retweeted_status",
    "retweeted_status_result",
    "user_refs"
  ];
  var PRUNE_KEYS = /* @__PURE__ */ new Set([
    "advertiser_account_service_levels",
    "card_platform",
    "clientEventInfo",
    "ext",
    "ext_media_color",
    "features",
    "feedbackInfo",
    "hashtags",
    "indices",
    "original_info",
    "player_image_color",
    "profile_banner_extensions",
    "profile_banner_extensions_media_color",
    "profile_image_extensions",
    "profile_image_extensions_media_color",
    "responseObjects",
    "sizes",
    "user_mentions",
    "video_info"
  ]);
  var checkUrl = /* @__PURE__ */ function() {
    const urlPattern = /^https?:\/\/\w/i;
    return (value) => urlPattern.test(value) && value;
  }();
  var isTrackedUrl = /* @__PURE__ */ function() {
    const urlPattern = /^https?:\/\/t\.co\/\w+$/;
    return (value) => urlPattern.test(value);
  }();
  var isURLData = (value) => {
    return isPlainObject(value) && isString(value.url) && isString(value.expanded_url) && Array.isArray(value.indices) && isNumber(value.indices[0]) && isNumber(value.indices[1]);
  };
  var Replacer = class _Replacer {
    seen = /* @__PURE__ */ new Map();
    unresolved = /* @__PURE__ */ new Map();
    count = 0;
    static transform(data, path) {
      const replacer = new _Replacer();
      return replacer.transform(data, path);
    }
    /*
     * replace t.co URLs with the original URL in all locations in the document
     * which may contain them
     *
     * returns the number of substituted URLs
     */
    transform(data, path) {
      const { seen, unresolved } = this;
      if (Array.isArray(data) || "id_str" in data) {
        this.traverse(data);
      } else {
        for (const key of DOCUMENT_ROOTS) {
          if (key in data) {
            this.traverse(data[key]);
          }
        }
      }
      for (const [url, targets] of unresolved) {
        const expandedUrl = seen.get(url);
        if (expandedUrl) {
          for (const { target, key } of targets) {
            target[key] = expandedUrl;
            ++this.count;
          }
          unresolved.delete(url);
        }
      }
      if (unresolved.size) {
        console.warn(`unresolved URIs (${path}):`, Object.fromEntries(unresolved));
      }
      return this.count;
    }
    /*
     * reduce the large binding_values array/object to the one property we care
     * about (card_url)
     */
    onBindingValues(value) {
      if (Array.isArray(value)) {
        const found = value.find((it) => it?.key === "card_url");
        return found ? [found] : 0;
      } else if (isPlainObject(value) && isPlainObject(value.card_url)) {
        return [value.card_url];
      } else {
        return 0;
      }
    }
    /*
     * handle cases where the t.co URL is already expanded, e.g.:
     *
     * {
     *     "entities": {
     *         "urls": [
     *             {
     *                 "display_url":  "example.com",
     *                 "expanded_url": "https://www.example.com",
     *                 "url":          "https://www.example.com",
     *                 "indices":      [16, 39]
     *             }
     *         ]
     *     },
     *     "full_text": "I'm on the bus! https://t.co/abcde12345"
     * }
     *
     * extract the corresponding t.co URLs from the text via the entities.urls
     * records and register the t.co -> expanded URL mappings so they can be
     * used later, e.g. https://t.co/abcde12345 -> https://www.example.com
     */
    onFullText(context, message) {
      const seen = this.seen;
      const urls = context.entities?.urls;
      if (!(Array.isArray(urls) && urls.length)) {
        return message;
      }
      const $message = Array.from(message);
      for (let i = 0; i < urls.length; ++i) {
        const $url = urls[i];
        if (!isURLData($url)) {
          break;
        }
        const {
          url,
          expanded_url: expandedUrl,
          indices: [start, end]
        } = $url;
        const alreadyExpanded = !isTrackedUrl(url) && expandedUrl === url;
        if (!alreadyExpanded) {
          continue;
        }
        const trackedUrl = context.lang === "zxx" ? message : $message.slice(start, end).join("");
        seen.set(trackedUrl, expandedUrl);
      }
      return message;
    }
    /*
     * reduce the keys under context.legacy (typically around 30) to the
     * handful we care about
     */
    onLegacyObject(value) {
      const filtered = {};
      for (let i = 0; i < LEGACY_KEYS.length; ++i) {
        const key = LEGACY_KEYS[i];
        if (key in value) {
          filtered[key] = value[key];
        }
      }
      return filtered;
    }
    /*
     * expand t.co URL nodes in place, either $.url or $.string_value in
     * binding_values arrays/objects
     */
    onTrackedURL(context, key, url) {
      const { seen, unresolved } = this;
      let expandedUrl;
      if (expandedUrl = seen.get(url)) {
        context[key] = expandedUrl;
        ++this.count;
      } else if (expandedUrl = checkUrl(context.expanded_url || context.expanded)) {
        seen.set(url, expandedUrl);
        context[key] = expandedUrl;
        ++this.count;
      } else {
        let targets = unresolved.get(url);
        if (!targets) {
          unresolved.set(url, targets = []);
        }
        targets.push({ target: context, key });
      }
      return url;
    }
    /*
     * traverse an object by hijacking JSON.stringify's visitor (replacer).
     * dispatches each node to the +visit+ function
     */
    traverse(data) {
      if (!isObject(data)) {
        return;
      }
      const self = this;
      const replacer = function(key, value) {
        return Array.isArray(this) ? value : self.visit(this, key, value);
      };
      JSON.stringify(data, replacer);
    }
    /*
     * visitor callback which replaces a t.co +url+ property in an object with
     * its expanded URL
     */
    visit(context, key, value) {
      if (PRUNE_KEYS.has(key)) {
        return 0;
      }
      switch (key) {
        case "binding_values":
          return this.onBindingValues(value);
        case "full_text":
          if (isString(value)) {
            return this.onFullText(context, value);
          }
          break;
        case "legacy":
          if (isPlainObject(value)) {
            return this.onLegacyObject(value);
          }
          break;
        case "string_value":
        case "url":
          if (isTrackedUrl(value)) {
            return this.onTrackedURL(context, key, value);
          }
          break;
      }
      return value;
    }
  };
  var replacer_default = Replacer;

  // src/twitter-direct.user.ts
  // @license       GPL
  var URL_BLACKLIST = /* @__PURE__ */ new Set([
    "/hashflags.json",
    "/badge_count/badge_count.json",
    "/graphql/articleNudgeDomains",
    "/graphql/TopicToFollowSidebar"
  ]);
  var CONTENT_TYPE = /^application\/json\b/;
  var LOG_THRESHOLD = 1024;
  var STATS = {};
  var TWITTER_API = /^(?:(?:api|mobile)\.)?twitter\.com$/;
  var onResponse = (xhr, uri) => {
    const contentType = xhr.getResponseHeader("Content-Type");
    if (!contentType || !CONTENT_TYPE.test(contentType)) {
      return;
    }
    const url = new URL(uri);
    if (!TWITTER_API.test(url.hostname)) {
      return;
    }
    const json = xhr.responseText;
    const size = json.length;
    const path = url.pathname.replace(/^\/i\/api\//, "/").replace(/^\/\d+(\.\d+)*\//, "/").replace(/(\/graphql\/)[^\/]+\/(.+)$/, "$1$2").replace(/\/\d+\.json$/, ".json");
    if (URL_BLACKLIST.has(path)) {
      return;
    }
    let data;
    try {
      data = JSON.parse(json);
    } catch (e) {
      console.error(`Can't parse JSON for ${uri}:`, e);
      return;
    }
    if (!isObject(data)) {
      return;
    }
    const newPath = !(path in STATS);
    const count = replacer_default.transform(data, path);
    STATS[path] = (STATS[path] || 0) + count;
    if (!count) {
      if (!STATS[path] && size > LOG_THRESHOLD) {
        console.debug(`no replacements in ${path} (${size} B)`);
      }
      return;
    }
    const descriptor = { value: JSON.stringify(data) };
    const clone = GMCompat.export(descriptor);
    GMCompat.unsafeWindow.Object.defineProperty(xhr, "responseText", clone);
    const replacements = "replacement" + (count === 1 ? "" : "s");
    console.debug(`${count} ${replacements} in ${path} (${size} B)`);
    if (newPath) {
      console.log(STATS);
    }
  };
  var hookXHRSend = (oldSend) => {
    return function send2(body = null) {
      const oldOnReadyStateChange = this.onreadystatechange;
      this.onreadystatechange = function(event) {
        if (this.readyState === this.DONE && this.responseURL && this.status === 200) {
          onResponse(this, this.responseURL);
        }
        if (oldOnReadyStateChange) {
          oldOnReadyStateChange.call(this, event);
        }
      };
      oldSend.call(this, body);
    };
  };
  var xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype;
  var send = hookXHRSend(xhrProto.send);
  xhrProto.send = GMCompat.export(send);
})();
