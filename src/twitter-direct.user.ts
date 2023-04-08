// ==UserScript==
// @name          Twitter Direct
// @description   Remove t.co tracking links from Twitter
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.3.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @run-at        document-start
// ==/UserScript==

import { Transformer } from './twitter-direct/transformer'

/*
 * a list of document URIs (paths) which are known to not contain t.co URLs and
 * which therefore don't need to be transformed
 */
const URL_BLACKLIST = new Set([
    '/hashflags.json',
    '/badge_count/badge_count.json',
    '/graphql/articleNudgeDomains',
    '/graphql/TopicToFollowSidebar',
])

Transformer.register({ urlBlacklist: URL_BLACKLIST })
