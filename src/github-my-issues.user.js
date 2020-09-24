// ==UserScript==
// @name          GitHub My Issues
// @description   Add a link to issues you've contributed to on GitHub
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.0.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://github.com/
// @include       https://github.com/*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/eclecto/jQuery-onMutate@79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @grant         GM_log
// @inject-into   auto
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

// value of the ID attribute for the "My Issues" link. used to identify an
// existing link so it can be removed on pjax page loads
const ID = 'my-issues'

// selector for the "Issues" link which we clone the "My Issues" link from and
// append to
const ISSUES = '[aria-label="Global"] a[href="/issues"]'

// text for the "My Issues" link
const MY_ISSUES = 'My Issues'

// meta tag selector for the `<user>/<repo>` identifier on full pages
const PAGE_REPO = 'octolytics-dimension-repository_nwo'

// meta tag selector for the `/<user>/<repo>` identifier on pjax pages
const PJAX_REPO = '[data-pjax="#js-repo-pjax-container"]'

// meta tag selector for the name of the logged-in user
const SELF = 'user-login'

// meta tag selector for the username on a profile page
const USER = 'profile:username'

// helper function which extracts a value from a meta tag
function meta (name, key = 'name') {
    const quotedName = JSON.stringify(name)
    return $(`meta[${key}=${quotedName}]`).attr('content')
}

// handler which adds the "My Issues" link. called either a) on page load (full)
// or b) pjax load (partial)
function main (type) {
    const self = meta(SELF)
    const $issues = $(ISSUES)

    // if we're here via a pjax load, there may be an existing "My Issues" link
    // from a previous page load: remove it
    $(`#${ID}`).remove()

    // console.log(`XXX page (${type}):`, location.href)

    if (self && $issues.length === 1) {
        let path = '/issues', query = `involves:${self}`, prop

        if (prop = meta(PAGE_REPO)) { // user/repo
            path = `/${prop}/issues`
        } else if (prop = $(PJAX_REPO).attr('href')) { // /user/repo
            path = `${prop}/issues`
        } else if (prop = meta(USER, 'property')) { // user
            if (prop === self) { // own homepage
                // user:<self> involves:<self> is:open archived:false
                query = [`user:${prop}`, query, 'is:open', 'archived:false']
            } else { // other user's homepage
                // user:<user> involves:<self>
                query = [`user:${prop}`, query]
            }

            query = query.join('+')
        }

        const href = `${path}?q=${escape(query)}`
        const $link = $issues.clone()
            .attr({ href, 'data-hotkey': 'g I', id: ID })
            .text(MY_ISSUES)

        $issues.after($link)
    }
}

// navigation between pages on GitHub is a mixture of full-page requests and
// partial requests (pjax [1]). we detect the latter by detecting the
// modification of the page's TITLE element.
//
// in the pjax case, we need to take care not to keep adding "My Issues" links.
//
// [1] https://github.com/defunkt/jquery-pjax

$('html > head > title').onText(() => main('pjax'), true /* multi */)
main('page')
