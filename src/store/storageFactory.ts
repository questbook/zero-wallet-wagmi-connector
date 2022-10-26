import { IStoreable } from "./IStoreable";
import { BrowserStorage } from "./browserStorage";

export class StorageFactory implements IStoreable {

    nameToClass = {
        'browser': BrowserStorage
    } as {[key: string]: any}

    private store: IStoreable;

    constructor(storeType: string) {
        this.store = this.nameToClass[storeType]();
    }

    get(key: string): Promise<string | null> {
        return this.store.get(key);
    }
    set(key: string, value: string): Promise<void> {
        return this.store.set(key, value);
    }

}