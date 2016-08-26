// ==UserScript==
// @name          Pagerize MetaFilter
// @description   Mark up MetaFilter with pager metadata
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.3.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.metafilter.com/*
// @include       http://metafilter.com/*
// @include       https://*.metafilter.com/*
// @include       https://metafilter.com/*
// @require       https://code.jquery.com/jquery-3.1.0.min.js
// @require       https://raw.github.com/chocolateboy/userscripts/master/jquery/pagerizer.js
// @grant         none
// ==/UserScript==

/*
   <p class="copy">
       «
           <a href="/index.cfm?page=3" target="_self">Older posts</a>
           |
           <a href="/index.cfm?page=1" target="_self">Newer posts</a>
       »
   </p>
*/

var $links = $('p.copy').not('.whitesmallcopy').find('a[href]');

// use "previous" rather than "prev" (or both) to work around a bug in Vimperator:
// https://github.com/vimperator/vimperator-labs/pull/570
$links.eq(0).addRel('previous');
$links.eq(1).addRel('next');
