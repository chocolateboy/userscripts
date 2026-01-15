// ==UserScript==
// @name          GitHub My Issues
// @description   Add a contextual link to issues you've contributed to on GitHub
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.3.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://github.com/
// @include       https://github.com/*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.5/dist/cash.min.js
// @grant         GM_addStyle
// ==/UserScript==

// NOTE This file is generated from src/github-my-issues.user.ts and should not be edited directly.

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

  // src/github-my-issues.user.ts
  // @license       GPL
  var ID = "my-issues-link";
  var ISSUES_LINK = 'a[data-react-nav="issues-react"]';
  var MY_ISSUES = "My Issues";
  var MY_ISSUES_LINK = `a#${ID}`;
  var run = () => {
    const $issuesLink = $(`li ${ISSUES_LINK}`);
    const $issues = $issuesLink.closest("li");
    if ($issues.length !== 1) {
      console.warn("no issues tab:", $issues.length);
      return;
    }
    const self = $('meta[name="user-login"]').attr("content");
    if (!self) {
      console.warn("no logged-in user");
      return;
    }
    const [user, repo] = location.pathname.slice(1).split("/");
    if (!(repo && user)) {
      console.warn("no user/repo");
      return;
    }
    let $myIssues = $(`li ${MY_ISSUES_LINK}`).closest("li");
    let $link;
    let created = false;
    if ($myIssues.length) {
      $link = $myIssues.find(`:scope ${MY_ISSUES_LINK}`);
    } else {
      $myIssues = $issues.clone();
      $link = $myIssues.find(`:scope ${ISSUES_LINK}`);
      created = true;
    }
    const myIssues = `involves:${self}`;
    const path = `/${user}/${repo}/issues`;
    if (created) {
      const subqueries = [myIssues, "sort:updated-desc"];
      if (user === self) {
        subqueries.unshift("is:open", "archived:false");
      }
      const query = subqueries.join("+");
      const href = `${path}?q=${escape(query)}`;
      $link.removeClass("deselected").attr({
        id: ID,
        role: "tab",
        href,
        "aria-current": null,
        "data-hotkey": "g I",
        "data-react-nav": null,
        "data-selected-links": null
      });
      $link.find(':scope [data-content="Issues"]').text(MY_ISSUES);
      $link.find(':scope [data-component="counter"]').hide();
    }
    let q = null;
    if (location.pathname === path) {
      const params = new URLSearchParams(location.search);
      q = params.get("q");
    }
    if (q && q.trim().split(/\s+/).includes(myIssues)) {
      $link.attr("aria-selected", "true");
      $issuesLink.addClass("deselected");
    } else {
      $link.attr("aria-selected", "false");
      $issuesLink.removeClass("deselected");
    }
    if (created) {
      $issues.after($myIssues);
    }
  };
  GM_addStyle(`
    .deselected::after {
        background: transparent !important;
    }
`);
  observe(run);
})();
