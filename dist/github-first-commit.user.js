"use strict";

// ==UserScript==
// @name          GitHub First Commit
// @description   Add a link to a GitHub repo's first commit
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.8.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://github.com/
// @include       https://github.com/*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.1/dist/cash.min.js
// @grant         GM_log
// ==/UserScript==

// NOTE This file is generated from src/github-first-commit.user.ts and should not be edited directly.

(() => {
  // src/github-first-commit.user.ts
  // @license       GPL
  var COMMIT_BAR = "div.js-details-container[data-issue-and-pr-hovercards-enabled] > *:last-child ul";
  var FIRST_COMMIT_LABEL = '<span aria-label="First commit"><strong>1st</strong> commit</span>';
  function openFirstCommit(user, repo) {
    return fetch(`https://api.github.com/repos/${user}/${repo}/commits`).then((res) => Promise.all([res.headers.get("link"), res.json()])).then(([link, commits]) => {
      if (!link) {
        return commits;
      }
      const lastPage = link.match(/^.+?<([^>]+)>;/)[1];
      return fetch(lastPage).then((res) => res.json());
    }).then((commits) => {
      if (Array.isArray(commits)) {
        location.href = commits[commits.length - 1].html_url;
      } else {
        console.error(commits);
      }
    });
  }
  function run() {
    const $commitBar = $(COMMIT_BAR);
    if (!$commitBar.length) {
      return;
    }
    $commitBar.find("#first-commit").remove();
    const $firstCommit = $commitBar.find("li").eq(0).clone().attr("id", "first-commit");
    const $link = $firstCommit.find("a").removeAttr("href").css("cursor", "pointer");
    const $label = $(FIRST_COMMIT_LABEL);
    $link.find(":scope > span").empty().append($label);
    const [user, repo] = $('meta[name="octolytics-dimension-repository_network_root_nwo"]').attr("content").split("/");
    $link.on("click", () => {
      $label.text("Loading...");
      openFirstCommit(user, repo);
      return false;
    });
    $commitBar.append($firstCommit);
  }
  $(document).on("turbo:load", run);
})();
