// ==UserScript==
// @name          Pagerize MetaFilter
// @description   Mark up MetaFilter with pager metadata
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.1.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.metafilter.com/*
// @include       http://metafilter.com/*
// @include       https://*.metafilter.com/*
// @include       https://metafilter.com/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
// @require       https://raw.github.com/chocolateboy/userscripts/master/jquery/pagerizer.js
// @grant         none
// ==/UserScript==

/*
 * @requires:
 *
 * jQuery 2.0.3
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
 */

/*

   Top level:

       <p class="copy">« <a href="/index.cfm?page=3" target="_self">Older posts</a> | <a href="/index.cfm?page=1" target="_self">Newer posts</a> »</p>

   Article (these already work (with Pentadactyl)):

        <p class="copy whitesmallcopy" style="font-size:11px;">
            <a href="/124972/Im-in-love-with-Massachusetts-And-the-neon-when-its-cold-outside" target="_self">« Older</a>
            A bill to declare "Roadrunner" the official rock s...&nbsp;&nbsp;
            |
            &nbsp;&nbsp;What does ONE BILLION look lik...
            <a href="/124974/One-Billion-Rising" target="_self">Newer »</a>
        </p>
*/

// if there's only one link, it must be to an older page, since the
// oldest page (currently http://www.metafilter.com/index.cfm?page=2443)
// still has both links, even though its "Older" link target doesn't exist (yet).
// another way of looking at it is that the "Older" link appears (and
// is the first page navigation link) on every page
var $links = $('p.copy').not('.whitesmallcopy').find('a[href]');
$links.eq(0).addRel('prev'); // always exists
$links.eq(1).addRel('next'); // always exists (apart from on the first/front page)
