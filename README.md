# userscripts

<!-- toc -->

- [Installation](#installation)
  - [Engines](#engines)
- [Sites](#sites)
  - [Amazon](#amazon)
  - [GitHub](#github)
  - [Google](#google)
  - [Hacker News](#hacker-news)
  - [IMDb](#imdb)
  - [Last.fm](#lastfm)
  - [Reddit](#reddit)
  - [Rotten Tomatoes](#rotten-tomatoes)
- [Highlighters](#highlighters)
- [Pagerizers](#pagerizers)
- [Misc](#misc)
- [See Also](#see-also)
  - [Libraries](#libraries)
  - [Links](#links)
- [Author](#author)
- [Copyright and License](#copyright-and-license)

<!-- tocstop -->

## Installation

Unless otherwise noted, each link below points to the userscript's homepage on [GreasyFork](https://greasyfork.org/en/users/23939-chocolateboy).

Where possible, always install (or reinstall) these userscripts from GreasyFork, as this repo may contain development versions of these scripts that aren't ready for release and may not even compile. In addition, the file/directory names here are subject to change, whereas the URLs on GreasyFork will always remain stable.

### Engines

All of these scripts work in and are tested on [Violentmonkey](https://violentmonkey.github.io/), which is open source, cross browser, actively maintained, and highly recommended. If for some reason you can't use it — or don't want to — the following options are available:

- [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/)<sup>[1](#fn1)</sup>
- Tampermonkey ([closed source](https://github.com/Tampermonkey/tampermonkey/issues/214))

<a name="fn1"><sup><b>1</b></sup></a> The [Greasemonkey 4 API](https://www.greasespot.net/2017/09/greasemonkey-4-for-script-authors.html) is not [currently](https://github.com/chocolateboy/userscripts/issues/5) supported. Some scripts may work, but none have been tested.
<br />

## Sites

### Amazon

* [Amazon International Links](https://greasyfork.org/en/scripts/38639-amazon-international-links "Homepage") - add international links to Amazon product pages

### GitHub

* [GitHub First Commit](https://greasyfork.org/en/scripts/38557-github-first-commit "Homepage") - add a link to a GitHub repo's first commit

### Google

* [Google DWIMages](https://greasyfork.org/scripts/29420-google-dwimages/ "Homepage") - direct links to images and pages on Google Images

### Hacker News

* [Hacker News Date Tooltips](https://greasyfork.org/scripts/23432-hacker-news-date-tooltips/ "Homepage") - deobfuscate the "n days ago" dates on Hacker News with YYYY-MM-DD tooltips

### IMDb

* [IMDb Full Summary](https://greasyfork.org/scripts/23433-imdb-full-summary "Homepage") - automatically show the full plot summary on IMDb
* [IMDb Tomatoes](https://greasyfork.org/scripts/15222-imdb-tomatoes/ "Homepage") - add Rotten Tomatoes ratings to IMDb movie pages

### Last.fm

* [Last Picture Show](https://greasyfork.org/scripts/31179-last-picture-show/ "Homepage") - link last.fm artist/album images directly to the image page

### Reddit

* [Toggle Custom CSS](https://greasyfork.org/scripts/23434-reddit-toggle-custom-css/ "Homepage") - persistently disable/re-enable custom subreddit styles via a userscript command

### Rotten Tomatoes

* [More Tomatoes](https://greasyfork.org/scripts/23435-more-tomatoes/ "Homepage") - automatically show the full "Movie Info" plot synopsis on Rotten Tomatoes

## Highlighters

Highlight new stories since the last time a site was visited

* [BBC News](https://greasyfork.org/en/scripts/39310-bbc-news-highlighter "Homepage")
* [Digg](https://greasyfork.org/en/scripts/39308-digg-highlighter "Homepage")
* [Echo JS](https://greasyfork.org/en/scripts/39309-echo-js-highlighter "Homepage")
* [Hacker News](https://greasyfork.org/en/scripts/39311-hacker-news-highlighter "Homepage")
* [Lobsters](https://greasyfork.org/en/scripts/40906-lobsters-highlighter "Homepage")
* [Reddit](https://greasyfork.org/en/scripts/39312-reddit-highlighter "Homepage")

## Pagerizers

These scripts mark up pages with missing/sane `rel="prev"` and `rel="next"` links which can be consumed by a pager e.g. <kbd>[[</kbd> and <kbd>]]</kbd> in [Tridactyl](https://github.com/cmcaine/tridactyl), [Vim Vixen](https://github.com/ueokande/vim-vixen) etc.

The following are all direct links i.e. clicking them installs the script.

* [Amazon](https://github.com/chocolateboy/userscripts/raw/master/src/pagerize_amazon.user.js "Install")
* [Ars Technica](https://github.com/chocolateboy/userscripts/raw/master/src/pagerize_ars_technica.user.js "Install")
* [eBay](https://github.com/chocolateboy/userscripts/raw/master/src/pagerize_ebay.user.js "Install")
* [Hacker News](https://github.com/chocolateboy/userscripts/raw/master/src/pagerize_hacker_news.user.js "Install")
* [Metafilter](https://github.com/chocolateboy/userscripts/raw/master/src/pagerize_metafilter.user.js "Install")

## Misc

* [ISO 8601 Dates](https://greasyfork.org/scripts/23436-iso-8601-dates/ "Homepage") - display US dates in the ISO 8601 YYYY-MM-DD format

## See Also

### Libraries

* [jQuery Highlighter](https://github.com/chocolateboy/jquery-highlighter) - a jQuery plugin to highlight new items since the last time a site was visited
* [jQuery Pagerizer](https://github.com/chocolateboy/jquery-pagerizer) - a jQuery plugin to mark up web pages with next/previous page annotations

### Links

* [GreasyFork](https://greasyfork.org/en/users/23939-chocolateboy)
* [USO Mirror](http://userscripts-mirror.org/users/3169/scripts)

## Author

[chocolateboy](mailto:chocolate@cpan.org)

## Copyright and License

Copyright © 2011-2020 by chocolateboy.

These userscripts are free software; you can redistribute and/or modify them under the
terms of the [GPL](http://www.gnu.org/copyleft/gpl.html).
