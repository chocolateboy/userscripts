// ==UserScript==
// @name          YouTube Sidebar: Hide Recommended Videos
// @description   Remove "Recommended for you" videos from the YouTube video sidebar
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.0.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.youtube.com/watch*
// @include       http://youtube.com/watch*
// @include       https://www.youtube.com/watch*
// @include       https://youtube.com/watch*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
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
    <a class="related-video">
        <span class="attribution">
            by <span class="yt-user-name">username</span>
        </span>
        ...
        <span class="attribution">Recommended for you</span>
    </a>
*/

// see also:
//
//     http://userscripts.org/scripts/show/154755
//     http://userscripts.org/topics/123693

// remove each a.related-video that contains a 2nd (:eq is 0-based) span.attribution
$('a.related-video').has('span.attribution:eq(1)').hide();
