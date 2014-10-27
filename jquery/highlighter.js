// required: jQuery, GM_deleteValue, GM_getValue, GM_setValue
// optional: GM_registerMenuCommand

jQuery.highlight = (function ($) {
    var DEFAULT_ID = function ($item) { return $item.attr('id') };
    var DEFAULT_TARGET = function ($item) { return $item };
    var DEFAULT_TTL = { days: 7 };
    var HIGHLIGHT_COLOR = '#FFFD66';
    var KEY = 'seen';
    var TTL = {
        days:    24 * 60 * 60 * 1000,
        hours:   60 * 60 * 1000,
        minutes: 60 * 1000,
        seconds: 1000
    };

    function ttlToMilliseconds(ttl) {
        var ms = 0;

        for (var key in TTL) {
            var value = ttl[key];

            if (value) {
                ms += value * TTL[key];
            }
        }

        return ms;
    }

    function select(selector, args) {
        if (typeof(selector) === 'function') {
            return args ? selector.apply(args.shift(), args) : selector();
        } else {
            return args ? $(selector, args.shift()) : $(selector);
        }
    }

    function highlight(options) {
        // article ID -> cache expiry timestamp (epoch milliseconds)
        var seen = JSON.parse(GM_getValue(KEY, '{}'));
        // time-to-live: how long (in milliseconds) to cache IDs for
        var ttl = ttlToMilliseconds(options.ttl || DEFAULT_TTL);
        // the background color of the target element(s)
        var color = options.color || HIGHLIGHT_COLOR;
        // the current date/time in epoch milliseconds
        var now = new Date().getTime();

        // purge expired IDs
        for (var id in seen) {
            if (now > seen[id]) {
                delete seen[id];
            }
        }

        var items = select(options.item);

        if (!items) {
            console.warn('bad item: selector: %s', options.item);
            return;
        }

        var targetSelector = options.target || DEFAULT_TARGET;
        var idSelector = options.id || DEFAULT_ID;

        var getId = (typeof(idSelector) === 'function') ?
            function (idArgs) { return select(idSelector, idArgs) } :
            function (idArgs) { return idArgs[1].attr(idSelector) };

        items.each(function () {
            var $item = $(this);
            var targetArgs = [ this, $item ];
            var $target = select(targetSelector, targetArgs);

            if (!$target) {
                console.warn('bad target: selector: %s, args: %o', targetSelector, targetArgs);
                return;
            }

            var idArgs = [ this, $item, $target ];
            var id = getId(idArgs);

            if (!id) {
                console.warn('bad id: selector: %s, args: %o', idSelector, idArgs);
                return;
            }

            if (!seen[id]) {
                $target.css('background-color', color);
                seen[id] = now + ttl;
            }
        });

        GM_setValue(KEY, JSON.stringify(seen));

        if (options.site) {
            var commandName = options.site + ' Highlighter: clear data';
            GM_registerMenuCommand(commandName, function () { GM_deleteValue(KEY) });
        }
    }

    return highlight;
})(jQuery);
