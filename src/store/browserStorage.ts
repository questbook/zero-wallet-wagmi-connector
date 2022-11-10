import { IStoreable } from "./IStoreable";

export class BrowserStorage implements IStoreable {
  get(key: string): string | null {
    try {
      const item = localStorage.getItem(key);

      if (!item) {
        return null;
      }
      return item;
    } catch {
      throw new Error("Failed to get item from local storage");
    }
  }

  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      throw new Error("Failed to set item in local storage");
    }
  }
}
