// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.7.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://www.google.tld/*tbm=isch*
// @include       https://encrypted.google.tld/*tbm=isch*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.0/dist/cash.min.js
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @require       https://unpkg.com/@chocolateboy/uncommonjs@3.2.1/dist/polyfill.iife.min.js
// @require       https://unpkg.com/get-wild@3.0.2/dist/index.umd.min.js
// @grant         GM_log
// ==/UserScript==

// metadata cache which maps an image's 0-based index to its URL
const CACHE = new Map()

// events to intercept (stop propagating) in result elements
const EVENTS = 'auxclick click focus focusin mousedown touchstart'

// the type of image-metadata nodes; other types may be found in the tree, e.g.
// the type of nodes containing metadata for "Related searches" widgets is 7
const IMAGE_METADATA = 1

// a pattern which matches the endpoint for image metadata requests
const IMAGE_METADATA_ENDPOINT = /\/batchexecute\?rpcids=/

// the first child of a node (array) contains the node's type (integer)
const NODE_TYPE = 0

// the field (index) in an image-metadata node which contains its 0-based index
// within the list of results. this corresponds to the value of the data-ri
// attribute
const RESULT_INDEX = 4

// selector for image result elements (DIVs) which haven't been processed
// @ts-ignore https://github.com/microsoft/TypeScript/issues/14279
const UNPROCESSED_RESULTS = 'div[data-ri][data-ved][jsaction]'

/******************************** helper functions ****************************/

/**
 * deep clone a JSON-serializable value
 *
 * @type {<T>(data: T) => T} clone
 */
function clone (data) {
    return JSON.parse(JSON.stringify(data))
}

/*
 * return a wrapper for XmlHttpRequest#open which intercepts image-metadata
 * requests and adds the results to our metadata cache
 */
function hookXhrOpen (oldOpen, $container) {
    return /** @this {XMLHttpRequest} */ function open (method, url) {
        // delegate to the original (there's no return value)
        GMCompat.apply(this, oldOpen, arguments)

        if (!isImageDataRequest(method, url)) {
            return
        }

        // a new XHR instance is created for each metadata request, so we need
        // to register a new listener
        this.addEventListener('load', () => {
            let parsed

            try {
                // @ts-ignore
                const cooked = this.responseText.match(/"\[[\s\S]+\](?:\\n)?"/)[0] // '"[...]\n"'
                const raw = JSON.parse(cooked) // '[...]'
                parsed = JSON.parse(raw) // [...]
            } catch (e) {
                console.error("Can't parse response:", e)
                return
            }

            try {
                mergeImageMetadata(parsed)
                // process the new images
                $container.children(UNPROCESSED_RESULTS).each(onResult)
            } catch (e) {
                console.error("Can't merge new metadata:", e)
            }
        })
    }
}

/**
 * extract image metadata from the full metadata tree and add it to the cache
 *
 * @param {any} root
 */
function mergeImageMetadata (root) {
    const subtree = clone(root[56])
    const nodes = exports.get(subtree, '[1][0][-1][1][0]')

    for (const $node of nodes) {
        const node = exports.get($node, '[0][0].*')

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
 * determine whether an XHR request is an image-metadata request
 *
 * @param {string} method
 * @param {string} url
 * @return {boolean}
 */
function isImageDataRequest (method, url) {
    return method.toUpperCase() === 'POST' && IMAGE_METADATA_ENDPOINT.test(url)
}

/**
 * event handler for image links, page links and result elements which prevents
 * their click/mousedown events being intercepted
 *
 * @param {Event} e
 */
function stopPropagation (e) {
    e.stopPropagation()
}

/************************************* main ************************************/

/*
 * extract the data for the first ≈ 100 images embedded in the page and register
 * a listener for the requests for additional data
 */
function init () {
    const $container = $('.islrc')

    if (!$container.length) {
        throw new Error("Can't find results container")
    }

    // @ts-ignore
    mergeImageMetadata(GMCompat.unsafeWindow.AF_initDataChunkQueue[1].data)

    // there's static data for the first ~100 images, but only the first 50 are
    // shown initially. the next 50 are displayed lazily and then the remaining
    // images are fetched in batches of 100. this handles images 50-99
    const callback = (_mutations, observer) => {
        const $results = $container.children(UNPROCESSED_RESULTS)

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
    const $initial = $container.children(UNPROCESSED_RESULTS)
    const observer = new MutationObserver(callback)
    const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype

    $initial.each(onResult) // 0-49
    observer.observe($container.get(0), { childList: true }) // 50-99
    xhrProto.open = GMCompat.export(hookXhrOpen(xhrProto.open, $container)) // 100+
}

/**
 * process an image result (DIV), assigning the image URL to its first link and
 * disabling interceptors
 *
 * used to process the original batch of results as well as the lazily-loaded
 * updates
 *
 * @this {HTMLDivElement}
 */
function onResult () {
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

try {
    init()
} catch (e) {
    console.error('Initialisation error:', e)
}
