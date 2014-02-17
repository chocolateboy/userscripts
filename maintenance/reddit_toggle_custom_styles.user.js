// ==UserScript==
// @name           Reddit - Toggle Custom Styles
// @description    Enable/disable subreddit-specific CSS, flair and thumbnails
// @author         DEADBEEF.
// @maintainer     chocolateboy
// @namespace      https://github.com/chocolateboy/userscript
// @include        http://reddit.com/r/*
// @include        https://reddit.com/r/*
// @include        http://*.reddit.com/r/*
// @include        https://*.reddit.com/r/*
// @version        1.1.0
// @run-at         document-start
// @grant          none
// ==/UserScript==

// original: http://userscripts.org/scripts/show/109818

function ssMain() {
    var key   = 'ss-' + reddit.post_site, // post_site: subreddit ID e.g. watch_dogs
        value = localStorage.getItem(key) || 0;

    // Add buttons
    $('div.titlebox span.fancy-toggle-button').after(
        '<span style="" class="fancy-toggle-button toggle"><a tabindex="100" href="javascript:void(0)" style="margin-left:-5px" class="custom-css active add remove">css</a></span>' +
        '<span style="" class="fancy-toggle-button toggle"><a tabindex="100" href="javascript:void(0)" style="margin-left:-5px" class="custom-flair active add remove">flair</a></span>' +
        '<span style="" class="fancy-toggle-button toggle"><a tabindex="100" href="javascript:void(0)" style="margin-left:-5px" class="custom-thumbs active add remove">thumbs</a></span><div />'
    );

    // Add button actions
    $('a.custom-css').click(function() {
        value ^= 1;
        localStorage.setItem(key, value);
        set();
    });

    $('a.custom-flair').click(function() {
        value ^= 2;
        localStorage.setItem(key, value);
        set();
    });

    $('a.custom-thumbs').click(function() {
        value ^= 4;
        localStorage.setItem(key, value);
        set();
    });

    function set() {
        // Get bitmask values
        var disableCss    = !!(value & 1),
            disableFlair  = !!(value & 2),
            disableThumbs = !!(value & 4);

        // Show/hide things
        $('link[title="applied_subreddit_stylesheet"]').prop('disabled', disableCss);
        $('span.flair').css('display', disableFlair ? 'none' : 'inline-block');
        $('a.thumbnail').css('display', disableThumbs ? 'none' : 'block');

        // Set button state
        $('a.custom-css').toggleClass('add', disableCss);
        $('a.custom-flair').toggleClass('add', disableFlair);
        $('a.custom-thumbs').toggleClass('add', disableThumbs);
    };

    set();

    // Add callbacks for flowwit script
    window.flowwit = window.flowwit || [];
    window.flowwit.push(set);
}

// Add script to the page
document.addEventListener('DOMContentLoaded', function(e) {
    var script = document.createElement('script');
    script.textContent = '(' + ssMain.toString() + ')();';
    document.head.appendChild(script)
});

// Add CSS as soon as the head element exists (prevents jumping)
(function loadCSS() {
    var stylesheet = document.querySelector('link[title="applied_subreddit_stylesheet"]');

    if (!stylesheet) {
        return setTimeout(loadCSS);
    }

    var key   = 'ss-' + location.pathname.match(/\/r\/(\w+)/)[1],
        value = localStorage.getItem(key) || 0;

    var disableCss    = !!(value & 1),
        disableFlair  = !!(value & 2),
        disableThumbs = !!(value & 4);

    stylesheet.disabled = disableCss;

    var style = document.createElement('style');
    style.textContent = 'span.flair { display: ' + (disableFlair ? 'none' : 'inline-block') + ' } a.thumbnail { display: ' + (disableThumbs ? 'none' : 'block') + ' }';
    document.head.appendChild(style);
})();
