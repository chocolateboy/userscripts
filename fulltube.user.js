// ==UserScript==
// @name        FullTube
// @namespace   https://github.com/chocolateboy/userscripts
// @description Adds a full-screen button to embedded YouTube videos
// @version     0.80.0
// @author      chocolateboy
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     *
// @exclude     http://youtube.com/*
// @exclude     http://*.youtube.com/*
// @exclude     https://youtube.com/*
// @exclude     https://*.youtube.com/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js
// @require     https://sprintf.googlecode.com/files/sprintf-0.7-beta1.js
// @grant       GM_registerMenuCommand
// ==/UserScript==

/*
 * @requires:
 *
 * jQuery 2.0.3
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.js
 *
 * sprintf() for JavaScript
 *
 *     http://www.diveintojavascript.com/projects/javascript-sprintf
 */

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
 *    XXX Update (2012-10-17): no longer working: e.g.:
 *
 *        http://www.avclub.com/articles/the-mirror-has-two-faces-15-great-movie-scenes-whe,86576/
 *
 *    - fixed in 0.70
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
 * 4) Bad iframe embed URL (prevents full screen working) e.g. http://selfstarter.us/
 * the iframe URL is fixed to conform to:
 * https://developers.google.com/youtube/player_parameters#Embedding_a_Player
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

var EMBEDS = '//embed[(contains(@src, "youtube.com/v/") or contains(@src, "youtube-nocookie.com/v/"))]';

var OBJECTS = '//object[(contains(@data, "youtube.com/v/") or contains(@data, "youtube-nocookie.com/v/")) '
               + 'or ./param[(@name="movie" or @name="src") '
               + 'and (contains(@value, "youtube.com/v/") '
               + 'or contains(@value, "youtube-nocookie.com/v/"))]]';

var IFRAMES = '//iframe[(contains(@src, "youtube.com/embed/") or contains(@src, "youtube-nocookie.com/embed/") '
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

function fs(uri) {
    uri = unescape(uri);
    uri = uri.replace(/[?& ]+$/, ''); // remove trailing question marks, ampersands or spaces
    uri = uri.replace(/\bfs=(\w)*/g, 'fs=1');

    if (!uri.match(/[&?]fs=1\b/)) {
        uri += uri.match(/\?/) ? '&fs=1' : '?fs=1';
    }

    return uri;
}

// only set an element's src attribute (or equivalent) if the
// supplied URI is different to the attribute's current value.
// this reduces unnecessary reloading
function setSrc(element, src, _name) {
    var name = _name ? _name : 'src';

    if (!element.getAttribute(name) || (element.getAttribute(name) != src)) {
        element.setAttribute(name, src);
    }
}

function full_tube() {
    var embeds, objects, iframes;

    if (embeds = xpath(EMBEDS)) {
        embeds.for_each(function(embed) {
            var src = fs(embed.getAttribute('src'));
            setSrc(embed, src);
            embed.setAttribute('allowFullScreen', 'true');
            // bare embeds (i.e. not wrapped by objects) no longer support
            // full screen (in FF 16/Chromium 22), so wrap them; any remaining
            // object requirements will be added below
            var $embed = $(embed);
            if (!$embed.parent('object').length) {
                $embed.wrap(
                    sprintf(
                        '<object data="%s"%s%s />',
                        src,
                        ($embed.attr('width') ? sprintf(' width="%s"', $embed.attr('width')) : ''),
                        ($embed.attr('height') ? sprintf(' height="%s"', $embed.attr('height')) : '')
                    )
                );
            }
        });
    }

    if (objects = xpath(OBJECTS)) {
        objects.for_each(function(object) {
            var params;
            if (params = xpath('.//param[@name="allowFullScreen"]', object)) {
                params.for_each(function(param) { param.setAttribute('value', 'true') });
            } else {
                var param = document.createElement('param');
                param.setAttribute('name', 'allowFullScreen');
                param.setAttribute('value', 'true');
                object.appendChild(param);
            }

            var uri;
            if (params = xpath('.//param[@name="movie" or @name="src"]', object)) {
                params.for_each(function(param) {
                    // record the URI for later use
                    uri = fs(param.getAttribute('value'));
                    setSrc(param, uri, 'value');
                });
            } else {
                uri = fs(object.getAttribute('data'));
                /*
                 * embeds clearly work without this,
                 * but while we're at it we may as well
                 * make this conform to YouTube's own
                 * embed code
                 */
                var param = document.createElement('param');
                param.setAttribute('name', 'movie');
                setSrc(param, uri, 'value');
                object.appendChild(param);
            }

            var data;
            if (data = object.getAttribute('data')) {
                setSrc(object, fs(data), 'data');
            } else {
                setSrc(object, uri, 'data');
            }

            var embeds;
            if (embeds = xpath('.//embed[@src]', object)) {
                embeds.for_each(function(embed) {
                    embed.setAttribute('allowfullscreen', 'true');
                    setSrc(embed, uri);
                });
            } else {
                var embed = document.createElement('embed');
                embed.setAttribute('allowfullscreen', 'true');
                setSrc(embed, uri);
                object.appendChild(embed);
            }
        });
    }

    if (iframes = xpath(IFRAMES)) {
        iframes.for_each(function(iframe) {
            var src = fs(iframe.getAttribute('src'));

            // replace youtube.com/v/xyz?foo=bar with youtube.com/embed/xyz?foo=bar
            if (src.match(/\/v\//)) {
                src = src.replace('/v/', '/embed/');
            }

            setSrc(iframe, src);
        });
    }
}

GM_registerMenuCommand('FullTube', full_tube);
window.addEventListener('load', full_tube, false);
