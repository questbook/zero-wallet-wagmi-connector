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

    get(key: string): string | null {
        return this.store.get(key);
    }
    set(key: string, value: string): void {
        return this.store.set(key, value);
    }

}