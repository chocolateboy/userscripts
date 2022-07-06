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

type Commits = Array<{ html_url: string }>;

const COMMIT_BAR = 'div.js-details-container[data-issue-and-pr-hovercards-enabled] > *:last-child ul'
const FIRST_COMMIT_LABEL = '<span aria-label="First commit"><strong>1st</strong> commit</span>'

 /*
  * this function extracts the URL of the repo's first commit and navigates to it.
  * it is based on code by several developers, a list of whom can be found here:
  * https://github.com/FarhadG/init#contributors
  *
  * XXX it doesn't work on private repos. a way to do that can be found here,
  * but it requires an authentication token:
  * https://gist.github.com/simonewebdesign/a70f6c89ffd71e6ba4f7dcf7cc74ccf8
  */
function openFirstCommit (user: string, repo: string) {
    return fetch(`https://api.github.com/repos/${user}/${repo}/commits`)
        // the `Link` header has additional URLs for paging.
        // parse the original JSON for the case where no other pages exist
        .then(res => Promise.all([res.headers.get('link'), res.json() as Promise<Commits>]))

        .then(([link, commits]) => {
            if (!link) {
                // if there's no link, we know we're on the only page
                return commits
            }

            // the link header contains two URLs and has the following
            // format (wrapped for readability):
            //
            //  <https://api.github.com/repositories/1234/commits?page=2>; rel="next",
            //  <https://api.github.com/repositories/1234/commits?page=9>; rel="last"

            // extract the URL of the last page (commits are ordered in
            // reverse chronological order, like the git CLI, so the oldest
            // commit is on the last page)

            const lastPage = link.match(/^.+?<([^>]+)>;/)![1]

            // fetch the last page of results
            return fetch(lastPage).then(res => res.json())
        })

        // get the last commit and navigate to its target URL
        .then((commits: Commits) => {
            if (Array.isArray(commits)) {
                location.href = commits[commits.length - 1].html_url
            } else {
                console.error(commits)
            }
        })
}

/*
 * add the "First commit" link as the last child of the commit bar
 */
function run () {
    const $commitBar = $(COMMIT_BAR)

    // bail if it's not a repo page
    if (!$commitBar.length) {
        return
    }

    // delete (i.e. replace) the (possibly inert/unresponsive) widget if it
    // already exists
    $commitBar.find('#first-commit').remove()

    /*
     * This is the first LI in the commit bar (UL), which we clone to create the
     * "First commit" widget.
     *
     *   <li class="ml-3">
     *     <a data-pjax="" href="/foo/bar/commits/master" class="link-gray-dark no-underline">
     *       <svg height="16">...</svg>
     *
     *       <span class="d-none d-sm-inline">
     *           <strong>42</strong>
     *           <span aria-label="Commits on master">commits</span>
     *       </span>
     *     </a>
     *   </li>
     */

    // create it
    const $firstCommit = $commitBar
        .find('li')
        .eq(0)
        .clone()
        .attr('id', 'first-commit')

    const $link = $firstCommit
        .find('a')
        .removeAttr('href')
        .css('cursor', 'pointer')

    const $label = $(FIRST_COMMIT_LABEL)

    $link.find(':scope > span').empty().append($label)

    // @ts-ignore
    const [user, repo] = $('meta[name="octolytics-dimension-repository_network_root_nwo"]')
        .attr('content')
        .split('/')

    $link.on('click', () => {
        $label.text('Loading...')
        openFirstCommit(user, repo)
        return false // stop processing the click
    })

    $commitBar.append($firstCommit)
}

// run on navigation (including full page loads)
$(document).on('turbo:load' as any, run)
