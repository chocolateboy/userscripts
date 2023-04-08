// ==UserScript==
// @name          Twitter Direct
// @description   Remove t.co tracking links from Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.3.1
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
  var checkUrl = function() {
    const urlPattern = /^https?:\/\/\w/i;
    return (value) => urlPattern.test(value) && value;
  }();
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
  var isTrackedUrl = function() {
    const urlPattern = /^https?:\/\/t\.co\/\w+$/;
    return (value) => urlPattern.test(value);
  }();

  // src/twitter-direct/transformer.ts
  var CONTENT_TYPE = /^application\/json\b/;
  var DOCUMENT_ROOTS = [
    "data",
    "globalObjects",
    "inbox_initial_state",
    "modules",
    // TweetDeck
    "users"
  ];
  var LEGACY_KEYS = [
    "binding_values",
    "entities",
    "extended_entities",
    "quoted_status_permalink",
    "retweeted_status",
    "retweeted_status_result",
    "user_refs"
  ];
  var LOG_THRESHOLD = 1024;
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
  var STATS = {};
  var TWITTER_API = /^(?:(?:api|mobile)\.)?twitter\.com$/;
  var isSummary = (value) => {
    return isPlainObject(value) && isString(value.text) && Array.isArray(value.entities);
  };
  var isEntity = (value) => {
    return isPlainObject(value) && isNumber(value.fromIndex) && isNumber(value.toIndex) && isPlainObject(value.ref) && isString(value.ref.url);
  };
  var Transformer = class {
    urlBlacklist;
    /*
     * replace the default XHR#send with our custom version, which scans responses
     * for tweets and expands their URLs
     */
    static register(options) {
      const transformer = new this(options);
      const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype;
      const send = transformer.hookXHRSend(xhrProto.send);
      xhrProto.send = GMCompat.export(send);
      return transformer;
    }
    constructor(options) {
      this.urlBlacklist = options.urlBlacklist || /* @__PURE__ */ new Set();
    }
    /*
     * replacement for Twitter's default handler for XHR requests. we transform the
     * response if it's a) JSON and b) contains URL data; otherwise, we leave it
     * unchanged
     */
    onResponse(xhr, uri) {
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
      if (this.urlBlacklist.has(path)) {
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
      const count = this.transform(data, path);
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
    }
    /*
     * replace t.co URLs with the original URL in all locations in the document
     * which may contain them
     *
     * returns the number of substituted URLs
     */
    transform(data, path) {
      const seen = /* @__PURE__ */ new Map();
      const unresolved = /* @__PURE__ */ new Map();
      const state = { path, count: 0, seen, unresolved };
      if (Array.isArray(data) || "id_str" in data) {
        this.traverse(state, data);
      } else {
        for (const key of DOCUMENT_ROOTS) {
          if (key in data) {
            this.traverse(state, data[key]);
          }
        }
      }
      for (const [url, targets] of unresolved) {
        const expandedUrl = seen.get(url);
        if (expandedUrl) {
          for (const { target, key } of targets) {
            target[key] = expandedUrl;
            ++state.count;
          }
          unresolved.delete(url);
        }
      }
      if (unresolved.size) {
        console.warn(`unresolved URIs (${path}):`, Object.fromEntries(state.unresolved));
      }
      return state.count;
    }
    /*
     * reduce the large binding_values array/object to the one property we care
     * about (card_url)
     */
    transformBindingValues(value) {
      if (Array.isArray(value)) {
        const found = value.find((it) => it?.key === "card_url");
        return found ? [found] : 0;
      } else if (isPlainObject(value)) {
        return { card_url: value.card_url || 0 };
      } else {
        return 0;
      }
    }
    /*
     * reduce the keys under context.legacy (typically around 30) to the
     * handful we care about
     */
    transformLegacyObject(value) {
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
     * extract expanded URLs from a summary object
     *
     * the expanded URLs are only extracted here; they're substituted when the
     * +url+ property within the summary is visited
     */
    transformSummary(state, summary) {
      const { entities, text } = summary;
      for (const entity of entities) {
        if (!isEntity(entity)) {
          console.warn("invalid entity:", entity);
          break;
        }
        const { url } = entity.ref;
        if (isTrackedUrl(url)) {
          const expandedUrl = text.slice(entity.fromIndex, entity.toIndex);
          state.seen.set(url, expandedUrl);
        }
      }
      return summary;
    }
    /*
     * expand t.co URL nodes in place, either obj.url or obj.string_value in
     * binding_values arrays/objects
     */
    transformURL(state, context, key, url) {
      const { seen, unresolved } = state;
      const writable = this.isWritable(context);
      let expandedUrl;
      if (expandedUrl = seen.get(url)) {
        if (writable) {
          context[key] = expandedUrl;
          ++state.count;
        }
      } else if (expandedUrl = checkUrl(context.expanded_url || context.expanded)) {
        seen.set(url, expandedUrl);
        if (writable) {
          context[key] = expandedUrl;
          ++state.count;
        }
      } else {
        let targets = unresolved.get(url);
        if (!targets) {
          unresolved.set(url, targets = []);
        }
        if (writable) {
          targets.push({ target: context, key });
        }
      }
      return url;
    }
    /*
     * replace the built-in XHR#send method with a custom version which swaps
     * in our custom response handler. once done, we delegate to the original
     * handler (this.onreadystatechange)
     */
    hookXHRSend(oldSend) {
      const self = this;
      return function send(body = null) {
        const oldOnReadyStateChange = this.onreadystatechange;
        this.onreadystatechange = function(event) {
          if (this.readyState === this.DONE && this.responseURL && this.status === 200) {
            self.onResponse(this, this.responseURL);
          }
          if (oldOnReadyStateChange) {
            oldOnReadyStateChange.call(this, event);
          }
        };
        oldSend.call(this, body);
      };
    }
    /*
     * a hook which a subclass can use to veto an expansion.
     *
     * used by TweetDeck Direct to preserve t.co URLs which are expanded in the
     * UI (via a data-full-url attribute on the link)
     */
    isWritable(_context) {
      return true;
    }
    /*
     * traverse an object by hijacking JSON.stringify's visitor (replacer).
     * dispatches each node to the +visit+ method
     */
    traverse(state, data) {
      if (!isObject(data)) {
        return;
      }
      const self = this;
      const replacer = function(key, value) {
        return Array.isArray(this) ? value : self.visit(state, this, key, value);
      };
      JSON.stringify(data, replacer);
    }
    /*
     * visitor callback which replaces a t.co +url+ property in an object with
     * its expanded version
     */
    visit(state, context, key, value) {
      if (PRUNE_KEYS.has(key)) {
        return 0;
      }
      switch (key) {
        case "binding_values":
          return this.transformBindingValues(value);
        case "legacy":
          if (isPlainObject(value)) {
            return this.transformLegacyObject(value);
          }
          break;
        case "string_value":
        case "url":
          if (isTrackedUrl(value)) {
            return this.transformURL(state, context, key, value);
          }
          break;
        case "summary":
          if (isSummary(value)) {
            return this.transformSummary(state, value);
          }
      }
      return value;
    }
  };

  // src/twitter-direct.user.ts
  // @license       GPL
  var URL_BLACKLIST = /* @__PURE__ */ new Set([
    "/hashflags.json",
    "/badge_count/badge_count.json",
    "/graphql/articleNudgeDomains",
    "/graphql/TopicToFollowSidebar"
  ]);
  Transformer.register({ urlBlacklist: URL_BLACKLIST });
})();
