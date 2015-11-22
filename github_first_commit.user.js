// ==UserScript==
// @name          GitHub First Commit
// @description   Find a GitHub repo's first commit via http://first-commit.com
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       0.0.1
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://github.com/*/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

function addLink () {
    var latestCommit = $('div.commit-tease > span.right');

    if (latestCommit.length) {
        var repo = $('title').text();
        var href = 'http://first-commit.com/' + repo;

        latestCommit.prepend(
            '<span>' +
                '<a class="message" href="' + href + '">First commit</a>' +
                '&nbsp;|' +
            '</span>'
        );
    }
}

var container = $('#js-repo-pjax-container');

if (container.length) {
    new MutationObserver(addLink).observe(container.get(0), { childList: true });
}

addLink();
