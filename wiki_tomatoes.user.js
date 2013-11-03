// ==UserScript==
// @name        Wiki Tomatoes
// @namespace   http://www.chocolatey.com/code/js
// @description Adds a Rotten Tomatoes link to Wikipedia film articles that contain an IMDb link
// @version     0.40.0
// @author      chocolateboy
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     *.wikipedia.org/wiki/*
// @include     https://secure.wikimedia.org/wikipedia/*/wiki/*
// @grant       none
// ==/UserScript==

var $ATTRS = 'href="$HREF" class="external text" title="$TITLE - Rotten Tomatoes" rel="nofollow"';
var $RT = '<a href="/wiki/Rotten_Tomatoes" title="Rotten Tomatoes">Rotten Tomatoes</a>';
var $RT_BASE_URI = 'http://www.rottentomatoes.com/alias?type=imdbid&s=';

var $LOCALES = {
    de: [ '<a $ATTRS>Kritiken</a> zu <i>$TITLE</i> auf $RT (englisch)', extract_german_title ],
    en: '<a $ATTRS><i>$TITLE</i></a> at $RT',
    es: '<a $ATTRS><i>$TITLE</i></a> en $RT (en inglés)',
    fr: '<span style="cursor:help;font-family:monospace;font-weight:bold;font-size:small" title="Langue&#160;: anglais">' +
        '(en)' +
        '</span> ' +
        '<a $ATTRS><i>$TITLE</i></a> sur $RT',
    it: '(<span style="font-weight: bolder; font-size: 80%">' +
        '<a href="/wiki/Lingua_inglese" title="Lingua inglese">EN</a>' +
        '</span>) <a $ATTRS><i>$TITLE</i></a> su $RT'
};

/*
 * 1) Find the last ul element that contains an IMDb link and no Rotten Tomatoes link
 * 2) within that ul element, repeat the subexpression to select the IMDb link
 *
 * The XPath query takes the following pseudo-pipeline form:
 *
 *     select: all ul elements
 *     filter: doesn't contain a Rotten Tomatoes link
 *     filter: contains an IMDb link
 *     filter: is the last such ul
 *     select: its IMDb link
 *
 * Note: the IMDb URI might be:
 *
 *     imdb.com
 *     imdb.fr
 *     www.imdb.com
 *     www.imdb.fr
 *
 * &c.
 */

var $XPATH = '//ul' + 
   '[count(li//a[contains(@class, "external") and contains(@href, "rottentomatoes.com/")])=0]' +
   '[li//a[contains(@class, "external") and contains(@href, "imdb.") and contains(@href, "/title/tt")]]' +
   '[position()=last()]' +
   '/li//a[contains(@class, "external") and contains(@href, "imdb.") and contains(@href, "/title/tt")]';

/****************************************************************************************************/

function render($locale, $title, $href) {
    var $template = ($locale.constructor == Array) ? $locale[0] : $locale;
    var $html = $template.
        replace(/\$ATTRS/g, $ATTRS). // this must be first, as it contains embedded macros
        replace(/\$RT/g, $RT).
        replace(/\$HREF/g, $href).
        replace(/\$TITLE/g, $title);

    return $html;
}

function extract_title($locale, $imdb_li, $imdb_link) {
    return ($locale.constructor == Array) ? $locale[1]($imdb_li, $imdb_link) : $imdb_link.textContent; 
}

function extract_german_title($imdb_li, $imdb_link) {
    var $title;

    if ($imdb_li.firstChild.nodeName.toLowerCase() == 'i') {
        $title = $imdb_li.firstChild.textContent;
    } else {
        $title = document.title.replace(/\s+-\s+Wikipedia\s*$/, '');
    }

    return $title;
}

/****************************************************************************************************/

var $imdb_link = document.evaluate($XPATH, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

if ($imdb_link) {
    var $lang;

    if (location.hostname == 'secure.wikimedia.org') {
        $lang = location.pathname.split('/')[2];
    } else {
        $lang = location.hostname.split('.')[0];
    }

    var $locale = $LOCALES[$lang] || $LOCALES['en'];
    var $imdb_id = $imdb_link.getAttribute('href').match(/\/title\/tt(\w+)/)[1];
    var $rt_uri = $RT_BASE_URI + $imdb_id;
    var $imdb_li = $imdb_link.parentNode;

    while ($imdb_li.nodeName.toLowerCase() != 'li') {
        $imdb_li = $imdb_li.parentNode;
    }

    var $title = extract_title($locale, $imdb_li, $imdb_link);
    var $rt_li = document.createElement('li');

    $rt_li.innerHTML = render($locale, $title, $rt_uri);
    $imdb_li.appendChild($rt_li);
}
