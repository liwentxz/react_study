"use client";

const DB_NAME = "device_ledger_reports";
const DB_VERSION = 1;
const META_STORE = "meta";
const FILE_STORE = "files";

let dbPromise = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("当前环境不支持本地数据库（IndexedDB）"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(META_STORE))
        d.createObjectStore(META_STORE, { keyPath: "id" });
      if (!d.objectStoreNames.contains(FILE_STORE))
        d.createObjectStore(FILE_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("无法打开本地数据库"));
  });
}

function db() {
  if (!dbPromise)
    dbPromise = openDB().catch((e) => {
      dbPromise = null;
      throw e;
    });
  return dbPromise;
}

// 元数据与图片分开存放：列表只取 meta，图片按 id 单独读取，避免一次性把全部原图读进内存
async function run(stores, mode, work) {
  const d = await db();
  const get = await new Promise((resolve, reject) => {
    const t = d.transaction(stores, mode);
    let getter = () => undefined;
    try {
      getter = work(t);
    } catch (e) {
      try {
        t.abort();
      } catch {}
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(getter);
    t.onerror = () => reject(t.error || new Error("本地数据库操作失败"));
    t.onabort = () => reject(t.error || new Error("本地数据库操作被中止"));
  });
  return get();
}

export function newId() {
  return (
    "rep_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8)
  );
}

export function listReports() {
  return run(META_STORE, "readonly", (t) => {
    const out = [];
    const r = t.objectStore(META_STORE).getAll();
    r.onsuccess = () => out.push(...(r.result || []));
    return () => out;
  });
}

export function readFile(id) {
  return run(FILE_STORE, "readonly", (t) => {
    let rec;
    const r = t.objectStore(FILE_STORE).get(id);
    r.onsuccess = () => {
      rec = r.result;
    };
    return () => rec;
  });
}

export function saveReports(records) {
  return run([META_STORE, FILE_STORE], "readwrite", (t) => {
    const ms = t.objectStore(META_STORE);
    const fs = t.objectStore(FILE_STORE);
    records.forEach(({ full, thumb, ...meta }) => {
      ms.put(meta);
      fs.put({ id: meta.id, full, thumb: thumb || full });
    });
    return () => records.length;
  });
}

export function updateMeta(id, patch) {
  return run(META_STORE, "readwrite", (t) => {
    const s = t.objectStore(META_STORE);
    let updated;
    const r = s.get(id);
    r.onsuccess = () => {
      if (r.result) {
        updated = { ...r.result, ...patch };
        s.put(updated);
      }
    };
    return () => updated;
  });
}

export function removeReport(id) {
  return run([META_STORE, FILE_STORE], "readwrite", (t) => {
    t.objectStore(META_STORE).delete(id);
    t.objectStore(FILE_STORE).delete(id);
    return () => id;
  });
}
