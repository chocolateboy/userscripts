# userscripts

<!-- toc -->

- [Installation](#installation)
  - [Compatibility](#compatibility)
- [Sites](#sites)
  - [Amazon](#amazon)
  - [GitHub](#github)
  - [Google](#google)
  - [Hacker News](#hacker-news)
  - [IMDb](#imdb)
  - [Last.fm](#lastfm)
  - [Reddit](#reddit)
  - [Rotten Tomatoes](#rotten-tomatoes)
  - [Twitter](#twitter)
- [Highlighters](#highlighters)
- [Pagerizers](#pagerizers)
- [Misc](#misc)
- [See Also](#see-also)
  - [Addons](#addons)
  - [Libraries](#libraries)
  - [jQuery Plugins](#jquery-plugins)
  - [Sites](#sites-1)
- [Author](#author)
- [Copyright and License](#copyright-and-license)

<!-- tocstop -->

## Installation

Unless otherwise noted, each link below points to the userscript's homepage on
[GreasyFork](https://greasyfork.org/en/users/23939-chocolateboy).

Where possible, always install (or reinstall) these userscripts from
GreasyFork, as this repo may contain development versions of these scripts that
aren't ready for release and which may not even compile. In addition, the
file/directory names here are subject to change, whereas the URLs on GreasyFork
will always remain stable.

### Compatibility

All of these scripts work in and are tested on
[Violentmonkey](https://violentmonkey.github.io/), which is open source, cross
browser, actively maintained, and highly recommended. If for some reason you
can't use it — or don't want to — the following options are available:

- [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/)<sup>[1](#fn1)</sup>
- Tampermonkey ([closed source](https://github.com/Tampermonkey/tampermonkey/issues/214))

<a name="fn1"><sup><b>1</b></sup></a> The
[Greasemonkey 4 API](https://www.greasespot.net/2017/09/greasemonkey-4-for-script-authors.html)
is not [currently](https://github.com/chocolateboy/userscripts/issues/5)
supported. Some scripts work, but most haven't been tested. <br />

## Sites

### Amazon

- [Amazon International Links](https://greasyfork.org/en/scripts/38639-amazon-international-links "Homepage") - add international links to Amazon product pages

### GitHub

- [GitHub First Commit](https://greasyfork.org/en/scripts/38557-github-first-commit "Homepage") - add a link to a GitHub repo's first commit
- [GitHub My Issues](https://greasyfork.org/en/scripts/411765-github-my-issues "Homepage") - add a contextual link to issues you've contributed to on GitHub

### Google

- [Google DWIMages](https://greasyfork.org/scripts/29420-google-dwimages/ "Homepage") - direct links to images and pages on Google Images

### Hacker News

- [Hacker News Date Tooltips](https://greasyfork.org/scripts/23432-hacker-news-date-tooltips/ "Homepage") - deobfuscate the "n days ago" dates on Hacker News with YYYY-MM-DD tooltips

### IMDb

- [IMDb Full Summary](https://greasyfork.org/scripts/23433-imdb-full-summary "Homepage") - automatically show the full plot summary on IMDb
- [IMDb Tomatoes](https://greasyfork.org/scripts/15222-imdb-tomatoes/ "Homepage") - add Rotten Tomatoes ratings to IMDb movie and TV show pages

### Last.fm

- [Last Picture Show](https://greasyfork.org/scripts/31179-last-picture-show/ "Homepage") - link last.fm artist/album images directly to the image page

### Reddit

- [Reddit Toggle Custom CSS](https://greasyfork.org/scripts/23434-reddit-toggle-custom-css/ "Homepage") - persistently disable/re-enable custom subreddit styles via a userscript command

### Rotten Tomatoes

- [More Tomatoes](https://greasyfork.org/scripts/23435-more-tomatoes/ "Homepage") - automatically show the full "Movie Info" plot synopsis on Rotten Tomatoes

### Twitter

- [Twitter Direct](https://greasyfork.org/en/scripts/404632-twitter-direct) - remove t.co tracking links from Twitter
- [Twitter Linkify Trends](https://greasyfork.org/en/scripts/405103-linkify-twitter-trends) - make Twitter trends links (again)
- [Twitter Zoom Cursor](https://greasyfork.org/en/scripts/413963-twitter-zoom-cursor) - distinguish between images and links on Twitter (userstyle)

## Highlighters

Highlight new stories since the last time a site was visited

- [BBC News](https://greasyfork.org/en/scripts/39310-bbc-news-highlighter "Homepage")
- [Hacker News](https://greasyfork.org/en/scripts/39311-hacker-news-highlighter "Homepage")
- [Lobsters](https://greasyfork.org/en/scripts/40906-lobsters-highlighter "Homepage")
- [Reddit](https://greasyfork.org/en/scripts/39312-reddit-highlighter "Homepage")

## Pagerizers

These scripts mark up pages with missing/sane `rel="prev"` and `rel="next"`
links which can be consumed by a pager e.g. <kbd>[[</kbd> and <kbd>]]</kbd> in
[Tridactyl](https://github.com/cmcaine/tridactyl), [Vim Vixen](https://github.com/ueokande/vim-vixen)
etc.

The following are all direct links i.e. clicking them installs the script.

- [Amazon](https://github.com/chocolateboy/userscripts/raw/master/src/pagerize_amazon.user.js "Install")
- [Ars Technica](https://github.com/chocolateboy/userscripts/raw/master/src/pagerize_ars_technica.user.js "Install")
- [eBay](https://github.com/chocolateboy/userscripts/raw/master/src/pagerize_ebay.user.js "Install")
- [Metafilter](https://github.com/chocolateboy/userscripts/raw/master/src/pagerize_metafilter.user.js "Install")

## Misc

- [ISO 8601 Dates](https://greasyfork.org/scripts/23436-iso-8601-dates/ "Homepage") - display US dates in the ISO 8601 YYYY-MM-DD format

## See Also

### Addons

- [Google Direct](https://github.com/chocolateboy/google-direct) - a Firefox addon which removes tracking links from Google Search results

### Libraries

- [gm-compat](https://github.com/chocolateboy/gm-compat) - portable monkey-patching for userscripts
- [gm-storage](https://github.com/chocolateboy/gm-storage) - an ES6 Map wrapper for the synchronous userscript storage API
- [UnCommonJS](https://github.com/chocolateboy/uncommonjs) - a minimum viable shim for `module.exports`

### jQuery Plugins

- [jQuery Highlighter](https://github.com/chocolateboy/jquery-highlighter) - highlight new items since the last time a site was visited
- [jQuery Pagerizer](https://github.com/chocolateboy/jquery-pagerizer) - mark up web pages with next/previous page annotations

### Sites

- [GreasyFork](https://greasyfork.org/en/users/23939-chocolateboy)
- [USO Mirror](https://userscripts-mirror.org/users/3169/scripts)

## Author

[chocolateboy](mailto:chocolate@cpan.org)

## Copyright and License

Copyright © 2011-2021 by chocolateboy.

These userscripts are free software; you can redistribute and/or modify them
under the terms of the [GPL](https://www.gnu.org/copyleft/gpl.html).
