// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.0.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.google.tld/*tbm=isch*
// @include       https://encrypted.google.tld/*tbm=isch*
// @include       https://www.google.tld/*tbm=isch*
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.jsdelivr.net/gh/eclecto/jQuery-onMutate@79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
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

        // there are two layouts for image-search results:
        //
        // 1) new (?) (private browsing mode seems to trigger it): has a
        // dimensions tooltip (e.g. "800 x 600") in the bottom left-hand corner
        // of the image and a footer (link) below the image with the page name
        // and the domain in separate DIV elements
        //
        // 2) legacy (?): no footer below the image, but the tooltip includes
        // the domain name (e.g. "800 x 600 - example.com")
        //
        // in the first case, we only need to fix the existing link (footer)
        // i.e. we don't need to linkify the tooltip. in the second case, we
        // wrap the tooltip in a link and assign it the page URL

        const $footerLink = $container.find('a.irc-nic')

        if ($footerLink.length) {
            // 1) set the footer link's href to the page URL
            $footerLink.removeAttr('jsaction').attr('href', meta.ru)
        } else {
            // 2) wrap the tooltip in a link whose href points to the page URL
            $imageLink.find('.rg_ilmbg').wrap(
                $('<a></a>').attr('href', meta.ru)
            )
        }
    })
}

$.onCreate('a.rg_l', onImageLinks, true /* multi */)
