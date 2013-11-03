// ==UserScript==
// @name           latest.fm
// @namespace      http://chocolatey.com/code/js
// @description    Update the page title to reflect the currently-playing track on Last.fm
// @author         chocolateboy <chocolate@cpan.org>
// @include        http://*.last.fm/listen/*
// @include        http://last.fm/listen/*
// @version        0.05 2008-07-30
// ==/UserScript==
//

/*
 * 0.05 2008-07-30: fix typo
 * 0.04 2008-07-30: cleanup
 * 0.03 2008-07-30: fix binding
 * 0.02 2008-07-30: updated to work with latest version of Last.fm (20080711)
 * 0.01 2008-03-01: initial release
 */

if (unsafeWindow.LFM) {
    var $original_title = document.title;
    var $player = unsafeWindow.LFM.Flash.Player;

    $player.onNextTrack = function ($track, $unused) {
        document.title = $track.creator + ' - ' + $track.name;
        $player.context.onNextTrack($track)
    };

    $player.onStopTrack = function () {
        document.title = $original_title;
        $player.context.onStopTrack();
    };
}
