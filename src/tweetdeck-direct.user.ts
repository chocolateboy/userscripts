// ==UserScript==
// @name          TweetDeck Direct
// @description   Remove t.co tracking links from TweetDeck
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.1.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://tweetdeck.twitter.com/
// @include       https://tweetdeck.twitter.com/*
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @run-at        document-start
// ==/UserScript==

import { Transformer as BaseTransformer } from './twitter-direct/transformer'
import { Dict }                           from './twitter-direct/util'

const INIT = { childList: true, subtree: true }

const SELECTOR = [
    'a[href][data-full-url]:not([data-fixed])',
    '.mdl .med-tray a[href^="https://t.co/"]:not([data-fixed])',
].map(it => `:scope ${it}`).join(', ')

/*
 * a list of document URIs (paths) which are known to not contain t.co URLs and
 * which therefore don't need to be traversed
 */
const URL_BLACKLIST = new Set([
    '/search/typeahead.json',
    '/trends/available.json',
    '/blocks/ids.json',
    '/lists/ownerships.json',
    '/mutes/users/ids.json',
    '/tweetdeck/clients/blackbird/all',
    '/account/verify_credentials.json',
    '/trends/plus.json',
    '/collections/list.json',
    '/help/settings.json',
])

class Transformer extends BaseTransformer {
    /*
     * don't expand URLs whose expansion is handled by/available in the UI
     * (via a data-full-url attribute on the link)
     */
    protected isWritable (context: Dict) {
        return !('indices' in context)
    }
}

// register a MutationObserver to expand the links in the UI that aren't
// expanded in the JSON
const run = () => {
    const target = document.body

    const replace = () => {
        // we don't modify the tree so there's no need to suspend the
        // MutationObserver

        for (const link of target.querySelectorAll<HTMLAnchorElement>(SELECTOR)) {
            if (link.dataset.fullUrl) {
                link.href = link.dataset.fullUrl
                link.dataset.fixed = 'true'
            } else {
                const tweet = link.closest('.mdl')!.querySelector(':scope .med-tweet')

                if (tweet) {
                    const tweetLink = tweet.querySelector<HTMLAnchorElement>(':scope time a[href]')!

                    if (tweetLink) {
                        link.href = tweetLink.href
                        link.dataset.fixed = 'true'
                    }
                }
            }
        }
    }

    replace()
    new MutationObserver(replace).observe(target, INIT)
}

window.addEventListener('DOMContentLoaded', run)

Transformer.register({ urlBlacklist: URL_BLACKLIST })
