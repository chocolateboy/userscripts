// ==UserScript==
// @name          Twitter Reply Count
// @description   Show the number of replies on tweet pages
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.0.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://twitter.com/*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/eclecto/jQuery-onMutate@79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @grant         GM_log
// @inject-into   auto
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

// locate the DIV which contains the tweet's stats, e.g.:
//
//    <div aria-label="1234 replies, 2345 Retweets, 3456 likes" role="group">...</div>
//
// there are DIVs like this under each tweet on a page, and the tweet may not be
// the first on its page (it may be a reply), so we need to select the right
// one, namely the one with a Retweets or Likes widget containing a link whose
// href matches (i.e. starts with) the URI of the tweet

// only URLs whose paths match this pattern are used to scan for widgets
//
// NOTE we run on tweet pages, but need to be activated on the entry page, which
// might not be a tweet page, so the matching is done in the filter via this
// pattern rather than the @include pattern
const PATH = /^(\/\w+\/status\/\d+)/

/*
 * given a jQuery collection containing one or more stats elements (see above),
 * select the stats element for the current/main tweet and forward it to the
 * handler
 */
function filterStats ($stats) {
    // the canonical ID (path) of the tweet, e.g. /twitter/status/123456
    //
    // NOTE we determine the path dynamically because Twitter is a SPA, i.e.
    // this userscript is loaded once for multiple pages

    // if the path matches, clean it up, e.g. remove trailing slashes
    const match = location.pathname.match(PATH)

    if (!match) {
        return
    }

    const path = match[1]

    // console.debug('inside filterStats for:', path)

    // find the stats bar for the current tweet
    //
    // XXX the HTML uses the canonical case for the account name in the links
    // (e.g. /Twitter/status/1234), but users can use any case for the path (and
    // the domain), e.g. /twitter/Status/1234. so we need the attribute matches
    // to be case insensitive

    const lcPath = path.toLowerCase()
    const hrefs = new Set([`${lcPath}/likes`, `${lcPath}/retweets/with_comments`])

    for (const el of $stats) {
        const $el = $(el)
        const parsed = parseStats($el)

        if (!parsed) {
            // console.debug('invalid stats:', $el.attr('aria-label'))
            continue
        }

        // console.debug('stats:', $el.attr('aria-label'))

        const { length } = $el.prev().find('a[href]').filter(function () {
            const href = $(this).attr('href').toLowerCase()
            return hrefs.has(href)
        })

        // console.debug('length:', length)

        if (length > 0) {
            onStats($el, path)
        }
    }
}

/*
 * callback fired when the stats element's aria-label attribute is updated:
 * update the count in the Replies widget if it differs from the current value
 */
function onModify ($stats, $count, $label) {
    // console.debug('update:', $stats.attr('aria-label'))

    const stats = parseStats($stats)

    if (!stats) {
        return
    }

    const { label, replies } = stats
    const old = $count.text()

    if (replies === old) {
        return
    }

    if ($label.text() !== label) {
        $label.text(label)
    }

    // TODO (re-)investigate (re-)implementing the animation
    $count.text(replies)
}

/*
 * process the stats element for a tweet:
 *
 * 1) locate the corresponding stats bar
 * 2) create a Replies widget cloned from one of the existing widgets
 * 3) set the new widget's label to "Replies"
 * 4) set the widget's count to the initial number of replies
 * 5) use a mutation observer to sync the element's reply count to the widget
 * 6) prepend the new widget to the stats bar
 */
function onStats ($stats, path) {
    // locate the stats bar, which contains the Retweets and/or Likes widgets
    const $statsBar = $stats.prev().children() // there's only 1 child

    // XXX override the "column" layout if there's only one widget
    $statsBar.css('flex-direction', 'row')

    // create the Replies widget, initially a clone of the first widget
    const $first = $statsBar.children().eq(0)
    const $replies = $first.clone()

    // copy the inter-widget gap from the first widget's right margin
    $replies.css('margin-right', '20px') // $first.css('margin-right')

    // keep the link so the appearance remains consistent, but just link back to
    // the current page
    $replies.find('a').attr('href', path)

    // grab the 2 leaf nodes (terminal SPANs with text)
    const $leaves = $replies.find('span').filter(function () {
        return $(this).children().length === 0
    })

    const $count = $leaves.eq(0)
    const $label = $leaves.eq(1)
    const callback = $stats => onModify($stats, $count, $label)

    // display "replies" as "Replies"
    $label.css('text-transform', 'capitalize')

    // initialize
    onModify($stats, $count, $label)

    // observe changes to the aria-label attribute
    $stats.onModify('aria-label', callback, true /* multi */)

    $statsBar.prepend($replies)
}

/*
 * parse the reply count and localized label from the stats string, e.g.:
 *
 *   "1500 replies, 1000 Retweets, 500 likes"
 *
 * yields:
 *
 *   { count: 1500, label: 'replies', replies: '1.5K' }
 */
function parseStats ($stats) {
    const stats = $stats.attr('aria-label').split(', ')

    if (stats.length !== 3) {
        return false
    }

    const match = stats[0].match(/^(\d+)\s+(.+)$/)

    if (!match) {
        return false
    }

    const count = Number(match[1])
    const label = match[2]
    const replies = (count > 1000) ? Number((count / 1000).toFixed(1)) + 'K' : String(count)

    return { count, label, replies }
}

// console.debug('registering observer for:', location.pathname)

// XXX using the MutationObserver for this is much more reliable/less flaky than
// waiting until the document is "idle" to process "static" elements
$.onCreate(
    'div[role="group"][aria-label][aria-label!=""]',
    filterStats,
    true /* multi */
)
