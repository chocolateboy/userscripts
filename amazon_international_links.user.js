// ==UserScript==
// @name          Amazon International Links
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       1.4.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @description   Add international links to Amazon product pages
// @include       http://www.amazon.ca/*
// @include       http://www.amazon.cn/*
// @include       http://www.amazon.co.jp/*
// @include       http://www.amazon.com/*
// @include       http://www.amazon.co.uk/*
// @include       http://www.amazon.de/*
// @include       http://www.amazon.es/*
// @include       http://www.amazon.fr/*
// @include       http://www.amazon.it/*
// @include       https://www.amazon.ca/*
// @include       https://www.amazon.cn/*
// @include       https://www.amazon.co.jp/*
// @include       https://www.amazon.com/*
// @include       https://www.amazon.co.uk/*
// @include       https://www.amazon.de/*
// @include       https://www.amazon.es/*
// @include       https://www.amazon.fr/*
// @include       https://www.amazon.it/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js
// @require       https://raw.github.com/sizzlemctwizzle/GM_config/master/gm_config.js
// @require       https://sprintf.googlecode.com/files/sprintf-0.7-beta1.js
// @require       https://cdnjs.cloudflare.com/ajax/libs/lodash.js/3.6.0/lodash.min.js
// @grant         GM_registerMenuCommand
// ==/UserScript==

/*
 * @requires:
 *
 * jQuery 2.1.3
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.js
 *
 * GM_config
 *
 *     https://github.com/sizzlemctwizzle/GM_config/wiki
 *
 * sprintf() for JavaScript
 *
 *     http://www.diveintojavascript.com/projects/javascript-sprintf
 *     https://github.com/alexei/sprintf.js
 *
 * lodash.js utility library
 *
 *     https://lodash.com/
 */

/*
 *
 * further reading:
 *
 *     http://helpful.knobs-dials.com/index.php/Amazon_notes#Links
 */

/*********************** Constants ********************************/

var ASIN, CROSS_SITE_LINK_CLASS, CURRENT_TLD, LINKS, PROTOCOL, SITES;
var $CROSS_SHOP_LINKS, $LINK, $SEPARATOR; // the $ sigil denotes jQuery objects
var addLink, displayLinks; // functions that depend on the site design

/*********************** Functions ********************************/

// lazily initialize constants - these are only assigned if the ASIN is found
function initializeConstants (asin) {
    var location = document.location;

    // the cross-site/shop links container in the "modern" design
    $CROSS_SHOP_LINKS = $('#nav-cross-shop-links');

    if ($CROSS_SHOP_LINKS.length) {
        addLink = modernAddLink;
        displayLinks = modernDisplayLinks;
    } else {
        // the CSS class for cross-site links in the "classic" design
        CROSS_SITE_LINK_CLASS = 'navCrossshopYALink';

        // the penultimate Amazon cross-site link e.g. "Your Account"
        $LINK = $('a.' + CROSS_SITE_LINK_CLASS).eq(-2);

        // a span with a spaced vertical bar
        $SEPARATOR = $LINK.next();

        addLink = classicAddLink;
        displayLinks = classicDisplayLinks;
    }

    // the unique Amazon identifier for this product
    ASIN = asin;

    // one of the current Amazon TLDs
    CURRENT_TLD = location.hostname.substr('www.amazon.'.length);

    // an array of our added elements - jQuery objects representing (classic)
    // alternating links and separators or (modern) li-wrapped links
    LINKS = [];

    // http: or https:
    PROTOCOL = location.protocol;

    // a map from the Amazon TLD to the corresponding two-letter country code
    SITES = {
        'ca':    'CA',
        'cn':    'CN',
        'de':    'DE',
        'es':    'ES',
        'fr':    'FR',
        'it':    'IT',
        'co.jp': 'JP',

        // technically (shmechnically), this should be GB:
        // http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
        'co.uk': 'UK',

        'com':   'US'
    };
}

// build the underlying data model used by the GM_config utility
function initializeConfig () {
    var checkboxes = _(SITES).keys().foldl(
        function (fields, tld) {
            var country = SITES[tld];

            fields[tld] = {
                type: 'checkbox',
                label: country,
                title: sprintf('amazon.%s', tld),
                default: (country == 'UK' || country == 'US')
            };

            return fields;
        },
        {}
    ).value();

    // re-render the links if the settings are updated
    var callbacks = {
        save: function () { removeLinks(); addLinks() }
    };

    GM_config.init('Amazon International Links Settings', checkboxes, callbacks);
}

// display the settings manager
function showConfig () {
    GM_config.open();
}

// return the subset of the TLD -> country code map (SITES)
// corresponding to the enabled sites
function getConfiguredSites () {
    return _(SITES).keys().foldl(
        function (sites, tld) {
            if (GM_config.get(tld)) {
                sites[tld] = SITES[tld];
            }
            return sites;
        },
        {}
    ).value();
}

// remove all added links from the DOM and clear the array
// referencing them
function removeLinks () {
    _.each(LINKS, function (el) { el.remove() });
    LINKS.length = 0; // clear the array of links and separators
}

// add a link + separator to the LINKS array
function classicAddLink (tld, country) {
    var html;

    if (tld == CURRENT_TLD) {
        html = sprintf('<strong title="amazon.%s">%s</strong>', tld, country);
    } else {
        html = sprintf(
            '<a href="%s//www.amazon.%s/dp/%s" class="%s" title="amazon.%2$s">%s</a>',
            PROTOCOL, tld, ASIN, CROSS_SITE_LINK_CLASS, country
        );
    }

    LINKS.push($(html), $SEPARATOR.clone());
}

// add a li-wrapped link to the LINKS array
function modernAddLink (tld, country) {
    var html;

    if (tld == CURRENT_TLD) {
        html = sprintf(
            '<li class="nav-xs-link"><span style="font-weight: bold" title="amazon.%s">%s</span></li>',
            tld,
            country
        );
    } else {
        html = sprintf(
            '<li class="nav-xs-link"><a class="nav_a" href="%s//www.amazon.%s/dp/%s" title="amazon.%2$s">%s</a></li>',
            PROTOCOL, tld, ASIN, country
        );
    }

    var $link = $(html);

    // 2014-03-07: Amazon appear to be testing a new design
    // in which these links are no longer enclosed by <li>
    // elements
    if (!$CROSS_SHOP_LINKS.children('li').length) {
        $link = $link.children(); // remove the <li> wrapper
    }

    LINKS.push($link);
}

// prepend the cross-site links to the "Your Account" link
function classicDisplayLinks () {
    $LINK.before.apply($LINK, LINKS);
}

// append the cross-site links to the body of the nav-cross-shop-links <ul> element
function modernDisplayLinks () {
    $CROSS_SHOP_LINKS.append.apply($CROSS_SHOP_LINKS, LINKS);
}

// populate the array of links and display them by attaching them to the body of
// the cross-site navigation bar
function addLinks () {
    var sites = getConfiguredSites();

    if (!_.isEmpty(sites)) {
        var tlds = _(sites).keys().sortBy(function (tld) { return sites[tld] }).value();

        _.each(tlds, function (tld) {
            var country = sites[tld];
            addLink(tld, country);
        });

        displayLinks();
    }
}

/*********************** Main ********************************/

var asin;
var $asin = $('input#ASIN, input[name="ASIN"], input[name="ASIN.0"]');

if ($asin.length) {
    asin = $asin.val();
} else { // if there's a canonical link, try to retrieve the ASIN from the URI
    // <link rel="canonical" href="http://www.amazon.com/The-Frozen-Lake-ebook/dp/B005O53TPE" />
    var canonical = $('link[rel="canonical"][href]').attr('href');
    var match;

    if (canonical && (match = canonical.match('/dp/(\\w+)$'))) {
        asin = match[1];
    }
}

if (asin) {
    initializeConstants(asin);
    initializeConfig();
    GM_registerMenuCommand('Configure Amazon International Links', showConfig);
    addLinks();
}
