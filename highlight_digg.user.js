// ==UserScript==
// @name          Digg Highlighter
// @description   Highlight new stories on Digg
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.9.1
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
    ttl: { days: 4 },
    item: function () {
        return $('article[data-content-id][data-primary-tag-slug]')
            .not('[data-primary-tag-slug="apps-we-digg"]')
            .not('[data-primary-tag-slug="digg-picks"]')
            .not('[data-primary-tag-slug="digg-store"]')
            .not('[data-content-id="2bcqtJ7"]') // [1]
    },
    target: 'a.digg-story__title-link',
    id: 'data-content-id'
});

// [1] The "Donald Trump News" channel is the only remaining
// non-news article with a data-primary-tag-slug attribute,
// so we need something else to exclude it from highlighting.
// we can't use the slug ("donaldtrump") as that's also used
// for Trump-related news articles, so we use its unique ID
