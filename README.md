# EventosFISI — despliegue en Azure

Aplicación de eventos académicos con frontend React/Vite y API Node.js/Express con Sequelize. Publicación verificada el **30 de octubre de 2026** (America/Lima).

| Acceso público | URL |
|---|---|
| Web React | [Abrir web](https://eventosfisi-api-e4262df5.azurewebsites.net/) |
| API: catálogo | [Consultar eventos](https://eventosfisi-api-e4262df5.azurewebsites.net/api/events) |
| API: conexión PostgreSQL | [Comprobar disponibilidad](https://eventosfisi-api-e4262df5.azurewebsites.net/api/ready) |
| Laboratorio | [Probar API y base de datos](https://eventosfisi-api-e4262df5.azurewebsites.net/laboratorio.html) |

## Qué está publicado

Un App Service Linux **F1 / Free**, con Node.js 24 LTS, sirve la web compilada, la API y el laboratorio en el mismo dominio. La API utiliza **Azure Database for PostgreSQL Flexible Server 16**, tamaño **Standard_B1ms**, con **32 GB**. Ambos recursos están en **Brazil South**.

La web React conserva el catálogo local y el perfil e inscripciones en `localStorage`. El laboratorio llama a la API y guarda perfiles, favoritos y valoraciones en PostgreSQL. La integración de la web principal con la API sigue pendiente. Los nueve eventos originales tienen fechas pasadas al día de la publicación.

F1 es gratuito. La gratuidad de PostgreSQL depende de la vigencia y los límites del beneficio estudiantil; fuera del beneficio puede consumir el crédito disponible. La suscripción conserva su límite de gasto y no se convirtió a pago por uso. Ver los detalles en la [documentación de Azure](docs/AZURE.md#costos-y-límites).

## Documentación

- [Azure: arquitectura, recursos reales, proceso realizado, costos y operación](docs/AZURE.md).
- [Crear, preparar y actualizar el despliegue](Backend/deploy/README.md).
- [API, modelos, ejecución local y concurrencia](Backend/README.md).
- [Frontend React](Frontend/README.md).
- [Resumen de la verificación en Azure](Backend/evidence/azure-deploy.json).

## Código de infraestructura y publicación

- [`Backend/deploy/main.bicep`](Backend/deploy/main.bicep): App Service, PostgreSQL y configuración de ejecución.
- [`Backend/deploy/firewall.bicep`](Backend/deploy/firewall.bicep): acceso de PostgreSQL desde las IP de salida de App Service.
- [`Backend/deploy/azure.ps1`](Backend/deploy/azure.ps1): empaquetado, validación, infraestructura, publicación y comprobaciones.
- [`Backend/scripts/smoke-remote.js`](Backend/scripts/smoke-remote.js): prueba por HTTPS de PostgreSQL, perfiles, favoritos y valoraciones.
- [`Backend/scripts/smoke-web.js`](Backend/scripts/smoke-web.js): portada, rutas React, recursos estáticos, laboratorio y errores 404.

Los archivos compilados `Frontend/dist/` y `Backend/web/`, dependencias, ZIP de publicación, archivos SQLite y credenciales se generan fuera del control de versiones. La guía explica cómo reconstruirlos.
