import AsyncStorage from '@react-native-async-storage/async-storage';
import { IStoreable } from './IStoreable';

export class AppStorage implements IStoreable {
    async get(key: string) {
        try {
            const value = await AsyncStorage.getItem(key);

            if (!value) return undefined;

            return value;
        } catch (e) {
            throw new Error(
                `Error: ${e}. Failed to get item from local storage for key '${key}'.`
            );
        }
    }

    async set(key: string, value: any) {
        try {
            if (typeof value === 'string') {
                await AsyncStorage.setItem(key, value);
            } else {
                const jsonValue = JSON.stringify(value);
                await AsyncStorage.setItem(key, jsonValue);
            }
        } catch (e) {
            throw new Error(
                `Error: ${e}. Failed to set item in local storage for {${key}: ${value}}: ${e}`
            );
        }
    }
}
