# PWA Outbox

Práctica autónoma — Temas 5.1, 5.2 y 5.3.

Aplicación PWA que registra incidencias en campo, encola los envíos fallidos en IndexedDB y los sincroniza en segundo plano con la Background Sync API. JavaScript Vanilla, sin librerías externas y sin `async/await`.

## Enlaces

- **App publicada:** https://philarvz.github.io/practica-autonoma-pwa/
- **Repositorio:** https://github.com/philarvz/practica-autonoma-pwa

## Estructura

```
.
├── index.html        ← Interfaz del formulario y bandeja
├── styles.css
├── db-helper.js      ← Mini-wrapper promisificado de IndexedDB
├── app.js            ← Lógica de UI, envío resiliente y fallback online
├── sw.js             ← Service Worker con App Shell y Background Sync
├── manifest.json
└── icons/
```

## Qué resuelve cada archivo

### `db-helper.js` (Tema 5.1)
- Base `pwa-outbox-db` versión 1.
- Object store `transacciones_pendientes` con `keyPath: id` + `autoIncrement`.
- Funciones: `abrirDB`, `guardarRegistro`, `obtenerTodosLosRegistros`, `eliminarRegistro`, `actualizarEstadoRegistro`.
- Las escrituras resuelven en `tx.oncomplete` para garantizar persistencia en disco.
- `actualizarEstadoRegistro` hace `store.get(id)` + `store.put(registro)` dentro de la misma transacción `readwrite`.

### `index.html` + `app.js` (Tema 5.2)
- Formulario `#form-incidencia` con `#titulo` y `#descripcion`.
- `procesarEnvioReporte`: intenta `fetch POST`; si responde OK guarda como `'sincronizado'`, si falla encola como `'pendiente'` y registra la etiqueta de sync.
- `renderizarColaOutbox` lee IndexedDB y repinta la bandeja.
- `#btn-purgar` elimina únicamente los registros con `estado === 'sincronizado'` usando `Promise.all`.

### `sw.js` (Tema 5.3)
- `importScripts('./db-helper.js')` reutiliza el mismo wrapper en el hilo del SW.
- Cache `static-outbox-v2` precachea el App Shell (`install`) y limpia versiones viejas (`activate`).
- `sincronizarPendientesSW` lee pendientes, los envía con `Promise.all` y al terminar llama a `notificarClientesActualizacion`.
- `notificarClientesActualizacion` usa `self.clients.matchAll` y `postMessage({ tipo: 'OUTBOX_SINCRONIZADO' })`.
- Evento `sync` con etiqueta `'sync-reportes'` ejecuta el barrido; si falla, se relanza el error para que el navegador programe el reintento automático.
- `app.js` escucha `message` con `event.data.tipo === 'OUTBOX_SINCRONIZADO'` y repinta.
- Fallback para Safari/iOS: si `!('SyncManager' in window)`, el evento `online` llama a `sincronizarPendientesFallback()`.

## Probar en local

```
python3 -m http.server 8080
```

Abrir `http://localhost:8080` (no `file://`, el SW requiere HTTP/HTTPS).

## Prueba de la pestaña cerrada (Chrome)

1. Abrir la app y verificar en DevTools → Application → Service Workers que `sw.js` está "activated and is running".
2. DevTools → Application → Background Services → Background Sync → Record.
3. Network → marcar **Offline**. Enviar dos reportes.
4. En Background Sync aparece el *Registered sync* con tag `sync-reportes`.
5. Cerrar la pestaña, desactivar Offline, reabrir la URL.
6. Los reportes aparecen en estado `sincronizado`.

## Reglas respetadas

- 100 % JavaScript Vanilla (sin PouchDB, Dexie, idb, Workbox).
- Toda la asincronía con `new Promise()`, `.then()`, `.catch()`, `Promise.all()`.
- Rutas relativas (`./`) en HTML, manifest y Service Worker (compatible con subdirectorio de GitHub Pages).
