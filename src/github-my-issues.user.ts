// ==UserScript==
// @name          GitHub My Issues
// @description   Add a contextual link to issues you've contributed to on GitHub
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.3.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://github.com/
// @include       https://github.com/*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.5/dist/cash.min.js
// @grant         GM_addStyle
// ==/UserScript==

import { observe } from './lib/observer.js'

/*
 * unique ID for the My Issues link element
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
 * the URL of the last visited tab
 *
 * keep track of the previous tab to debounce the MutationObserver callback
 */
let LAST_PAGE: string | undefined

/*
 * add the "My Issues" link
 */
const run = () => {
    // bail quickly if we're a) still on the same page and b) the My Issues tab still exists
    let $myIssues = $(`li ${MY_ISSUES_LINK}`).closest('li')

    const create = $myIssues.length === 0
    const currentPage = location.href

    if (!create && currentPage === LAST_PAGE) {
        return
    } else {
        LAST_PAGE = currentPage
    }

    const $issuesLink = $(`li ${ISSUES_LINK}`)
    const $issues = $issuesLink.closest('li')

    if ($issues.length !== 1) {
        console.warn('no issues tab:', $issues.length)
        return
    }

    const self = $('meta[name="user-login"]').attr('content')

    if (!self) {
        console.warn('no logged-in user')
        return
    }

    const [user, repo] = location.pathname.slice(1).split('/')

    if (!(repo && user)) {
        console.warn('no user/repo')
        return
    }

    let $link: JQuery<HTMLAnchorElement>

    if (create) {
        $myIssues = $issues.clone()
        $link = $myIssues.find(`:scope ${ISSUES_LINK}`)
    } else {
        $link = $myIssues.find(`:scope ${MY_ISSUES_LINK}`)
    }

    const myIssues = `involves:${self}`
    const issuesPath = `/${user}/${repo}/issues`

    if (create) {
        const subqueries = [myIssues, 'sort:updated-desc']

        if (user === self) { // own repo
            // is:open archived:false involves:<self> ...
            subqueries.unshift('is:open', 'archived:false')
        }

        const query = subqueries.join('+')
        const href = `${issuesPath}?q=${escape(query)}`

        $link
            .removeClass('deselected')
            .attr({
                id: ID,
                role: 'tab',
                href,
                'aria-current': null,
                'data-hotkey': 'g I',
                'data-react-nav': null,
                'data-selected-links': null,
            })

        $link.find(':scope [data-content="Issues"]').text(MY_ISSUES)
        $link.find(':scope [data-component="counter"]').hide()
    }

    if (location.pathname === issuesPath) { // Issues or My Issues
        const q = URL.parse(location.href)!.searchParams.get('q')

        if (q && q.trim().split(/\s+/).includes(myIssues)) { // My Issues
            $link.attr('aria-selected', 'true')
            $issuesLink.addClass('deselected')
        } else { // Issues
            $link.attr('aria-selected', 'false')
            $issuesLink.removeClass('deselected')
        }
    } else { // other tab, e.g. Pull requests
        $link.attr('aria-selected', 'false')
    }

    if (create) {
        $issues.after($myIssues)
    }
}

GM_addStyle(`
    .deselected::after {
        background: transparent !important;
    }
`)

observe(run)
