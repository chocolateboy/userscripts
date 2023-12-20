// ==UserScript==
// @name          GitHub First Commit
// @description   Add a link to a GitHub repo's first commit
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.1.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://github.com/
// @include       https://github.com/*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.5/dist/cash.min.js
// @grant         GM_log
// @noframes
// @run-at        document-start
// ==/UserScript==

// NOTE This file is generated from src/github-first-commit.user.ts and should not be edited directly.

"use strict";
(() => {
  // src/lib/util.ts
  var pipe = (value, fn) => fn(value);

  // src/github-first-commit/util.ts
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

  // src/github-first-commit/first-commit.ts
  var DEFAULT_TIMEOUT = 1e3;
  var DUMMY_MUTATIONS = [];
  var getCommitHistoryButton = (root) => {
    return root.querySelector("svg.octicon.octicon-history")?.closest("a") || null;
  };
  var FirstCommit = class {
    constructor(state, options = {}) {
      this.state = state;
      this.timeout = options.timeout || DEFAULT_TIMEOUT;
    }
    timeout;
    append($target, $firstCommit) {
      const $targetLi = $target.parent("li");
      const $firstCommitLi = $($targetLi[0].cloneNode(false)).empty().append($firstCommit);
      $targetLi.after($firstCommitLi);
    }
    /*
     * add the "1st Commit" button after the commit-history ("123 Commits")
     * button
     */
    attach(target) {
      console.log("inside attach:", target);
      const $target = $(target);
      const $firstCommit = $target.clone().removeAttr("href data-pjax data-turbo-frame").removeClass("react-last-commit-history-group").attr({
        "aria-label": "First commit",
        "id": "first-commit"
      }).css("cursor", "pointer");
      const $label = this.findLabel($firstCommit);
      $label.text("1st Commit");
      const [user, repo] = $('meta[name="octolytics-dimension-repository_network_root_nwo"][content]').attr("content").split("/");
      $firstCommit.one("click", () => {
        $label.text("Loading...");
        openFirstCommit(user, repo);
        return false;
      });
      console.log("attaching first-commit button:", $firstCommit[0]);
      this.append($target, $firstCommit);
    }
    findLabel($firstCommit) {
      const $label = $firstCommit.find(":scope span > strong").first();
      $label.nextAll().remove();
      return $label;
    }
    getRoot() {
      return document.getElementById("js-repo-pjax-container");
    }
    handleFirstCommitButton(firstCommit) {
      console.debug("removing obsolete first-commit button");
      firstCommit.remove();
      return true;
    }
    // in most cases, the "turbo:load" event signals that the (SPA) page has
    // finished loading and is ready to be queried and updated (i.e. the SPA
    // equivalent of DOMContentLoaded), but that's not the case for the
    // commit-history button, which can either be:
    //
    // a) already loaded (full page load)
    // b) not there yet (still loading)
    // c) already loaded or still loading, but invalid
    //
    // b) and c) can occur when navigating to a repo page via the back button or
    // via on-site links, including self-links (i.e. from a repo page to
    // itself).
    //
    // in the c) case, the "old" [1] button is displayed (with the old
    // first-commit button still attached) before being replaced by the
    // refreshed version, unless the user is not logged in, in which case the
    // old first-commit button is not replaced.
    //
    // this method handles all 3 cases
    //
    // [1] actually restored (i.e. new) versions of these cached elements, but
    // the behavior is the same
    onLoad(_event) {
      const state = this.state;
      const root = this.getRoot();
      if (!root) {
        console.warn("can't find root element!");
        return;
      }
      let timerHandle = 0;
      let disconnected = false;
      const disconnect = () => {
        if (disconnected) {
          return;
        }
        disconnected = true;
        observer.disconnect();
        if (timerHandle) {
          pipe(timerHandle, ($timerHandle) => {
            timerHandle = 0;
            clearTimeout($timerHandle);
          });
        }
      };
      const timeout = () => {
        console.warn(`timed out after ${this.timeout}ms`);
        disconnect();
      };
      const callback = (mutations) => {
        if (mutations !== DUMMY_MUTATIONS) {
          console.debug("inside mutation callback:", mutations);
        }
        if (!root.isConnected) {
          console.warn("root is not connected:", root);
          disconnect();
          return;
        }
        if (generation !== state.generation) {
          console.warn("obsolete page:", { generation, state });
          disconnect();
          return;
        }
        const firstCommit = document.getElementById("first-commit");
        if (firstCommit) {
          console.debug("obsolete button:", firstCommit);
          const handled = this.handleFirstCommitButton(firstCommit);
          if (!handled) {
            return;
          }
        }
        const commitHistoryButton = getCommitHistoryButton(root);
        if (commitHistoryButton) {
          console.debug("found commit-history button");
          disconnect();
          queueMicrotask(() => this.attach(commitHistoryButton));
        }
      };
      const generation = state.generation;
      const observer = new MutationObserver(callback);
      callback(DUMMY_MUTATIONS, observer);
      if (!disconnected) {
        console.debug("starting mutation observer");
        timerHandle = setTimeout(timeout, this.timeout);
        observer.observe(root, { childList: true, subtree: true });
      }
    }
  };

  // src/github-first-commit/first-commit-logged-in.ts
  var FirstCommitLoggedIn = class extends FirstCommit {
    append($target, $firstCommit) {
      $target.after($firstCommit);
    }
    findLabel($firstCommit) {
      return $firstCommit.find(':scope [data-component="text"] > span').first();
    }
    getRoot() {
      return document.querySelector('[partial-name="repos-overview"]') || super.getRoot();
    }
    handleFirstCommitButton(_firstCommit) {
      return false;
    }
  };

  // src/github-first-commit.user.ts
  // @license       GPL
  var LOCATION = 'meta[name="analytics-location"][content]';
  var TIMEOUT = 1e3;
  var USER_LOGIN = 'meta[name="user-login"][content]:not([content=""])';
  var main = () => {
    const state = { generation: 0 };
    const anonHandler = new FirstCommit(state, { timeout: TIMEOUT });
    const loggedInHandler = new FirstCommitLoggedIn(state, { timeout: TIMEOUT });
    $(window).on("turbo:load", (event) => {
      ++state.generation;
      const path = document.querySelector(LOCATION)?.content;
      const isRepoPage = path === "/<user-name>/<repo-name>";
      console.log("inside turbo:load", {
        path,
        repo: isRepoPage,
        ...state,
        event
      });
      if (!isRepoPage) {
        console.log("skipping: non-repo page");
        return;
      }
      const isLoggedIn = document.querySelector(USER_LOGIN);
      const handler = isLoggedIn ? loggedInHandler : anonHandler;
      handler.onLoad(event);
    });
  };
  console.debug("inside:", GM_info.script.name);
  main();
})();
