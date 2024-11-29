// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.1.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.google.tld/search?*tbm=isch*
// @include       https://www.google.tld/search?*udm=2*
// @grant         none
// ==/UserScript==

import { done, observe } from './lib/observer'

// property (data attribute) on image result elements used to distinguish them
// from new/unprocessed results
const enum ResultStatus {
    PENDING = 'pending',
    FIXED   = 'fixed',
}

// events to intercept (stop propagating) in result elements
const EVENTS = [
    'auxclick',
    'click',
    'contextmenu',
    'focus',
    'focusin',
    'keydown',
    'mousedown',
    'touchstart'
]

// the default target for image links (same as page links)
const LINK_TARGET = '_blank'

// selector for image result elements (relative to the result container)
const RESULT = ':scope > :is([data-lpage], [data-ri]):not([data-status])'

// selector for the image result container
const RESULTS = ':has(> :is([data-lpage], [data-ri]))'

/**
 * event handler for result elements which prevents their click/mousedown events
 * being intercepted to open the sidebar
 */
const stopPropagation = (e: Event): void => {
    e.stopPropagation()
}

/*
 * process an image link:
 *
 * 1) extract the image URL from the tracking URL and assign it, e.g.
 *
 *    from: href="/imgres?imgurl=https%3A%2F%2Fexample.com%2Fimage.jpg&..."
 *      to: href="https://example.com/image.jpg"
 *
 * 2) update the result element's status to indicate it has been processed
 */
const onImageLink = (link: HTMLAnchorElement, result: HTMLElement): void => {
    const { searchParams: params } = new URL(link.href)
    const src = params.get('imgurl')

    if (!src) {
        console.warn("Can't find image URL in result link:", { result, link, params })
        return
    }

    const image = link.querySelector<HTMLImageElement>(':scope img')

    if (!image) {
        console.warn("Can't find image in result link:", { result, link })
        return
    }

    link.href = src
    link.title = image.alt
    link.target = LINK_TARGET // make it consistent with the page link
    result.dataset.status = ResultStatus.FIXED

    // force a reflow (once) so the updated URL is immediately visible on hover
    // (XXX Firefox issue, not needed in Chrome)
    //
    // this no longer works (parent is a custom element (g-img)):
    //
    //   image.parentElement!.replaceChild(image, image)
    image.parentElement!.innerHTML = image.parentElement!.innerHTML
}

/*
 * process an image result:
 *
 * 1) prevent its click event(s) being intercepted to open the sidebar
 * 2) wait for its image link to be assigned a URL (on the first hover) and
 *    extract the direct image URL from it
 */
const onResult = (result: HTMLElement): void => {
    // tag the result so we don't process it again
    result.dataset.status = ResultStatus.PENDING

    // disable the click interceptors
    for (const event of EVENTS) {
        result.addEventListener(event, stopPropagation)
    }

    // grab the link to the image (first link)
    const imageLink = result.querySelector<HTMLAnchorElement>(':scope a')

    if (!imageLink) {
        console.warn("Can't find image link in result:", result)
        return
    }

    // wait for its href to be assigned (on the first hover)
    observe(imageLink, { attributeFilter: ['href'] }, () => {
        return imageLink.href && done(onImageLink(imageLink, result))
    })
}

const run = () => {
    const results = document.querySelector<HTMLElement>(RESULTS)

    if (!results) {
        console.warn("Can't find result container")
        return
    }

    observe(results, { childList: true }, () => {
        results.querySelectorAll<HTMLElement>(RESULT).forEach(onResult)
    })
}

run()
