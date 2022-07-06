"use strict";

// ==UserScript==
// @name          GitHub My Issues
// @description   Add a contextual link to issues you've contributed to on GitHub
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.3.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://github.com/
// @include       https://github.com/*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.1/dist/cash.min.js
// @grant         GM_log
// ==/UserScript==

// NOTE This file is generated from src/github-my-issues.user.ts and should not be edited directly.

(() => {
  // src/github-my-issues.user.ts
  // @license       GPL
  var ID = "my-issues";
  var ISSUES = '[aria-label="Global"] a[href="/issues"]';
  var MY_ISSUES = "My Issues";
  var PAGE_REPO = "octolytics-dimension-repository_nwo";
  var PJAX_REPO = '[data-pjax="#js-repo-pjax-container"]';
  var SELF = "user-login";
  var USER = "profile:username";
  function meta(name, key = "name") {
    const quotedName = JSON.stringify(name);
    return $(`meta[${key}=${quotedName}]`).attr("content");
  }
  function run() {
    $(`#${ID}`).remove();
    const self = meta(SELF);
    if (!self) {
      return;
    }
    const $issues = $(ISSUES);
    if ($issues.length !== 1) {
      return;
    }
    let subqueries = [`involves:${self}`, "sort:updated-desc"];
    let prop, path = "/issues";
    if (prop = meta(PAGE_REPO)) {
      path = `/${prop}/issues`;
    } else if (prop = $(PJAX_REPO).attr("href")) {
      path = `${prop}/issues`;
    } else if (prop = meta(USER, "property")) {
      if (prop === self) {
        subqueries = [`user:${prop}`, "is:open", "archived:false", ...subqueries];
      } else {
        subqueries = [`user:${prop}`, ...subqueries];
      }
    }
    const query = subqueries.join("+");
    const href = `${path}?q=${escape(query)}`;
    const $link = $issues.clone().attr({ href, "data-hotkey": "g I", id: ID }).text(MY_ISSUES);
    $issues.after($link);
  }
  $(document).on("turbo:load", run);
})();
