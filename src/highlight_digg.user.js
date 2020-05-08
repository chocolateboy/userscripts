// ==UserScript==
// @name          Digg Highlighter
// @description   Highlight new stories on Digg
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.1.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://digg.com/
// @require       https://code.jquery.com/jquery-3.5.0.min.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/jquery-highlighter@63adeb7dea43c47e210fd17b0589e648239e97f0/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_listValues
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// @inject-into   content
// ==/UserScript==

const ITEMS = ['featured', 'vertical']
    .map(it => `article[data-id].fp-${it}-story`)
    .join(', ')

$.highlight({
    ttl: { days: 4 },
    item () {
        return $(ITEMS).has('[itemprop="alternativeHeadline"][style="color:"]')
    },
    target: '[itemprop="headline"]',
    id: 'data-id'
})
