// ==UserScript==
// @name          IMDb Full Summary
// @description   Automatically show the full plot summary on IMDb
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.2.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       /^https://www\.imdb\.com(/[^/]+)?/title/tt[0-9]+(/([#?].*)?)?$/
// @run-at        document-start
// @grant         none
// ==/UserScript==

/*
 * Tests:
 *
 *  - movie:   https://www.imdb.com/title/tt7638460/
 *  - TV show: https://www.imdb.com/title/tt0108983/
 */

import { observe } from './lib/observer.js'

// each child of the plot element is a summary element which is displayed
// for a different display size, e.g. plot-xl for desktop, plot-l for
// tablets, and plot-xs_to_m for mobile. changing the display size selects a
// different summary element.
const SUMMARY = '[data-testid="plot"] [data-testid^="plot-"]:not([data-expanded])'

const $ = document

const run = () => {
    let $summary = ''

    // get the summary from the props (JSON) embedded in the page
    try {
        const { textContent: metadata } = $.getElementById('__NEXT_DATA__')!
        $summary = JSON.parse(metadata!).props.pageProps.aboveTheFoldData.plot.plotText.plainText
    } catch (e: unknown) {
        console.warn("Can't extract summary from JSON metadata:", (e as Error).message)
    }

    if (!$summary) {
        console.log('no summary found')
        return
    }

    // scan the document for summary elements which haven't been expanded and
    // expand them.
    observe($.body, () => {
        for (const summary of $.querySelectorAll<HTMLElement>(SUMMARY)) {
            summary.textContent = $summary
            summary.dataset.expanded = 'true'
        }
    })
}

// the earliest event after the "static" parts of the page become visible.
// this occurs when document.readyState transitions from "loading" to
// "interactive", which should be the first readystatechange event a userscript
// sees. on my system, this can occur up to 4 seconds before DOMContentLoaded.
//
// NOTE: this means we can't extract the summary from the (lazy) "storyline"
// element as it's not available yet.
$.addEventListener('readystatechange', run, { once: true })
