// ==UserScript==
// @name          GitHub First Commit
// @description   Add a link to a GitHub repo's first commit
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       2.1.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://github.com/*/*
// @require       https://code.jquery.com/jquery-3.3.1.min.js
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
//     https://gist.github.com/pitaj/e52862409dd5726711214a55189f332d
//
// similar/related snippets are listed here:
//
//     https://github.com/wong2/first-commit/issues/15#issuecomment-317750579

const COMMIT_BAR = 'div.commit-tease.js-details-container > span.float-right'

const FIRST_COMMIT =
    `<span id="first-commit">
        |&nbsp;
        <a id="first-commit-link" style="cursor: pointer" class="message">First commit</a>
    </span>`

// add the "First commit" link as the last child of the commit bar
function addLink ($commitBar) {
    const [user, repo] = $('meta[name="octolytics-dimension-repository_network_root_nwo"]')
        .attr('content')
        .split('/')

    // the "First commit" link already exists when navigating to a repo's
    // homepage via the back button. however, resurrecting the link in this
    // way causes i"Latest commit" ts onclick event handler to be unregistered
    // (XXX why?), so we need to re-attach it
    let $firstCommit = $commitBar.find('#first-commit')

    if (!$firstCommit.length) {
        $firstCommit = $(FIRST_COMMIT)
        $commitBar.append($firstCommit)
    }

    const $link = $firstCommit.find('#first-commit-link')

    $link.on('click', event => {
        $link.text('Loading...')
        openFirstCommit(user, repo)
        return false
    })
}

// the commit bar (div.commit-tease) is statically defined in the HTML
// for users who aren't logged in. for logged in users, it's loaded dynamically
// via an <include-fragment> custom element:
//
//     https://github.com/github/include-fragment-element
//
// jQuery-onMutate fires the callback immediately if the element already exists,
// so it handles both cases

// #js-repo-pjax-container is only created on repo homepages
// see here for more details: https://github.com/Mottie/GitHub-userscripts/wiki/How-to
$('#js-repo-pjax-container').onCreate(COMMIT_BAR, addLink, true /* multi */)
