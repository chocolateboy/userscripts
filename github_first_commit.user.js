// ==UserScript==
// @name          GitHub First Commit
// @description   Add a link to a GitHub repo's first commit via http://www.buhtig.com
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       2.0.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://github.com/*/*
// @require       https://code.jquery.com/jquery-3.2.1.min.js
// @require       https://cdn.rawgit.com/eclecto/jQuery-onMutate/v1.4.2/src/jquery.onmutate.min.js
// @grant         GM_log
// @grant         GM_xmlhttpRequest
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

// there's a per-file latest-commit link on every file page. this selector
// adds the first-commit link to these pages as well:
// const LATEST_COMMIT_SELECTOR = 'div.commit-tease > span.float-right'

// this selector restricts the first-commit link to pages
// with a latest-commit link
const LATEST_COMMIT_SELECTOR = 'div.commit-tease.js-details-container > span.float-right'

function getLink (repo, $link) {
    return function (event) {
        $link.text('Loading...')

        GM_xmlhttpRequest({
            method: 'GET',
            url: `http://www.buhtig.com:10000/?repo=${repo}&commit=1`,
            onload (res) {
                const url = res.responseText.replace(/^lnk:/, '')
                location = url
            },
            onerror (res) {
                console.warn(`error (${res.status}) loading first commit for ${repo}: ${res.statusText}`)
            }
        })

        return false
    }
}

function addLink ($latestCommit) {
    if ($latestCommit.not(':has(#first-commit)').length) {
        const repo = $('meta[name="octolytics-dimension-repository_network_root_nwo"]')
            .attr('content')

        const $firstCommit = $(
            '<span id="first-commit">' +
                '|&nbsp;' +
                `<a id="first-commit-link" href="http://www.buhtig.com/${repo}" class="message">First commit</a>` +
            '</span>'
        )

        const $link = $firstCommit.find('#first-commit-link')

        $link.one('click', getLink(repo, $link))
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
