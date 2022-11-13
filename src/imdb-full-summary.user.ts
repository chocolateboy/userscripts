// ==UserScript==
// @name          IMDb Full Summary
// @description   Automatically show the full plot summary on IMDb
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.0.2
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.imdb.com/title/tt*
// @run-at        document-start
// @grant         none
// ==/UserScript==

/*
 * Tests:
 *
 *  - movie:   https://www.imdb.com/title/tt7638460/
 *  - TV show: https://www.imdb.com/title/tt0108983/
 */

const $ = document
const init: MutationObserverInit = { childList: true }

const run = () => {
    let summary = ''

    // get the summary from the GraphQL data (JSON) embedded in the page
    try {
        const { textContent: metadata } = $.getElementById('__NEXT_DATA__')!
        summary = JSON.parse(metadata!).props.pageProps.aboveTheFoldData.plot.plotText.plainText
    } catch (e: unknown) {
        console.warn("Can't extract summary from JSON metadata:", e)
    }

    if (!summary) {
        return
    }

    // each child of the plot element is a summary element which is displayed
    // for a different display size, e.g. plot-xl for desktop, plot-l for
    // tablets, and plot-xs_to_m for mobile. changing the display size selects a
    // different summary element.
    for (const target of $.querySelectorAll<HTMLElement>('[data-testid="plot"] [data-testid^="plot-"]')) {
        // replace the truncated summary with the full version and revert
        // React's attempts to reinstate the original (reconciliation)
        const callback = () => {
            observer.disconnect()
            target.textContent = summary
            observer.observe(target, init)
        }

        const observer = new MutationObserver(callback)

        callback()
    }
}

// the earliest event after the "static" parts of the page become visible.
// this occurs when document.readyState transitions from "loading" to
// "interactive", which should be the first readystatechange event a userscript
// sees. on my system, this can occur up to 4 seconds before DOMContentLoaded.
//
// NOTE: this means we can't extract the summary from the (lazy) "storyline"
// element as it's not available yet.
$.addEventListener('readystatechange', run, { once: true })
