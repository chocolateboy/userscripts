// ==UserScript==
// @name           reddit.com - IAmA Filter
// @include        *.reddit.com/*
// @run-at         document-start
// @author         DEADBEEF.
// @maintainer     chocolateboy
// @version        1.1.0
// ==/UserScript==

// original: http://userscripts.org/scripts/show/125260

function iamafilter() {
    if ((!reddit.post_site || !$('body.comments-page').length || !document.title.match(/\b(i?ama|ilivein)\b/i) || document.title.match(/'\bi?ama request\b/i)) && reddit.post_site != 'redditoroftheday') return;

    // Get OP
    var OP = $('#siteTable .author').first().text();
    if (reddit.post_site == 'redditoroftheday') {
        OP = $('.linklisting .md a[href*="/user/"]:first').text();
        $('.thing a.author[href$="' + OP + '"]').css({
            backgroundColor: '#5F99CF',
            color: 'white',
            padding: '0 2px',
            '-moz-border-radius': '3px',
            'border-radius': '3px'
        });
    }

    // Add buttons
    $('.tabmenu').append(' <li> </li> <li class="qad-q"><a title="Show questions only" href="javascript:void(0)">Q</a></li><li class="qad-a"><a title="Show questions and answers only" href="javascript:void(0)">A</a></li><li class="qad-d selected"><a title="Show questions, answers and discussion (default)" href="javascript:void(0)">D</a></li>');

    // Add button actions
    $('.tabmenu li[class|=qad] a').click(function() {
        $('div.thing').show();
        $('.tabmenu li[class|=qad]').removeClass('selected');
        $(this).parent().addClass('selected')
    });

    $('.tabmenu li.qad-q a').click(function() {
        $('div.nestedlisting div.thing div.thing').hide()
    });

    $('.tabmenu li.qad-a a').click(function() {
        $('div.nestedlisting div.thing').not('div:has(a.author:contains("' + OP + '"))').hide()
    });
};

// Add script to main page scope
document.addEventListener('DOMContentLoaded', function(e) {
    var s = document.createElement('script');
    s.textContent = "(" + iamafilter.toString() + ')()';
    document.head.appendChild(s)
});
