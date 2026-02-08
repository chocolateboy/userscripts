/// <ref path="./types/gm-compat.d.ts" />

import { assign, type Maybe } from './util.js'

type XHR = XMLHttpRequest
type URLLike = string | URL

export type RequestParams = {
    method?: string;
    url: URLLike;
    async?: boolean;
    user?: Maybe<string>;
    password?: Maybe<string>;
}

export type OnError = EventListener
export type OnRequest = (xhr: XHR, request: RequestParams) => Maybe<RequestParams> | void;
export type OnResponse = (xhr: XHR, url: string) => void;
export type Unhook = () => void

const $unsafeWindow = GMCompat.unsafeWindow

export const hookRequest = (onRequest: OnRequest): Unhook => {
    const xhrProto = $unsafeWindow.XMLHttpRequest.prototype
    const oldOpen = xhrProto.open

    // preserve the arity
    function open (
        this: XHR,
        method: string,
        url: URLLike,
        async = true,
        user: Maybe<string> = null,
        password: Maybe<string> = null
    ) {
        const $request = { method, url, async, user, password }
        const request = structuredClone($request)
        const result = onRequest(this, request)
        const r = result ? assign($request, result) : $request

        // delegate to the original XHR#open handler
        oldOpen.call(
            this,
            r.method,
            r.url,
            r.async,
            r.user,
            r.password,
        )
    }

    xhrProto.open = GMCompat.export(open)
    return () => { xhrProto.open = oldOpen }
}

/*
 * replace the built-in XHR#send method with a custom version which calls the
 * supplied response handler. once done, we delegate to the original handler
 * (this.onreadystatechange)
 */
export const hookResponse = (onResponse: OnResponse, onError?: OnError): Unhook => {
    const xhrProto = $unsafeWindow.XMLHttpRequest.prototype
    const oldSend = xhrProto.send

    function send (this: XMLHttpRequest, body = null) {
        const oldOnReadyStateChange = this.onreadystatechange

        if (onError) {
            this.addEventListener('error', onError)
        }

        this.onreadystatechange = function (event) {
            if (this.readyState === this.DONE && this.status === 200) {
                onResponse(this, this.responseURL)
            }

            if (oldOnReadyStateChange) {
                oldOnReadyStateChange.call(this, event)
            }
        }

        oldSend.call(this, body)
    }

    xhrProto.send = GMCompat.export(send)
    return () => { xhrProto.send = oldSend }
}
