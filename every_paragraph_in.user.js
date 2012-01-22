// ==UserScript==
// @name        Every Paragraph In...
// @namespace   https://github.com/chocolateboy/userscripts
// @description Add paragraphs to Every Film in 2011/2012 &c. Reviews
// @author      chocolateboy
// @version     0.2.0
// @license     GPL: http://www.gnu.org/copyleft/gpl.html
// @include     http://everyfilmin2011.blogspot.com
// @include     http://everyfilmin2011.blogspot.com/*
// @include     http://everyfilmin2012.blogspot.com
// @include     http://everyfilmin2012.blogspot.com/*
// @require     https://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.js
// ==/UserScript==

/*
 * jQuery 1.6.2
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.js
 */

/*
 * test cases:
 *
 * italics:
 *
 *   http://everyfilmin2011.blogspot.com/2011/12/588-beyond-time-william-turnbull.html
 *
 * trailing unicode:
 *
 *     http://everyfilmin2011.blogspot.com/2011/01/24-rabbit-hole.html
 */

const PREFORMATTED = /^\s*(Laughs|Jumps|Tears|Vomit|Nudity)\s*:\s*\S/;
var $posts = $('div.post-body');

/*
 * posts variously wrap paragraphs in:
 *
 *     div
 *     div.separator
 *     span.Apple-style-span
 *
 * Not all of these containers are followed by BRs.
 * Rather than dealing with every possible way the markup has been mangled,
 * simply a) append a BR to each container; b) unwrap the contents of each
 * container; and c) clean up any redundant BRs afterwards
 */

$posts.find('div, span').after('<br />').contents().unwrap();
$posts.find('div, span').remove(); // expunge broken (contentless) containers

$posts.contents().filter(function () {
    return (
        this.nextSibling &&                        // has a following node
        (this.nextSibling.nodeName == 'BR') &&     // which is a BR
        ((this.nodeType == 3) ?                    // if it's a text node...
            (this.nodeValue.match(/\S/) &&         // ... it must be non-whitespace
            !this.nodeValue.match(PREFORMATTED)) : // ... and not pre-formatted
            true)
    );
}).each(function() {
    $(this).after($('<br />'));
});

// cleanup
$posts.each(function () {
    var $this = $(this);
    var html = $this.html();

    // remove misplaced Unicode BOM
    html = html.replace(/\ufeff/g, '');
    // squash 2 or more spaced BRs down to 2 clean BRs
    html = html.replace(/(?:\s|&nbsp;)*(?:<br\s*\/?>(?:\s|&nbsp;)*){2,}/gi, '<br /><br />');
    // remove any leading BRs
    html = html.replace(/^(?:\s|&nbsp;)(?:<br\s*\/?>(?:\s|&nbsp;)*)*/i, '');
    // remove any trailing BRs
    html = html.replace(/(?:\s|&nbsp;)*(?:<br\s*\/?>(?:\s|&nbsp;)*)*$/i, '');

    $this.html(html);
});
