// ==UserScript==
// @name          YouTube Sidebar: Hide Recommended Videos
// @description   Remove "Recommended for you" videos from the sidebar on YouTube video pages
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       1.2.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.youtube.com/watch*
// @include       http://youtube.com/watch*
// @include       https://*.youtube.com/watch*
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

var NAVIGATE_PROCESSED = 'navigate-processed-callback';

/* recommended videos can be distinguished by the fact that
 * they have two attribution spans, rather than the usual one:
 *
 *     <li class="related-list-item">
 *         <a href="/watch?v=1234xyz" class="spf-link">
 *             <span class="attribution">
 *                 by <span class="yt-user-name">username</span>
 *             </span>
 *             ...
 *             <span class="attribution">Recommended for you</span>
 *         </a>
 *     </li>
 */
function hide_recommended() {
    $('li.related-list-item').has('span.attribution:eq(1)').hide();
}

// execute as late as possible
$(window).on('load', function() {
    hide_recommended();

    // handle AJAX page loads by wrapping the callback
    // the SPF (single page framework?) module fires after
    // the content for a new page has been retrieved and processed

    // XXX "@grant none" should allow us to use window (and disable
    // unsafeWindow), but Scriptish 0.1.11 doesn't seem to have got
    // the memo: http://wiki.greasespot.net/@grant
    var win = typeof(unsafeWindow) == 'undefined' ? window : unsafeWindow;
    var spf_config = win._spf_state.config;
    var old_callback = spf_config[NAVIGATE_PROCESSED];

    spf_config[NAVIGATE_PROCESSED] = function() {
        // apparently, try/finally (without a catch block) doesn't work in IE7.
        // solution: don't use IE7!
        try {
            if (old_callback) {
                // the return value isn't currently used, but it may be in future
                return old_callback.apply(null, arguments);
            }
        } finally {
            hide_recommended();
        }
    };
});
