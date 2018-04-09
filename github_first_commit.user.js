// ==UserScript==
// @name          GitHub First Commit
// @description   Add a link to a GitHub repo's first commit
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       2.3.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://github.com/
// @include       https://github.com/*
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.rawgit.com/pie6k/jquery.initialize/16342abd3d411a20d35390f3e4c966ceb37ec43e/jquery.initialize.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

const COMMIT_BAR = 'div.commit-tease.js-details-container > span.float-right'

const FIRST_COMMIT =
    `<span id="first-commit">
        |&nbsp;
        <a id="first-commit-link" style="cursor: pointer" class="message">First commit</a>
    </span>`

// this function extracts the URL of the repo's first commit and navigates to it.
// it is based on code by several developers, a list of whom can be found here:
// https://github.com/FarhadG/init#contributors
//
// XXX it doesn't work on private repos. a way to do that can be found here,
// but it requires an authentication token:
// https://gist.github.com/simonewebdesign/a70f6c89ffd71e6ba4f7dcf7cc74ccf8
function openFirstCommit (user, repo) {
    return fetch(`https://api.github.com/repos/${user}/${repo}/commits`)
        // the `Link` header has additional URLs for paging.
        // parse the original JSON for the case where no other pages exist
        .then(res => Promise.all([res.headers.get('link'), res.json()]))

        .then(([link, commits]) => {
            if (link) {
                // the link header contains two URLs and has the following
                // format (wrapped for readability):
                //
                //     <https://api.github.com/repositories/1234/commits?page=2>;
                //     rel="next",
                //     <https://api.github.com/repositories/1234/commits?page=9>;
                //     rel="last"

                // extract the URL of the last page (commits are ordered in
                // reverse chronological order, like the CLI, so the oldest
                // commit is on the last page)
                const lastPage = link.match(/^.+?<([^>]+)>;/)[1]

                // fetch the last page of results
                return fetch(lastPage).then(res => res.json())
            }

            // if there's no link, we know we're on the only page
            return commits
        })

        // get the last commit and extract the target URL
        .then(commits => commits[commits.length - 1].html_url)

        // navigate there
        .then(url => location.href = url)
}

// add the "First commit" link as the last child of the commit bar
function addLink () {
    const $commitBar = $(this)
    const [user, repo] = $('meta[name="octolytics-dimension-repository_network_root_nwo"]')
        .attr('content')
        .split('/')

    // the "First commit" link already exists when navigating to a repo's
    // homepage via the back button. however, resurrecting the link in this way
    // causes its onclick event handler to be unregistered (XXX why?), so we
    // still need to re-attach it
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
// for users who aren't logged in. for logged-in users, it's loaded dynamically
// via an <include-fragment> custom element:
//
//     https://github.com/github/include-fragment-element
//
// jquery.initialize fires the callback immediately if the element already exists,
// so it handles both cases
$.initialize(COMMIT_BAR, addLink)
