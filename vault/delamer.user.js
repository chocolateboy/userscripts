// ==UserScript==
// @name          Delamer
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     http://chocolatey.com/code/js
// @version       0.10
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @description   Demoronize Gawker Media Hashbang URLs
// @include       http://*.deadspin.com/*
// @include       http://deadspin.com/*
// @include       https://*.deadspin.com/*
// @include       https://deadspin.com/*
// @include       http://*.defamer.com/*
// @include       http://defamer.com/*
// @include       https://*.defamer.com/*
// @include       https://defamer.com/*
// @include       http://*.fleshbot.com/*
// @include       http://fleshbot.com/*
// @include       https://*.fleshbot.com/*
// @include       https://fleshbot.com/*
// @include       http://*.gawker.com/*
// @include       http://gawker.com/*
// @include       https://*.gawker.com/*
// @include       https://gawker.com/*
// @include       http://*.gizmodo.com/*
// @include       http://gizmodo.com/*
// @include       https://*.gizmodo.com/*
// @include       https://gizmodo.com/*
// @include       http://*.io9.com/*
// @include       http://io9.com/*
// @include       https://*.io9.com/*
// @include       https://io9.com/*
// @include       http://*.jalopnik.com/*
// @include       http://jalopnik.com/*
// @include       https://*.jalopnik.com/*
// @include       https://jalopnik.com/*
// @include       http://*.jezebel.com/*
// @include       http://jezebel.com/*
// @include       https://*.jezebel.com/*
// @include       https://jezebel.com/*
// @include       http://*.kotaku.com/*
// @include       http://kotaku.com/*
// @include       https://*.kotaku.com/*
// @include       https://kotaku.com/*
// @include       http://*.lifehacker.com/*
// @include       http://lifehacker.com/*
// @include       https://*.lifehacker.com/*
// @include       https://lifehacker.com/*
// @include       http://*.sploid.com/*
// @include       http://sploid.com/*
// @include       https://*.sploid.com/*
// @include       https://sploid.com/*
// @include       http://*.valleywag.com/*
// @include       http://valleywag.com/*
// @include       https://*.valleywag.com/*
// @include       https://valleywag.com/*
// ==/UserScript==

if ((location.pathname == '/') && location.hash && /^#(?:!|%21)/.test(location.hash)) {
    location.href = location.href.replace(/^(https?:\/\/)(?:\w+\.)*?(\w+\.com\b[^\/]*\/)#(?:!|%21)(.+)$/, '$1ca.$2$3');
}
