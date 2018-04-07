// ==UserScript==
// @name          Last Picture Show
// @description   Link last.fm artist/album images directly to the image page
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       1.1.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.last.fm/*
// @include       https://*.last.fm/*
// @include       http://*.lastfm.tld/*
// @include       https://*.lastfm.tld/*
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.rawgit.com/eclecto/jQuery-onMutate/79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

/*
    Thumbnail:    https://lastfm-img2.akamaized.net/i/u/300x300/{imageId}.jpg
    Picture page: https://www.last.fm/music/Artist+Name/+images/{imageId}

    before:

        <div class="grid-items-cover-image js-link-block link-block">
            <div class="grid-items-cover-image-image">
                <!-- XXX wrap this image in a link -->
                <img
                    src="https://lastfm-img2.akamaized.net/i/u/300x300/1ce40dc1f3ec52cb78efb9f0ae54dddd.jpg"
                    alt="Image for 'Ellie Goulding'"
                />
            </div>

            <div class="grid-items-item-details">
                <p class="grid-items-item-main-text">
                    <!-- XXX grab the path prefix from here -->
                    <a href="/music/Ellie+Goulding" class="link-block-target">Ellie Goulding</a>
                </p>
                <p class="grid-items-item-aux-text">
                    1,783,906 <span class="stat-name">listeners</span>
                </p>
            </div>
            ...
        </div>

    after:

        <div class="grid-items-cover-image js-link-block link-block">
            <div class="grid-items-cover-image-image">
                <a href="/music/Ellie+Goulding/+images/1ce40dc1f3ec52cb78efb9f0ae54dddd">
                    <img
                        src="https://lastfm-img2.akamaized.net/i/u/300x300/1ce40dc1f3ec52cb78efb9f0ae54dddd.jpg"
                        alt="Image for 'Ellie Goulding'"
                    />
                </a>
            </div>

            <div class="grid-items-item-details">
                <p class="grid-items-item-main-text">
                    <a href="/music/Ellie+Goulding" class="link-block-target">Ellie Goulding</a>
                </p>
                <p class="grid-items-item-aux-text">
                    1,783,906 <span class="stat-name">listeners</span>
                </p>
            </div>
            ...
        </div>
*/

// XXX don't include the images in "Similar Tracks" grids. those images are
// located in album (or release) "subfolders" e.g.:
//
//   - image: https://lastfm-img2.akamaized.net/i/u/300x300/fafc74a8f45241acc10158be6e2d8270.jpg
//   - track: https://www.last.fm/music/The+Beatles/_/Doctor+Robert
//   - image page: https://www.last.fm/music/The+Beatles/Revolver/+images/fafc74a8f45241acc10158be6e2d8270
//
// but last.fm doesn't include any additional data in the "Similar Tracks"
// grids which can be used to identify the release (e.g. "Revolver").
//
// XXX last.fm doesn't distinguish the "Similar Tracks" grid from the "Similar
// Artists" grid in any way (same markup and CSS), so we have to identify
// (and exclude) it as "section 1 of 2 in the similar-tracks-and-artists row"
const GRID_ITEMS = '.grid-items-cover-image:not(.similar-tracks-and-artists-row section:nth-of-type(1) .grid-items-cover-image)'

function onItems ($items) {
    $items.each(function () {
        const $item = $(this)
        const $image = $item.find('.grid-items-cover-image-image img[src]')
        const imageId = $image.attr('src').match(/\/([^/.]+)\.\w+$/)[1]
        const path = $item.find('a.link-block-target[href]').attr('href')

        $image.wrap(`<a href="${path}/+images/${imageId}"></a>`)
    })
}

$.onCreate(GRID_ITEMS, onItems, true /* multi */)
