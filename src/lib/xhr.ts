type XHR = XMLHttpRequest

export type OnResponse = (xhr: XHR, uri: string) => void;

/*
 * replace the built-in XHR#send method with a custom version which calls the
 * supplied response handler. once done, we delegate to the original handler
 * (this.onreadystatechange)
 */
export const hookXHRSend = (oldSend: XHR['send'], onResponse: OnResponse): XHR['send'] => {
    return function send (this: XMLHttpRequest, body = null) {
        const oldOnReadyStateChange = this.onreadystatechange

        this.onreadystatechange = function (event) {
            if (this.readyState === this.DONE && this.responseURL && this.status === 200) {
                onResponse(this, this.responseURL)
            }

            if (oldOnReadyStateChange) {
                oldOnReadyStateChange.call(this, event)
            }
        }

        oldSend.call(this, body)
    }
}
