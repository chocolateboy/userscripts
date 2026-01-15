// ==UserScript==
// @name          GitHub My Issues
// @description   Add a contextual link to issues you've contributed to on GitHub
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.3.0
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
 * add the "My Issues" link
 */
const run = () => {
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

    let $myIssues = $(`li ${MY_ISSUES_LINK}`).closest('li')
    let $link: JQuery<HTMLAnchorElement>
    let created = false

    if ($myIssues.length) {
        $link = $myIssues.find(`:scope ${MY_ISSUES_LINK}`)
    } else {
        $myIssues = $issues.clone()
        $link = $myIssues.find(`:scope ${ISSUES_LINK}`)
        created = true
    }

    const myIssues = `involves:${self}`
    const path = `/${user}/${repo}/issues`

    if (created) {
        const subqueries = [myIssues, 'sort:updated-desc']

        if (user === self) { // own repo
            // is:open archived:false involves:<self> ...
            subqueries.unshift('is:open', 'archived:false')
        }

        const query = subqueries.join('+')
        const href = `${path}?q=${escape(query)}`

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

    let q: string | null = null

    if (location.pathname === path) {
        const params = new URLSearchParams(location.search)
        q = params.get('q')
    }

    if (q && q.trim().split(/\s+/).includes(myIssues)) {
        $link.attr('aria-selected', 'true')
        $issuesLink.addClass('deselected')
    } else {
        $link.attr('aria-selected', 'false')
        $issuesLink.removeClass('deselected')
    }

    if (created) {
        $issues.after($myIssues)
    }
}

GM_addStyle(`
    .deselected::after {
        background: transparent !important;
    }
`)

observe(run)
