importScripts('./db-helper.js')

const ENDPOINT = 'https://jsonplaceholder.typicode.com/posts'
const SYNC_TAG = 'outbox-sync'
const CACHE_SHELL = 'outbox-shell-v1'

const APP_SHELL = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './db-helper.js',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png'
]

self.addEventListener('install', (event) => {
    self.skipWaiting()
    event.waitUntil(
        caches.open(CACHE_SHELL).then((cache) => {
            return Promise.all(
                APP_SHELL.map((url) => {
                    return cache.add(url).catch((err) => {
                        console.warn('No se pudo cachear', url, err)
                    })
                })
            )
        })
    )
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => {
                return Promise.all(
                    keys.filter((k) => k !== CACHE_SHELL).map((k) => caches.delete(k))
                )
            })
            .then(() => self.clients.claim())
    )
})

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return
    event.respondWith(
        caches.match(event.request).then((hit) => {
            return hit || fetch(event.request).catch(() => hit)
        })
    )
})

function enviarRegistro(registro) {
    return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registro.payload)
    }).then((resp) => {
        if (!resp.ok) throw new Error('Respuesta no OK: ' + resp.status)
        return resp.json()
    })
}

function procesarCola() {
    return self.DBHelper.getPendientes().then((pendientes) => {
        if (pendientes.length === 0) {
            return { enviados: 0, fallidos: 0 }
        }

        const tareas = pendientes.map((registro) => {
            return enviarRegistro(registro)
                .then(() => {
                    registro.status = 'sincronizado'
                    registro.syncedAt = Date.now()
                    return self.DBHelper.update(registro).then(() => ({ ok: true }))
                })
                .catch((err) => {
                    console.warn('[SW] fallo envío', registro.id, err)
                    return { ok: false }
                })
        })

        return Promise.all(tareas).then((resultados) => {
            const enviados = resultados.filter((r) => r.ok).length
            const fallidos = resultados.length - enviados
            return { enviados: enviados, fallidos: fallidos }
        })
    })
}

function avisarClientes(resultado) {
    return self.clients.matchAll({ includeUncontrolled: true }).then((clientes) => {
        clientes.forEach((cliente) => {
            cliente.postMessage({
                type: 'SYNC_RESULT',
                enviados: resultado.enviados,
                fallidos: resultado.fallidos,
                timestamp: Date.now()
            })
        })
        return resultado
    })
}

self.addEventListener('sync', (event) => {
    if (event.tag !== SYNC_TAG) return
    event.waitUntil(
        procesarCola()
            .then((resultado) => avisarClientes(resultado))
            .catch((err) => {
                console.error('[SW] error en sync:', err)
                return avisarClientes({ enviados: 0, fallidos: -1 })
            })
    )
})

self.addEventListener('message', (event) => {
    const data = event.data || {}
    if (data.type === 'FORCE_SYNC') {
        event.waitUntil(
            procesarCola().then((resultado) => avisarClientes(resultado))
        )
    }
})
