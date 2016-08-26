// helper library for userscripts that mark up pages so that they can be navigated by keyboard
// e.g. with Vimperator/Pentadactyl's "[[" (<previous-page>) and "]]" (<next-page>) keys
//
// rel porn: http://blog.unto.net/a-survey-of-rel-values-on-the-web.html

jQuery.pagerizer = {
    // convert the list of strings to a lookup table:
    // [ "foo", "Bar", "BAZ" ] -> [ "foo": "foo", "bar": "Bar", "baz": "BAZ" ]
    getStringListAsMap: function (stringList) {
        var array;

        if (jQuery.isArray(stringList)) {
            array = stringList.forEach ? stringList : jQuery.makeArray(stringList);
        } else if (typeof(stringList) === 'string') {
            array = jQuery.trim(stringList).split(/\s+/);
        } else { // extract the map's values
            array = [];
            if (stringList) { // watch out for null/undefined
                jQuery.each(stringList, function (key, value) { array.push(value) });
            }
        }

        var map = {};
        array.forEach(function (string) { map[string.toLowerCase()] = string });
        return map;
    },

    // note: this is based on getStringListAsMap to ensure that
    // duplicates are removed
    getStringListAsArray: function (stringList) {
        var map = this.getStringListAsMap(stringList);
        return jQuery.map(map, function (key, value) { return value });
    }
};

jQuery.fn.setStringList = function (attr, stringList, removeIfEmpty) {
    var array = jQuery.pagerizer.getStringListAsArray(stringList);

    if (array.length === 0) {
        // an empty rel attribute in a LINK is invalid: remove the element
        // https://squizlabs.github.io/HTML_CodeSniffer/Standards/WCAG2/Examples/H59.2a.Fail.html
        // http://www.w3.org/TR/WCAG20-TECHS/H59
        if (this.is('link')) {
            this.remove('link');
        } else if (removeIfEmpty) {
            this.removeAttr(attr);
        }
    } else {
        this.attr(attr, array.join(' '));
    }

    return this;
};

// return all A and LINK elements which have rel attributes that
// include any of the supplied values. If no values are supplied,
// default to: findRelLinks('prev', 'previous', 'next')
jQuery.fn.findRelLinks = function () {
    var rels = arguments.length ?
        jQuery.makeArray(arguments).map(function (rel) { return jQuery.trim(rel) }) :
        [ 'prev', 'previous', 'next' ];

    var selector = rels.map(function (rel) {
        return 'a[rel~="%"], link[rel~="%"]'.replace(/%/g, rel)
    }).join(', ');

    return this.find(selector);
};

jQuery.fn.addRel = function () {
    var newRels = jQuery.makeArray(arguments);

    return this.each(function () {
        var $this = $(this);
        var oldRels = jQuery.pagerizer.getStringListAsArray($this.attr('rel'));
        $this.setStringList('rel', oldRels.concat(newRels));
    });
};

jQuery.fn.removeRel = function () {
    var removeRels = jQuery.makeArray(arguments).map(function (rel) { return rel.toLowerCase() });

    return this.each(function () {
        var $this = $(this);
        var rels = jQuery.pagerizer.getStringListAsMap($this.attr('rel'));

        for (var i = 0; i < removeRels.length; ++i) {
            delete rels[removeRels[i]];
        }

        $this.setStringList('rel', rels, true);
    });
};
