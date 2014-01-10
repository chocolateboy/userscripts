// ==UserScript==
// @name           Reddit - Toggle Custom Styles
// @description    Enable/disable subreddit-specific CSS, flair and thumbnails
// @author         DEADBEEF.
// @maintainer     chocolateboy
// @namespace      https://github.com/chocolatgeboy/userscript
// @include        http://reddit.com/r/*
// @include        https://reddit.com/r/*
// @include        http://*.reddit.com/r/*
// @include        https://*.reddit.com/r/*
// @version        1.0.0
// @run-at         document-start
// @grant          GM_getValue
// @grant          GM_setValue
// ==/UserScript==

// original: http://userscripts.org/scripts/show/109818

function main() {
    var key = 'ss-' + reddit.post_site, // post_site: subreddit ID e.g. watch_dogs
    value = GM_getValue(key, 0);

    // Add buttons
    $('div.titlebox span.fancy-toggle-button').after(
        '<span style="" class="fancy-toggle-button toggle"><a tabindex="100" href="javascript:void(0)" style="margin-left:-5px" class="custom-css active remove">css</a></span>' +
        '<span style="" class="fancy-toggle-button toggle"><a tabindex="100" href="javascript:void(0)" style="margin-left:-5px" class="custom-flair active remove">flair</a></span>' +
        '<span style="" class="fancy-toggle-button toggle"><a tabindex="100" href="javascript:void(0)" style="margin-left:-5px" class="custom-thumbs active remove">thumbs</a></span><div />'
    );

    // Add button actions
    $('a.custom-css').click(function() {
        value ^= 1
    });

    $('a.custom-flair').click(function() {
        value ^= 2
    });

    $('a.custom-thumbs').click(function() {
        value ^= 4
    });

    $('a[class|="custom"]').click(function() {
        localStorage.setItem(key, value);
        set()
    });

    function set() {
        // Get bitmask values
        var css    = !(value & 1),
            flair  = !(value & 2),
            thumbs = !(value & 4);

        // Show/hide things.
        $('span.flair').css('display', flair ? 'inline-block' : 'none');
        $('a.thumbnail').css('display', thumbs ? 'block' : 'none');
        $('link[title="applied_subreddit_stylesheet"]').prop('disabled', !css);

        // Set button state
        $('a.custom-css').toggleClass('add', !css);
        $('a.custom-flair').toggleClass('add', !flair);
        $('a.custom-thumbs').toggleClass('add', !thumbs);
    };

    set();

    // Add callbacks for flowwit script
    window.flowwit = window.flowwit || [];
    window.flowwit.push(set);
}

// Add script to the page.
document.addEventListener('DOMContentLoaded', function(e) {
    var script = document.createElement('script');
    script.textContent = '(' + main.toString() + ')();';
    document.head.appendChild(script)
});

// Add CSS as soon as the head element exists (prevents jumping).
(function loadCSS() {
    if (!document.styleSheets || !document.styleSheets[1]) {
        return setTimeout(loadCSS);
    }

    var key   = 'ss-' + location.pathname.match(/\/r\/(\w+)/)[1],
        value = localStorage.getItem(key) || 0;

    document.styleSheets[1].disabled = !!(value & 1);
    var s = document.createElement('style');
    s.textContent = 'span.flair{display:' + (!(value & 2) ? 'inline-block':'none') + '}a.thumbnail{display:' + (!(value & 4) ? 'block':'none') + '}';
    document.head.appendChild(s);
})();
