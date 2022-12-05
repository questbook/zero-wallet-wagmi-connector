import { IStoreable } from './IStoreable';

export class BrowserStorage implements IStoreable {
    get(key: string): string | undefined {
        try {
            const value = localStorage.getItem(key);

            if (!value) {
                return undefined;
            }

            return value;
        } catch (e) {
            throw new Error(
                `Error ${e}. Failed to get item from local storage for key '${key}'`
            );
        }
    }

    set(key: string, value: any) {
        try {
            if (typeof value === 'string') {
                localStorage.setItem(key, value);
            } else {
                const jsonValue = JSON.stringify(value);
                localStorage.setItem(key, jsonValue);
            }
        } catch (e) {
            throw new Error(
                `Error: ${e}. Failed to set item in local storage for {${key}: ${value}}`
            );
        }
    }
}
