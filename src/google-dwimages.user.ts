// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       4.0.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.google.tld/search?*tbm=isch*
// @include       https://www.google.tld/search?*udm=2*
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// ==/UserScript==

import { observe } from './lib/observer'

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

// the default target for image links (the same as page links)
const LINK_TARGET = '_blank'

// selector for image result elements (relative to the result container)
const RESULT = ':scope > :is([data-lpage], [data-ri]):not([data-gd-status="done"])'

// selector for the image result container
const RESULTS = ':has(> :is([data-lpage], [data-ri]))'

// the pattern used to scrape image URLs out of the page/pulled payloads
const IMAGE_DATA = /(\["[^"]+",\d+,\d+\]),[^,]+,[^,]+,"rgb\(\d+,\d+,\d+\)"/g

// an index used to store a result's image URL until the element is displayed.
// keyed on the element's (1-based) index in the result list
let CACHE = new Map<string, string>()

// the index for each extracted image URL (1-based)
let DATA_ID = 0

// the index for each rendered result element (1-based)
let RESULT_ID = 0

/**
 * event handler for result elements which prevents their click/mousedown events
 * being intercepted to open the sidebar
 */
const stopPropagation = (e: Event): void => {
    e.stopPropagation()
}

/*
 * extract (scrape) image URLs from the page (initial) or from an XHR request
 * for more. add each one to a cache to be looked up later when the result
 * element appears
 */
const extractImageUrls = (text: string): void => {
    // console.debug('extracting image URLs...')

    // deduplicate and extract the URLs (they come in pairs)
    const imageUrls = text
        .matchAll(IMAGE_DATA)
        .flatMap((it, i) => i % 2 ? [] : [JSON.parse(it[1])[0]])

    let count = 0

    for (const url of imageUrls) {
        ++count
        CACHE.set(String(++DATA_ID), url)
    }

    // console.debug(`found ${count} image URLs`)
}

/*
 * replace the built-in XHR#send method with a custom version which swaps
 * in our custom response handler. once done, we delegate to the original
 * handler (this.onreadystatechange)
 */
const hookXHRSend = (oldSend: XMLHttpRequest['send']): XMLHttpRequest['send'] => {
    return function send (this: XMLHttpRequest, body = null) {
        const oldOnReadyStateChange = this.onreadystatechange

        this.onreadystatechange = function (event) {
            if (this.readyState === this.DONE && this.responseURL && this.status === 200) {
                onResponse(this, this.responseURL)
            }

            if (oldOnReadyStateChange) {
                oldOnReadyStateChange.call(this, event)
            }
        }

        oldSend.call(this, body)
    }
}

/*
 * replacement for the default handler for XHR requests. intercept the response
 * if it includes the image URL data and add it to the cache
 */
const onResponse = (xhr: XMLHttpRequest, uri: string): void => {
    if (URL.parse(uri)?.pathname === '/search') {
        extractImageUrls(xhr.responseText.replaceAll('\\', ''))
    }
}

/*
 * process an image result:
 *
 * 1) prevent its click event(s) being intercepted to open the sidebar
 * 2) assign the stored image URL if available, otherwise wait for the next
 *    DOM update
 */
const onResult = (result: HTMLElement): void => {
    result.dataset.gdStatus ||= 'pending'

    // initialize the element's result index, e.g, 'data-gd-ri="1"'
    let id = result.dataset.gdRi

    if (!id) {
        id = result.dataset.gdRi = String(++RESULT_ID)
    }

    // grab the link to the image (first link)
    const imageLink = result.querySelector<HTMLAnchorElement>(':scope a')

    if (!imageLink) {
        console.warn("can't find image link in result:", result)
        return
    }

    const image = imageLink.querySelector<HTMLImageElement>(':scope img')

    if (!image) {
        console.warn("can't find image in result link:", { result, link: imageLink })
        return
    }

    const href = CACHE.get(id)

    if (!href) {
        console.debug(`can't find URL for result ${id}`)
        return
    }

    // console.debug(`Found URL for result ${id}: ${href}`)

    // disable the click interceptors
    for (const event of EVENTS) {
        result.addEventListener(event, stopPropagation)
    }

    Object.assign(imageLink, {
        href,
        title: image.alt,
        target: LINK_TARGET, // make it consistent with the page link
    })

    CACHE.delete(id)

    // tag the result so we don't process it again
    result.dataset.gdStatus = 'done'
}

const run = () => {
    // replace the default XHR#send method with our custom version, which scans
    // the response for image URLs and adds them to the cache
    const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype
    const send = hookXHRSend(xhrProto.send)

    xhrProto.send = GMCompat.export(send)

    const results = document.querySelector<HTMLElement>(RESULTS)

    if (!results) {
        console.warn("can't find result container")
        return
    }

    // the first 100 results are embedded in the page
    const script = [...document.scripts]
        .filter(it => !it.src)
        .findLast(it => it.textContent.match(IMAGE_DATA))

    if (!script) {
        console.warn("can't find initial data")
        return
    }

    extractImageUrls(script.textContent)

    observe(results, { childList: true }, () => {
        results.querySelectorAll<HTMLElement>(RESULT).forEach(onResult)
    })
}

run()
