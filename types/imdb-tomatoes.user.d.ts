import DayJs from 'dayjs'
import DayJsRelativeTime from 'dayjs/plugin/relativeTime'

declare global {
    const dayjs: typeof DayJs;
    const dayjs_plugin_relativeTime: typeof DayJsRelativeTime;

    type DayJs = DayJs.Dayjs;

    interface JQuery {
        balloon: (options: any) => this;
    }

    type AsyncGetOptions = {
        params?: Record<string, string | number | boolean>;
        title?: string;
        request?: Partial<Tampermonkey.Request>;
    };

    type LinkTarget = '_self' | '_blank';
    type Falsey = null | undefined | '' | false | 0;
    type Maybe<T> = T | Falsey;
    type IsTruthy<T> = (value: Maybe<T>) => value is T;

    namespace WaitFor {
        type Callback = (timeout: () => boolean, id: string) => void;
        type Checker<T> = (state: State) => Maybe<T>;
        type Id = string | number | bigint;
        type State = { tick: number, time: number, id: string };

        interface WaitFor {
            <T>(id: Id, callback: Callback, checker: Checker<T>): Promise<T>;
            <T>(callback: Callback, checker: Checker<T>): Promise<T>;
            <T>(id: Id, checker: Checker<T>): Promise<T>;
            <T>(checker: Checker<T>): Promise<T>;
        }
    }

    type RTResult = {
        title: string;
        vanity: string;
        releaseYear: string;
        updateDate: string;
        cast?: Array<{ name: string }>;
        rottenTomatoes?: { criticsScore?: number };
        pageViews_popularity?: number;
        aka?: string[];
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
        targetUrl: string | null;
        url: string;
    };
}
