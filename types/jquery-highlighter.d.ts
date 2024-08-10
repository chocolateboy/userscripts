import JQuery = require('jquery')

type JQueryHighlighterOptions<T extends HTMLElement = HTMLElement> = {
    cache?:       boolean;
    color?:       string;
    debug?:       boolean;
    dedup?:       boolean;
    id?:          string | ((this: T, target: JQuery) => string);
    item:         string | (() => Iterable<Element>);
    onHighlight?: ((this: T, target: JQuery, options: { id: string, color: string }) => void);
    target?:      string | (<U extends HTMLElement = HTMLElement>(this: T, item: U) => JQuery);
    ttl?:         Record<string, number>;
}

declare global {
    interface JQueryStatic {
        highlight: {
            <T extends HTMLElement = HTMLElement>(options: JQueryHighlighterOptions<T>): Promise<void>;
            className: string;
            selector: string;
        }
    }
}
