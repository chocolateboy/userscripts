// ==UserScript==
// @name          Amazon International Links
// @description   Add international links to Amazon product pages
// @author        chocolateboy
// @copyright     chocolateboy
// @version       4.1.0
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL
// @include       https://smile.amazon.tld/*
// @include       https://www.amazon.com.be/*
// @include       https://www.amazon.tld/*
// @require       https://code.jquery.com/jquery-3.7.1.slim.min.js
// @require       https://cdn.jsdelivr.net/gh/sizzlemctwizzle/GM_config@43fd0fe4de1166f343883511e53546e87840aeaf/gm_config.js
// @grant         GM_registerMenuCommand
// @grant         GM_getValue
// @grant         GM_setValue
// ==/UserScript==

// XXX GM_getValue and GM_setValue are used by GM_config

/*
 *
 * further reading:
 *
 *     https://helpful.knobs-dials.com/index.php/Amazon_notes#Links
 */

/*********************** Constants ********************************/

/*
 * a map from the Amazon TLD to the corresponding two-letter country code
 *
 * XXX technically, UK should be GB: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
 */
const SITES = {
    'com.au': 'AU', // Australia
    'com.be': 'BE', // Belgium
    'com.br': 'BR', // Brazil
    'ca':     'CA', // Canada
    'cn':     'CN', // China
    'fr':     'FR', // France
    'de':     'DE', // Germany
    'in':     'IN', // India
    'ie':     'IE', // Ireland
    'it':     'IT', // Italy
    'co.jp':  'JP', // Japan
    'com.mx': 'MX', // Mexico
    'nl':     'NL', // Netherlands
    'es':     'ES', // Spain
    'se':     'SE', // Sweden
    'com.tr': 'TR', // Turkey
    'ae':     'AE', // UAE
    'co.uk':  'UK', // UK
    'com':    'US', // US
}

/*
 * Amazon TLDs which support the "smile.amazon" subdomain
 */
const SMILE = new Set(['com', 'co.uk', 'de'])

/*********************** Functions and Classes ********************************/

/*
 * A class which encapsulates the logic for creating and updating cross-site links
 */
class Linker {
    /*
     * get the unique identifier (ASIN - Amazon Standard Identification Number)
     * for this product, or return a falsey value if it's not found
     */
    static getASIN () {
        const $asin = $('input#ASIN, input[name="ASIN"], input[name="ASIN.0"]')
          let asin

        if ($asin.length) {
            asin = $asin.val()
        } else { // if there's a canonical link, try to retrieve the ASIN from its URI
            // <link rel="canonical" href="https://www.amazon.com/Follows-Movie-Poster-18-28/dp/B01BKUBARA" />
            const canonical = $('link[rel="canonical"][href]').attr('href')
              let match

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
        this.navbar = $('#nav-xshop .nav-ul')

        // an array of our added elements - jQuery wrappers of child elements of
        // the cross-site links navbar
        //
        // we keep a reference to these elements so we can easily remove them
        // from the DOM (and replace them with new elements) whenever the
        // country selection changes
        this.links = []

        // extract and store 1) the subdomain (e.g. "www.amazon") and 2) the TLD
        // (e.g. "co.uk") of the current site
        const parts = location.hostname.split('.')

        // 1) the subdomain (part before the TLD) of the current site, e.g.
        // "www.amazon" or "smile.amazon"
        this.subdomain = parts.slice(0, 2).join('.')

        // 2) the TLD of the current site, e.g. "co.uk" or "com"
        this.tld = parts.slice(2).join('.')
    }

    /*
     * add a child element to the internal `links` array
     */
    addLink (tld, country) {
        const attrs = {
            class: 'nav-a',
            title: `amazon.${tld}`
        }

        // XXX we can't always preserve the "smile.amazon" subdomain as it's not
        // available for most Amazon TLDs
        const subdomain = SMILE.has(tld) ? this.subdomain : 'www.amazon'

        let tag

        if (tld === this.tld) {
            tag = 'strong'
        } else {
            tag = 'a'
            attrs.href = `//${subdomain}.${tld}/dp/${this.asin}`
        }

        // serialize the attributes, e.g. { title: 'amazon.com' } -> `title="amazon.com"`
        const $attrs = Object.entries(attrs)
            .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
            .join(' ')

        const link =
            `<li class="nav-li">
                <div class="nav-div">
                    <${tag} ${$attrs}>${country}</${tag}>
                </div>
            </li>`

        this.links.push($(link))
    }

    /*
     * populate the array of links and display them by prepending them to the
     * body of the cross-site navigation bar
     */
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

            // populate the `links` array with jQuery wrappers for each link
            // element (e.g. <li>...</li>)
            for (const tld of tlds) {
                this.addLink(tld, sites[tld])
            }

            // prepend the cross-site links to the body of the navbar
            this.navbar.prepend(...this.links)
        }
    }

    /*
     * build the underlying data model used by the GM_config utility
     */
    initializeConfig () {
        const checkboxes = {}

        // sort by country code
        for (const tld of Object.keys(SITES).sort((a, b) => SITES[a].localeCompare(SITES[b]))) {
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

    /*
     * remove all added links from the DOM and clear the array referencing them
     */
    removeLinks () {
        const { links } = this

        for (const $link of links) {
            $link.remove() // remove from the DOM...
        }

        links.length = 0 // ...and empty the array
    }
}

/*********************** Main ********************************/

const run = () => {
    const asin = Linker.getASIN()

    if (asin) {
        const showConfig = () => GM_config.open() // display the settings manager
        const linker = new Linker(asin)

        linker.initializeConfig()
        linker.addLinks()

        GM_registerMenuCommand('Configure Amazon International Links', showConfig)
    }
}

run()
