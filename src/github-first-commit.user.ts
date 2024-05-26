// ==UserScript==
// @name          GitHub First Commit
// @description   Add a link to a GitHub repo's first commit
// @author        chocolateboy
// @copyright     chocolateboy
// @version       4.0.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://github.com/
// @include       https://github.com/*
// @grant         GM_log
// @noframes
// ==/UserScript==

import { observe } from './lib/observer.js'

type Commits = Array<{ html_url: string }>;

/* the unique ID assigned to the first-commit widget */
const ID = 'first-commit'

/*
 * a selector for the page-type identifier, e.g. "/<user-name>/<repo-name>" or
 * "/<user-name>/<repo-name>/issues/index"
 */
const LOCATION = 'meta[name="analytics-location"][content]'

/* a selector for the owner name/repo name, e.g. "chocolateboy/userscripts" */
const USER_REPO = 'meta[name="octolytics-dimension-repository_network_root_nwo"][content]'

const $ = document

/*
 * this function extracts the URL of the repo's first commit and navigates to it.
 * it is based on code by several developers, a list of whom can be found here:
 * https://github.com/FarhadG/init#contributors
 *
 * XXX it doesn't work on private repos. a way to do that can be found here,
 * but it requires an authentication token:
 * https://gist.github.com/simonewebdesign/a70f6c89ffd71e6ba4f7dcf7cc74ccf8
 */
const openFirstCommit = (user: string, repo: string) => {
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

observe($.body, () => {
    const path = $.querySelector<HTMLMetaElement>(LOCATION)?.content
    const isRepoPage = path === '/<user-name>/<repo-name>'

    if (!isRepoPage) {
        return
    }

    // widget already exists
    if ($.getElementById(ID)) {
        return
    }

    // locate the commit-history widget (e.g. "1,234 Commits") via its clock icon
    const historyIcon = $.querySelector('svg.octicon-history')

    if (!historyIcon) {
        return
    }

    // clone and customize it
    const commitHistory = historyIcon.closest<HTMLDivElement>('div')!
    const container = commitHistory.parentElement! as HTMLDivElement
    const firstCommit = commitHistory.cloneNode(true) as HTMLDivElement
    const label = firstCommit.querySelector(':scope [data-component="text"] > *')!
    const header = firstCommit.querySelector(':scope h2')!
    const link = firstCommit.querySelector(':scope a[href]')!
    const [user, repo] = $.querySelector(USER_REPO)!.getAttribute('content')!.split('/')

    firstCommit.id = ID
    header.textContent = label.textContent = '1st Commit'
    link.removeAttribute('href')
    link.setAttribute('aria-label', 'First commit')

    // navigate to the first commit when clicked
    firstCommit.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        label.textContent = 'Loading...'
        openFirstCommit(user, repo) // async
    }, { once: true })

    // append to the commit-history widget
    container.appendChild(firstCommit)
})
