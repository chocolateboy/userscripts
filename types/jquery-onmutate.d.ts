import JQuery = require('jquery')

declare global {
    interface JQueryStatic {
        onCreate (selector: JQuery.Selector, callback: ($results: JQuery) => void, multi?: boolean): void;
    }

    interface JQuery<TElement = HTMLElement> {
        onCreate (selector: JQuery.Selector, callback: ($results: JQuery) => void, multi?: boolean): void;
    }
}
