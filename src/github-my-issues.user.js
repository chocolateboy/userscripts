// ==UserScript==
// @name          GitHub My Issues
// @description   Add a link to issues you've contributed to on GitHub
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.1.1
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

const ID = 'my-issues'
const meta = (name, key = 'name') => $(`meta[${key}=${JSON.stringify(name)}]`).attr('content')

function main (type) {
    const self = meta('user-login')
    const $issues = $('[aria-label="Global"] a[href="/issues"]')

    // if we're here via a pjax load, there may be an existing "My Issues" link
    // from a previous page load: remove it
    $(`#${ID}`).remove()

    // console.log(`XXX page (${type}):`, location.href)

    if (self && $issues.length === 1) {
        let path = '/issues', query = `involves:${self}`, prop

        if (prop = meta('octolytics-dimension-repository_nwo')) { // user/repo
            path = `/${prop}/issues`
        } else if (prop = $('[data-pjax="#js-repo-pjax-container"]').attr('href')) {
            path = `${prop}/issues`
        } else if (prop = meta('profile:username', 'property')) { // user
            query = [`user:${prop}`, query].join('+')
        }

        const href = `${path}?q=${escape(query)}`
        const $link = $issues.clone()
            .attr({ href, 'data-hotkey': 'g I', id: ID })
            .text('My Issues')

        $issues.after($link)
    }
}

// navigation between pages on GitHub is a mixture of full page requests and
// partial requests (pjax [1]). we detect the latter by detecting the
// modification of the page's TITLE element.
//
// in the pjax case we need to take care not to keep adding "My Issues"
// links.
//
// [1] https://github.com/defunkt/jquery-pjax

main('page')
$('html > head > title').onText(() => main('pjax'), true /* multi */)
