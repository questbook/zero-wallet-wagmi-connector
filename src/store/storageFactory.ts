import { IStoreable } from './IStoreable';
import { BrowserStorage } from './browserStorage';
import { NameToClassValue } from 'types';

export abstract class StorageFactory {
    private static nameToClass: Record<string, any> = {
        browser: BrowserStorage
    };

    static create(storeType: string): IStoreable {
        return new StorageFactory.nameToClass[storeType]();
    }
}
