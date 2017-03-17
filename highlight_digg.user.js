// ==UserScript==
// @name          Digg Highlighter
// @description   Highlight new stories on Digg
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.8.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://digg.com/
// @include       https://digg.com/
// @require       https://code.jquery.com/jquery-3.2.0.min.js
// @require       https://cdn.rawgit.com/chocolateboy/jquery-highlighter/v1.0.0/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({
    ttl:    { days: 4 },
    item:   function () {
        return $('article[data-content-id][data-primary-tag-slug]')
            .not('[data-primary-tag-slug="apps-we-digg"]')
            .not('[data-primary-tag-slug="digg-picks"]')
            .not('[data-primary-tag-slug="digg-store"]')
            .not('[data-primary-tag-slug="donaldtrump"]')
    },
    target: 'a.digg-story__title-link',
    id:     'data-content-id'
});
