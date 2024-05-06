// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.0.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.google.tld/search?*tbm=isch*
// @include       https://www.google.tld/search?*udm=2*
// @grant         none
// ==/UserScript==

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

// selector for the image result container
const RESULTS = ':has(> :is([data-lpage], [data-ri]))'

// selector for image result elements (relative to the result container)
const RESULT = ':scope > :is([data-lpage], [data-ri]):not([data-status])'

/**
 * event handler for result elements which prevents their click/mousedown events
 * being intercepted
 */
const stopPropagation = (e: Event): void => {
    e.stopPropagation()
}

const onImageLink = (link: HTMLAnchorElement, result: HTMLElement): void => {
    const { searchParams: params } = new URL(link.href)
    const src = params.get('imgurl')

    if (!src) {
        console.warn("Can't find image URL in result link:", { link, params })
        return
    }

    const image = link.querySelector<HTMLImageElement>(':scope img')

    if (!image) {
        console.warn("Can't find image in result link:", { result, link })
        return
    }

    link.href = src
    link.title = image.alt
    link.target = '_blank' // make it consistent with the page link
    result.dataset.status = 'fixed'

    // force a reflow (once) so the updated URL is immediately visible on hover
    // (XXX Firefox issue, not needed in Chrome)
    image.parentElement!.replaceChild(image, image)
}

const onResult = (result: HTMLElement): void => {
    result.dataset.status = 'pending'

    // disable the link interceptors
    for (const event of EVENTS) {
        result.addEventListener(event, stopPropagation)
    }

    const imageLink = result.querySelector<HTMLAnchorElement>(':scope a')

    if (!imageLink) {
        console.warn("Can't find image link in result:", result)
        return
    }

    // wait for the href
    const init = { attributeFilter: ['href'] }
    const callback: MutationCallback = (_mutations, observer) => {
        observer.disconnect()

        if (imageLink.href) {
            return onImageLink(imageLink, result)
        }

        observer.observe(imageLink, init)
    }

    callback([], new MutationObserver(callback))
}

const run = () => {
    const init = { childList: true }
    const results = document.querySelector<HTMLElement>(RESULTS)

    if (!results) {
        console.warn("Can't find result container")
        return
    }

    const callback: MutationCallback = (_mutations, observer) => {
        observer.disconnect()

        for (const result of results.querySelectorAll<HTMLElement>(RESULT)) {
            onResult(result)
        }

        observer.observe(results, init)
    }

    callback([], new MutationObserver(callback))
}

run()
