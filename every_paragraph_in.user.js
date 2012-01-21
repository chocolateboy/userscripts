// ==UserScript==
// @name        Every Paragraph In...
// @namespace   https://github.com/chocolateboy/userscripts
// @description Add paragraphs to Every Film in 2011/2012 &c. Reviews
// @author      chocolateboy
// @version     0.0.1
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

const PREFORMATTED = /^\s*(Laughs|Jumps|Tears|Vomit|Nudity)\s*:\s*\S/;
var $posts = $('div.post-body');

// separator divs are useless noise on the main page, and on article pages
// they wrap every line, rendering this script useless.
$posts.find('div.separator').after('<br />').contents().unwrap();

$posts.contents().filter(function () {
    return (
        (this.nodeType == 3) &&                 // text node
        this.nextSibling &&                     // with a following (non-text) node
        (this.nextSibling.nodeName == 'BR') &&  // which is a <br /> element
        this.nodeValue.match(/\S/) &&           // non-whitespace
        !this.nodeValue.match(PREFORMATTED)     // not pre-formatted
    );
}).each(function() {
    $(this).after($('<br />'));
});
