import { BrowserStorage } from './browserStorage';
import { IStoreable } from './IStoreable';

export abstract class StorageFactory {
    private static nameToClass: Record<string, any> = {
        browser: BrowserStorage
    };

    static create(storeType: string): IStoreable {
        return new StorageFactory.nameToClass[storeType]();
    }
}
