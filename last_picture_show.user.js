// ==UserScript==
// @name          Last Picture Show
// @description   Link last.fm artist/album images directly to the image page
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       1.0.3
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://*.last.fm/*
// @include       https://*.last.fm/*
// @include       http://*.lastfm.tld/*
// @include       https://*.lastfm.tld/*
// @require       https://code.jquery.com/jquery-3.2.1.min.js
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

function onItems ($items) {
    $items.each(function () {
        const $item = $(this)
        const $image = $item.find('.grid-items-cover-image-image img[src]')
        const imageId = $image.attr('src').match(/\/([^/.]+)\.\w+$/)[1]
        const path = $item.find('a.link-block-target[href]').attr('href')

        $image.wrap(`<a href="${path}/+images/${imageId}"></a>`)
    })
}

$.onCreate('.grid-items-cover-image', onItems, true /* multi */)
