# FrontendEventos conectado a la API

Web React 19 con Vite y React Router, publicada por separado del backend Docker.

**Web pública:** https://eventosfisi-web-e4262df5.azurewebsites.net/

**API:** https://eventosfisi-docker-e4262df5.kindwater-fcfdd589.westus.azurecontainerapps.io

## Ejecución local

Requisito: Node.js 24 y npm. Primero instalar e iniciar el backend desde `Backend/` con `npm ci` y `npm start`. Luego, desde `Frontend/`:

```powershell
npm ci
npm run dev
```

Vite sirve la web en `http://localhost:5173`. Por defecto, el cliente usa `http://localhost:3001`. Se puede configurar `VITE_API_BASE_URL` antes de compilar o en un archivo de entorno local, tomando [.env.example](.env.example) como referencia. Es una URL pública, nunca una conexión de base de datos.

## Datos y funciones

- `src/api/client.js`: cliente HTTP, identificador de sesión, errores y límite de espera.
- `src/context/AppContext.jsx`: carga catálogo, categorías, perfil e inscripciones mediante la API. Las mutaciones esperan la respuesta del servidor antes de actualizar la pantalla.
- `src/hooks/useEventFilter.js`: filtra los eventos recibidos de la API.
- `src/pages/EventDetail.jsx` y `MyEvents.jsx`: detalle e inscripciones usando los datos del servidor. La capacidad ya incluye las inscripciones globales y no se incrementa dos veces en el frontend.
- `StudentModal`: guarda el perfil en el servidor y comunica errores. El navegador conserva únicamente `edu_session_id`; las claves antiguas de perfil e inscripciones locales ya no son el origen de datos.

El archivo original `src/data/mockData.js` se conserva como referencia de los datos de la clase, pero la aplicación ya no lo importa para obtener su catálogo. Los nueve eventos tienen fechas pasadas: la regla de inscripción lo respeta. La prueba de integración usa un evento futuro aislado.

El identificador de sesión permite recuperar el perfil en el mismo navegador. Esta versión de laboratorio no implementa autenticación por contraseña.

## Compilar y servir el frontend independiente

```powershell
$env:VITE_API_BASE_URL = 'https://eventosfisi-docker-e4262df5.kindwater-fcfdd589.westus.azurecontainerapps.io'
npm run build
node server.mjs
```

`server.mjs` sirve únicamente `dist/`, escucha el puerto de `PORT` (8080 por defecto), resuelve enlaces directos a `/eventos/:id` y `/mis-eventos`, y devuelve 404 para archivos y rutas inexistentes. El paquete Azure contiene `dist/` y `server.mjs`; no contiene código ni credenciales del backend.

El backend debe permitir el origen de la web en `CORS_ORIGINS`. La [guía de publicación](../Backend/deploy/README.md) obtiene la URL de la API directamente de Azure.

## Prueba de integración

Con las dependencias de `Backend/` también instaladas:

```powershell
npm test
```

La prueba inicia una API real con una base temporal, carga el catálogo, valida el perfil, inscribe/cancela y recupera los datos usando el mismo identificador. No modifica PostgreSQL ni el catálogo público.

## Publicación automática

Los cambios de código enviados a `master` se prueban y publican mediante [GitHub Actions](../.github/workflows/deploy-azure.yml). Un cambio de frontend recompila React con la URL real del backend y actualiza este servicio independiente. Ver [arquitectura y costos](../docs/AZURE.md).
