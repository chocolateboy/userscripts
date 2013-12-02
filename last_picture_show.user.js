// ==UserScript==
// @name          Last Picture Show
// @description   Link last.fm library images directly to the image page
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.2.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.last.fm/*
// @include       http://cn.last.fm/*
// @include       http://www.lastfm.tld/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
// @grant         GM_log
// ==/UserScript==

/*
 * @requires:
 *
 * jQuery 2.0.3
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
 */

/*
    Thumbnail:    http://userserve-ak.last.fm/serve/xyz/{image_id}.png
    Picture page: http://www.last.fm/music/Artist+Name/+images/{image_id}

    Before:

        <ul class=" libraryItems artistsLarge">
            <li class=" first" id="li_id">
                <a href="/music/Artist+Name">
                    <span class="pictureFrame">
                        <span class="image">
                            <img alt="" src="http://userserve-ak.last.fm/serve/xyz/{image_id}.png" height="126" width="126">
                        </span>
                        <span class="overlay"></span>
                    </span>
                    <strong class="name">Artist Name</strong>
                </a>
                <a href="/user/username/library/music/Artist+Name?from=timestamp&amp;rangetype=range" class="plays" rel="nofollow">
                    <span dir="ltr">(123&nbsp;plays)</span>
                </a>
            </li>
            <li>...</li> <!-- etc. -->
        </ul>

    After:

        <ul class=" libraryItems artistsLarge">
            <li class=" first" id="li_id">
                <a href="/music/Artist+Name/+images/{image_id}">
                    <span class="pictureFrame">
                        <span class="image">
                            <img alt="" src="http://userserve-ak.last.fm/serve/xyz/{image_id}.png" height="126" width="126">
                        </span>
                        <span class="overlay"></span>
                    </span>
                </a>
                <a href="/music/Artist+Name">
                    <strong class="name">Artist Name</strong>
                </a>
                <a href="/user/username/library/music/Artist+Name?from=timestamp&amp;rangetype=range" class="plays" rel="nofollow">
                    <span dir="ltr">(123&nbsp;plays)</span>
                </a>
            </li>
            <li>...</li> <!-- etc. -->
        </ul>
*/

// split each link in a library page/panel (image + artist name -> artist page) into:
//
//     1) image        -> image page
//     2) artist name  -> artist page
//
// Note: we set a flag on the UL element after its children have been processed.
// This is checked for before any splits are performed, which
// ensures that navigating back to previously-viewed (PJAX) pages in the
// library view doesn't re-split (and therefore break) already-split
// links
//
// TODO add support for Similar Artists pages e.g.: http://www.last.fm/music/The+Beatles/+similar

var SPLIT_LINKS = 'split_links';

function split_links() {
    var $ul = $('ul.libraryItems');
    var seen = $ul.data(SPLIT_LINKS);

    if (!seen) {
        $ul.find('li a:first-child').each(
            function() {
                var $original_link = $(this);
                var $artist_name = $original_link.find('.name').detach();
                var $new_link = $('<a/>');
                var artist_page = $original_link.attr('href');
                var image_id = $original_link.find('img').attr('src').match(/(\d+)\.\w+$/)[1];
                var image_page = artist_page + '/+images/' + image_id;

                $original_link.attr('href', image_page);
                $new_link.attr('href', artist_page).append($artist_name).insertAfter($original_link);
            }
        );

        $ul.data(SPLIT_LINKS, true);
    }
}

$(window).on('hashchange', split_links); // deal with PJAX on the library page
split_links();
