// ==UserScript==
// @name          Digg Highlighter
// @description   Highlight new stories on Digg
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.4.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://digg.com/
// @include       https://digg.com/
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.2.2/jquery.js
// @require       https://raw.github.com/chocolateboy/userscripts/master/jquery/highlighter.js
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
            .not('[data-primary-tag-slug="digg-store"]')
    },
    target: 'a.digg-story__title-link',
    id:     'data-content-id'
});
