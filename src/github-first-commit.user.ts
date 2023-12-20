// ==UserScript==
// @name          GitHub First Commit
// @description   Add a link to a GitHub repo's first commit
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.1.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://github.com/
// @include       https://github.com/*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.5/dist/cash.min.js
// @grant         GM_log
// @noframes
// @run-at        document-start
// ==/UserScript==

import FirstCommit         from './github-first-commit/first-commit.js'
import FirstCommitLoggedIn from './github-first-commit/first-commit-logged-in.js'

const LOCATION   = 'meta[name="analytics-location"][content]'
const TIMEOUT    = 1_000 // 1 second
const USER_LOGIN = 'meta[name="user-login"][content]:not([content=""])'

const main = () => {
    const state = { generation: 0 } // bumped when we navigate to a new page
    const anonHandler = new FirstCommit(state, { timeout: TIMEOUT })
    const loggedInHandler = new FirstCommitLoggedIn(state, { timeout: TIMEOUT })

    $(window).on('turbo:load', (event: Event) => {
        ++state.generation

        const path = document.querySelector<HTMLMetaElement>(LOCATION)?.content
        const isRepoPage = path === '/<user-name>/<repo-name>'

        console.log('inside turbo:load', {
            path,
            repo: isRepoPage,
            ...state,
            event,
        })

        if (!isRepoPage) {
            console.log('skipping: non-repo page')
            return
        }

        const isLoggedIn = document.querySelector(USER_LOGIN)
        const handler = isLoggedIn ? loggedInHandler : anonHandler

        handler.onLoad(event)
    })
}

console.debug('inside:', GM_info.script.name)
main()
