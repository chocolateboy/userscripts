// required: jQuery, GM_deleteValue, GM_getValue, GM_registerMenuCommand, GM_setValue

jQuery.highlight = (function ($) {
    var CLASS          = 'github-com-chocolateboy-userscripts-jquery-highlighter-highlighted';
    var DEFAULT_ID     = 'id';
    var DEFAULT_TARGET = function () { return $(this) }; // i.e. $item
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

    function ttlToMilliseconds (ttl) {
        var ms = 0, key;

        for (key in ttl) {
            ms += ttl[key] * (TTL[key] || 0);
        }

        return ms;
    }

    function select (name, selector, _context, args) {
        var context = _context || document;
        var type = typeof selector;

        if (type === 'function') {
            return selector.apply(context, args || []);
        } else if (type === 'string') {
            return $(selector, context);
        } else {
            throw new TypeError('invalid ' + name + ' selector: expected string or function, got: ' + type);
        }
    }

    function highlight (options) {
        // article ID -> cache expiry timestamp (epoch milliseconds)
        var seen = debug ? {} : JSON.parse(GM_getValue(KEY, '{}'));

        // time-to-live: how long (in milliseconds) to cache IDs for
        var ttl = ttlToMilliseconds(options.ttl || DEFAULT_TTL);

        // the background color of the target element(s)
        var color = options.color || DEFAULT_COLOR;

        // if true, the cache is neither read from nor written to.
        // this allows userscripts to be modified and reloaded
        // without having to manually clear the cache each time
        var debug = options.debug;

        // the current date/time in epoch milliseconds
        var now = new Date().getTime();

        // purge expired IDs
        for (var id in seen) {
            if (now > seen[id]) {
                delete seen[id];
            }
        }

        var targetSelector = options.target || DEFAULT_TARGET;
        var idSelector = options.id || DEFAULT_ID;
        var itemSelector = options.item;

        var getId = (typeof idSelector === 'function') ?
            function (item, args) { return select('id', idSelector, item, args) } :
            function (item) { return $(item).attr(idSelector) };

        var onHighlight = options.onHighlight || function () {};

        var $items = select('item', itemSelector);

        function processItems ($items) {
            $items.each(function () {
                var $target = select('target', targetSelector, this);
                var id = getId(this, [ $target ]);

                if (!seen[id]) {
                    $target.css('background-color', color);
                    $target.addClass(CLASS);
                    onHighlight.call(this, $target, { id: id, color: color });
                    seen[id] = now + ttl;
                }
            });

            if (!debug) {
                GM_setValue(KEY, JSON.stringify(seen));
            }
        }

        // handle dynamically-created items if the jQuery-onMutate plugin is loaded
        var $document = $(document);

        if ($document.onCreate && (typeof itemSelector === 'string')) {
            $document.onCreate(itemSelector, processItems, true);
        }

        // handle the statically-defined items
        processItems($items);
    }

    highlight.className = CLASS;
    highlight['class']  = '.' + CLASS;

    return highlight;
}(jQuery));
