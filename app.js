const ENDPOINT = 'https://jsonplaceholder.typicode.com/posts'

const form = document.getElementById('form-incidencia')
const inputTitulo = document.getElementById('titulo')
const inputDescripcion = document.getElementById('descripcion')
const listaOutbox = document.getElementById('lista-outbox')
const badgeRed = document.getElementById('badge-red')
const btnPurgar = document.getElementById('btn-purgar')

function actualizarIndicadorRed() {
    if (navigator.onLine) {
        badgeRed.textContent = 'En Línea'
        badgeRed.className = 'badge online'
    } else {
        badgeRed.textContent = 'Sin Conexión'
        badgeRed.className = 'badge offline'
    }
}

function renderizarColaOutbox() {
    return obtenerTodosLosRegistros()
        .then((registros) => {
            listaOutbox.innerHTML = ''

            if (registros.length === 0) {
                const vacio = document.createElement('li')
                vacio.className = 'item-vacio'
                vacio.textContent = 'No hay registros en la bandeja.'
                listaOutbox.appendChild(vacio)
                return
            }

            registros
                .slice()
                .sort((a, b) => b.fechaCreacion - a.fechaCreacion)
                .forEach((registro) => {
                    listaOutbox.appendChild(crearItemOutbox(registro))
                })
        })
        .catch((error) => console.error('[Outbox] Error al renderizar:', error))
}

function crearItemOutbox(registro) {
    const li = document.createElement('li')
    li.className = 'item estado-' + registro.estado

    const titulo = document.createElement('strong')
    titulo.textContent = registro.titulo

    const descripcion = document.createElement('p')
    descripcion.textContent = registro.descripcion

    const meta = document.createElement('small')
    const fecha = new Date(registro.fechaCreacion).toLocaleString()
    meta.textContent = fecha + ' · estado: ' + registro.estado

    const chip = document.createElement('span')
    chip.className = 'chip chip-' + registro.estado
    chip.textContent = registro.estado

    li.appendChild(chip)
    li.appendChild(titulo)
    li.appendChild(descripcion)
    li.appendChild(meta)

    return li
}

function procesarEnvioReporte(datosFormulario) {
    return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosFormulario)
    })
        .then((respuesta) => {
            if (!respuesta.ok) throw new Error('Error HTTP del servidor')
            return respuesta.json()
        })
        .then(() => {
            return guardarRegistro({
                ...datosFormulario,
                estado: 'sincronizado',
                fechaCreacion: Date.now()
            })
        })
        .catch(() => {
            console.warn('[Outbox] Sin conexión. Encolando en IndexedDB...')

            return guardarRegistro({
                ...datosFormulario,
                estado: 'pendiente',
                fechaCreacion: Date.now()
            })
                .then(() => {
                    if ('serviceWorker' in navigator && 'SyncManager' in window) {
                        return navigator.serviceWorker.ready
                            .then((registro) => {
                                console.log('[Outbox] Registrando etiqueta sync-reportes en el SW...')
                                return registro.sync.register('sync-reportes')
                            })
                    }
                })
        })
        .then(() => {
            return renderizarColaOutbox()
        })
}

function sincronizarPendientesFallback() {
    console.log('[Outbox] Conexión detectada. Buscando registros pendientes...')

    return obtenerTodosLosRegistros()
        .then((registros) => {
            const pendientes = registros.filter((item) => item.estado === 'pendiente')

            if (pendientes.length === 0) {
                console.log('[Outbox] No hay transacciones pendientes por sincronizar.')
                return
            }

            const promesasDeEnvio = pendientes.map((item) => {
                return fetch(ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: item.titulo, body: item.descripcion })
                })
                    .then((res) => {
                        if (!res.ok) throw new Error('Falla al reintentar envío')
                        return actualizarEstadoRegistro(item.id, 'sincronizado')
                    })
            })

            return Promise.all(promesasDeEnvio)
        })
        .then(() => renderizarColaOutbox())
        .catch((error) => {
            console.error('[Outbox] Error durante la sincronización masiva:', error)
        })
}

form.addEventListener('submit', (event) => {
    event.preventDefault()

    const datosFormulario = {
        titulo: inputTitulo.value.trim(),
        descripcion: inputDescripcion.value.trim()
    }

    if (!datosFormulario.titulo || !datosFormulario.descripcion) return

    procesarEnvioReporte(datosFormulario)
        .then(() => form.reset())
        .catch((error) => console.error('[Outbox] Fallo en procesarEnvioReporte:', error))
})

btnPurgar.addEventListener('click', () => {
    obtenerTodosLosRegistros()
        .then((registros) => {
            const sincronizados = registros.filter((item) => item.estado === 'sincronizado')

            if (sincronizados.length === 0) {
                console.log('[Outbox] No hay registros sincronizados que purgar.')
                return
            }

            const promesasDeBorrado = sincronizados.map((item) => eliminarRegistro(item.id))
            return Promise.all(promesasDeBorrado)
        })
        .then(() => renderizarColaOutbox())
        .catch((error) => console.error('[Outbox] Error al purgar:', error))
})

window.addEventListener('online', () => {
    actualizarIndicadorRed()

    if (!('SyncManager' in window)) {
        console.log('[Outbox] Navegador sin SyncManager. Ejecutando fallback por evento online...')
        sincronizarPendientesFallback()
    }
})

window.addEventListener('offline', actualizarIndicadorRed)

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('[UI] Service Worker registrado'))
        .catch((error) => console.error('[UI] Error registrando SW:', error))

    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.tipo === 'OUTBOX_SINCRONIZADO') {
            console.log('[UI] Confirmación recibida del Service Worker. Actualizando bandeja...')
            renderizarColaOutbox()
        }
    })
}

actualizarIndicadorRed()
renderizarColaOutbox()
