// ==UserScript==
// @name          Amazon International Links
// @description   Add international links to Amazon product pages
// @author        chocolateboy
// @copyright     chocolateboy
// @version       3.2.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://smile.amazon.tld/*
// @include       https://www.amazon.tld/*
// @require       https://code.jquery.com/jquery-3.4.1.min.js
// @require       https://cdn.jsdelivr.net/gh/sizzlemctwizzle/GM_config@6a82709680bbeb3bd2041a4345638b628d537c96/gm_config.js
// @require       https://cdn.jsdelivr.net/gh/aduth/hijinks@23b74cdb43d3a76f4981c815eb3961c2625c7ae7/hijinks.min.js
// @grant         GM_registerMenuCommand
// @grant         GM_getValue
// @grant         GM_setValue
// @inject-into   content
// ==/UserScript==

/*
 *
 * further reading:
 *
 *     http://helpful.knobs-dials.com/index.php/Amazon_notes#Links
 */

/*********************** Constants ********************************/

// a map from the Amazon TLD to the corresponding two-letter country code
// XXX technically, UK should be GB: http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
const SITES = {
    'com.au': 'AU', // Australia
    'com.br': 'BR', // Brazil
    'ca':     'CA', // Canada
    'cn':     'CN', // China
    'fr':     'FR', // France
    'de':     'DE', // Germany
    'in':     'IN', // India
    'it':     'IT', // Italy
    'co.jp':  'JP', // Japan
    'com.mx': 'MX', // Mexico
    'nl':     'NL', // Netherlands
    'es':     'ES', // Spain
    'co.uk':  'UK', // UK
    'com':    'US', // US
}

// Amazon TLDs which support the "smile.amazon" subdomain
const SMILE = { 'com': true, 'co.uk': true, 'de': true }

// a tiny DOM builder to avoid cluttering the code with HTML templates
// https://github.com/aduth/hijinks
const el = hijinks

/*********************** Functions and Classes ********************************/

// A class which encapsulates the logic for creating and updating cross-site links
class Linker {
    // get the unique identifier (ASIN - Amazon Standard Identification Number)
    // for this product, or return a falsey value if it's not found
    static getASIN () {
        let asin, $asin = $('input#ASIN, input[name="ASIN"], input[name="ASIN.0"]')

        if ($asin.length) {
            asin = $asin.val()
        } else { // if there's a canonical link, try to retrieve the ASIN from its URI
            // <link rel="canonical" href="https://www.amazon.com/Follows-Movie-Poster-18-28/dp/B01BKUBARA" />
            let match, canonical = $('link[rel="canonical"][href]').attr('href')

            if (canonical && (match = canonical.match('/dp/(\\w+)$'))) {
                asin = match[1]
            }
        }

        return asin
    }

    constructor (asin) {
        // the unique Amazon identifier for this product
        this.asin = asin

        // the navbar to add the cross-site links to
        this.crossSiteLinks = $('#nav-xshop')

        // an array of our added elements - jQuery objects representing
        // <a>...</a> links
        //
        // we keep a reference to these elements so we can easily remove them
        // from the DOM (and replace them with new elements) whenever the
        // country selection changes
        this.links = []

        // extract and store 1) the subdomain (e.g. "www.amazon") and 2) the TLD
        // (e.g. "co.uk") of the current site
        const parts = location.hostname.split('.')

        // 1) the subdomain (part before the TLD) of the current site e.g.
        // "www.amazon" or "smile.amazon"
        this.subdomain = parts.slice(0, 2).join('.')

        // 2) the TLD of the current site e.g. "co.uk" or "com"
        this.tld = parts.slice(2).join('.')
    }

    // add a link element to the internal `links` array
    addLink (tld, country) {
        const attrs = {
            class: 'nav-a',
            style: 'display: inline-block',
            title: `amazon.${tld}`
        }

        // XXX we can't always preserve the "smile.amazon" subdomain as it's not
        // available for most Amazon TLDs
        const subdomain = SMILE[tld] ? this.subdomain : 'www.amazon'

        let tag

        if (tld === this.tld) {
            tag = 'strong'
        } else {
            tag = 'a'
            attrs.href = `//${subdomain}.${tld}/dp/${this.asin}`
        }

        const link = el(tag, attrs, country)

        this.links.push($(link))
    }

    // populate the array of links and display them by appending them to the
    // body of the cross-site navigation bar
    addLinks () {
        // create the subset of the TLD -> country-code map (SITES)
        // corresponding to the enabled sites
        const sites = Object.entries(SITES)
            .filter(([tld]) => GM_config.get(tld))
            .reduce((obj, [key, val]) => { return obj[key] = val, obj }, {})

        if (!$.isEmptyObject(sites)) {
            // sort the sites by the country code (e.g. AU) rather than the TLD
            // (e.g. com.au)
            // const tlds = sortBy(Object.keys(sites), tld => sites[tld])
            const tlds = Object.keys(sites).sort((a, b) => sites[a].localeCompare(sites[b]))

            // populate the `links` array with jQuery wrappers for link
            // (i.e. <a>...</a>) elements
            for (const tld of tlds) {
                const country = sites[tld]
                this.addLink(tld, country)
            }

            // append the cross-site links to the body of the crossSiteLinks container
            this.crossSiteLinks.append.apply(this.crossSiteLinks, this.links)
        }
    }

    // build the underlying data model used by the GM_config utility
    initializeConfig () {
        const checkboxes = {}

        for (const tld of Object.keys(SITES)) {
            const country = SITES[tld]

            checkboxes[tld] = {
                type: 'checkbox',
                label: country,
                title: `amazon.${tld}`,
                default: (country === 'UK' || country === 'US')
            }
        }

        // re-render the links when the settings are updated
        const save = () => {
            this.removeLinks()
            this.addLinks()
            GM_config.close()
        }

        const callbacks = { save }

        GM_config.init('Amazon International Links Settings', checkboxes, callbacks)
    }

    // remove all added links from the DOM and clear the array referencing them
    removeLinks () {
        const { links } = this

        for (const $link of links) {
            $link.remove() // remove from the DOM...
        }

        links.length = 0; // ...and empty the array
    }
}

/*********************** Main ********************************/

const asin = Linker.getASIN()

if (asin) {
    const showConfig = () => GM_config.open() // display the settings manager
    const linker = new Linker(asin)

    linker.initializeConfig()
    linker.addLinks()

    GM_registerMenuCommand('Configure Amazon International Links', showConfig)
}
