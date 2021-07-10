// ==UserScript==
// @name          IMDb Full Summary
// @description   Automatically show the full plot summary on IMDb
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.1.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.imdb.com/title/tt*
// @grant         none
// ==/UserScript==

/*
 * Tests:
 *
 *  - movie:   https://www.imdb.com/title/tt7638460/
 *  - TV show: https://www.imdb.com/title/tt0108983/
 */

(function () {
    // the truncated summaries: separate elements for the small/medium
    // ("plot-xs_to_m"), large ("plot-l"), and extra large ("plot-xl") layouts
    //
    // const summaries = document.querySelectorAll('span[data-testid^="plot-"]:has(> a[data-testid="plot-read-all-link"])')

    /** @type Element[] */
    // @ts-ignore https://github.com/microsoft/TypeScript/issues/23405
    const summaries = Array.from(
        document.querySelectorAll('span[data-testid^="plot-"] > a[data-testid="plot-read-all-link"]'),
        link => link.parentElement
    )

    if (!summaries.length) {
        return
    }

    // the full summary
    const storyline = document.querySelector('[data-testid="storyline-plot-summary"] > div > div')

    if (!storyline) {
        return
    }

    const [summary] = summaries
    const truncated = summary.firstChild?.textContent?.trim()?.slice(0, -3)
    const fullSummary = storyline.firstChild?.textContent?.trim()

    if (truncated && fullSummary && fullSummary.length > truncated.length && fullSummary.startsWith(truncated)) {
        const init = { childList: true }
        const fakeMutations = Array.from(summaries, target => ({ target }))

        /**
         * @param {Array<{ target: Node }>} mutations
         * @param {MutationObserver} observer
         */
        const replaceSummary = (mutations, observer) => {
            observer.disconnect()
            const targets = new Set(mutations.map(mutation => mutation.target))
            targets.forEach(target => target.textContent = fullSummary)
            targets.forEach(target => observer.observe(target, init))
        }

        replaceSummary(fakeMutations, new MutationObserver(replaceSummary))
    }
})()
