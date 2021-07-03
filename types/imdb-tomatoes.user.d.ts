import DayJs from 'dayjs'
import DayJsRelativeTime from 'dayjs/plugin/relativeTime'

declare global {
    const dayjs: typeof DayJs;
    const dayjs_plugin_relativeTime: typeof DayJsRelativeTime;

    interface JQuery<TElement = HTMLElement> {
        balloon: (options: any) => JQuery;
        jsonLd: (id: string) => any;
    }
}
