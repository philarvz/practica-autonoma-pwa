const DB_NAME = 'outbox-db'
const DB_VERSION = 1
const STORE = 'pendientes'

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = (event) => {
            const db = event.target.result
            if (!db.objectStoreNames.contains(STORE)) {
                const store = db.createObjectStore(STORE, {
                    keyPath: 'id',
                    autoIncrement: true
                })
                store.createIndex('status', 'status', { unique: false })
                store.createIndex('timestamp', 'timestamp', { unique: false })
            }
        }

        request.onsuccess = (event) => resolve(event.target.result)
        request.onerror = (event) => reject(event.target.error)
    })
}

function add(payload) {
    return openDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite')
            const store = tx.objectStore(STORE)
            const registro = {
                payload: payload,
                status: 'pendiente',
                timestamp: Date.now()
            }
            const request = store.add(registro)
            request.onsuccess = () => {
                registro.id = request.result
                resolve(registro)
            }
            request.onerror = (event) => reject(event.target.error)
        })
    })
}

function getAll() {
    return openDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly')
            const store = tx.objectStore(STORE)
            const request = store.getAll()
            request.onsuccess = () => resolve(request.result)
            request.onerror = (event) => reject(event.target.error)
        })
    })
}

function getPendientes() {
    return getAll().then((registros) => {
        return registros.filter((r) => r.status === 'pendiente')
    })
}

function update(registro) {
    return openDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite')
            const store = tx.objectStore(STORE)
            const request = store.put(registro)
            request.onsuccess = () => resolve(registro)
            request.onerror = (event) => reject(event.target.error)
        })
    })
}

function remove(id) {
    return openDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite')
            const store = tx.objectStore(STORE)
            const request = store.delete(id)
            request.onsuccess = () => resolve(id)
            request.onerror = (event) => reject(event.target.error)
        })
    })
}

function clearAll() {
    return openDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite')
            const store = tx.objectStore(STORE)
            const request = store.clear()
            request.onsuccess = () => resolve(true)
            request.onerror = (event) => reject(event.target.error)
        })
    })
}

self.DBHelper = {
    openDB: openDB,
    add: add,
    getAll: getAll,
    getPendientes: getPendientes,
    update: update,
    remove: remove,
    clearAll: clearAll,
    STORE_NAME: STORE,
    DB_NAME: DB_NAME,
    DB_VERSION: DB_VERSION
}
