# Outbox PWA

Práctica autónoma — Temas 5.1, 5.2 y 5.3.

Aplicación PWA que captura envíos `POST` sin conexión, los encola en IndexedDB y los sincroniza en segundo plano con la Background Sync API. Vanilla JS, sin librerías y sin `async/await`.

## Enlaces

- **App publicada:** https://philarvz.github.io/practica-autonoma-pwa/
- **Repositorio:** https://github.com/philarvz/practica-autonoma-pwa

## Estructura

```
.
├── index.html                ← UI (formulario + listas)
├── app.js                    ← lógica de interfaz, registro de SW, fallback online
├── db-helper.js              ← mini-wrapper promisificado de IndexedDB
├── sw.js                     ← Service Worker con evento sync y postMessage
├── manifest.webmanifest
├── styles.css
└── icons/
```

## Qué resuelve cada archivo

### `db-helper.js` (Tema 5.1)
- Abre la base `outbox-db` (versión 1) con `onupgradeneeded`.
- Crea el object store `pendientes` con `keyPath: id` y `autoIncrement`.
- Expone `openDB`, `add`, `getAll`, `getPendientes`, `update`, `remove`, `clearAll`.
- Cada operación es una `new Promise(...)` que distingue `readonly` de `readwrite`.

### `app.js` + `index.html` (Tema 5.2)
- El formulario intercepta el submit:
  - Si hay red, hace `fetch POST` y guarda el registro como `sincronizado`.
  - Si no hay red o el fetch rechaza, encola el registro como `pendiente`.
- Renderiza dos listas: pendientes y sincronizados.
- Botón "Sincronizar ahora" reintenta manualmente con `Promise.all`.
- Botón "Purgar todo" vacía la base.

### `sw.js` (Tema 5.3)
- Cachea el App Shell en `install` y limpia caches viejos en `activate`.
- Al dispararse el evento `sync` con tag `outbox-sync`, lee los pendientes de IndexedDB y los envía.
- Comunica el resultado a la página con `postMessage({ type: 'SYNC_RESULT', enviados, fallidos })`.
- `app.js` registra el sync con `registration.sync.register('outbox-sync')` cuando existe `SyncManager`.
- **Fallback Safari / iOS:** si no existe `SyncManager`, el evento `online` dispara `sincronizarDesdeUI()`.

## Probar en local

Cualquier servidor HTTP estático sirve. Ejemplo:

```
python3 -m http.server 8080
```

Abrir `http://localhost:8080`.

## Probar el modo offline

1. Abrir la app y aceptar que se registre el Service Worker.
2. DevTools → Network → marcar **Offline**.
3. Enviar un mensaje: debe aparecer en la lista "Pendientes".
4. DevTools → Application → **IndexedDB → outbox-db → pendientes**: el registro está ahí con `status: 'pendiente'`.
5. Volver a **Online**. Con Background Sync el Service Worker lo reenvía y la UI recibe un toast "Sync en segundo plano: N enviados".
6. En Safari / iOS el fallback por evento `online` hace el mismo trabajo desde la página.

## Reglas respetadas

- 100 % JavaScript Vanilla (sin PouchDB, Dexie, idb, Workbox).
- Toda la asincronía con `new Promise()`, `.then()`, `.catch()`, `Promise.all()`.
- Rutas relativas (`./`) en HTML, manifest y Service Worker.
