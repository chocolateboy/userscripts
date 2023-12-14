// ==UserScript==
// @name          GitHub First Commit
// @description   Add a link to a GitHub repo's first commit
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.0.0
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

const REPO_PATH = /^\/[^\/]+\/[^\/]+$/
const TIMEOUT = 1_000 // 1 second
const USER_LOGIN = 'meta[name="user-login"][content]:not([content=""])'

const main = () => {
    const state = { generation: 0 } // bumped when we navigate to a new page

    $(document).on('turbo:load', (event: Event) => {
        ++state.generation

        console.log('inside turbo:load', { ...state, event })

        // the metadata hasn't necessarily been updated by this stage, but the
        // location has
        if (!REPO_PATH.test(location.pathname)) {
            console.log('skipping invalid path')
            return
        }

        const isLoggedIn = document.querySelector(USER_LOGIN)
        const handler = isLoggedIn
            ? new FirstCommitLoggedIn(state, { timeout: TIMEOUT })
            : new FirstCommit(state, { timeout: TIMEOUT })

        handler.onLoad(event)
    })
}

console.debug('inside:', GM_info.script.name)
main()
