// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.3.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://www.google.tld/*tbm=isch*
// @include       https://encrypted.google.tld/*tbm=isch*
// @require       https://cdn.jsdelivr.net/npm/cash-dom@8.1.0/dist/cash.min.js
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @grant         GM_log
// @inject-into   auto
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

const SELECTOR = 'div[data-ri][data-ved][jsaction]'

// events to intercept (stop propagating) in result elements
const EVENTS = 'click focus mousedown'

let METADATA

/******************************** helper functions ****************************/

// return a wrapper for XmlHttpRequest#open which intercepts image-metadata
// requests and appends the results to our metadata store (array)
function hookXhrOpen (oldOpen, $container) {
    return function open (method, url) {
        GMCompat.apply(this, oldOpen, arguments) // there's no return value

        if (!isImageDataRequest(method, url)) {
            return
        }

        // a new XHR instance is created for each metadata request, so we need
        // to register a new listener
        this.addEventListener('load', () => {
            let parsed

            try {
                const cooked = this.responseText.match(/"\[[\s\S]+\](?:\\n)?"/)[0] // '"[...]\n"'
                const raw = JSON.parse(cooked) // '[...]'
                parsed = JSON.parse(raw) // [...]
            } catch (e) {
                console.error("Can't parse response:", e)
                return
            }

            try {
                METADATA = METADATA.concat(imageMetadata(parsed))
                // process the new images
                $container.children(SELECTOR).each(onResult)
            } catch (e) {
                console.error("Can't merge new metadata:", e)
            }
        })
    }
}

// return the image metadata subtree (array) of the full metadata tree
function imageMetadata (tree) {
    return tree[31][0][12][2]
}

// determine whether an XHR request is an image-metadata request
function isImageDataRequest (method, url) {
    return method.toUpperCase() === 'POST' && /\/batchexecute\?rpcids=/.test(url)
}

// return the URL for the nth image (0-based) and remove its data from the tree
function nthImageUrl (index) {
    const result = METADATA[index][1][3][0]
    delete METADATA[index]
    return result
}

// event handler for image links, page links and results which prevents their
// click/mousedown events being hijacked for tracking
function stopPropagation (e) {
    e.stopPropagation()
}

/************************************* main ************************************/

// extract the data for the first ≈ 100 images embedded in the page and register
// a listener for the requests for additional data
function init () {
    const $container = $('.islrc')

    if (!$container.length) {
        throw new Error("Can't find results container")
    }

    const initialMetadata = imageMetadata(GMCompat.unsafeWindow.AF_initDataChunkQueue[1].data)

    // clone the data so we can mutate it (remove obsolete entries)
    //
    // XXX this (or at least a shallow clone) is also needed to avoid permission
    // errors in Violentmonkey for Firefox (but not Violentmonkey for Chrome)
    METADATA = JSON.parse(JSON.stringify(initialMetadata))

    // there's static data for the first ~100 images, but only the first 50 are
    // shown initially. the next 50 are loaded dynamically and then the
    // remaining images are loaded in batches of 100 (these can be processed
    // synchronously because the images have been added to the DOM by the time
    // the data arrives)
    const callback = (mutations, observer) => {
        const $elements = $container.children(SELECTOR)

        for (const el of $elements) {
            const index = $(el).data('ri')

            if (index < METADATA.length) {
                onResult.call(el)
            } else {
                observer.disconnect()
                break
            }
        }
    }

    // process the initial images
    const $initial = $container.children(SELECTOR)
    const observer = new MutationObserver(callback)
    const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype

    $initial.each(onResult)
    observer.observe($container.get(0), { childList: true })
    xhrProto.open = GMCompat.export(hookXhrOpen(xhrProto.open, $container))
}

// process an image result (DIV), assigning the image URL to its first link and
// disabling trackers
//
// used to process the original batch of results as well as the lazily-loaded
// updates
function onResult () {
    // grab the metadata for this result
    const $result = $(this)
    const index = $result.data('ri') // 0-based index of the result

    let imageUrl

    try {
        imageUrl = nthImageUrl(index)
    } catch (e) {
        console.warn("Can't find image URL for result:", index)
        return // continue
    }

    // prevent new trackers being registered on this DIV and its descendant
    // elements
    //
    // XXX cash doesn't support +addBack+
    $result.find('*').add($result).removeAttr('jsaction')

    // assign the correct/missing URI to the image link
    const $links = $result.find('a')
    const $imageLink = $links.eq(0)
    const $pageLink = $links.eq(1)

    $imageLink.attr('href', imageUrl)

    // pre-empt the existing trackers on elements which don't already have
    // direct listeners (the result element and the image link)
    $result.on(EVENTS, stopPropagation)
    $imageLink.on(EVENTS, stopPropagation)

    // forcibly remove trackers from the remaining element (the page link)
    $pageLink.replaceWith($pageLink.clone())
}

try {
    init()
} catch (e) {
    console.error('Initialisation error:', e)
}
