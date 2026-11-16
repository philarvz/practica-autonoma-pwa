# Ensamblado arquitectónico autónomo

Para mantener el ritmo del semestre y llegar listos a la integración de
sus proyectos finales, esta semana trabajaremos bajo una modalidad de
**ensamblado arquitectónico autónomo**. Todo el material base ya se
encuentra disponible tanto en nuestro cuaderno de **NotebookLM** como en
las guías técnicas de **Notion**.

## Recursos de consulta

-   **Cuaderno en NotebookLM** (fuentes: Tema 5.1, Tema 5.2 y Tema 5.3):
    úsenlo para estudiar los conceptos y preparar su defensa oral.
-   **Guías de laboratorio en Notion** (con bloques de código limpios):
    -   **Tema 5.1:** Fundamentos de IndexedDB y Mini-Wrapper.
    -   **Tema 5.2:** Patrón Outbox (CRUD Offline) y GitHub Pages.
    -   **Tema 5.3:** Background Sync API y `postMessage`.

## Plan de trabajo paso a paso

### 1. Lectura técnica y base de datos local (Tema 5.1)

-   Lean a detalle la guía del **Tema 5.1** para comprender las
    diferencias entre `localStorage`, `Cache API` e `IndexedDB`, el
    evento `onupgradeneeded` y el manejo de transacciones (`readonly`
    vs. `readwrite`).
-   Construyan y prueben su archivo `db-helper.js` (el mini-wrapper
    promisificado en Vanilla JS), verificando en **Chrome DevTools →
    Application → IndexedDB** que los registros se almacenen
    correctamente.

### 2. Implementación del patrón Outbox y despliegue (Tema 5.2)

-   Sigan la guía del **Tema 5.2** para ensamblar la interfaz
    (`index.html`, `app.js`) que captura envíos `POST` fallidos sin red,
    los encola en IndexedDB como `'pendiente'` y permite visualizarlos y
    purgarlos.
-   Suban su repositorio a GitHub y publíquenlo en **GitHub Pages**,
    cuidando que todas sus rutas sean relativas (`./`) para evitar
    errores 404 en subdirectorios.

### 3. Evolución a sincronización en segundo plano (Tema 5.3)

-   Evolucionen su proyecto aplicando la guía del **Tema 5.3**:
    trasladen el motor de sincronización al Service Worker (`sw.js`)
    mediante la **Background Sync API** (`sync`), comuniquen el
    resultado a la interfaz con `postMessage` y condicionen el evento
    `online` como respaldo para navegadores sin `SyncManager`
    (Safari/iOS).

------------------------------------------------------------------------

## Reglas técnicas no negociables

1.  **100 % JavaScript Vanilla:** prohibido el uso de librerías externas
    (`PouchDB`, `Dexie`, `idb`, `Workbox`, etc.).
2.  **Cero `async / await`:** toda la asincronía debe resolverse
    mediante `new Promise()`, `.then()`, `.catch()` y `Promise.all()`.
    Cualquier entrega con `async/await` será anulada.
3.  **Código ensamblado y comprendido:** las guías contienen fragmentos
    explicados y desafíos de integración; no son archivos completos para
    copiar y pegar.

## Entregable y evaluación (defensa oral aleatoria)

-   **Entrega en esta tarea:**
    -   Enlace público de su aplicación funcionando en **GitHub Pages**.
    -   Enlace a su **repositorio de GitHub**.
-   **Fecha límite:** lunes 16 de noviembre.
-   **Evaluación:** en la próxima sesión presencial se realizará un
    **sorteo aleatorio** para defensas prácticas individuales de 5
    minutos, directamente sobre su enlace de GitHub Pages y su código
    fuente.
