// ==UserScript==
// @name          More Tomatoes
// @description   Automatically show the full "Movie Info" plot synopsis on Rotten Tomatoes
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.1.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://rottentomatoes.com/m/*
// @include       https://*.rottentomatoes.com/m/*
// @include       https://rottentomatoes.com/tv/*
// @include       https://*.rottentomatoes.com/tv/*
// @run-at        document-start
// @grant         none
// ==/UserScript==

const run = () => {
    const synopsis = document.querySelector('[data-qa="section:media-scorecard"]')

    if (!synopsis) {
        return
    }

    const readLess = synopsis.querySelector<HTMLElement>(':scope [slot="cta-close"]')

    if (readLess) {
        readLess.style.display = 'none'
    }

    const readMore = synopsis.querySelector<HTMLElement>(':scope [slot="cta-open"]')

    if (readMore) {
        readMore.click()
    }
}

window.addEventListener('load', run)
