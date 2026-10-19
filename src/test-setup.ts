import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import Dexie from 'dexie';

// Jeder Test bekommt eine leere IndexedDB und leeren LocalStorage
beforeEach(() =>
{
    const factory = new IDBFactory();
    globalThis.indexedDB = factory;
    Dexie.dependencies.indexedDB = factory;
    localStorage.clear();
});
