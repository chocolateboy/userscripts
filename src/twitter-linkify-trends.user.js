// ==UserScript==
// @name          Twitter Linkify Trends
// @description   Make Twitter trends links (again)
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.3.1
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/eclecto/jQuery-onMutate@79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @require       https://unpkg.com/@chocolateboy/uncommonjs@3.1.2/dist/polyfill.iife.min.js
// @require       https://unpkg.com/get-wild@1.4.0/dist/index.umd.min.js
// @require       https://unpkg.com/flru@1.0.2/dist/flru.min.js
// @grant         GM_log
// @grant         GM_registerMenuCommand
// @run-at        document-start
// @inject-into   auto
// ==/UserScript==

// XXX note: the unused grant (GM_log) is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

/*
 * a map from event IDs to their URLs. populated via the intercepted trends
 * data (JSON)
 */

// an LRU cache (flru) with up to 256 (128 * 2) entries
const CACHE = new exports.default(128)

// debugging options. currently used to define colors for trend and event
// elements. the values are undefined by default (no change) but can be
// overridden (until the page is reloaded) via a menu command
let DEBUG = {}

// the background colors to use for trend and event elements when debugging is
// enabled
const DEBUG_SELECTORS = { event: 'powderblue', trend: 'palegreen' }

/*
 * events to disable (stop propagating) on event and trend elements
 */
const DISABLED_EVENTS = 'click touch'

/*
 * path to the JSON document containing event data
 */
const EVENT_DATA = '/i/api/2/guide.json'

/*
 * path to the array of event records within the JSON document; each record
 * includes an ID, title, URL and image URL
 */
const EVENT_PATH = 'timeline.instructions.*.addEntries.entries.*.content.timelineModule.items.*.item.content.eventSummary'

/*
 * path to the data for the main image/link on trend pages
 * (https://twitter.com/explore/tabs/*)
 */
const EVENT_HERO_PATH = 'timeline.instructions.*.addEntries.entries.*.content.item.content.eventSummary'

/*
 * the shared identifier (key) for live events (if they don't have a custom
 * image). if an event has this key, we identify it by its title rather than its
 * image URL
 */
const LIVE_EVENT_KEY = '/lex/placeholder_live_nomargin'

/*
 * selectors for trend elements and event elements (i.e. Twitter's curated news
 * links). works for trends/events in the "What's happening" panel in the
 * sidebar and the dedicated trends pages (https://twitter.com/explore/tabs/*)
 */

// NOTE: we detect the image inside an event/event-hero element and then
// navigate up to the event to avoid the overhead of using :has()
const EVENT = 'div[role="link"]:not([data-testid]).r-1j3t67a'
const EVENT_IMAGE = `${EVENT} > div > div:nth-child(2):last-child img[src]`
const EVENT_HERO = 'div[role="link"][data-testid="eventHero"]'
const EVENT_HERO_IMAGE = `${EVENT_HERO} > div:first-child [data-testid="image"] > img[src]`
const TREND = 'div[role="link"][data-testid="trend"]'
const EVENT_ANY = [EVENT, EVENT_HERO].join(', ')
const SELECTOR = [EVENT_IMAGE, EVENT_HERO_IMAGE, TREND].join(', ')

/*
 * a custom version of get-wild's `get` function which automatically removes
 * missing/undefined results
 *
 * we also use a simpler/faster path parser since we don't use the extended
 * syntax
 */
const get = exports.getter({ default: [], split: '.' })

/*
 * remove the onclick interceptors from event elements
 */
function disableAll (e) {
    // don't preventDefault: we still want links to work
    e.stopPropagation()
}

/*
 * remove the onclick interceptors from trend elements, apart from clicks on the
 * caret (which opens a drop-down menu)
 */
function disableSome (e) {
    const $target = $(e.target)
    const $caret = $target.closest('[data-testid="caret"]', this)

    if (!$caret.length) {
        // don't preventDefault: we still want links to work
        e.stopPropagation()
    }
}

/*
 * intercept XMLHTTPRequest#open requests for trend data (guide.json) and pass
 * the response to a custom handler which extracts data for the event elements
 */
function hookXHROpen (oldOpen) {
    return function open (_method, url, ...rest) { // preserve the arity
        const $url = new URL(url)

        if ($url.pathname === EVENT_DATA) {
            // register a new listener
            this.addEventListener('load', () => processEventData(this.responseText))
        }

        return oldOpen.call(this, _method, url, ...rest)
    }
}

/*
 * translate an event's ID to its canonical form
 *
 * takes an identifier for an event image (its URL) and returns the portion of
 * that identifier which the data and the element have in common
 */
function keyFor (url) {
    return new URL(url).pathname.replace(/\.\w+$/, '')
}

/*
 * create a link (A) which targets the specified URL
 *
 * used to wrap the trend/event titles
 */
function linkFor (href) {
    return $('<a></a>')
        .attr({ href, role: 'link', 'data-focusable': true })
        .css({ color: 'inherit', textDecoration: 'inherit' })
}

/*
 * process a newly-created trend or event element
 */
function onElement (el) {
    const $el = $(el)

    // determine the element's type and pass it to the appropriate handler
    if ($el.is(TREND)) {
        $el.css({
            cursor: 'auto', // remove the fake pointer
            backgroundColor: DEBUG.trend,
        })

        $el.on(DISABLED_EVENTS, disableSome)
        onTrend($el)
    } else {
        const $event = $el.closest(EVENT_ANY)
        const wrapImage = $event.is(EVENT)

        $event.css({
            cursor: 'auto', // remove the fake pointer
            backgroundColor: DEBUG.event,
        })

        $event.on(DISABLED_EVENTS, disableAll)
        onEvent($event, $el, { wrapImage })
    }
}

/*
 * linkify an event element: the target URL is (was) extracted from the
 * intercepted JSON
 */
function onEvent ($event, $image, options = {}) {
    const { $target, title } = targetFor($event)

    console.debug('event (element):', JSON.stringify(title))

    const key = keyFor($image.attr('src'))
    const url = key === LIVE_EVENT_KEY ? CACHE.get(title) : CACHE.get(key)

    if (url) {
        const $link = linkFor(url)

        $target.wrap($link)

        if (options.wrapImage !== false) {
            $image.wrap($link)
        }
    } else {
        console.warn("Can't find URL for event (element):", JSON.stringify(title))
    }
}

/*
 * linkify a trend element: the target URL is derived from the title in the
 * element rather than from the JSON
 */
function onTrend ($trend) {
    const { $target, title } = targetFor($trend)
    const unquoted = title.replace(/"/g, '')

    // console.debug('trend (element):', JSON.stringify(unquoted))

    const query = encodeURIComponent('"' + unquoted + '"')
    const url = `${location.origin}/search?q=${query}`

    $target.wrap(linkFor(url))
}

/*
 * process the events data (JSON): extract ID/URL pairs for the event elements
 * and store them in a cache
 */
function processEventData (json) {
    const data = JSON.parse(json)
    const events = get(data, EVENT_PATH)

    // always returns an array even though there's at most 1
    const eventHero = get(data, EVENT_HERO_PATH)

    const $events = eventHero.concat(events)
    const nEvents = $events.length

    if (!nEvents) {
        return
    }

    const plural = nEvents === 1 ? 'event' : 'events'

    console.debug(`caching data for ${nEvents} ${plural}`)

    for (const event of $events) {
        const { title, url: { url } } = event
        const imageURL = event.image?.url

        if (!imageURL) {
            // XXX not all event heroes (or adverts) have images
            console.warn("Can't find image for event (data):", title)
            continue
        }

        const key = keyFor(imageURL)

        console.debug('event (data):', JSON.stringify(title))

        if (key === LIVE_EVENT_KEY) {
            CACHE.set(title, url)
        } else {
            CACHE.set(key, url)
        }
    }
}

/*
 * given a trend or event element, return its target element — i.e. the SPAN
 * containing the element's title — along with its title text
 */
function targetFor ($el) {
    const $target = $el.find('div[dir="ltr"]').first().find('> span')
    const title = $target.text().trim()

    return { $target, title }
}

// hook HMLHTTPRequest#open so we can extract event data from the JSON
const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype

xhrProto.open = GMCompat.export(hookXHROpen(xhrProto.open))

// GM_registerMenuCommand is not available in Greasemonkey
// https://github.com/greasemonkey/greasemonkey/issues/3078
if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand(`Debug ${GM_info.script.name} Selectors`, () => {
        DEBUG = DEBUG_SELECTORS
    })
}

// monitor the creation of trend/event elements
//
// this script needs to be loaded early enough to intercept the JSON
// (document-start), but run after the page has loaded. this ensures the latter
$(() => {
    const onElements = $elements => {
        for (const el of $elements) {
            onElement(el)
        }
    }

    $.onCreate(SELECTOR, onElements, true /* multi */)
})
