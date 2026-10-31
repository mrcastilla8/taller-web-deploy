# Publicar frontend y backend Docker por separado

Consultar [docs/AZURE.md](../../docs/AZURE.md) para las URLs reales, regiones, recursos y evidencia. El despliegue conjunto anterior se conserva como [historial](../../docs/AZURE-2026-10-30.md).

## Requisitos

- PowerShell 7, Node.js 24, npm, Azure CLI con Bicep y la extensión `containerapp`.
- Docker Desktop con el motor Linux iniciado.
- Suscripción activa de Azure, cuota y regiones permitidas revisadas.
- Para esta migración: el grupo `rg-eventos-fisi`, el plan F1 `eventosfisi-api-e4262df5-plan` y PostgreSQL `eventosfisi-pg-e4262df5` ya existen. Se reutilizan para conservar los datos. Las plantillas de contenedores no crean ni reemplazan esa base de datos.

Desde la raíz del repositorio:

```powershell
az login --use-device-code
az account list --all --output table
az extension add --name containerapp --upgrade
Set-Location Backend
npm ci
Set-Location ../Frontend
npm ci
Set-Location ../Backend
```

## Construir y comprobar Docker localmente

Desde `Backend/`:

```powershell
docker build --tag eventosfisi-backend:local .
docker run --rm --publish 127.0.0.1:8080:8080 eventosfisi-backend:local node src/server.js --memory
```

Abrir `http://localhost:8080/health` y `http://localhost:8080/laboratorio.html`. El modo memoria es temporal; en Azure se usa PostgreSQL. El contenedor se ejecuta con el usuario `node`. La base Debian Trixie de Node.js 24 es compatible con el binario de SQLite 6 que también usa el proyecto en las pruebas locales; `allowScripts` autoriza únicamente su instalación nativa.

`dockerignore`, recibido como referencia, se incorporó con el nombre correcto **`.dockerignore`**. El Dockerfile omite `web/`, `support/` y las dependencias locales. La aplicación se inicia directamente con Node para recibir las señales de parada.

## Preparar sin modificar Azure

```powershell
.\deploy\azure.ps1 -PrepareOnly
```

Compila las plantillas y construye la imagen local. El frontend se compila por separado, al publicar, con la URL real del backend.

## Primera migración de los recursos existentes

```powershell
.\deploy\azure.ps1 -SubscriptionId '<id-suscripcion-activa>' -ImageTag 'version-inicial' -CredentialSourceAppName eventosfisi-api-e4262df5
```

El parámetro `CredentialSourceAppName` copia la conexión PostgreSQL de la configuración existente a un secreto de Container Apps, sin imprimir su valor. También puede publicarse el backend con `publish-container.ps1 -DatabaseUrl (Read-Host -AsSecureString)` cuando se proporciona una conexión propia. Los archivos temporales con parámetros se eliminan al terminar.

El proceso completo:

1. Construye la imagen a partir de `Backend/Dockerfile`.
2. Crea o actualiza `container-foundation.bicep`: registro Standard, identidad de lectura de imágenes, entorno `WorkloadProfiles` con consumo y frontend F1 independiente. Reutiliza el plan existente.
3. Sube la imagen al registro privado con la identidad del operador de Azure.
4. Publica `container-api.bicep` con el secreto PostgreSQL, CORS, puerto 8080, sondas de salud y límites de 0 a 1 réplica.
5. `sync-postgres-firewall.ps1` ejecuta `src/egress.js` en la revisión nueva y permite su IP pública real en la regla `container-app-egress` de PostgreSQL. No usa la IP de entrada como si fuera de salida ni abre el firewall a todos los orígenes. Si la consola de Azure no responde en un entorno local, consultar la IP desde esa consola y pasarla mediante `-EgressIp`.
6. Comprueba la API y PostgreSQL con `smoke-remote.js`.
7. `publish-frontend.ps1` obtiene la URL real del contenedor, configura `VITE_API_BASE_URL`, compila React y publica `dist/` más `server.mjs` en el App Service del frontend.
8. `smoke-web.js` comprueba servicios independientes, rutas, recursos, `/health` y CORS.

La creación de infraestructura puede tardar. Revisar el estado y esperar a que el entorno termine antes de sincronizar las IP. La selección de regiones de esta cuenta es Brazil South para web/registro/BD y West US para el contenedor, por las restricciones y cuotas de la suscripción.

## Actualizar manualmente

```powershell
.\deploy\azure.ps1 -SubscriptionId '<id-suscripcion-activa>' -ImageTag 'version-nueva' -UpdateOnly
```

`-UpdateOnly` conserva la infraestructura. La conexión se recupera del secreto existente de Container Apps; no necesita la aplicación anterior. El tag debe identificar la versión nueva de la imagen.

Para publicar solo la web:

```powershell
.\deploy\publish-frontend.ps1 -SubscriptionId '<id-suscripcion-activa>'
```

## Publicación automática al cambiar `master`

El workflow [deploy-azure.yml](../../.github/workflows/deploy-azure.yml) detecta cambios en `Frontend/` y `Backend/`. Ejecuta sus pruebas antes de publicar. La construcción del frontend siempre utiliza el dominio real de la API. El backend se publica con una imagen cuyo tag es el SHA del commit; si falla su comprobación PostgreSQL posterior, se solicita restaurar la imagen anterior.

El workflow usa OIDC mediante `github-oidc.bicep`: identidad federada vinculada exclusivamente a `mrcastilla8/taller-web-deploy` y `refs/heads/master`. Sus permisos son lectura del grupo, publicación en el frontend, modificación de este Container App, subida de imágenes al registro y uso de su identidad de lectura. El propietario también autorizó la actualización de la regla concreta `container-app-egress` para la IP real del contenedor. Ese permiso está limitado a ese recurso hijo; no da acceso a los datos, las contraseñas de PostgreSQL ni a la asignación de roles.

La configuración de GitHub usa variables del repositorio `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` y `AZURE_SUBSCRIPTION_ID`; son identificadores, no contraseñas. El secreto PostgreSQL permanece en Azure. Consultar el resultado en la pestaña **Actions**. También se puede ejecutar manualmente con **Run workflow**.

Para preparar la federación en otra cuenta, desplegar `github-oidc.bicep` con un operador autorizado a asignar roles y configurar las tres variables con las salidas de la plantilla. Las nuevas suscripciones necesitan sus propios recursos, cuotas y nombres; cambiar los valores por defecto coherentemente.

Las modificaciones de infraestructura Bicep se revisan y aplican con el script manual. El workflow de cambios de código no altera automáticamente tamaños, identidades ni secretos de BD; solo mantiene la regla de salida concreta autorizada. Una rama distinta de `master` tampoco publica.

## Verificar

Desde `Backend/`, con las URLs reales:

```powershell
npm test
node scripts/smoke-remote.js '<url-backend>'
node scripts/smoke-web.js '<url-frontend>' '<url-backend>'
```

Desde `Frontend/`, después de instalar también las dependencias de `Backend/`:

```powershell
npm test
npm run build
```

## Archivos históricos

`main.bicep` y `firewall.bicep` registran la primera infraestructura de PostgreSQL y App Service del 30 de octubre; no son las plantillas usadas para publicar el backend Docker actual. `azure.ps1` ahora utiliza `container-foundation.bicep` y `container-api.bicep`. `Backend/web/` ya no es servido ni copiado al contenedor.
