// ==UserScript==
// @name          Twitter Linkify Trends
// @description   Make Twitter trends links (again)
// @author        chocolateboy
// @copyright     chocolateboy
// @version       1.0.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://twitter.com/
// @include       https://twitter.com/*
// @include       https://mobile.twitter.com/
// @include       https://mobile.twitter.com/*
// @require       https://code.jquery.com/jquery-3.5.1.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/eclecto/jQuery-onMutate@79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/gm-compat@a26896b85770aa853b2cdaf2ff79029d8807d0c0/index.min.js
// @require       https://unpkg.com/@chocolateboy/uncommonjs@2.0.1/index.min.js
// @require       https://unpkg.com/tmp-cache@1.0.0/lib/index.js
// @grant         GM_log
// @inject-into   auto
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

// a map from event IDs to their URLs. populated via the intercepted trends
// data (JSON)
const CACHE = new exports.Cache({ maxAge: 60 * 60 * 1000 }) // one hour

// events to disable (stop propagating) on event and trend elements
const DISABLED_EVENTS = 'click touch'

// path to the array of event records within the JSON document; each record
// includes an ID, title, URL and image URL (which includes the ID)
const EVENTS = 'timeline.instructions.*.addEntries.entries.*.content.timelineModule.items.*.item.content.eventSummary'

// an immutable array used to indicate "no values". static to avoid unnecessary
// allocations
const NONE = []

// selector for elements in the "What's happening" panel in the sidebar and the
// dedicated trends pages (https://twitter.com/explore/tabs/*)
//
// includes actual trends as well as "events" (news items)
const EVENT_SELECTOR = [
    'div[role="link"]:not([data-testid])',
        ':has(> div > div:nth-child(2):nth-last-child(1) img[src])'
].join('')

const TREND_SELECTOR = 'div[role="link"][data-testid="trend"]'

const SELECTOR = [EVENT_SELECTOR, TREND_SELECTOR].join(', ')

// remove all of Twitter's interceptors for events raised on event elements
function disableEventEvents (e) {
    // don't preventDefault: we still want links to work
    e.stopPropagation()
}

// remove all of Twitter's interceptors for events raised on trend elements
// apart from clicks on the caret, which opens a drop-down menu
function disableTrendEvents (e) {
    const $target = $(e.target)
    const $caret = $target.closest('[data-testid="caret"]', this)

    if (!$caret.length) {
        // don't preventDefault: we still want links to work
        e.stopPropagation()
    }
}

// a version of lodash.get with support for wildcards
function get (obj, path, $default) {
    if (!obj) {
        return $default
    }

    let props, prop

    if (Array.isArray(path)) {
        props = path.slice(0) // clone
    } else if (typeof path === 'string') {
        props = path.split('.')
    } else {
        throw new Error('path must be an array or string')
    }

    while (props.length) {
        if (!obj) {
            return $default
        }

        prop = props.shift()

        if (prop === '*') {
            // Object.values is very forgiving and works with anything that
            // can be turned into an object via Object(...), i.e. everything
            // but undefined and null, which we've guarded against above.
            return Object.values(obj).flatMap(value => {
                return get(value, props.slice(0), NONE)
            })
        }

        obj = obj[prop]

        if (obj === undefined) {
            return $default
        }
    }

    return obj
}

// intercept XMLHTTPRequest#open calls which pull in data for the "What's
// happening" (Trends) panel, and pass the response (JSON) to a custom handler
// which extracts ID/URL pairs for the event elements
function hookXHROpen (oldOpen) {
    return function open (_method, url) {
        const $url = new URL(url)

        if ($url.pathname === '/2/guide.json') {
            // register a new listener
            this.addEventListener('load', () => processEvents(this.responseText))
        }

        return oldOpen.apply(this, arguments)
    }
}

// takes a URL and creates the link which is wrapped around the trend and event
// titles
function linkFor (href) {
    return $('<a></a>')
        .attr({ href, role: 'link', 'data-focusable': true })
        .css({ color: 'inherit', textDecoration: 'inherit' })
}

// update an event element: the link is extracted from the JSON data used to
// populate the "What's happening" panel.
function onEvent ($event) {
    const { $target, title } = targetFor($event)
    const $title = JSON.stringify(title)
    const $image = $event.find('> div > div:nth-child(2) img[src]')

    // console.debug(`event: ${$title}`)

    if ($image.length === 0) {
        console.warn(`Can't find image in event: ${$title}`)
        return
    }

    const key = new URL($image.attr('src')).pathname
    const url = CACHE.get(key)

    if (url) {
        const $link = linkFor(url)
        $target.wrap($link)
        $event.find('div:has(> img)').wrap($link) // also wrap the image
    } else {
        console.warn(`Can't find URL for event: ${$title}`)
    }
}

// update a trend element: the link is derived from the title in the element
// rather than from the JSON
function onTrend ($trend) {
    const { $target, title } = targetFor($trend)
    const unquoted = title.replace(/"/g, '')

    // console.debug(`trend: ${JSON.stringify(unquoted)}`)

    const query = encodeURIComponent('"' + unquoted + '"')
    const url = `${location.origin}/search?q=${query}`

    $target.wrap(linkFor(url))
}

// process a collection of newly-created trend or event elements. determines the
// element's type and passes it to the appropriate handler
function onTrends ($trends) {
    for (const el of $trends) {
        const $el = $(el)

        // remove the fake pointer
        $el.css('cursor', 'auto')

        // remove event hijacking and dispatch to the handler
        if ($el.data('testid') === 'trend') {
            $el.on(DISABLED_EVENTS, disableTrendEvents)
            onTrend($el)
        } else {
            $el.on(DISABLED_EVENTS, disableEventEvents)
            onEvent($el)
        }
    }
}

// process the events data (JSON): extract ID/URL pairs for the event elements
// and store them in a cache
function processEvents (json) {
    const data = JSON.parse(json)
    const events = get(data, EVENTS, NONE)

    if (!events.length) {
        return
    }

    console.debug(`processing events: ${events.length}`)

    for (const event of events) {
        const { image: { url: imageURL }, url: { url } } = event
        const key = new URL(imageURL).pathname.replace(/\.\w+$/, '')

        CACHE.set(key, url)
    }

    // keep track of the cache size (for now) to ensure it doesn't become a
    // memory hog
    console.debug(`cache size: ${CACHE.size}`)
}

// given a trend or event element, return its target element — i.e. the SPAN
// containing the element's title — along with its title text
function targetFor ($el) {
    const $target = $el.find('div[dir="ltr"]').first().find('> span')
    const title = $target.text().trim()

    return { $target, title }
}

// hook HMLHTTPRequest#open so we can extract event data from the JSON
const xhrProto = GMCompat.unsafeWindow.XMLHttpRequest.prototype

xhrProto.open = GMCompat.export(hookXHROpen(XMLHttpRequest.prototype.open))

// monitor the creation of trend/event elements
$.onCreate(SELECTOR, onTrends, true /* multi */)
