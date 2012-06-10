// ==UserScript==
// @name        FullTube
// @namespace   https://github.com/chocolateboy/userscripts
// @description Adds a full-screen button to embedded YouTube videos
// @version     0.40
// @author      chocolateboy
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     *
// @exclude     http://youtube.com/*
// @exclude     http://*.youtube.com/*
// @exclude     https://youtube.com/*
// @exclude     https://*.youtube.com/*
// ==/UserScript==

/*
 * 1) Iterate over all YouTube embed elements and make sure:
 *    a) their @src attribute contains "&fs=1" (or append it if it doesn't).
 *    b) the @allowFullScreen attribute is set to "true"
 *
 * This handles minimal, <embed>...</embed>-only embeds and does no harm to <object>...</object>
 * or <param>...</param> embeds.
 *
 * 2) Iterate over all object and/or param elements that contain at least one @movie/@src param
 *    with a YouTube link @value. These are required to have consistent attributes and/or
 *    child elements. Check/repair them.
 *
 * 3) Iterate over all YouTube iframe elements and make sure their @src attribute contains "&fs=1"
 * (or append it if it doesn't).
 *
 * The awkward squad (all tested and verified):
 *
 * 1) SMF 2.0 RC3 - uses SWFObject: params without name="movie" or name="src"
 *    (only <object data="http://www.youtube.com/v...">)
 *    http://code.google.com/p/swfobject/
 *
 * 2) http://www.avclub.com/articles/our-favorite-film-scenes-of-the-00s,35888/
 *    embeds without object parents (all &fs=1, though, and they work with or without FullTube)
 *
 * 3) Buzzfeed uses bare <embed>...</embed>s e.g. http://www.buzzfeed.com/mjs538/mom-ruins-hockey-fight e.g.
 *
 * <embed
 *     src="http://www.youtube.com/v/pzhkPfZwk20"
 *     type="application/x-shockwave-flash"
 *     allowscriptaccess="always"
 *     allowfullscreen="true"
 *     bgcolor="#000"
 *     wmode="transparent"
 *     height="376"
 *     width="625">
 *
 */

/*
 *
 * Unsupported:
 *
 * 1) HTML5 iframes don't support the fs parameter e.g. (with HTML video enabled on YouTube):
 *    http://thedailywh.at/2012/05/18/morning-fluff-202/
 *    See https://developers.google.com/youtube/player_parameters#fs
 */

const EMBEDS = '//embed[(contains(@src, "youtube.com/v/") or contains(@src, "youtube-nocookie.com/v/"))]';

const OBJECTS = '//object[(contains(@data, "youtube.com/v/") or contains(@data, "youtube-nocookie.com/v/")) '
               + 'or ./param[(@name="movie" or @name="src") '
               + 'and (contains(@value, "youtube.com/v/") '
               + 'or contains(@value, "youtube-nocookie.com/v/"))]]';

const IFRAMES = '//iframe[(contains(@src, "youtube.com/embed/") or contains(@src, "youtube-nocookie.com/embed/") '
               + 'or contains(@src, "youtube.com/v/") or contains(@src, "youtube-nocookie.com/v/"))]';

function xpath(xpath, context) {
    var node_list = document.evaluate(xpath, context || document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    var length;

    if (length = node_list.snapshotLength) {
        node_list.for_each = function(f) {
            for (var i = 0; i < length; ++i) {
                f(node_list.snapshotItem(i));
            }
        };
        return node_list;
    } else {
        return null;
    }
}

function fs(url) {
    url = unescape(url);
    url = url.replace(/[?& ]+$/, ''); // remove trailing question marks, ampersands or spaces
    url = url.replace(/\bfs=(\w)*/g, 'fs=1');

    if (!url.match(/[&?]fs=1\b/)) {
        url += url.match(/\?/) ? '&fs=1' : '?fs=1';
    }

    return url;
}

function full_tube() {
    var embeds, objects, iframes;

    if (embeds = xpath(EMBEDS)) {
        embeds.for_each(function(embed) {
            embed.setAttribute('src', fs(embed.getAttribute('src')));
            embed.setAttribute('allowFullScreen', 'true');
        });
    }

    if (objects = xpath(OBJECTS)) {
        var nobjects = objects.snapshotLength;
        objects.for_each(function(object) {
            var params, param, data, uri;

            if (params = xpath('.//param[@name="allowFullScreen"]', object)) {
                params.for_each(function(param) { param.setAttribute('value', 'true') });
            } else {
                param = document.createElement('param');
                param.setAttribute('name', 'allowFullScreen');
                param.setAttribute('value', 'true');
                object.appendChild(param);
            }

            if (params = xpath('.//param[@name="movie" or @name="src"]', object)) {
                params.for_each(function(param) {
                    // record the URI for later use
                    uri = fs(param.getAttribute('value'));
                    param.setAttribute('value', uri);
                });
            } else {
                uri = fs(object.getAttribute('data'));
                /*
                 * embeds clearly work without this,
                 * but while we're at it we may as well
                 * make this conform to YouTube's own
                 * embed code
                 */
                param = document.createElement('param');
                param.setAttribute('name', 'movie');
                param.setAttribute('value', uri);
                object.appendChild(param);
            }

            if (data = object.getAttribute('data')) {
                object.setAttribute('data', fs(data));
            } else {
                object.setAttribute('data', uri);
            }

            if (embeds = xpath('.//embed[@src]', object)) {
                embeds.for_each(function(embed) {
                    embed.setAttribute('allowfullscreen', 'true');
                    embed.setAttribute('src', uri);
                });
            } else {
                embed = document.createElement('embed');
                embed.setAttribute('allowfullscreen', 'true');
                embed.setAttribute('src', uri);
                object.appendChild(embed);
            }
        });
    }

    if (iframes = xpath(IFRAMES)) {
        iframes.for_each(function(iframe) {
            iframe.setAttribute('src', fs(iframe.getAttribute('src')));
        });
    }
}

GM_registerMenuCommand('FullTube', full_tube);
window.addEventListener('load', full_tube, false);
