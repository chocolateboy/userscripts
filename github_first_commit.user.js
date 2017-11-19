// ==UserScript==
// @name          GitHub First Commit
// @description   Add a link to a GitHub repo's first commit
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       2.0.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://github.com/*/*
// @require       https://code.jquery.com/jquery-3.2.1.min.js
// @require       https://cdn.rawgit.com/eclecto/jQuery-onMutate/v1.4.2/src/jquery.onmutate.min.js
// @require       https://cdn.rawgit.com/pitaj/e52862409dd5726711214a55189f332d/raw/71cec49b5f1648749d20260b496a4c92e25239c6/Get%2520the%2520first%2520commit%2520url.js
// @grant         GM_log
// @grant         GM_xmlhttpRequest
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

// the included function (openFirstCommit) for extracting (and navigating to)
// the URL from GitHub's public API comes from:
//
// https://gist.github.com/pitaj/e52862409dd5726711214a55189f332d
//
// similar/related snippets are listed here:
//
// https://github.com/wong2/first-commit/issues/15#issuecomment-317750579

// there's a per-file latest-commit link on every file page. this selector
// adds the first-commit link to these pages as well:
// const LATEST_COMMIT_SELECTOR = 'div.commit-tease > span.float-right'

// this selector restricts the first-commit link to pages with a latest-commit link
const LATEST_COMMIT_SELECTOR = 'div.commit-tease.js-details-container > span.float-right'

function onClick ($link, user, repo) {
    return function (event) {
        $link.text('Loading...')
        openFirstCommit(user, repo)
        return false
    }
}

function addLink ($latestCommit) {
    if ($latestCommit.not(':has(#first-commit)').length) {
        const [user, repo] = $('meta[name="octolytics-dimension-repository_network_root_nwo"]')
            .attr('content')
            .split('/')

        const $firstCommit = $(
            '<span id="first-commit">' +
                '|&nbsp;' +
                '<a id="first-commit-link" href="#" class="message">First commit</a>' +
            '</span>'
        )

        const $link = $firstCommit.find('#first-commit-link')

        $link.one('click', onClick($link, user, repo))
        $latestCommit.append($firstCommit)
    }
}

// the latest-commit bar (div.commit-tease) is statically defined in the HTML
// for users who aren't logged in. for logged in users, it's loaded dynamically
// via an <include-fragment> custom element:
//
// https://github.com/github/include-fragment-element
//
// jQuery-onMutate fires the callback immediately if the element already exists,
// so it handles both cases
$('#js-repo-pjax-container').onCreate(LATEST_COMMIT_SELECTOR, addLink, true /* multi */)
