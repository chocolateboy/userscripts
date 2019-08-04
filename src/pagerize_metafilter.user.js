// ==UserScript==
// @name          Pagerize MetaFilter
// @description   Mark up MetaFilter with pager metadata
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.6.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.metafilter.com/*
// @include       http://metafilter.com/*
// @include       https://*.metafilter.com/*
// @include       https://metafilter.com/*
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/jquery-pagerizer@v1.0.0/dist/pagerizer.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

/*
   <p class="copy">
       «
           <a href="/index.cfm?page=3" target="_self">Older posts</a>
           |
           <a href="/index.cfm?page=1" target="_self">Newer posts</a>
       »
   </p>
*/

var $links = $('p.copy').not('.whitesmallcopy').find('a[href]')

$links.eq(0).addRel('prev')
$links.eq(1).addRel('next')
