// required: jQuery, GM_deleteValue, GM_getValue, GM_registerMenuCommand, GM_setValue

jQuery.highlight = (function ($) {
    var DEFAULT_ID     = function ($item) { return $item.attr('id') };
    var DEFAULT_TARGET = function ($item) { return $item };
    var DEFAULT_TTL    = { days: 7 };
    var DEFAULT_COLOR  = '#FFFD66';
    var KEY            = 'seen';

    var TTL = (function (ttl) {
        ttl.minutes = 60 * ttl.seconds;
        ttl.hours   = 60 * ttl.minutes;
        ttl.days    = 24 * ttl.hours;
        ttl.weeks   = 7  * ttl.days;
        return ttl;
    })({ seconds: 1000 });

    // register this early so data can be cleared even if there's an error
    var commandName = GM_info.script.name + ': clear data';
    GM_registerMenuCommand(commandName, function () { GM_deleteValue(KEY) });

    function ttlToMilliseconds(ttl) {
        var ms = 0, key;

        for (key in ttl) {
            ms += ttl[key] * (TTL[key] || 0);
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
        var color = options.color || DEFAULT_COLOR;
        // the current date/time in epoch milliseconds
        var now = new Date().getTime();

        // purge expired IDs
        for (var id in seen) {
            if (now > seen[id]) {
                delete seen[id];
            }
        }

        var $items = select(options.item);

        if (!$items) {
            console.warn('bad item: selector: %s', options.item);
            return;
        }

        var targetSelector = options.target || DEFAULT_TARGET;
        var idSelector = options.id || DEFAULT_ID;

        var getId = (typeof(idSelector) === 'function') ?
            function (idArgs) { return select(idSelector, idArgs) } :
            function (idArgs) { return idArgs[1].attr(idSelector) };

        $items.each(function () {
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
    }

    return highlight;
}(jQuery));
