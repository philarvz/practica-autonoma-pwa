const ENDPOINT = 'https://jsonplaceholder.typicode.com/posts'
const SYNC_TAG = 'outbox-sync'

const form = document.getElementById('form-mensaje')
const inputNombre = document.getElementById('nombre')
const inputMensaje = document.getElementById('mensaje')
const feedback = document.getElementById('feedback')
const listaPendientes = document.getElementById('lista-pendientes')
const listaSincronizados = document.getElementById('lista-sincronizados')
const vacio = document.getElementById('vacio')
const vacioSinc = document.getElementById('vacio-sinc')
const estadoRed = document.getElementById('estado-red')
const estadoSync = document.getElementById('estado-sync')
const btnSync = document.getElementById('btn-sync')
const btnPurgar = document.getElementById('btn-purgar')
const toast = document.getElementById('toast')

function pintarEstadoRed() {
    if (navigator.onLine) {
        estadoRed.textContent = 'En línea'
        estadoRed.className = 'pill pill-ok'
    } else {
        estadoRed.textContent = 'Sin conexión'
        estadoRed.className = 'pill pill-warn'
    }
}

function mostrarToast(texto) {
    toast.textContent = texto
    toast.classList.add('visible')
    setTimeout(() => toast.classList.remove('visible'), 2500)
}

function renderListas() {
    DBHelper.getAll()
        .then((registros) => {
            const pendientes = registros.filter((r) => r.status === 'pendiente')
            const sincronizados = registros.filter((r) => r.status === 'sincronizado')

            listaPendientes.innerHTML = ''
            pendientes.forEach((r) => listaPendientes.appendChild(crearItem(r, true)))
            vacio.style.display = pendientes.length === 0 ? 'block' : 'none'

            listaSincronizados.innerHTML = ''
            sincronizados.forEach((r) => listaSincronizados.appendChild(crearItem(r, false)))
            vacioSinc.style.display = sincronizados.length === 0 ? 'block' : 'none'
        })
        .catch((err) => console.error('Error al leer IndexedDB:', err))
}

function crearItem(registro, borrable) {
    const li = document.createElement('li')
    li.classList.add('item')

    const info = document.createElement('div')
    info.classList.add('info')

    const titulo = document.createElement('strong')
    titulo.textContent = registro.payload.nombre

    const texto = document.createElement('p')
    texto.textContent = registro.payload.mensaje

    const meta = document.createElement('small')
    meta.textContent = new Date(registro.timestamp).toLocaleString() + ' · ' + registro.status

    info.appendChild(titulo)
    info.appendChild(texto)
    info.appendChild(meta)
    li.appendChild(info)

    if (borrable) {
        const btn = document.createElement('button')
        btn.textContent = 'Eliminar'
        btn.classList.add('btn', 'btn-small')
        btn.addEventListener('click', () => {
            DBHelper.remove(registro.id)
                .then(() => {
                    renderListas()
                    mostrarToast('Registro eliminado')
                })
                .catch((err) => console.error(err))
        })
        li.appendChild(btn)
    }

    return li
}

function solicitarBackgroundSync() {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
        return Promise.resolve(false)
    }
    return navigator.serviceWorker.ready.then((registration) => {
        return registration.sync.register(SYNC_TAG).then(() => true)
    })
}

function enviarAlServidor(registro) {
    return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registro.payload)
    }).then((resp) => {
        if (!resp.ok) {
            throw new Error('Respuesta no OK: ' + resp.status)
        }
        return resp.json()
    })
}

function sincronizarDesdeUI() {
    estadoSync.textContent = 'Sync: en curso'
    estadoSync.className = 'pill pill-info'

    return DBHelper.getPendientes().then((pendientes) => {
        if (pendientes.length === 0) {
            estadoSync.textContent = 'Sync: nada que enviar'
            return { enviados: 0, fallidos: 0 }
        }

        const tareas = pendientes.map((registro) => {
            return enviarAlServidor(registro)
                .then(() => {
                    registro.status = 'sincronizado'
                    registro.syncedAt = Date.now()
                    return DBHelper.update(registro).then(() => ({ ok: true }))
                })
                .catch((err) => {
                    console.warn('Falló envío del registro', registro.id, err)
                    return { ok: false }
                })
        })

        return Promise.all(tareas).then((resultados) => {
            const enviados = resultados.filter((r) => r.ok).length
            const fallidos = resultados.length - enviados
            estadoSync.textContent = 'Sync: ' + enviados + ' enviados, ' + fallidos + ' pendientes'
            estadoSync.className = fallidos === 0 ? 'pill pill-ok' : 'pill pill-warn'
            renderListas()
            mostrarToast('Sincronización: ' + enviados + ' enviados')
            return { enviados: enviados, fallidos: fallidos }
        })
    })
}

form.addEventListener('submit', (event) => {
    event.preventDefault()

    const payload = {
        nombre: inputNombre.value.trim(),
        mensaje: inputMensaje.value.trim()
    }

    if (!payload.nombre || !payload.mensaje) return

    if (!navigator.onLine) {
        DBHelper.add(payload)
            .then(() => {
                feedback.textContent = 'Sin conexión: guardado en la cola.'
                form.reset()
                renderListas()
                return solicitarBackgroundSync()
            })
            .then((registrado) => {
                if (registrado) {
                    estadoSync.textContent = 'Sync: programado en segundo plano'
                    estadoSync.className = 'pill pill-info'
                }
            })
            .catch((err) => console.error(err))
        return
    }

    enviarAlServidor({ payload: payload })
        .then(() => {
            feedback.textContent = 'Enviado directo al servidor.'
            form.reset()
            const sincronizado = {
                payload: payload,
                status: 'sincronizado',
                timestamp: Date.now(),
                syncedAt: Date.now()
            }
            return DBHelper.openDB().then((db) => {
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(DBHelper.STORE_NAME, 'readwrite')
                    const req = tx.objectStore(DBHelper.STORE_NAME).add(sincronizado)
                    req.onsuccess = () => resolve()
                    req.onerror = (e) => reject(e.target.error)
                })
            })
        })
        .then(() => renderListas())
        .catch(() => {
            DBHelper.add(payload)
                .then(() => {
                    feedback.textContent = 'Fallo de red: guardado en la cola.'
                    form.reset()
                    renderListas()
                    return solicitarBackgroundSync()
                })
                .catch((err) => console.error(err))
        })
})

btnSync.addEventListener('click', () => {
    sincronizarDesdeUI().catch((err) => console.error(err))
})

btnPurgar.addEventListener('click', () => {
    DBHelper.clearAll()
        .then(() => {
            renderListas()
            mostrarToast('Cola purgada')
        })
        .catch((err) => console.error(err))
})

window.addEventListener('online', () => {
    pintarEstadoRed()
    if (!('SyncManager' in window)) {
        mostrarToast('Conexión recuperada: sincronizando...')
        sincronizarDesdeUI().catch((err) => console.error(err))
    }
})

window.addEventListener('offline', pintarEstadoRed)

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('SW registrado'))
        .catch((err) => console.error('Error registrando SW:', err))

    navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data || {}
        if (data.type === 'SYNC_RESULT') {
            estadoSync.textContent = 'Sync SW: ' + data.enviados + ' enviados, ' + data.fallidos + ' pendientes'
            estadoSync.className = data.fallidos === 0 ? 'pill pill-ok' : 'pill pill-warn'
            renderListas()
            mostrarToast('Sync en segundo plano: ' + data.enviados + ' enviados')
        }
    })
}

pintarEstadoRed()
renderListas()
