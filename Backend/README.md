# Backend de EventosFISI

API REST en JavaScript con Node.js, Express y Sequelize, con SQLite local o
PostgreSQL para Azure. Implementa los
requisitos de las dos imágenes: APIs de eventos, concurrencia, modo en memoria,
persistencia con ORM y dos funciones nuevas que graban y consultan datos.

**Alcance acordado: solo `Backend/`.** `Frontend/` conserva exactamente los archivos
del remoto. El laboratorio es un cliente de prueba servido por este backend;
la conexión del frontend original a las APIs queda para una etapa posterior.

El despliegue de Azure está preparado en [deploy/README.md](deploy/README.md):
App Service Linux y Azure Database for PostgreSQL. Requiere una suscripción
habilitada; compilar la infraestructura localmente no equivale a desplegarla.

## Ejecutar

Requisito: Node.js 22.12+ y npm. Desde la raíz del repositorio:

```bash
cd Backend
npm ci
npm start
```

- API: <http://localhost:3001/api/health>.
- Cliente de prueba: <http://localhost:3001/laboratorio.html>.
- Base persistente: `Backend/data/eventos.sqlite`, creada automáticamente.
- No se necesita instalar un servidor de base de datos ni configurar credenciales.

Para el ejercicio en memoria, detener el servidor anterior con Ctrl+C y ejecutar:

```bash
npm run start:memory
```

Este modo usa SQLite `:memory:` a través del mismo ORM y contrato HTTP: no crea un
archivo de base de datos y pierde los cambios al detener el proceso. El modo
predeterminado guarda los datos en disco y los recupera al iniciar otra vez.

Otros comandos, desde `Backend/`:

```bash
npm run dev       # Reinicio automático al modificar el backend
npm test          # Pruebas HTTP reales, ORM, cupos, concurrencia y persistencia
npm run evidence  # Genera evidence/resultado.json con mediciones y comprobaciones
```

Variables opcionales: `PORT` (3001), `HOST` (127.0.0.1), `DB_STORAGE` (ruta de archivo
alternativa, relativa al directorio de ejecución) y `SQL_LOG=1` (imprimir SQL).
`--memory` tiene prioridad sobre `DB_STORAGE`. Los archivos SQLite, las
dependencias y los logs están excluidos de Git.

## APIs para EventosFISI

Todas las rutas tienen el prefijo `/api`. El catálogo conserva IDs, campos,
categorías, fechas y agenda de los nueve eventos originales. Los filtros y las
reglas de presentación siguen siendo responsabilidad del frontend.

| Método | Ruta | Resultado |
|---|---|---|
| GET | `/health` | Estado, modo y contadores de peticiones pendientes |
| GET | `/ready` | Comprueba también la conexión a la base de datos |
| GET | `/categories` | Categorías originales |
| GET | `/events` | Eventos; `enrolled` ya incluye todas las nuevas inscripciones |
| GET | `/events/:id` | Detalle de un evento |
| GET | `/state` | `{ student, inscriptions, events }` para cargar la aplicación |
| GET | `/student` | Perfil o `null` |
| PUT | `/student` | Guarda/edita `{ name, email, phone }` y devuelve el estado |
| DELETE | `/student` | Borra perfil y sus datos asociados; devuelve el estado |
| GET | `/inscriptions` | Array de IDs inscritos |
| POST | `/inscriptions` | Inscribe con `{ eventId }`; devuelve el estado |
| DELETE | `/inscriptions/:id` | Cancela y devuelve el estado |

Las rutas personales requieren `X-Session-Id` con un UUID que genera el cliente.
El laboratorio lo guarda en `localStorage` como `edu_session_id`. El perfil y las
inscripciones se consultan siempre en el servidor. Es identificación por
dispositivo para el taller; no incorpora autenticación de cuentas.

Las inscripciones son idempotentes: la primera responde 201 y la repetida 200,
sin ocupar un segundo cupo. Se rechazan eventos inexistentes, pasados o llenos.
Las validaciones de nombre, correo institucional y teléfono también se aplican
en el servidor. Las fechas conservan la comparación por día UTC del frontend
original.

En SQLite, el conteo y la inserción se realizan en una transacción `IMMEDIATE`;
una cola de Promises serializa las escrituras de esta instancia sin bloquear el
hilo de JavaScript. En PostgreSQL, las transacciones bloquean la fila del evento
con `SELECT FOR UPDATE`, protegiendo los cupos entre varias instancias del backend.
Las claves primarias compuestas impiden duplicados y las claves foráneas eliminan
los registros asociados al borrar el perfil.

## Dos funciones nuevas con ORM

| Función | Escritura | Consulta | Comportamiento |
|---|---|---|---|
| Favoritos | `PUT /favorites/:id` y `DELETE /favorites/:id` | `GET /favorites` | Lista personal de eventos, sin duplicados |
| Valoraciones | `PUT /events/:id/reviews` | `GET /events/:id/reviews` | Una por estudiante/evento; puntuación 1–5, comentario y promedio |

El cuerpo de una valoración es `{ "rating": 5, "comment": "Excelente evento" }`.
Guardar otra vez actualiza la valoración existente. La consulta es pública y
devuelve autor, puntuación, comentario, fechas, cantidad y promedio; no expone
correo, teléfono ni el identificador de sesión.

Los modelos `Event`, `Student`, `Inscription`, `Favorite` y `Review` definen las
tablas y relaciones en `src/database.js`. Las operaciones de negocio usan los
métodos de Sequelize. Al iniciar, `sync()` crea las tablas faltantes, sin `force`
ni `alter`; la semilla inserta solo eventos que aún no existen.

## Demostración de las dos entregas

1. Abrir el laboratorio y pulsar **Probar espera de 3 segundos**. Ver que `/health`,
   `/categories` y una lectura real de `/events` terminan mientras la otra petición
   sigue esperando. La tabla muestra inicio, fin, duración y resultado.
2. Pulsar **Probar consulta ORM**. Se calcula una suma con una consulta SQL real
   mediante `sequelize.query()`. `/health` y `/categories` siguen respondiendo;
   además se cuentan los ticks de un temporizador de JavaScript durante la consulta.
3. Guardar un perfil de prueba, un favorito y una valoración. Pulsar los botones
   de consulta para recuperar los registros desde SQLite.
4. Detener e iniciar el servidor en modo persistente, recargar el laboratorio y
   volver a consultar: los datos siguen disponibles. En modo memoria se pierden.
5. Ejecutar `npm test` y `npm run evidence` para repetir las comprobaciones por HTTP.

El archivo [evidence/resultado.json](evidence/resultado.json) contiene una ejecución
real con IDs de petición, tiempos, confirmación de que la operación lenta estaba
en curso y lecturas de favoritos/valoraciones tras cerrar y reabrir tanto el
servidor HTTP como la conexión ORM. El script usa una base temporal separada, sin
alterar `data/eventos.sqlite`, y termina con error si alguna comprobación falla.
La página y ese script comparten `public/concurrency.js`.

### Qué parte es no bloqueante

`await delay(ms)` en `src/app.js` usa `node:timers/promises`: suspende esa petición
y devuelve el control al event loop. Las consultas de Sequelize se esperan con
`await`; su controlador `sqlite3` encola el trabajo nativo con
`napi_queue_async_work`, por lo que el SQL no se ejecuta en el hilo de JavaScript.
La prueba del ORM comprueba esto con HTTP y un temporizador que avanzan mientras
la consulta todavía está ejecutándose.

Esto no implica paralelismo ilimitado: SQLite tiene un escritor a la vez y ciertas
consultas pueden esperar la conexión o los bloqueos de la base. La prueba SQL usa
rutas rápidas sin acceso a BD para aislar la disponibilidad del event loop; la
prueba de demora también incluye una lectura ORM mientras la espera sigue activa.
`/api/demo/orm` está limitado a cinco millones de iteraciones y `delayMs` a 10 s.
Son herramientas locales de demostración del taller.

Para PostgreSQL, Sequelize utiliza el controlador asíncrono `pg`. Se mantiene
la misma API y las operaciones se esperan con `await`. En Azure, la conexión
usa TLS con validación del certificado. `DATABASE_URL` selecciona PostgreSQL;
`DB_SSL=disable` se reserva para un PostgreSQL local de pruebas.

Fuentes técnicas verificadas:

- [Sequelize: Promises y async/await](https://sequelize.org/docs/v6/getting-started/#promises-and-asyncawait).
- [Sequelize: controlador SQLite y almacenamiento en memoria](https://sequelize.org/docs/v6/other-topics/dialect-specific-things/#sqlite).
- [sqlite3: código que encola el trabajo nativo](https://github.com/TryGhost/node-sqlite3/blob/v6.0.1/src/macros.h).
- [Node-API: napi_queue_async_work](https://nodejs.org/api/n-api.html#napi_queue_async_work).
- [node-postgres: consultas asíncronas](https://node-postgres.com/features/queries).

## Estructura

```text
Backend/
  src/
    server.js          Inicio, configuración y cierre
    app.js             Rutas HTTP, validación y medición
    database.js        Modelos, relaciones, transacciones y operaciones ORM
    errors.js          Errores HTTP controlados
    data/events.js     Semilla del catálogo original
  public/              Cliente de prueba independiente del frontend original
  test/api.test.js     Pruebas de integración
  support/harness.js   Servidores y bases aisladas para las pruebas
  scripts/evidence.js  Generador reproducible de evidencia
  evidence/            Resultados de la ejecución y capturas del laboratorio
  deploy/              Plantillas Bicep, publicación y guía de Azure
  data/                Archivo SQLite local, excluido de Git
```
