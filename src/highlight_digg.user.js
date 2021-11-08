// ==UserScript==
// @name          Digg Highlighter
// @description   Highlight new stories on Digg
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.2.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://digg.com/
// @require       https://code.jquery.com/jquery-3.6.0.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/jquery-highlighter@63adeb7dea43c47e210fd17b0589e648239e97f0/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_listValues
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

const PROMO_CHANNELS = [
    '/advertising',
    'apps-we-digg',
    'digg-pick',
    'digg-store',
    'gift-guides',
    'promotion',
]

const PROMO_SELECTOR = PROMO_CHANNELS
    .map(name => {
        const href = name.startsWith('/') ? name : `/channel/${name}`
        return `a[itemprop="keywords"][href="${href}"]`
    })
    .join(', ')

/**
 * @this {JQuery<HTMLElement>}
 */
function isArticle () {
    return !$(this).find(PROMO_SELECTOR).length
}

$.highlight({
    ttl: { days: 4 },
    item () {
        return $('article[data-id]').has('[itemprop="headline"]').filter(isArticle)
    },
    target: '[itemprop="headline"]',
    id: 'data-id'
})
