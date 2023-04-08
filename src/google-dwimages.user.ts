// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.10.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.google.tld/*tbm=isch*
// @include       https://encrypted.google.tld/*tbm=isch*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.4/dist/cash.min.js
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @require       https://unpkg.com/@chocolateboy/uncommonjs@3.2.1/dist/polyfill.iife.min.js
// @require       https://unpkg.com/get-wild@3.0.2/dist/index.umd.min.js
// @grant         GM.registerMenuCommand
// @grant         GM.setClipboard
// @run-at        document-start
// ==/UserScript==

// XXX needed to appease esbuild
export {}

declare const exports: {
    get: typeof import('get-wild').get;
}

declare global {
    interface Window {
        AF_initDataChunkQueue: Array<{ data: Metadata }>;
    }
}

type Metadata = any[];

// metadata cache which maps an image's 0-based index to its URL
const CACHE = new Map<number, string>()

// events to intercept (stop propagating) in result elements
const EVENTS = 'auxclick click contextmenu focus focusin keydown mousedown touchstart'

// the type of image-metadata nodes; other types may be found in the tree, e.g.
// the type of nodes containing metadata for "Related searches" widgets is 7
const IMAGE_METADATA = 1

// a pattern which matches the endpoint for image metadata requests
const IMAGE_METADATA_ENDPOINT = /\/batchexecute\?rpcids=/

// snapshot of the image-metadata tree for diagnostics
let INITIAL_DATA: Metadata

// the first child of a node (array) contains the node's type (integer)
const NODE_TYPE = 0

// the field (index) in an image-metadata node which contains its 0-based index
// within the list of results. this corresponds to the value of the data-ri
// attribute
const RESULT_INDEX = 4

// selector for image result elements (DIVs) which haven't been processed
const UNPROCESSED_RESULTS = 'div[data-ri][data-ved][jsaction]'

/******************************** helper functions ****************************/

/**
 * deep clone a JSON-serializable value
 */
function clone <T>(data: T): T {
    return JSON.parse(JSON.stringify(data))
}

/**
 * return a wrapper for XmlHttpRequest#open which intercepts image-metadata
 * requests and adds the results to our metadata cache
 */
function hookXhrOpen (oldOpen: XMLHttpRequest['open'], $container: JQuery): XMLHttpRequest['open'] {
    return function open (this: XMLHttpRequest, method: string, url: string) {
        if (isImageDataRequest(method, url)) {
            // a new XHR instance is created for each metadata request, so we
            // need to register a new listener
            this.addEventListener('load', () => {
                onLoad(this, $container)
            })
        }

        // delegate to the original (there's no return value)
        GMCompat.apply(this, oldOpen, arguments)
    }
}

/**
 * determine whether an XHR request is an image-metadata request
 */
function isImageDataRequest (method: string, url: string): boolean {
    return method.toUpperCase() === 'POST' && IMAGE_METADATA_ENDPOINT.test(url)
}

/**
 * extract image metadata from the full metadata tree and add it to the cache
 */
function mergeImageMetadata (root: Metadata): void {
    const nodes = root[56]
        ? exports.get(clone(root[56]), '[1][0][-1][1][0].**[0][0][0]')
        : exports.get(clone(root[31]), '[-1][12][2]')

    for (const node of nodes) {
        // the first child is the node's type (1 for image metadata)
        const type = node[NODE_TYPE]

        // other nodes are ignored, e.g. metadata for "Related searches" widgets
        if (type !== IMAGE_METADATA) {
            continue
        }

        // the 0-based index of the image in the list of results (data-ri)
        const index = node[RESULT_INDEX]

        // there is more metadata in the node, but for now we only need the
        // URL
        const imageUrl = node[1][3][0]

        CACHE.set(index, imageUrl)
    }
}

/**
 * load handler for XHR metadata requests. parse the response and add its
 * results to the metadata cache
 */
function onLoad (xhr: XMLHttpRequest, $container: JQuery) {
    let parsed: Metadata

    try {
        const cooked = xhr.responseText.match(/"\[[\s\S]+\](?:\\n)?"/)![0] // '"[...]\n"'
        const raw = JSON.parse(cooked) // '[...]'
        parsed = JSON.parse(raw) // [...]
    } catch (e) {
        console.error("Can't parse response:", e)
        return
    }

    try {
        mergeImageMetadata(parsed)
        // process the new images
        $container.find(UNPROCESSED_RESULTS).each(onResult)
    } catch (e) {
        console.error("Can't merge new metadata:", e)
    }
}

/**
 * event handler for image links, page links and result elements which prevents
 * their click/mousedown events being intercepted
 */
function stopPropagation (e: Event): void {
    e.stopPropagation()
}

/************************************* main ************************************/

/**
 * extract the data for the first ≈ 100 images embedded in the page and register
 * a listener for the requests for additional data
 */
function init (): void {
    const container = document.querySelector(UNPROCESSED_RESULTS)?.parentElement

    if (!container) {
        throw new Error("Can't find results container")
    }

    const $container = $(container)

    mergeImageMetadata(INITIAL_DATA = GMCompat.unsafeWindow.AF_initDataChunkQueue[1].data)

    // there's static data for the first ~100 images, but only the first 50 are
    // shown initially. the next 50 are displayed lazily and then the remaining
    // images are fetched in batches of 100. this handles images 50-99
    const callback = (_mutations: MutationRecord[], observer: MutationObserver) => {
        const $results = $container.find(UNPROCESSED_RESULTS)

        for (const result of $results) {
            const index = $(result).data('ri') // data() converts it to an integer

            if (CACHE.has(index)) {
                onResult.call(result)
            } else {
                observer.disconnect()
                break
            }
        }
    }

    // process the initial images
    const $initial = $container.find(UNPROCESSED_RESULTS)
    const observer = new MutationObserver(callback)
    const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype

    $initial.each(onResult) // 0-49
    observer.observe(container, { childList: true }) // 50-99
    xhrProto.open = GMCompat.export(hookXhrOpen(xhrProto.open, $container)) // 100+
}

/**
 * process an image result (DIV), assigning the image URL to its first link and
 * disabling interceptors
 *
 * used to process the initial batch of results as well as the lazily-loaded
 * updates
 */
function onResult (this: HTMLElement): void {
    // grab the metadata for this result
    const $result = $(this)
    const index = $result.data('ri') // 0-based index of the result
    const imageUrl = CACHE.get(index)

    if (!imageUrl) {
        console.error(`Can't find image URL for result (${index})`)
        return // continue
    }

    // prevent new interceptors being added to this element and its
    // descendants and pre-empt the existing interceptors

    $result.find('[jsaction]').add($result).each(function () {
        $(this).removeAttr('jsaction').on(EVENTS, stopPropagation)
    })

    // assign the correct URL to the image link
    $result.find('a').eq(0).attr('href', imageUrl)

    // the URL is no longer needed: release the memory
    CACHE.delete(index)
}

function run () {
    try {
        init()
    } catch (e) {
        console.error('Initialisation error:', e)
    }
}

GM.registerMenuCommand('Copy image metadata to the clipboard', () => {
    GM.setClipboard(JSON.stringify(INITIAL_DATA))
})

document.addEventListener('readystatechange', run, { once: true })
