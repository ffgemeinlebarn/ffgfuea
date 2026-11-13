import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import Dexie from 'dexie';

// Der erste Test einer Datei lädt Angular Material bzw. jsPDF erst. Bei vielen parallelen Testdateien
// (und auf CI-Runnern mit wenigen Kernen) reichen die Standardwerte von 5 s bzw. 10 s dafür nicht immer.
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

// Jeder Test bekommt eine leere IndexedDB und leeren LocalStorage
beforeEach(() =>
{
    const factory = new IDBFactory();
    globalThis.indexedDB = factory;
    Dexie.dependencies.indexedDB = factory;
    localStorage.clear();
});
