// ==UserScript==
// @name          GitHub First Commit
// @description   Add a link to a GitHub repo's first commit
// @author        chocolateboy
// @copyright     chocolateboy
// @version       4.0.2
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://github.com/
// @include       https://github.com/*
// @grant         GM_log
// @noframes
// ==/UserScript==

// NOTE This file is generated from src/github-first-commit.user.ts and should not be edited directly.

"use strict";
(() => {
  // src/lib/observer.ts
  var DUMMY_MUTATIONS = [];
  var INIT = { childList: true, subtree: true };
  var observe = (target, ...args) => {
    const [init, callback] = args.length === 1 ? [INIT, args[0]] : args;
    const $callback = (mutations, observer2) => {
      observer2.disconnect();
      const result = callback(mutations, observer2);
      if (!result) {
        observer2.observe(target, init);
      }
    };
    const observer = new MutationObserver($callback);
    queueMicrotask(() => $callback(DUMMY_MUTATIONS, observer));
    return observer;
  };

  // src/github-first-commit.user.ts
  // @license       GPL
  var ID = "first-commit";
  var PATH = 'meta[name="analytics-location"][content]';
  var USER_REPO = 'meta[name="octolytics-dimension-repository_network_root_nwo"][content]';
  var $ = document;
  var openFirstCommit = (user, repo) => {
    return fetch(`https://api.github.com/repos/${user}/${repo}/commits`).then((res) => Promise.all([res.headers.get("link"), res.json()])).then(([link, commits]) => {
      if (!link) {
        return commits;
      }
      const lastPage = link.match(/^.+?<([^>]+)>;/)[1];
      return fetch(lastPage).then((res) => res.json());
    }).then((commits) => {
      if (Array.isArray(commits)) {
        location.href = commits.at(-1).html_url;
      } else {
        console.error(commits);
      }
    });
  };
  observe($.body, () => {
    const path = $.querySelector(PATH)?.content;
    const isRepoPage = path === "/<user-name>/<repo-name>";
    if (!isRepoPage) {
      return;
    }
    if ($.getElementById(ID)) {
      return;
    }
    const commitHistory = $.querySelector("div svg.octicon-history")?.closest("div");
    if (!commitHistory) {
      return;
    }
    const firstCommit = commitHistory.cloneNode(true);
    const label = firstCommit.querySelector(':scope [data-component="text"] > *');
    const header = firstCommit.querySelector(":scope h2");
    const link = firstCommit.querySelector(":scope a[href]");
    const [user, repo] = $.querySelector(USER_REPO).getAttribute("content").split("/");
    firstCommit.id = ID;
    header.textContent = label.textContent = "1st Commit";
    link.removeAttribute("href");
    link.setAttribute("aria-label", "First commit");
    firstCommit.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      label.textContent = "Loading...";
      openFirstCommit(user, repo);
    }, { once: true });
    commitHistory.after(firstCommit);
  });
})();
