// ==UserScript==
// @name          Twitter Linkify Trends
// @description   Make Twitter trends links (again)
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.2.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://mobile.x.com/
// @include       https://mobile.x.com/*
// @include       https://x.com/
// @include       https://x.com/*
// @require       https://code.jquery.com/jquery-3.7.1.slim.min.js
// @require       https://unpkg.com/gm-compat@1.1.0/dist/index.iife.min.js
// @require       https://unpkg.com/@chocolateboy/uncommonjs@3.2.1/dist/polyfill.iife.min.js
// @require       https://unpkg.com/get-wild@3.0.2/dist/index.umd.min.js
// @require       https://unpkg.com/flru@1.0.2/dist/flru.min.js
// @grant         GM_log
// @run-at        document-start
// ==/UserScript==

/// <reference types="jquery" />
/// <reference path="../types/gm-compat.d.ts" />

// XXX needed to appease esbuild
export {}

import { observe } from './lib/observer.js'

declare const exports: {
    default: typeof import('flru').default;
    get:     typeof import('get-wild').get;
}

type SidebarEvent = {
    core: { name: string };
    rest_id: string;
}

type TimelineEvent = {
    itemType: string;
    name: string;
    trend_url: { url: string };
}

/**
 * a map from event titles to their URLs. populated via the intercepted event
 * data (JSON)
 *
 * uses an LRU cache (flru) with up to 256 (128 * 2) entries
 */
const CACHE = exports.default(128)

/*
 * DOM events to disable (stop propagating) on event and trend elements
 */
const DISABLED_EVENTS = 'click touch'

/*
 * path to timeline event records within the JSON document; each record includes
 * a title and target URL
 */
const TIMELINE_EVENT_DATA = 'data.explore_page.body.initialTimeline.timeline.timeline.instructions[-1].entries.*.content.items.*.item.itemContent'

/*
 * path to event records for the "Today's News" sidebar within the JSON document;
 * each record includes a title and target URL
 */
const SIDEBAR_EVENT_DATA = 'data.story_topic.stories.items.*.trend_results.result'

/*
 * the last part of the pathname of the JSON document containing timeline event data
 */
const TIMELINE_EVENT_DATA_ENDPOINT = '/ExplorePage' // e.g. /i/api/graphql/abc123/ExplorePage

/*
 * the last part of the pathname of the JSON document containing sidebar event data
 */
const SIDEBAR_EVENT_DATA_ENDPOINT = '/useStoryTopicQuery' // e.g. /i/api/graphql/abc123/useStoryTopicQuery

/*
 * selectors for trend elements and event elements (i.e. Twitter's AI-curated
 * news links). works for trends/events in the "What's happening" panel in the
 * sidebar and on the dedicated trends pages (https://x.com/explore/tabs/*)
 */
const TIMELINE_EVENT = '[data-testid="trend"]:has([data-testid^="UserAvatar-Container"])'
const SIDEBAR_EVENT = '[data-testid^="news_sidebar_article_"]'
const EVENT = `div[role="link"]:is(${TIMELINE_EVENT}, ${SIDEBAR_EVENT}):not([data-linked])`
const TREND = 'div[role="link"][data-testid="trend"]:not(:has([data-testid^="UserAvatar-Container"])):not([data-linked])'
const VIDEO = 'div[role="presentation"] div[role="link"][data-testid^="media-tweet-card-"]:not([data-linked])'
const SELECTOR = [EVENT, TREND, VIDEO].join(', ')

/*
 * remove the onclick interceptors from event elements
 */
function disableAll (e: JQuery.Event) {
    // don't preventDefault: we still want links to work
    e.stopPropagation()
}

/**
 * remove the onclick interceptors from trend elements, apart from clicks on the
 * caret (which opens a drop-down menu)
 */
function disableSome (this: HTMLElement, e: JQueryEventObject) {
    const $target = $(e.target)
    const $caret = $target.closest('[data-testid="caret"]', this)

    if (!$caret.length) {
        // don't preventDefault: we still want links to work
        e.stopPropagation()
    }
}

/**
 * intercept XMLHTTPRequest#open requests for event data and pass the response
 * to a custom handler which extracts the URLs for the event elements
 *
 * @param {XMLHttpRequest['open']} oldOpen
 * @returns {XMLHttpRequest['open']}
 */
function hookXHROpen (oldOpen: XMLHttpRequest['open']) {
    return function open (this: XMLHttpRequest, _method: string, url: string) { // preserve the arity
        const { pathname } = URL.parse(url)!

        let onEventData: ((data: string) => void) | undefined

        if (pathname.endsWith(TIMELINE_EVENT_DATA_ENDPOINT)) {
            onEventData = onTimelineEventData
        } else if (pathname.endsWith(SIDEBAR_EVENT_DATA_ENDPOINT)) {
            onEventData = onSidebarEventData
        }

        if (onEventData) {
            // register a new listener
            this.addEventListener('load', () => onEventData(this.responseText))
        }

        // delegate to the original XHR#open handler
        return GMCompat.apply(this, oldOpen, arguments)
    }
}

/*
 * create a link (A) which targets the specified URL
 *
 * used to wrap the trend/event titles
 */
function linkFor (href: string) {
    return $('<a></a>')
        .attr({ href, role: 'link', 'data-focusable': true })
        .css({ color: 'inherit', textDecoration: 'inherit' })
}

/*
 * process a newly-created trend or event element
 */
function onElement (el: HTMLElement) {
    const $el = $(el)

    let fixPointer = true
    let linked = true

    // determine the element's type and pass it to the appropriate handler
    if ($el.is(EVENT)) {
        $el.on(DISABLED_EVENTS, disableAll)
        linked = onEventElement($el)
    } else if ($el.is(TREND)) {
        $el.on(DISABLED_EVENTS, disableSome)
        onTrendElement($el)
    } else if ($el.is(VIDEO)) {
        fixPointer = false
        $el.on(DISABLED_EVENTS, disableAll)
        onVideoElement($el)
    }

    // a link was added: tag the element so we don't select it again
    if (linked) {
        $el.attr('data-linked', 'true')
    }

    // remove the fake pointer
    if (fixPointer) {
        $el.css('cursor', 'auto')
    }
}

/*
 * linkify an event element: the target URL is (was) extracted from the
 * intercepted JSON
 *
 * returns true if the link has been updated (i.e. the event data has been
 * loaded), false otherwise (i.e. try again on the next DOM update)
 */
function onEventElement ($event: JQuery): boolean {
    const { target, title } = targetFor($event)
    const url = CACHE.get(title)

    // the JSON may be loaded after the element is detected, so wait until the
    // target URL becomes available
    if (!url) {
        return false
    }

    console.debug(`element (event):`, JSON.stringify(title))
    const $link = linkFor(url)
    $(target).parent().wrap($link)
    return true
}

/*
 * process the (JSON) data for events in the "Today's News" sidebar: extract
 * title/URL pairs for the event elements and store them in a cache
 */
function onSidebarEventData (json: string) {
    const data = JSON.parse(json)
    const events = exports.get<SidebarEvent[]>(data, SIDEBAR_EVENT_DATA, [])

    for (const event of events) {
        const { core: { name: title }, rest_id: id } = event
        const url = `${location.origin}/i/trending/${id}`
        console.debug('data (sidebar event):', { title, url })
        CACHE.set(title, url)
    }
}

/*
 * linkify a trend element: the target URL is derived from the title in the
 * element rather than from the JSON data
 */
function onTrendElement ($trend: JQuery) {
    const { target, title } = targetFor($trend)
    // use Twitter's quoting rule for compatibility
    const trend = /\s/.test(title) ? `"${title.replace(/"/g, '')}"` : title

    console.debug('element (trend):', trend)

    const query = encodeURIComponent(trend)
    const url = `${location.origin}/search?q=${query}&src=trend_click&vertical=trends`

    $(target).wrap(linkFor(url))
}

/*
 * process the (JSON) data for timeline events: extract title/URL pairs for the
 * event elements and store them in a cache
 */
function onTimelineEventData (json: string) {
    const data = JSON.parse(json)
    const events = exports.get<TimelineEvent[]>(data, TIMELINE_EVENT_DATA, [])

    for (const event of events) {
        // the index of records with event data isn't fixed, so filter them by
        // type
        if (event.itemType !== 'TimelineTrend') {
            break
        }

        const { name: title, trend_url: { url: uri } } = event
        const url = uri.replace(/^twitter:\/\//, `${location.origin}/i/`)
        console.debug('data (timeline event):', { title, url })
        CACHE.set(title, url)
    }
}

/*
 * linkify a video element ("Videos for you"): the target URL is derived from
 * the ID in the data-testid attribute, e.g.:
 *
 *     <div role="link" data-testid="media-tweet-card-12345678">...</div>
 */
function onVideoElement ($link: JQuery) {
    const id = $link.data('testid').split('-').at(-1)
    const url = `${location.origin}/i/web/status/${id}`
    $link.wrap(linkFor(url))
}

/*
 * given a trend or event element, return its target element (the SPAN
 * containing the element's title) along with its title text
 */
function targetFor ($el: JQuery) {
    // the target element is the last bold SPAN (live events have a preceding
    // bold SPAN containing the word "LIVE" in the header)
    const targets = $el.find('div[dir="ltr"] > span').filter((_, el) => {
        // the class for this is currently r-b88u0q (700) or r-1vr29t4 for
        // hero images (800)
        const fontWeight = Number($(el).parent().css('fontWeight') || 0)
        return fontWeight >= 700
    })

    const target = targets.get().pop()!
    const title = $(target).text().trim()

    return { target, title }
}

/******************************************************************************/

/*
 * monitor the creation of trend/event elements
 */
function run () {
    const target = document.getElementById('react-root')

    if (!target) {
        console.warn("can't find react-root element")
        return
    }

    observe(target, () => {
        for (const el of $(SELECTOR)) {
            onElement(el)
        }
    })
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
