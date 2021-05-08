// ==UserScript==
// @name          Twitter Linkify Trends
// @description   Make Twitter trends links (again)
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.5.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @require       https://unpkg.com/@chocolateboy/uncommonjs@3.1.2/dist/polyfill.iife.min.js
// @require       https://unpkg.com/get-wild@1.4.1/dist/index.umd.min.js
// @require       https://unpkg.com/flru@1.0.2/dist/flru.min.js
// @grant         GM_log
// @run-at        document-start
// ==/UserScript==

/// <reference types="jquery" />
/// <reference path="../types/gm-compat.d.ts" />

// isolate from the scope of the @requires to work around a missing feature in
// TypeScript and a misfeature in a userscript engine.
//
// XXX https://github.com/microsoft/TypeScript/issues/14279
// XXX https://github.com/chocolateboy/uncommonjs#scope

/* begin */ {

/**
 * @typedef {Object} TwitterEvent
 *
 * @prop {{ url?: string }} TwitterEvent.image
 * @prop {string} TwitterEvent.title
 * @prop {{ url: string }} TwitterEvent.url
 */

/**
 * a map from event IDs to their URLs. populated via the intercepted trends
 * data (JSON)
 *
 * uses an LRU cache (flru) with up to 256 (128 * 2) entries
 *
 * @type {import("flru").flruCache}
 */
const CACHE = new exports.default(128)

/*
 * debugging options
 *
 * uncomment this to debug the selectors by assigning distinct background colors
 * to trend and event elements
 */
// const DEBUG = { event: 'powderblue', trend: 'palegreen' }
const DEBUG = {}

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
const EVENT = 'div[role="link"]:not([data-testid]):not([data-linked])'
const EVENT_IMAGE = `${EVENT} > div > div:nth-child(2):last-child img[src]:not([src=""])`
const EVENT_HERO = 'div[role="link"][data-testid="eventHero"]:not([data-linked])'
const EVENT_HERO_IMAGE = `${EVENT_HERO} > div:first-child [data-testid="image"] > img[src]:not([src=""])`
const TREND = 'div[role="link"][data-testid="trend"]:not([data-linked])'
const EVENT_ANY = [EVENT, EVENT_HERO].join(', ')
const SELECTOR = [EVENT_IMAGE, EVENT_HERO_IMAGE, TREND].join(', ')

/**
 * a custom version of get-wild's `get` function which automatically removes
 * missing/undefined results
 *
 * we also use a simpler/faster path parser since we don't use the extended
 * syntax
 *
 * @type {typeof import("get-wild").get}
 */
const pluck = exports.getter({ default: [], split: '.' })

/*
 * remove the onclick interceptors from event elements
 */
function disableAll (e) {
    // don't preventDefault: we still want links to work
    e.stopPropagation()
}

/**
 * remove the onclick interceptors from trend elements, apart from clicks on the
 * caret (which opens a drop-down menu)
 *
 * @this {Element}
 * @param {JQueryEventObject} e
 */
function disableSome (e) {
    const $target = $(e.target)
    const $caret = $target.closest('[data-testid="caret"]', this)

    if (!$caret.length) {
        // don't preventDefault: we still want links to work
        e.stopPropagation()
    }
}

/**
 * intercept XMLHTTPRequest#open requests for trend data (guide.json) and pass
 * the response to a custom handler which extracts data for the event elements
 *
 * @param {XMLHttpRequest['open']} oldOpen
 * @returns {XMLHttpRequest['open']}
 */
function hookXHROpen (oldOpen) {
    return /** @this {XMLHttpRequest} */ function open (_method, url) { // preserve the arity
        const $url = new URL(url)

        if ($url.pathname === EVENT_DATA) {
            // register a new listener
            this.addEventListener('load', () => processEventData(this.responseText))
        }

        return GMCompat.apply(this, oldOpen, arguments)
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
            backgroundColor: DEBUG?.trend,
        })

        $el.on(DISABLED_EVENTS, disableSome)

        // tag so we don't select it again
        $el.attr('data-linked', 'true')

        onTrendElement($el)
    } else {
        const $event = $el.closest(EVENT_ANY)
        const wrapImage = $event.is(EVENT)

        $event.css({
            cursor: 'auto', // remove the fake pointer
            backgroundColor: DEBUG?.event,
        })

        $event.on(DISABLED_EVENTS, disableAll)

        // tag so we don't select it again
        $event.attr('data-linked', 'true')

        onEventElement($event, $el, { wrapImage })
    }
}

/*
 * linkify an event element: the target URL is (was) extracted from the
 * intercepted JSON
 */
function onEventElement ($event, $image, options = {}) {
    const { $target, title } = targetFor($event)

    console.debug('event (element):', JSON.stringify(title))

    const key = keyFor($image.attr('src'))
    const url = key === LIVE_EVENT_KEY ? CACHE.get(title) : CACHE.get(key)

    if (url) {
        const $link = linkFor(url)

        $target.parent().wrap($link)

        if (options.wrapImage) {
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
function onTrendElement ($trend) {
    const { $target, title } = targetFor($trend)
    const param = /\s+/.test(title) ? ('"' + title.replace(/"/g, '') + '"') : title

    // console.debug('trend (element):', JSON.stringify(param))

    const query = encodeURIComponent(param)
    const url = `${location.origin}/search?q=${query}&src=trend_click&vertical=trends`

    $target.wrap(linkFor(url))
}

/*
 * process the events data (JSON): extract ID/URL pairs for the event elements
 * and store them in a cache
 */
function processEventData (json) {
    const data = JSON.parse(json)

    /** @type {Array<TwitterEvent>} */
    const events = pluck(data, EVENT_PATH)

    // always returns an array even though there's at most 1
    /** @type {Array<TwitterEvent>} */
    const eventHero = pluck(data, EVENT_HERO_PATH)

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

/******************************************************************************/

/*
 * monitor the creation of trend/event elements
 */
function run () {
    const init = { childList: true, subtree: true }
    const target = document.getElementById('react-root')

    if (!target) {
        console.warn("can't find react-root element")
        return
    }

    const callback = (_mutations, observer) => {
        observer.disconnect()

        for (const el of $(SELECTOR)) {
            onElement(el)
        }

        observer.observe(target, init)
    }

    new MutationObserver(callback)
        .observe(target, init)
}

// hook HMLHTTPRequest#open so we can extract event data from the JSON
const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype

xhrProto.open = GMCompat.export(hookXHROpen(xhrProto.open))

// monitor the creation of trend/event elements after the page has loaded
//
// this script needs to be loaded early enough to intercept the JSON
// (document-start), but run after the page has loaded (DOMContentLoaded). this
// ensures the latter
$(run)

/* end */ }
