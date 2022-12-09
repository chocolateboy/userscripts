import DayJs from 'dayjs'
import DayJsRelativeTime from 'dayjs/plugin/relativeTime'

type RTResult = {
    title: string;
    vanity: string;
    releaseYear: string;
    updateDate: string;
    cast?: Array<{ name: string }>;
    rottenTomatoes?: { criticsScore?: number };
    pageViews_popularity?: number;
};

declare global {
    const dayjs: typeof DayJs;
    const dayjs_plugin_relativeTime: typeof DayJsRelativeTime;

    type DayJs = DayJs.Dayjs;

    interface JQuery {
        balloon: (options: any) => this;
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

    type RTTVResult = RTResult & {
        seasons: number[];
        seriesFinale?: string;
        seriesPremiere?: string;
    };

    type RTMovieResult = RTResult;

    type RTState = {
        fallbackUnused: boolean;
        rtPage: RTDoc | null;
        targetUrl: string | null;
        url: string;
        verify: boolean;
    };
}
