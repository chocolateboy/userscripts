import DayJs from 'dayjs'
import DayJsRelativeTime from 'dayjs/plugin/relativeTime'

type RTResult = {
    url: string;
    meterScore: number;
};

declare global {
    const dayjs: typeof DayJs;
    const dayjs_plugin_relativeTime: typeof DayJsRelativeTime;

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
        endYear: number;
        startYear: number;
        title: string;
    };

    type RTMovieResult = RTResult & {
        castItems: string[];
        name: string;
        year: number;
    };

    type RTState = {
        fallbackUnused: boolean;
        rtPage: RTDoc | null;
        targetUrl: string | null;
        url: string;
        verify: boolean;
    };
}
