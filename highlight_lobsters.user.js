// ==UserScript==
// @name          Lobsters Highlighter
// @description   Highlight new stories on Lobsters
// @author        chocolateboy
// @copyright     chocolateboy
// @version       0.0.3
// @namespace     https://github.com/chocolateboy/userscripts
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://lobste.rs/
// @include       /^https://lobste\.rs/(newest|page|recent|t)\b/
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/jquery-highlighter@478971a2a6e279f73cc65680e1e25ae0b62a3820/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({ item: 'li.story', target: '.link a' })
