// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.1.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       http://www.google.tld/*tbm=isch*
// @include       https://www.google.tld/*tbm=isch*
// @require       https://code.jquery.com/jquery-3.1.1.min.js
// @require       https://cdn.rawgit.com/eclecto/jQuery-onMutate/v1.4.2/src/jquery.onmutate.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

function onImageLinks ($imageLinks) {
    $imageLinks.each(function () {
        var $imageLink = $(this).removeAttr('jsaction');
        var $container = $imageLink.closest('.rg_di');
        var meta       = JSON.parse($container.find('.rg_meta').text());

        $imageLink
            .attr('href', meta.ou)
            .find('.rg_ilm')
                .wrap($('<a></a>').attr('href', meta.ru));
    });
}

$.onCreate('a.rg_l', onImageLinks, true /* multi */);
