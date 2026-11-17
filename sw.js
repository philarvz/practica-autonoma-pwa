importScripts('./db-helper.js')

const CACHE_STATIC_NAME = 'static-outbox-v2'
const STATIC_FILES = [
    './',
    './index.html',
    './styles.css',
    './db-helper.js',
    './app.js',
    './manifest.json'
]

self.addEventListener('install', (event) => {
    console.log('[SW] Instalando y precacheando App Shell...')
    self.skipWaiting()
    event.waitUntil(
        caches.open(CACHE_STATIC_NAME).then((cache) => {
            return Promise.all(
                STATIC_FILES.map((url) => {
                    return cache.add(url).catch((err) => {
                        console.warn('[SW] No se pudo cachear', url, err)
                    })
                })
            )
        })
    )
})

self.addEventListener('activate', (event) => {
    console.log('[SW] Activando y limpiando caches antiguos...')
    event.waitUntil(
        caches.keys()
            .then((keys) => {
                return Promise.all(
                    keys.filter((k) => k !== CACHE_STATIC_NAME).map((k) => caches.delete(k))
                )
            })
            .then(() => self.clients.claim())
    )
})

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return

    event.respondWith(
        caches.match(event.request).then((cacheado) => {
            return cacheado || fetch(event.request).catch(() => cacheado)
        })
    )
})

function notificarClientesActualizacion() {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientes) => {
            clientes.forEach((cliente) => {
                cliente.postMessage({
                    tipo: 'OUTBOX_SINCRONIZADO',
                    timestamp: Date.now()
                })
            })
        })
}

function sincronizarPendientesSW() {
    console.log('[SW-Sync] Ejecutando barrido de transacciones pendientes...')

    return obtenerTodosLosRegistros()
        .then((registros) => {
            const pendientes = registros.filter((item) => item.estado === 'pendiente')

            if (pendientes.length === 0) {
                console.log('[SW-Sync] Cola limpia. Nada por sincronizar.')
                return
            }

            const promesasDeEnvio = pendientes.map((item) => {
                return fetch('https://jsonplaceholder.typicode.com/posts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: item.titulo,
                        body: item.descripcion
                    })
                })
                    .then((respuesta) => {
                        if (!respuesta.ok) {
                            throw new Error(`Error HTTP ${respuesta.status} al sincronizar ID ${item.id}`)
                        }
                        return actualizarEstadoRegistro(item.id, 'sincronizado')
                    })
            })

            return Promise.all(promesasDeEnvio)
                .then(() => notificarClientesActualizacion())
        })
}

self.addEventListener('sync', (event) => {
    console.log('[SW-Sync] Evento sync disparado con etiqueta:', event.tag)

    if (event.tag === 'sync-reportes') {
        event.waitUntil(
            sincronizarPendientesSW()
                .catch((error) => {
                    console.error('[SW-Sync] Falla en sincronización; el navegador reintentará luego:', error)
                    throw error
                })
        )
    }
})
