// ==UserScript==
// @name          GitHub First Commit
// @description   Add a link to a GitHub repo's first commit via http://first-commit.com
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       1.0.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://github.com/*/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js
// @require       https://raw.githubusercontent.com/eclecto/jQuery-onMutate/master/jquery.onmutate.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

// there's a per-file latest-commit link on every file page. this selector
// adds the first-commit link to these pages as well:
// var LATEST_COMMIT_SELECTOR = 'div.commit-tease > span.right';

// this selector restricts the first-commit link to the repo's front page
var LATEST_COMMIT_SELECTOR = 'div.commit-tease.js-details-container > span.right';

function addLink ($latestCommit) {
    if ($latestCommit.not(':has(#first-commit)').length) {
        var repo = $('meta[property="og:title"]').attr('content');
        var href = 'http://first-commit.com/' + repo;

        $latestCommit.append(
            '<span id="first-commit">' +
                '|&nbsp;' +
                '<a class="message" href="' + href + '">First commit</a>' +
            '</span>'
        );
    }
}

// the latest-commit bar (div.commit-tease) is statically defined in the HTML
// for users who aren't logged in. for logged in users, it's loaded dynamically
// via an <include-fragment> custom element:
//
// https://github.com/github/include-fragment-element
//
// jQuery-onMutate fires the callback immediately if the element already exists,
// so it handles both cases
$('#js-repo-pjax-container').onCreate(LATEST_COMMIT_SELECTOR, addLink, true /* multi */);
