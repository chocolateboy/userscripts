// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.4.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.google.tld/*tbm=isch*
// @include       https://encrypted.google.tld/*tbm=isch*
// @include       https://www.google.tld/*tbm=isch*
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.rawgit.com/eclecto/jQuery-onMutate/79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

function onImageLinks ($imageLinks) {
    $imageLinks.each(function () {
        const $imageLink = $(this)
        const $container = $imageLink.closest('.rg_di')
        const meta = JSON.parse($container.find('.rg_meta').text())

        // remove the hook from the image-link to prevent it being hijacked
        $imageLink.removeAttr('jsaction')

        // set the image-link's href to the image URL rather than Google's
        // interceptor
        $imageLink.attr('href', meta.ou)

        // wrap the text at the bottom of the image (e.g. "800 x 600 - example.com")
        // in a link and set its href to the site URL
        $imageLink.find('.rg_ilmbg').wrap($('<a></a>').attr('href', meta.ru))
    })
}

$.onCreate('a.rg_l', onImageLinks, true /* multi */)
