const DB_NAME = "gestao-frotas";
const DB_VERSION = 1;

let databasePromise;

export function getDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("vehicles")) {
        const vehicles = db.createObjectStore("vehicles", { keyPath: "id" });
        vehicles.createIndex("plate", "plate", { unique: true });
        vehicles.createIndex("createdAt", "createdAt");
      }

      if (!db.objectStoreNames.contains("inspections")) {
        const inspections = db.createObjectStore("inspections", { keyPath: "id" });
        inspections.createIndex("vehicleId", "vehicleId");
        inspections.createIndex("date", "date");
      }

      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return databasePromise;
}

export async function getAll(storeName) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putRecord(storeName, record) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(record);
    transaction.oncomplete = () => resolve(record);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteRecord(storeName, id) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function replaceAllData(data) {
  const db = await getDatabase();
  const storeNames = ["vehicles", "inspections", "settings"];

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, "readwrite");
    for (const storeName of storeNames) {
      const store = transaction.objectStore(storeName);
      store.clear();
      for (const item of data[storeName] ?? []) store.put(item);
    }
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}
