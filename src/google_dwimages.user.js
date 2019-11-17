// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.2.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://www.google.tld/*tbm=isch*
// @include       https://encrypted.google.tld/*tbm=isch*
// @require       https://code.jquery.com/jquery-3.4.1.min.js
// @require       https://cdn.jsdelivr.net/gh/eclecto/jQuery-onMutate@79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @grant         GM_log
// @inject-into   content
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

function onResults ($results) {
    $results.each(function () {
        const $result = $(this)

        // remove the actions from this DIV and all its descendant elements to
        // prevent events on these elements being intercepted
        $result.find('*').addBack().removeAttr('jsaction')

        // parse the JSON out of the attached metadata element
        const meta = JSON.parse($result.find('.rg_meta').text())

        // assign the correct URIs to the image and page links
        const $links = $result.find('a')
        const $imageLink = $links.eq(0)
        const $pageLink = $links.eq(1)

        $pageLink.attr('href', meta.ru) // page URL

        // remove another hook: links with this class automatically revert
        // changes to the href
        $imageLink.removeClass('rg_l')
        $imageLink.attr('href', meta.ou) // image URL

        // compensate for the removed style
        $imageLink.css({
            'display':  'inline-block',
            'position': 'relative',
            'overflow': 'hidden',
        })
    })
}

$.onCreate('div[data-ri][data-ved]', onResults, true /* multi */)
