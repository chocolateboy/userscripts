// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       4.0.3
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.google.tld/search?*tbm=isch*
// @include       https://www.google.tld/search?*udm=2*
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// ==/UserScript==

import { observe }     from './lib/observer'
import { assign }      from './lib/util'
import { hookXHRSend } from './lib/xhr'

const enum Status { PENDING = 'pending', DONE = 'done' }

interface Result extends HTMLElement {
    dataset: {
        gdId?: string;     // data-gd-id
        gdStatus?: Status; // data-gd-status
    }
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

// the pattern used to scrape image URLs out of the page and the pulled updates
const IMAGE_DATA = /\[("[^"]+"),\d+,\d+\],[^,]+,[^,]+,"rgb\(\d+,\d+,\d+\)"/g

// the default target for image links (the same as page links)
const LINK_TARGET = '_blank'

// selector for image result elements (relative to the results container)
const RESULT = `:scope > :is([data-lpage], [data-ri]):not([data-gd-status="${Status.DONE}"])`

// selector for the image results container
const RESULTS = ':has(> :is([data-lpage], [data-ri]))'

// the API endpoint for result data
const RESULTS_ENDPOINT = '/search'

// a cache used to track the image URL for each result. keyed on the element's
// (1-based) index in the results list
const SEEN = new Map<number, string>()

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
 * extract (scrape) image URLs from the page (initial) or from the data pulled
 * for subsequent pages. add each one to a cache to be looked up later when the
 * result element appears
 */
const extractImageUrls = (text: string): void => {
    // deduplicate and extract the URLs
    const imageUrls = text
        .matchAll(IMAGE_DATA)
        .flatMap<string>((match, i) => {
            // each link appears twice, one after the other: remove the 2nd one
            if (i % 2) {
                return []
            }

            // parse the JSON and extract the URL
            //
            // from: '"https://example.com/?foo\\u003dbar"'
            //   to: 'https://example.com/?foo\u003dbar'
            const $url = JSON.parse(match[1])

            // decode the URL
            //
            // from: 'https://example.com/?foo\u003dbar'
            //   to: 'https://example.com/?foo=bar'
            const url = JSON.parse(`"${$url}"`)

            return [url]
        })

    for (const url of imageUrls) {
        SEEN.set(++DATA_ID, url)
    }
}

/*
 * replacement for the default handler for XHR requests. intercept requests
 * which pull result data, and add the image URLs to the cache
 */
const onResponse = (xhr: XMLHttpRequest, uri: string): void => {
    if (URL.parse(uri)?.pathname === RESULTS_ENDPOINT) {
        // remove one level of double-quote escapes for parity with the embedded
        // page data
        //
        // from: '"... [\"https://example.com/?foo\\u003dbar\",640,480] ..."'
        //   to: '"... ["https://example.com/?foo\\u003dbar",640,480] ..."'
        extractImageUrls(xhr.responseText.replaceAll('\\"', '"'))
    }
}

/*
 * process an image result:
 *
 * 1) assign the extracted image URL
 * 2) prevent click event(s) being intercepted to open the sidebar
 */
const onResult = (result: Result): void => {
    const data = result.dataset

    // initialize the element's status: either pending or done
    data.gdStatus ||= Status.PENDING

    // initialize the element's result index, e.g, 'data-gd-id="1"'
    const id = Number(data.gdId ||= String(++RESULT_ID))

    // grab the link to the image (the first link)
    const imageLink = result.querySelector<HTMLAnchorElement>(':scope a')

    if (!imageLink) {
        console.warn("can't find image link in result:", result)
        return
    }

    // grab the image
    const image = imageLink.querySelector<HTMLImageElement>(':scope img')

    if (!image) {
        console.warn("can't find image in result link:", { result, link: imageLink })
        return
    }

    // look up the extracted image URL for this result
    const href = SEEN.get(id)

    if (!href) {
        console.debug(`can't find URL for result ${id}`)
        return
    }

    // disable the click interceptors
    for (const event of EVENTS) {
        result.addEventListener(event, stopPropagation)
    }

    // update the link
    assign(imageLink, {
        href,
        title: image.alt,
        target: LINK_TARGET, // make it consistent with the page link
    })

    // we're done with the stored URL, so remove it
    SEEN.delete(id)

    // tag the result so we don't process it again
    data.gdStatus = Status.DONE
}

const run = () => {
    // replace the default XHR#send method with our custom version, which scans
    // the response for image URLs and adds them to the cache
    const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype
    const send = hookXHRSend(xhrProto.send, onResponse)

    xhrProto.send = GMCompat.export(send)

    const results = document.querySelector<HTMLElement>(RESULTS)

    if (!results) {
        console.warn("can't find results container")
        return
    }

    // the first 100 image URLs are embedded in the page
    const script = [...document.scripts]
        .findLast(it => !it.src && IMAGE_DATA.test(it.textContent))

    if (!script) {
        console.warn("can't find initial data")
        return
    }

    extractImageUrls(script.textContent)

    observe(results, { childList: true }, () => {
        results.querySelectorAll<Result>(RESULT).forEach(onResult)
    })
}

run()
