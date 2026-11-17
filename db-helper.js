const DB_NAME = 'pwa-outbox-db'
const DB_VERSION = 1
const STORE_NAME = 'transacciones_pendientes'

function abrirDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = (event) => {
            const db = event.target.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
            }
        }

        request.onsuccess = (event) => resolve(event.target.result)
        request.onerror = (event) => reject(event.target.error)
    })
}

function guardarRegistro(datos) {
    return abrirDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readwrite')
            const store = tx.objectStore(STORE_NAME)

            const req = store.add(datos)
            let idGenerado

            req.onsuccess = (event) => {
                idGenerado = event.target.result
            }

            tx.oncomplete = () => resolve(idGenerado)
            tx.onerror = (event) => reject(event.target.error)
        })
    })
}

function obtenerTodosLosRegistros() {
    return abrirDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readonly')
            const store = tx.objectStore(STORE_NAME)
            const req = store.getAll()

            req.onsuccess = (event) => resolve(event.target.result)
            req.onerror = (event) => reject(event.target.error)
        })
    })
}

function eliminarRegistro(id) {
    return abrirDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readwrite')
            const store = tx.objectStore(STORE_NAME)

            store.delete(id)

            tx.oncomplete = () => resolve(true)
            tx.onerror = (event) => reject(event.target.error)
        })
    })
}

function actualizarEstadoRegistro(id, nuevoEstado) {
    return abrirDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readwrite')
            const store = tx.objectStore(STORE_NAME)

            const reqGet = store.get(id)

            reqGet.onsuccess = (event) => {
                const registro = event.target.result
                if (!registro) {
                    reject(new Error(`No se encontró el registro con ID: ${id}`))
                    return
                }

                registro.estado = nuevoEstado
                registro.fechaSincronizacion = Date.now()
                store.put(registro)
            }

            tx.oncomplete = () => resolve(true)
            tx.onerror = (event) => reject(event.target.error)
        })
    })
}
