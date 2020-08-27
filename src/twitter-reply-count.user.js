// ==UserScript==
// @name          Twitter Reply Count
// @description   Show the number of replies on tweet pages
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.3.0
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

/*********************************** constants ********************************/

// only URLs whose paths match this pattern are used to scan for widgets
//
// NOTE we run on tweet pages, but need to be activated on the entry page, which
// might not be a tweet page, so the page match is handled in the filter via this
// pattern rather than the @include pattern
const PATH = /^\/(?:i\/web|\w+)\/status\/(\d+)/i

// a pattern which matches valid stats-bar URLs and extracts some data
const STATS_BAR_URL = /^(\/\w+\/status\/\d+)\/(likes|retweets)(?:\/with_comments)?$/

/*********************************** functions ********************************/

/*
 * given a jQuery wrapper containing one or more stats elements, select the ones
 * which have a correspoding stats bar and instantiate and start a
 * Replies controller to sync the stats to the bar
 */
function filterStats ($results) {
    // NOTE we need to determine the path dynamically because Twitter is a SPA,
    // i.e. this userscript is loaded once for multiple pages

    if (!location.pathname.match(PATH)) {
        return
    }

    // reduce the list of candidate elements down to the ones whose previous
    // sibling is a stats bar
    filter: for (const el of $results) {
        const $stats = $(el)
        const $links = $stats.prev().find('a[href][href!=""]')

        // the number of widgets must be at least 1 (so we can clone it)
        if (!$links.length) {
            continue
        }

        // confirm that all links are valid and extract some extra info

        // count the number of consumed stats. this is roughly equal to the
        // number of links/widgets, with the qualification that the retweets
        // stat may be consumed by 2 separate widgets
        //
        // XXX for now we assume that the number of widgets/links doesn't
        // change, e.g. we assume that the Likes widget isn't removed from
        // the DOM if its count goes down to 0
        const consumed = new Set() // dedup

        let repliesLink

        for (const link of $links.get()) {
            const match = $(link).attr('href').match(STATS_BAR_URL)

            if (!match) {
                continue filter
            }

            if (!repliesLink) {
                repliesLink = match[1]
            }

            // the first part of the tweet's subpage, e.g. "retweets" or "likes"
            consumed.add(match[2])
        }

        // we need to locate the stats bar in the previous sibling, but its
        // structure can vary: sometimes (e.g. in threads) the widgets are
        // its direct children; at other times, they're its grandchildren.
        // in both cases, however, the stats bar is the great grandparent of
        // the Retweets/Likes links, so we use that to find it
        const $statsBar = $links.first().parent().parent().parent()

        const replies = new Replies($stats, consumed.size, repliesLink)

        if (replies.parse()) {
            replies.connect($statsBar)
        } else {
            const stats = JSON.stringify($stats.attr('aria-label'))
            console.warn(`Can't parse stats for ${path}: ${stats}`)
        }
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

/************************************ classes *********************************/

/*
 * a helper class which encapsulates a) reading reply counts from the stats
 * element and b) syncing reply counts to the Replies widget's count and label
 * elements
 */
class Replies {
    constructor ($stats, nConsumed, path) {
        this._$stats = $stats
        this._nConsumed = nConsumed
        this._path = path
    }

    /*
     * extract the count and label elements from a widget's link element
     */
    _targets ($link) {
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

    /*
     * callback fired when the stats element's aria-label attribute is updated:
     * update the Replies widget's count and the label if they differ from the
     * current values
     */
    _update ($count, $label) {
        const stats = this.parse()

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
    connect ($statsBar) {
        // override the "column" layout used when there's only one widget
        $statsBar.css('flex-direction', 'row')

        // create the Replies widget, initially a clone of the first widget
        const $replies = $statsBar.children().first().clone()

        // copy the inter-widget gap from the first widget's right margin
        $replies.css('margin-right', '20px')

        // keep the link so the appearance remains consistent, but just link back to
        // the current page
        const $link = $replies.find('a[href]').attr('href', this._path)

        // grab the widget's target elements
        const [$count, $label] = this._targets($link)

        // display "replies" as "Replies"
        $label.css('text-transform', 'capitalize')

        // initialize the target elements
        this._update($count, $label)

        // pipe updates to the target elements
        const callback = () => this._update($count, $label)
        this._$stats.onModify('aria-label', callback, true /* multi */)

        // add the widget to the stats bar
        $statsBar.prepend($replies)
    }

    /*
     * parse the reply count and localized label from the stats string, e.g.:
     *
     *   "1500 replies, 1000 Retweets, 500 likes"
     *   "1500 réponses, 1000 Retweets, 500 j'aime"
     *
     * yield:
     *
     *   { count: 1500, displayCount: '1.5K', label: 'replies' }
     *   { count: 1500, displayCount: '1.5K', label: 'réponses' }
     */
    parse () {
        // if there are replies, the reply count is always first, but:
        //
        // 1) we can't just choose the first stat, because it won't be the reply
        // count if there are no replies
        //
        // 2) we can't match the label because it's localised
        //
        // instead, we check to see if the number of available stats is > the
        // number of displayed stats. if there's an extra stat, it must be the
        // reply count since that widget is no longer displayed
        //
        // this is complicated slightly by the fact that more than one widget
        // (e.g. Retweets and Quotes widgets) can display the same stat
        // (retweets), but that distinction is currently handled in the filter
        // rather than here

        const { _$stats: $stats, _nConsumed: nConsumed } = this
        const stats = $stats.attr('aria-label')

        // parse the stats into an array of { count, label } objects.
        // exclude mangled stats, e.g. "Liked" in "2 Retweets, 3 likes, Liked"
        const parsed = stats.trim().split(/,\s+/).flatMap(pair => {
            const match = pair.match(/^(\d+)\s+(.+)$/)
            return match ? [{ count: Number(match[1]), label: match[2] }] : []
        })

        // the number of available stats must exceed the number of consumed stats
        if (!(parsed.length > nConsumed)) {
            return false
        }

        const { count, label } = parsed[0]

        const displayCount = (count > 1000)
            ? Number((count / 1000).toFixed(1)) + 'K'
            : String(count)

        return { count, displayCount, label }
    }
}

/************************************* main ***********************************/

// locate the DIVs which contain stats, e.g.:
//
//    <div aria-label="1234 replies, 2345 Retweets, 3456 likes" role="group">...</div>
//
// there are DIVs like this under each tweet on a page; we only want to match
// the ones with a corresponding stats bar.
//
// the filter selects the correct stats elements by scanning their previous
// siblings, so in theory we could feed it the candidate elements under every
// tweet on a page and let it match the right ones, but this would be hugely
// wasteful given that there are only one or two matching elements per page,
// while there could be hundreds (or even thousands) of replies.
//
// we avoid this inefficiency by pre-filtering here to limit the candidates
// based on whatever static properties we can use to identify the right
// elements. this can be tricky because the class names are auto-generated (and
// therefore fragile) and the markup is otherwise almost entirely free of any
// kind of semantic hooks or hints...

$.onCreate(
    'div[role="group"][aria-label][aria-label!=""]:not(.r-156q2ks)',
    filterStats,
    true /* multi */
)
