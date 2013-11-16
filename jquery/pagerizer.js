// helper library for userscripts that mark up pages so that they can be navigated by keyboard
// e.g. with Pentadactyl's "[[" (<previous-page>) and "]]" (<next-page>) keys

jQuery.pagerizer = {
    // convert the list of strings to a lookup table:
    // [ "foo", "Bar", "BAZ" ] -> [ "foo": "foo", "bar": "Bar", "baz": "BAZ" ]
    getStringListAsMap: function(stringList) {
        var array;

        if (jQuery.isArray(stringList)) {
            array = stringList.forEach ? stringList : jQuery.makeArray(stringList);
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

    // note: this is based on getStringListAsMap to ensure that
    // duplicates are removed
    getStringListAsArray: function(stringList) {
        var map = this.getStringListAsMap(stringList);
        return $.map(map, function(key, value) { return value });
    }
};

jQuery.fn.setStringList = function(attr, stringList, removeIfEmpty) {
    var array = jQuery.pagerizer.getStringListAsArray(stringList);

    if (array.length) {
        this.attr(attr, array.join(' '));
    } else if (removeIfEmpty) {
        this.removeAttr(attr);
    }

    return this;
};

// return all A and LINK elements which have rel attributes that
// include any of the supplied values. If no values are supplied,
// default to [ 'prev', 'next' ]
jQuery.fn.findRelLinks = function() {
    var rels = arguments.length ? jQuery.makeArray(arguments).map(function(arg) { return jQuery.trim(arg) }) : [ 'prev', 'next' ];
    var selector = rels.map(function(rel) { return 'a[rel~="%"], link[rel~="%"]'.replace(/%/g, rel) }).join(', ');
    return this.find(selector);
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
