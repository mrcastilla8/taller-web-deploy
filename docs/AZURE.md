# Azure: frontend independiente y microservicio Docker

Corrección del despliegue del **31 de octubre de 2026**, America/Lima. El [documento del 30 de octubre](AZURE-2026-10-30.md) describe la versión conjunta anterior y se conserva como historial.

## Requisitos del laboratorio

| Requisito | Implementación |
|---|---|
| Usar Azure, AWS o GCP | Los servicios de ejecución, imágenes y datos están en Azure |
| Desplegar FrontendEventos | React/Vite en un App Service F1 propio, con su dominio y paquete |
| Dockerfile para Eventos | `Backend/Dockerfile` y `.dockerignore`; imagen Linux de Node.js 24 |
| Servicio `/health` | Ruta pública del microservicio y `HEALTHCHECK` de Docker |
| Backend como microservicio | Azure Container Apps, perfil Consumption, 0 a 1 réplica |
| Conectar frontend y backend en nube | `VITE_API_BASE_URL`, cliente HTTP, CORS y persistencia en PostgreSQL |

La participación de dos personas es una condición de la actividad académica; este documento registra únicamente la implementación técnica.

## Arquitectura

El navegador descarga React desde el App Service del frontend. React realiza peticiones HTTPS a otro dominio, el del Container App del backend. El backend utiliza Sequelize y `pg` para consultar PostgreSQL con TLS. Las imágenes se almacenan en un registro privado de Azure y Container Apps las descarga mediante una identidad con permiso `AcrPull`.

| Parte | Recurso y configuración |
|---|---|
| Frontend | `eventosfisi-web-e4262df5`, App Service Linux Node.js 24, plan F1 existente, Brazil South |
| Servidor del frontend | `Frontend/server.mjs`, solo archivos estáticos compilados y soporte para rutas React |
| Backend | `eventosfisi-docker-e4262df5`, imagen `eventos-backend` de Azure Container Registry |
| Entorno del backend | `eventosfisi-env-docker-e4262df5`, WorkloadProfiles con Consumption, West US |
| Recursos del contenedor | 0,25 vCPU, 0,5 GiB; mínimo 0 y máximo 1 réplica; puerto 8080 |
| Registro | `eventosfisiacre4262df5`, Standard, Brazil South, usuario administrador desactivado |
| Identidad de lectura de imagen | `eventosfisi-acr-pull-e4262df5`, solo lectura del registro |
| PostgreSQL | `eventosfisi-pg-e4262df5`, PostgreSQL 16, Standard_B1ms, base `eventos`, Brazil South |
| Almacenamiento y copias | 32 GB sin crecimiento automático; retención 7 días sin redundancia geográfica |
| Grupo | `rg-eventos-fisi`; sus metadatos permanecen en North Central US |

El frontend tiene su propio proceso y publicación. El backend no copia ni sirve `Frontend/dist` o `Backend/web`. `/api/events` en el frontend no es una API: la web debe llamar al dominio del microservicio.

## Selección de servicios y regiones

Para una SPA estática, Azure Static Web Apps Free sería una opción apropiada. En esta suscripción, las cinco regiones ofrecidas para Static Web Apps no coinciden con las permitidas por su política. Se usa un App Service F1 independiente sobre el plan gratuito existente para conservar las rutas de React y evitar un cambio a pago por uso.

El backend usa Container Apps para ejecutar directamente la imagen Docker, exponer HTTPS y escalar a cero. Se seleccionó WorkloadProfiles con Consumption para disponer de una IP pública del entorno que se pueda autorizar en PostgreSQL. La suscripción permite un único entorno por región; se eligió West US para el entorno definitivo. No se añadió un NAT Gateway ni un workspace de Log Analytics.

## URLs y estado de validación

La [ejecución automática 41200189943](https://github.com/mrcastilla8/taller-web-deploy/actions/runs/41200189943) terminó con **success** en los tres jobs: pruebas, publicación del backend y publicación del frontend. La imagen publicada corresponde al commit `fb9443b72829d0a53053388663c281e8a2488250` y al digest `sha256:8175b04a178abe74c110041c2b490af03e0d372e76cbd6291a535cf9c5b3e31e`.

Pasaron 18 pruebas del backend, la integración del cliente React con una API real, la construcción Docker y las comprobaciones públicas de PostgreSQL, rutas React y CORS. La web se revisó en el navegador cargando su catálogo desde la API. La aplicación conjunta anterior `eventosfisi-api-e4262df5` quedó detenida; se usan los dominios nuevos de esta sección.

- Frontend: https://eventosfisi-web-e4262df5.azurewebsites.net/
- Backend Docker: https://eventosfisi-docker-e4262df5.kindwater-fcfdd589.westus.azurecontainerapps.io
- La URL real de backend y su imagen publicada se registran en [`Backend/evidence/azure-deploy.json`](../Backend/evidence/azure-deploy.json).
- Salud HTTP: `<url-backend>/health`; compatibilidad: `<url-backend>/api/health`.
- Conexión PostgreSQL: `<url-backend>/api/ready`.
- Catálogo: `<url-backend>/api/events`.
- Laboratorio de pruebas: `<url-backend>/laboratorio.html`.

El resumen de evidencia distingue los resultados comprobados de las comprobaciones no realizadas. Las URLs pueden dejar de responder si se retiran los recursos posteriormente.

## Integración React y API

`Frontend/src/api/client.js` toma `VITE_API_BASE_URL` durante la compilación y envía `X-Session-Id` en las peticiones. `AppContext` carga `/api/state` y `/api/categories`, guarda el perfil mediante `PUT /api/student` y gestiona inscripciones con `POST /api/inscriptions` y `DELETE /api/inscriptions/:id`.

El navegador conserva solo `edu_session_id`. El perfil y las inscripciones se recuperan del servidor al recargar. La web no utiliza `mockEvents` como origen del catálogo ni cuenta dos veces las inscripciones: el backend devuelve el total global.

La interfaz presenta los errores y la espera de conexión, y desactiva las acciones mientras guarda. La eliminación del perfil también elimina sus datos asociados en el servidor. El identificador de sesión sigue siendo un mecanismo de demostración, no un sistema completo de autenticación con cuentas y contraseñas.

CORS permite únicamente el origen configurado en `CORS_ORIGINS`; admite el preflight de `PUT`, `POST` y `DELETE` con JSON y `X-Session-Id`. Los orígenes no configurados reciben 403. En desarrollo se permiten `localhost:5173` y `127.0.0.1:5173`.

La IP de entrada del entorno no coincidía con su salida real. Se comprobó la salida desde dentro del contenedor mediante HTTPS a `api.ipify.org`. La regla `container-app-egress` admite esa IP concreta. La herramienta `src/egress.js` se ejecuta mediante la consola autenticada de Azure y rechaza direcciones globales de apertura como `0.0.0.0`; no hay una ruta pública de diagnóstico.

Los nueve eventos originales ya están pasados. Se conservan las reglas de inscripción y cancelación por fecha; las pruebas locales utilizan un evento futuro aislado para demostrar ambos flujos. El laboratorio del backend conserva favoritos, valoraciones y las pruebas de concurrencia.

## Docker y salud

El Dockerfile se adaptó de la referencia adjunta: se retiró la copia de `web/` y `support/`, se usó Node.js 24 con Debian Trixie para compatibilidad del binario nativo de SQLite y se fijó una política de instalación de scripts que permite únicamente `sqlite3`.

Solo se instalan dependencias de producción, el contenedor usa el usuario `node` y el puerto 8080, y el proceso principal es `node src/server.js`. `.dockerignore` excluye dependencias, archivos de entorno, datos locales, pruebas, ZIP y frontend.

`/health` comprueba que HTTP está disponible. El proceso escucha mientras inicializa PostgreSQL y reintenta la conexión si falla; durante ese arranque `/api/ready` devuelve 503 y no se registra la cadena de conexión. Cuando Sequelize está listo, se habilita la API completa. Container Apps tiene sondas Startup, Liveness y Readiness; Docker también incluye `HEALTHCHECK`.

## Configuración y secretos

| Variable | Dónde se usa |
|---|---|
| `VITE_API_BASE_URL` | Frontend, valor público incorporado al JavaScript durante el build |
| `CORS_ORIGINS` | Backend, origen HTTPS concreto del frontend |
| `HOST=0.0.0.0`, `PORT=8080` | Contenedor del backend |
| `NODE_ENV=production` | Aplicaciones publicadas |
| `DATABASE_URL` | Backend, referencia al secreto `database-url` de Container Apps |
| `DB_SSL=require` | Backend, TLS con validación de certificado |

La conexión existente de PostgreSQL se reutiliza, sin cambiar la contraseña ni recrear la base. En la migración se transfiere de la configuración anterior a un secreto del contenedor mediante un archivo temporal que se elimina. No se incorpora a la imagen, al frontend ni al repositorio. Las actualizaciones siguientes recuperan el secreto existente en Azure.

## Publicación automática

El workflow [deploy-azure.yml](../.github/workflows/deploy-azure.yml) se ejecuta con los cambios pertinentes enviados a `master` o con **Run workflow**:

1. Instala dependencias, ejecuta las pruebas de API e integración React y compila el frontend.
2. Si cambió el backend, construye y sube una imagen con el SHA del commit, inicia una nueva revisión, comprueba su IP real de salida y actualiza únicamente `container-app-egress`. Después comprueba PostgreSQL. Si esta comprobación falla, solicita restaurar la imagen anterior.
3. Si cambió el frontend, compila con la URL real del backend, publica su ZIP independiente y comprueba rutas, archivos, `/health` y CORS.

Un fallo en las pruebas previas impide publicar. Las publicaciones se serializan. Un cambio solo de frontend no reconstruye el contenedor; un cambio solo del backend no recompila la web porque el dominio de la API se mantiene. Los cambios de infraestructura se aplican mediante las plantillas y scripts manuales, no mediante una ampliación automática de cuotas o tamaños.

GitHub se autentica en Azure con OIDC y una identidad propia vinculada al repositorio y a `master`. Solo recibe permisos sobre el frontend, este Container App, el registro y la identidad de lectura, además de lectura de metadatos del grupo. El propietario autorizó expresamente actualizar la única regla PostgreSQL `container-app-egress`; la asignación se limita a ese recurso hijo. No permite acceder a tablas, obtener credenciales de PostgreSQL ni asignar roles. Las variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` y `AZURE_SUBSCRIPTION_ID` son identificadores de la federación; no se guarda una contraseña de Azure en GitHub.

## Costos y límites

- App Service F1: nivel gratuito, con límites de CPU y almacenamiento y posibilidad de reposo.
- Container Apps Consumption: cuota mensual publicada de 180.000 vCPU-segundos, 360.000 GiB-segundos y dos millones de peticiones. La configuración escala a cero y limita el máximo a una réplica. Fuera de la cuota puede consumir crédito.
- Azure for Students publica durante el período elegible un registro Standard con 100 GB y PostgreSQL B1ms de 750 horas mensuales con 32 GB de datos y backup. La vigencia individual y el saldo restante no se han verificado; no se garantiza gratuidad permanente.
- La suscripción conserva el límite de gasto habilitado y no se cambia a pago por uso.
- La base está en otra región que el contenedor; puede haber latencia y consumo de transferencia entre regiones. No se presenta esta arquitectura de laboratorio como una garantía de costo cero a largo plazo.

## Operación

Consultar la [guía de despliegue](../Backend/deploy/README.md) para los comandos de actualización y las pruebas. Las imágenes del registro permiten identificar qué commit se publicó. Los resultados de la automatización aparecen en [GitHub Actions](https://github.com/mrcastilla8/taller-web-deploy/actions).

Para retirar el laboratorio completo, primero exportar los datos que se quieran conservar. Eliminar `rg-eventos-fisi` también elimina PostgreSQL y sus registros. Detener solo el frontend no detiene la base de datos ni elimina el registro. No hay un borrado programado.

## Fuentes oficiales

- [Azure for Students y sus beneficios](https://azure.microsoft.com/en-us/free/students/).
- [Precios de Container Apps](https://azure.microsoft.com/en-us/pricing/details/container-apps/).
- [Identidad administrada para descargar imágenes privadas](https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull).
- [Red de Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/networking).
- [App Service para Node.js](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs).
- [Login de Azure para GitHub Actions](https://github.com/Azure/login).
