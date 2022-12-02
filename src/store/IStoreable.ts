export interface IStoreable {
    get: (key: string) => string | undefined | Promise<string | undefined>;
    set: (key: string, value: any) => void | Promise<void>;
}
