import DayJs from 'dayjs'
import DayJsRelativeTime from 'dayjs/plugin/relativeTime'

declare global {
    const dayjs: typeof DayJs;
    const dayjs_plugin_relativeTime: typeof DayJsRelativeTime;

    interface JQuery<TElement = HTMLElement> {
        balloon: (options: any) => JQuery;
        jsonLd: (id: string) => any;
    }

    type AsyncGetOptions = {
        params?: Record<string, string | number | boolean>;
        title?: string;
        request?: Partial<Tampermonkey.Request>;
    };

    type RTDoc = JQuery<Document> & {
        meta: any;
        document: Document;
    };

    type RTMatch = {
        rating: number | undefined;
        url: string;
        verify?: ($rt: RTDoc) => boolean;
    };
}
