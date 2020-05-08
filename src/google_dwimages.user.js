// ==UserScript==
// @name          Google DWIMages
// @description   Direct links to images and pages on Google Images
// @author        chocolateboy
// @copyright     chocolateboy
// @version       2.1.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: https://www.gnu.org/copyleft/gpl.html
// @include       https://www.google.tld/*tbm=isch*
// @include       https://encrypted.google.tld/*tbm=isch*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @grant         GM_log
// @inject-into   content
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

let METADATA

/******************************** helper functions ****************************/

// extract the image metadata for the original batch of results from the
// content of the SCRIPT tag
function extractMetadata (source) {
    // XXX not all browsers support the ES2018 /s (matchAll) flag
    // const json = source.match(/(\[.+\])/s)[1]
    const json = source.match(/(\[[\s\S]+\])/)[1]
    return JSON.parse(json)
}

// return a wrapper for XmlHttpRequest#open which intercepts image-metadata
// requests and appends the results to our metadata store (array)
function hookXHROpen (oldOpen) {
    return function open (...args) {
        oldOpen.apply(this, args) // there's no return value

        if (!isImageDataRequest(args)) {
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
                $('div[data-ri][data-ved][jsaction]').each(onResult)
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
function isImageDataRequest (args) {
    return (args.length >= 2)
        && (args[0].toUpperCase() === 'POST')
        && /\/batchexecute\?rpcids=/.test(args[1])
}

// return the URL for the nth image (0-based)
function nthImageUrl (index) {
    return METADATA[index][1][3][0]
}

// event handler for image links, page links and results which prevents their
// click/mousedown events being hijacked for tracking
function stopPropagation (e) {
    e.stopPropagation()
}

/************************************* main ************************************/

// extract the data for the first ≈ 100 images out of the SCRIPT element
// embedded in the page and register a listener for the requests for
// additional data
function init () {
    const scripts = Array.from(document.scripts)
    const callbacks = scripts.filter(script => /^AF_initDataCallback\b/.test(script.text))
    const callback = callbacks.pop().text

    METADATA = imageMetadata(extractMetadata(callback))
    window.XMLHttpRequest.prototype.open = hookXHROpen(window.XMLHttpRequest.prototype.open)
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
        console.warn(`Can't find image URL for image #${index + 1}`)
        return // continue
    }

    // prevent new trackers being registered on this DIV and its descendant
    // elements
    $result.find('*').addBack().removeAttr('jsaction')

    // assign the correct/missing URI to the image link
    const $links = $result.find('a')
    const $imageLink = $links.eq(0)
    const $pageLink = $links.eq(1)

    $imageLink.attr('href', imageUrl)

    // pre-empt the existing trackers on elements which don't already have
    // direct listeners (the result element and the image link)
    $result.on('click focus mousedown', stopPropagation)
    $imageLink.on('click focus mousedown', stopPropagation)

    // forcibly remove trackers from the remaining element (the page link)
    $pageLink.replaceWith($pageLink.clone())
}

try {
    init()
    // process the initial images
    $('div[data-ri][data-ved]').each(onResult)
} catch (e) {
    console.error("Can't parse metadata:", e)
}
