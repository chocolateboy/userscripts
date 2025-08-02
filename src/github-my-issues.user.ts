// ==UserScript==
// @name          GitHub My Issues
// @description   Add a contextual link to issues you've contributed to on GitHub
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.1.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://github.com/
// @include       https://github.com/*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.5/dist/cash.min.js
// @grant         GM_addStyle
// @run-at        document-start
// ==/UserScript==

/*
 * the ID of the "My Issues" link.
 */
const ID = 'my-issues-tab'

/*
 * selector for the "Issues" link. we navigate up from this to its parent
 * tab, which we clone the "My Issues" tab from and append to.
 */
const ISSUES_LINK = 'a#issues-tab'

/*
 * text of the "My Issues" link
 */
const MY_ISSUES = 'My Issues'

/*
 * selector for the added "My Issues" link. used to identify an existing link so
 * it can be removed on pjax page loads
 */
const MY_ISSUES_LINK = `li a#${ID}`

/*
 * add the "My Issues" link
 */
const run = () => {
    // if we're here via a pjax load, there may be an existing "My Issues" link
    // from a previous page load. we can't reuse it as it may no longer be
    // required or in a valid state, so we just replace it
    $(MY_ISSUES_LINK).closest('li').remove()

    const $issuesLink = $(`li ${ISSUES_LINK}`)
    const $issues = $issuesLink.closest('li')

    if ($issues.length !== 1) {
        return
    }

    const self = $('meta[name="user-login"]').attr('content')
    const repo = $('[data-current-repository]').data('currentRepository')
    const user = repo?.split('/')?.at(0)

    if (!(self && repo && user)) {
        return
    }

    const myIssues = `involves:${self}`
    const subqueries = [myIssues, 'sort:updated-desc']

    if (user === self) { // own repo
        // is:open archived:false involves:<self> ...
        subqueries.unshift('is:open', 'archived:false')
    }

    const query = subqueries.join('+')
    const path = `/${repo}/issues`
    const href = `${path}?q=${escape(query)}`
    const $myIssues = $issues.clone()
    const $link = $myIssues
        .find(`:scope ${ISSUES_LINK}`)
        .removeClass('selected deselected')
        .attr({
            id: ID,
            role: 'tab',
            href,
            'aria-current': null,
            'data-hotkey': 'g I',
            'data-selected-links': null,
        })

    $link.find(':scope [data-content="Issues"]').text(MY_ISSUES)
    $link.find(':scope [id="issues-repo-tab-count"]').remove()

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

    $issues.after($myIssues)
}

GM_addStyle(`
    .deselected::after {
        background: transparent !important;
    }
`)

// run on navigation (including full page loads)
$(document).on('turbo:load', run)
