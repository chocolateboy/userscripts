// ==UserScript==
// @name          GitHub My Issues
// @description   Add a contextual link to issues you've contributed to on GitHub
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.1.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://github.com/
// @include       https://github.com/*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.5/dist/cash.min.js
// @grant         GM_addStyle
// ==/UserScript==

import { observe } from './lib/observer.js'

/*
 * unique ID for the "My Issues" link element
 */
const ID = 'my-issues-link'

/*
 * selector for the "Issues" link. we navigate up from this to its parent
 * tab, which we clone the "My Issues" tab from and append to.
 */
const ISSUES_LINK = 'a[data-react-nav="issues-react"]'

/*
 * text of the "My Issues" link
 */
const MY_ISSUES = 'My Issues'

/*
 * selector for the added "My Issues" link. used to identify an existing link so
 * it can be reused for SPA navigation
 */
const MY_ISSUES_LINK = `a#${ID}`

/*
 * return true if we're on the "My Issues" page, false otherwise.
 */
const pageIsMyIssues = (issuesPath: string, myIssues: string): boolean => {
    if (location.pathname === issuesPath) { // "Issues" or "My Issues"
        const q = URL.parse(location.href)!.searchParams.get('q')
        return !!q && q.trim().split(/\s+/).includes(myIssues)
    }

    return false
}

/*
 * add/restore the "My Issues" link
 */
const addLink = () => {
    const $issuesLink = $<HTMLAnchorElement>(`li > ${ISSUES_LINK}`)

    if ($issuesLink.length !== 1) {
        console.debug('no issues link:', $issuesLink.length)
        return
    }

    const $issuesTab = $issuesLink.closest('li')
    const self = $('meta[name="user-login"]').attr('content')

    if (!self) {
        console.debug('no logged-in user')
        return
    }

    const [user, repo] = location.pathname.slice(1).split('/')

    if (!(repo && user)) {
        console.debug('no user/repo')
        return
    }

    const myIssues = `involves:${self}`
    const issuesPath = `/${user}/${repo}/issues`

    let $myIssuesLink = $<HTMLAnchorElement>(`li > ${MY_ISSUES_LINK}`)

    // create it if it doesn't exist yet/has been removed
    if ($myIssuesLink.length === 0) {
        console.debug('adding My Issues tab')

        const $myIssuesTab = $issuesTab.clone()
        const subqueries = [myIssues, 'sort:updated-desc']

        if (user === self) { // own repo
            // state:open archived:false involves:<self> ...
            subqueries.unshift('state:open', 'archived:false')
        }

        const query = subqueries.join('+')
        const href = `${issuesPath}?q=${escape(query)}`

        $myIssuesLink = $myIssuesTab.find<HTMLAnchorElement>(`:scope ${ISSUES_LINK}`)

        $myIssuesLink
            .removeClass('deselected')
            .attr({
                id: ID,
                role: 'tab',
                href,
                'aria-current': null,
                'data-hotkey': 'g I',
                'data-react-nav': null,
                'data-selected-links': null,
                'data-tab-item': 'my-issues',
            })

        $myIssuesLink.find(':scope [data-content="Issues"]').text(MY_ISSUES)
        $myIssuesLink.find(':scope [data-component="counter"]').hide()

        $issuesTab.after($myIssuesTab)
    }

    updateLink(issuesPath, myIssues, $issuesLink, $myIssuesLink)
}

/*
 * update the "Issues" and "My Issues" tabs to reflect the current page
 */
const updateLink = (
    issuesPath: string,
    myIssues: string,
    $issuesLink: JQuery<HTMLAnchorElement>,
    $myIssuesLink: JQuery<HTMLAnchorElement>,
) => {
    if (pageIsMyIssues(issuesPath, myIssues)) { // "MyIssues"
        $myIssuesLink.attr('aria-selected', 'true')
        $issuesLink.addClass('deselected')
    } else { // any other page, e.g. "Issues", "Pull requests", etc.
        $myIssuesLink.attr('aria-selected', 'false')
        $issuesLink.removeClass('deselected')
    }
}

GM_addStyle(`
    .deselected::after {
        background: transparent !important;
    }
`)

observe(document.documentElement, () => {
    if (document.querySelector('[partial-name="global-nav-bar"].loaded')) {
        addLink()
    }
})
