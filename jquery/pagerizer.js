// helper library for userscripts that mark up pages so that they can be navigated by keyboard
// e.g. with Pentadactyl's "[[" (<previous-page>) and "]]" (<next-page>) keys

jQuery.pagerizer = {
    getLinks: function(_document) {
        return [ this.getPrevLinks(_document), this.getNextLinks(_document) ];
    },

    getRelLinks: function(rel, _document) {
        var seen = {}, urls = [];
        var d = _document || document;

        if (rel == 'next' || rel == 'prev') {
            [ 'link', 'a' ].forEach(function(tag) {
                $(tag + '[rel~="' + rel + '"][href]', d).each(function() {
                    var url = jQuery.trim($(this).attr('href'));

                    if ((url != '') && (!seen[url])) {
                        urls.push(url);
                        seen[url] = true;
                    }
                });
            });
        }

        return urls;
    },

    getNextLinks: function(_document) {
        return this.getRelLinks('next', _document);
    },

    getPrevLinks: function(_document) {
        return this.getRelLinks('prev', _document);
    },

    // convert the list of rels to a lookup table:
    // [ "foo", "Bar", "BAZ" ] -> [ "foo": "foo", "bar": "Bar", "baz": "BAZ" ]
    getStringListAsMap: function (stringList) {
        var array;

        if (jQuery.isArray(stringList)) {
            array = stringList;
        } else if (typeof(stringList) === 'string') {
            array = jQuery.trim(stringList).split(/\s+/);
        } else { // extract the map's values
            array = [];
            if (stringList) { // watch out for null/undefined
                jQuery.each(stringList, function(key, value) { array.push(value) });
            }
        }

        var map = {};
        array.forEach(function(it) { map[it.toLowerCase()] = it });

        return map;
    },

    getStringListAsArray: function (stringList) {
        var map = this.getStringListAsMap(stringList);
        var array = [];
        jQuery.each(map, function(key, value) { array.push(value) });
        return array;
    }
};

jQuery.fn.setStringList = function (attr, stringList, removeIfEmpty) {
    if (arguments.length < 3) {
        removeIfEmpty = true;
    }

    var array = jQuery.pagerizer.getStringListAsArray(stringList);

    if (array.length) {
        this.attr(attr, array.join(' '));
    } else if (removeIfEmpty) {
        this.removeAttr(attr);
    }

    return this;
};

jQuery.fn.addRel = function() {
    var oldRels = jQuery.pagerizer.getStringListAsArray(this.attr('rel'));
    var newRels = jQuery.makeArray(arguments);

    this.setStringList('rel', oldRels.concat(newRels));

    return this;
};

jQuery.fn.removeRel = function() {
    var rels = jQuery.pagerizer.getStringListAsMap(this.attr('rel'));

    for (var i = 0; i < arguments.length; ++i) {
        var canonicalRel = arguments[i].toLowerCase();
        delete rels[canonicalRel];
    }

    this.setStringList('rel', rels);

    return this;
};
