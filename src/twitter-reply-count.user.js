// ==UserScript==
// @name          Twitter Reply Count
// @description   Show the number of replies on tweet pages
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.0.2
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/eclecto/jQuery-onMutate@79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @grant         GM_log
// @inject-into   auto
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

// only URLs whose paths match this pattern are used to scan for widgets
//
// NOTE we run on tweet pages, but need to be activated on the entry page, which
// might not be a tweet page, so the page match is handled in the filter via this
// pattern rather than the @include pattern
const PATH = /^\/(?:i\/web|\w+)\/status\/(\d+)/i

/*
 * given a jQuery wrapper containing a stats element (see below), verify that
 * it's valid, then forward the following details to the handler
 *
 *  - the stats bar (the parent element of the Retweets/Likes widgets)
 *  - the number of widgets in the stats bar - we need at least 1 (to clone)
 *  - the path of the current page (used as a dummy URL for the replies widget)
 */
function filterStats ($results) {
    // NOTE we need to determine the path dynamically because Twitter is a SPA,
    // i.e. this userscript is loaded once for multiple pages

    const path = location.pathname
    const match = path.match(PATH)

    if (!match) {
        return
    }

    const $stats = $results.first() // there should only be one
    const $links = $stats.prev().find('a[href]')
    const nWidgets = $links.length // one link per widget

    if (nWidgets && parseStats($stats, nWidgets)) {
        // we need to locate the stats bar in the previous sibling, but its
        // structure can vary: sometimes (e.g. in threads) the widgets are its
        // direct children; at other times, they're its grandchildren. in both
        // cases, however, the stats bar is the great grandparent of the
        // Retweets/Likes links, so we use that to find it
        const $statsBar = $links.first().parent().parent().parent()

        onStats($stats, $statsBar, nWidgets, path)
    }
}

/*
 * a helper function used to filter jQuery collections
 *
 * return true if an element has no children, false otherwise
 */
function isLeaf () {
    return this.children.length == 0
}

/*
 * callback fired when the stats element's aria-label attribute is updated:
 * update the count and the label if they differ from the current values
 */
function onUpdate ($stats, $count, $label, nWidgets) {
    const stats = parseStats($stats, nWidgets)

    if (!stats) {
        return
    }

    const { displayCount, label } = stats

    if ($count.text() !== displayCount) {
        // TODO (re-)investigate (re-)implementing the animation
        $count.text(displayCount)
    }

    if ($label.text() !== label) {
        $label.text(label)
    }
}

/*
 * process the stats element for a tweet:
 *
 * 1) create a Replies widget cloned from one of the existing widgets
 * 2) set the new widget's label to "Replies"
 * 3) set the widget's count to the initial number of replies
 * 4) use a mutation observer to sync the stats to the widget
 * 5) prepend the new widget to the stats bar
 */
function onStats ($stats, $statsBar, nWidgets, path) {
    // override the "column" layout used when there's only one widget
    $statsBar.css('flex-direction', 'row')

    // create the Replies widget, initially a clone of the first widget
    const $replies = $statsBar.children().first().clone()

    // copy the inter-widget gap from the first widget's right margin
    $replies.css('margin-right', '20px')

    // keep the link so the appearance remains consistent, but just link back to
    // the current page
    const $link = $replies.find('a[href]').attr('href', path)

    // grab the widget's target elements
    const [$count, $label] = targets($link)

    // display "replies" as "Replies"
    $label.css('text-transform', 'capitalize')

    // initialize the target elements
    onUpdate($stats, $count, $label, nWidgets)

    // pipe updates to the target elements
    const callback = $stats => onUpdate($stats, $count, $label, nWidgets)
    $stats.onModify('aria-label', callback, true /* multi */)

    // add the widget to the stats bar
    $statsBar.prepend($replies)
}

/*
 * parse the reply count and localized label from the stats string, e.g.:
 *
 *   "1500 replies, 1000 Retweets, 500 likes"
 *
 * yields:
 *
 *   { count: 1500, displayCount: '1.5K', label: 'replies' }
 */
function parseStats ($stats, nWidgets) {
    const stats = $stats.attr('aria-label')

    // parse the stats into an array of count (number) => label (string) pairs.
    // exclude mangled stats, e.g. "Liked" in "2 Retweets, 3 likes, Liked"
    const pairs = stats.trim().split(/,\s+/).flatMap(pair => {
        const match = pair.match(/^(\d+)\s+(.+)$/)
        return match ? [[Number(match[1]), match[2]]] : []
    })

    // the number of stats must exceed the number of widgets (and the
    // number of widgets must be at least 1 (so we can clone it))
    if (pairs.length <= nWidgets) {
        return false
    }

    const [count, label] = pairs[0]

    const displayCount = (count > 1000)
        ? Number((count / 1000).toFixed(1)) + 'K'
        : String(count)

    return { count, displayCount, label }
}

/*
 * extract the count and label elements from a widget's link element
 */
function targets ($link) {
    /*
        NOTE if the cloned widget was in the process of updating its count, we
        may have an extra (transient) SPAN representing the before and after
        states of the rollover animation

        it's possible the same technique is used to update the label, e.g.

            "0 Likes" -> "1 Like" -> "2 Likes"

        - so we normalize both:

        before:

            <a href="/status/1234/retweets">
                <div>
                    <span>
                        <span>1</span>
                    </span>

                    <span> <!-- XXX incoming -->
                        <span>2</span>
                    </span>
                </div>

                <span>
                    <span>Retweet</span>
                    <span>Retweets</span> <!-- XXX maybe? -->
                </span>
            </a>

        after (the text values don't matter since we're going to change them):

            <a href="status/1234/retweets">
                <div>
                    <span>
                        <span>1</span>
                    </span>
                </div>

                <span>
                    <span>Retweet</span>
                </span>
            </a>
    */

    const targets = []

    $link.children().each(function () {
        const $child = $(this)

        // remove all but the first child of each child of the link
        $child.children().filter(index => index > 0).remove()

        // grab the target element
        targets.push($child.find('span').filter(isLeaf))
    })

    return targets
}

// locate the DIV which contains the tweet's stats, e.g.:
//
//    <div aria-label="1234 replies, 2345 Retweets, 3456 likes" role="group">...</div>
//
// there are DIVs like this under each tweet on a page, and the tweet may not be
// the first on its page (it may be a reply), so we need to select the right one
//
// currently, we identify the element by a unique (generated) class name.
// this looks fragile, but something like it has reportedly been stable since
// the last major redesign (over a year ago) [1]
//
// [1] https://greasyfork.org/en/scripts/405335-twitter-reply-count/discussions/59090

$.onCreate(
    'div.r-a2tzq0[role="group"][aria-label][aria-label!=""]',
    filterStats,
    true /* multi */
)
