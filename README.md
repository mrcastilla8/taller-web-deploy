# EventosFISI — frontend y backend independientes en Azure

React/Vite se publica como una web independiente y consume por HTTPS la API de eventos. El backend se construye con [`Backend/Dockerfile`](Backend/Dockerfile), se guarda en Azure Container Registry y se ejecuta como microservicio en Azure Container Apps. Sequelize persiste los datos en PostgreSQL.

## Accesos

- **Frontend:** https://eventosfisi-web-e4262df5.azurewebsites.net/
- **Backend Docker:** https://eventosfisi-docker-e4262df5.kindwater-fcfdd589.westus.azurecontainerapps.io
- La URL real del backend y las comprobaciones del despliegue están en [docs/AZURE.md](docs/AZURE.md) y [la evidencia de Azure](Backend/evidence/azure-deploy.json).
- La ruta de salud del microservicio es **`/health`**. Se conserva `/api/health` por compatibilidad y `/api/ready` verifica PostgreSQL.

## Qué cambió

- El frontend y el backend tienen servicios, paquetes y dominios distintos.
- El Dockerfile del backend copia solo sus archivos de ejecución; incluye `HEALTHCHECK`, puerto 8080 y usuario sin privilegios. `.dockerignore` excluye la web, dependencias locales y credenciales.
- La web consulta catálogo, categorías, perfil e inscripciones mediante la API. El navegador conserva únicamente un identificador de sesión; la persistencia se realiza en el servidor.
- CORS permite el origen concreto del frontend. La conexión de PostgreSQL se guarda como un secreto del contenedor.
- [GitHub Actions](.github/workflows/deploy-azure.yml) prueba y publica los cambios de `master`: los del frontend actualizan la web y los del backend generan una nueva imagen Docker. Los cambios solo en documentación raíz no disparan una publicación.

## Documentación y ejecución

- [Arquitectura, recursos, costos, requisitos del laboratorio y validación](docs/AZURE.md).
- [Publicación automática comprobada: pruebas, backend y frontend en verde](https://github.com/mrcastilla8/taller-web-deploy/actions/runs/41200189943).
- [Publicación manual, actualización y automatización](Backend/deploy/README.md).
- [API y ejecución local](Backend/README.md).
- [Frontend conectado a la API](Frontend/README.md).
- [Historial del primer despliegue conjunto del 30 de octubre](docs/AZURE-2026-10-30.md).

Los nueve eventos originales ya tienen fechas pasadas: se conservan las reglas que impiden nuevas inscripciones en eventos realizados. Las pruebas de integración usan un evento futuro aislado para comprobar la inscripción y cancelación sin modificar el catálogo público.

F1 tiene nivel gratuito. Container Apps tiene cuota mensual gratuita y escala a cero. Los beneficios de Container Registry Standard y PostgreSQL dependen de la elegibilidad y vigencia de la cuenta estudiantil; no se garantiza gratuidad permanente. La suscripción mantiene su límite de gasto.
