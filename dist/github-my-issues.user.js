// ==UserScript==
// @name          GitHub My Issues
// @description   Add a contextual link to issues you've contributed to on GitHub
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.0.1
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
  // src/lib/util/constant.ts
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
  var addLink = () => {
    const $issuesLink = $(`li > ${ISSUES_LINK}`);
    if ($issuesLink.length !== 1) {
      console.debug("no issues link:", $issuesLink.length);
      return;
    }
    const $issuesTab = $issuesLink.closest("li");
    const self = $('meta[name="user-login"]').attr("content");
    if (!self) {
      console.debug("no logged-in user");
      return;
    }
    const [user, repo] = location.pathname.slice(1).split("/");
    if (!(repo && user)) {
      console.debug("no user/repo");
      return;
    }
    const myIssues = `involves:${self}`;
    const issuesPath = `/${user}/${repo}/issues`;
    let $myIssuesLink = $(`li > ${MY_ISSUES_LINK}`);
    if ($myIssuesLink.length === 0) {
      console.debug("adding My Issues tab");
      const $myIssuesTab = $issuesTab.clone();
      $myIssuesLink = $myIssuesTab.find(`:scope ${ISSUES_LINK}`);
      const subqueries = [myIssues, "sort:updated-desc"];
      if (user === self) {
        subqueries.unshift("is:open", "archived:false");
      }
      const query = subqueries.join("+");
      const href = `${issuesPath}?q=${escape(query)}`;
      $myIssuesLink.removeClass("deselected").attr({
        id: ID,
        role: "tab",
        href,
        "aria-current": null,
        "data-hotkey": "g I",
        "data-react-nav": null,
        "data-selected-links": null,
        "data-tab-item": "my-issues"
      });
      $myIssuesLink.find(':scope [data-content="Issues"]').text(MY_ISSUES);
      $myIssuesLink.find(':scope [data-component="counter"]').hide();
      $issuesTab.after($myIssuesTab);
    }
    updateLink(issuesPath, myIssues, $myIssuesLink, $issuesLink);
  };
  var updateLink = (issuesPath, myIssues, $myIssuesLink, $issuesLink) => {
    if (location.pathname === issuesPath) {
      const q = URL.parse(location.href).searchParams.get("q");
      if (q && q.trim().split(/\s+/).includes(myIssues)) {
        $myIssuesLink.attr("aria-selected", "true");
        $issuesLink.addClass("deselected");
        return;
      }
    }
    $myIssuesLink.attr("aria-selected", "false");
    $issuesLink.removeClass("deselected");
  };
  GM_addStyle(`
    .deselected::after {
        background: transparent !important;
    }
`);
  observe(document.documentElement, addLink);
})();
