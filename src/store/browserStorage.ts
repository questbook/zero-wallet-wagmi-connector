import { IStoreable } from "./IStoreable";

export class BrowserStorage implements IStoreable {
    get(key: string): Promise<string | null> {
        try {
            const item = localStorage.getItem(key);

            if (!item) {
                return Promise.resolve(null);
            }
            return Promise.resolve(item);
        }
        catch {
            throw new Error("Failed to get item from local storage");
        }

    }
    set(key: string, value: string): Promise<void> {
        try {
            localStorage.setItem(key, value);
            return Promise.resolve();
        }
        catch {
            throw new Error("Failed to set item in local storage");   
        }
    }
}