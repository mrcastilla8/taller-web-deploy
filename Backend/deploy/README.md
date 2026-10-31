# Desplegar la web, la API y PostgreSQL en Azure

El despliegue real está documentado en [docs/AZURE.md](../../docs/AZURE.md), con sus URLs, recursos, región, configuración, costos y resultados de validación.

Se publica `Backend/`. Si contiene `web/index.html`, también se publica la web React compilada: la raíz muestra la web, `/api/*` mantiene la API y `/laboratorio.html` mantiene el laboratorio. El frontend conserva su comportamiento original con `localStorage`; publicar ambos no conecta automáticamente React con la API.

Para incluir el frontend, desde la raíz del repositorio:

```powershell
Set-Location Frontend
npm ci
npm run build
Set-Location ..
New-Item -ItemType Directory -Path Backend/web -Force | Out-Null
Copy-Item -Path Frontend/dist/* -Destination Backend/web -Recurse -Force
Set-Location Backend
```

Las rutas React `/eventos/:id` y `/mis-eventos` devuelven `index.html`; las rutas de API y los archivos inexistentes mantienen sus respuestas 404.

## Infraestructura preparada

| Recurso | Configuración |
|---|---|
| App Service | Linux, Node.js 24 LTS, plan F1 |
| Base de datos | Azure Database for PostgreSQL Flexible Server, versión 16 |
| Cómputo de BD | Burstable `Standard_B1ms` |
| Almacenamiento | 32 GB, crecimiento automático desactivado |
| Copias | Retención de 7 días, redundancia geográfica desactivada |
| Conexión | TLS con validación del certificado |
| Firewall de BD | Solo IPs de salida actuales y posibles de App Service |

Azure publica un beneficio de estudiantes de 750 horas B1ms, 32 GB de datos y
32 GB de backup al mes durante 12 meses para cuentas elegibles. La disponibilidad
depende de la suscripción, la vigencia del beneficio, la región y las cuotas.
F1 es el plan gratuito de App Service, con sus límites de uso. El script no
sustituye planes ni tamaños por otros de pago si Azure rechaza la configuración.

## Comprobación previa obligatoria

```powershell
az login --use-device-code
az account list --all --query '[].{name:name,id:id,state:state}' --output table
```

La suscripción elegida debe mostrar `Enabled`. Si aparece `Disabled`, el script
se detiene antes de crear o modificar recursos. Revisar la suscripción en el
portal y la [guía de reactivación de Azure for Students](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/azurestudents-subscription-disabled).

También deben comprobarse las regiones permitidas, las cuotas y el beneficio
gratuito vigente. `brazilsouth` es el valor inicial del script, correspondiente a la publicación verificada; puede cambiarse con
`-Location` para una región permitida por la cuenta.

## Preparar sin crear recursos

Desde `Backend/`, con Azure CLI y Bicep instalados:

```powershell
.\deploy\azure.ps1 -PrepareOnly
```

Compila las plantillas y crea `deploy/out/backend.zip`. El ZIP contiene `src/`,
`public/`, `web/` si existe, `package.json` y `package-lock.json`; las dependencias se instalan en
Azure sobre Linux. Los archivos SQLite, credenciales, evidencia y dependencias
locales quedan fuera del paquete. `deploy/out/` está excluido de Git.

## Crear y publicar

Con una suscripción activa y sus beneficios comprobados:

```powershell
.\deploy\azure.ps1 -SubscriptionId '<id-de-la-suscripcion>' -Location brazilsouth
```

El script crea el grupo `rg-eventos-fisi`, un App Service y PostgreSQL. Los nombres
incluyen un sufijo calculado a partir de la suscripción y el prefijo para evitar
colisiones. El nombre del grupo y el prefijo se pueden configurar por parámetros.

La contraseña inicial de PostgreSQL se genera automáticamente. Se pasa como
parámetro seguro de Bicep mediante un archivo temporal que se elimina al finalizar;
la conexión se guarda en la configuración de App Service. Las salidas de la
plantilla contienen nombres y URLs, sin contraseñas. La plantilla configura
`HOST=0.0.0.0`, `DATABASE_URL`, `DB_SSL=require` y compilación remota con Oryx.

Después se publica el ZIP y se ejecuta `scripts/smoke-remote.js`: comprueba HTTPS,
conexión PostgreSQL, catálogo, grabación/consulta de favoritos y valoraciones.
Crea un perfil de prueba único y lo elimina con sus datos al terminar. Si se incluye `web/`, también ejecuta `scripts/smoke-web.js` para comprobar la web, sus rutas, sus archivos y los errores 404.

La base se inicializa con los modelos de Sequelize y el catálogo original. Los
datos personales guardados en el SQLite local requieren una migración adicional
si se desea conservarlos en Azure.

## Actualizar el código

```powershell
.\deploy\azure.ps1 -SubscriptionId '<id-de-la-suscripcion>' -UpdateOnly
```

Publica el código y repite las comprobaciones sin cambiar infraestructura ni
credenciales. Deben conservarse el mismo grupo y prefijo usados al crear recursos.
Si una creación anterior falla parcialmente, revisar esos recursos antes de
repetirla; `-UpdateOnly` presupone que la infraestructura ya quedó completa.

Las URLs finales se obtienen desde Azure; no se presupone ningún dominio antes
de completar la creación. El cliente de prueba está en `/laboratorio.html`.

## Verificar la persistencia

Guardar un favorito y una valoración en el laboratorio, reiniciar App Service,
recargar y volver a consultarlos. PostgreSQL se ejecuta como recurso independiente
de App Service y conserva los datos al reiniciar o republicar el backend.

Para inspeccionar el servicio:

```powershell
az webapp show --resource-group rg-eventos-fisi --name '<app-name>' --query defaultHostName
az webapp log tail --resource-group rg-eventos-fisi --name '<app-name>'
```

`/api/health` verifica la disponibilidad de HTTP sin hacer una consulta SQL;
`/api/ready` verifica también la conexión a PostgreSQL. Esto conserva la posibilidad
de demostrar que HTTP responde mientras una consulta ORM sigue ejecutándose.

## Estado de validación

La publicación del 30 de octubre de 2026 se completó en Brazil South. La plantilla y las 25 reglas del firewall terminaron con `Succeeded`; Oryx compiló el paquete y App Service confirmó el arranque. Pasaron las 15 pruebas locales y las comprobaciones públicas de la web, la API, la conexión PostgreSQL y escritura/consulta de favoritos y valoraciones. Los perfiles temporales de comprobación se eliminaron al terminar.

Ver [el resumen de evidencia](../evidence/azure-deploy.json) y [la documentación completa](../../docs/AZURE.md). La vigencia individual del beneficio gratuito y el saldo de crédito no se verificaron desde facturación.

Fuentes oficiales:

- [Beneficios de Azure for Students](https://azure.microsoft.com/en-us/free/students/).
- [Configuración de Node.js en App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs).
- [Limitaciones de bases locales sobre montajes de App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-connect-to-azure-storage).
- [API de PostgreSQL Flexible Server](https://learn.microsoft.com/en-us/azure/templates/microsoft.dbforpostgresql/2024-08-01/flexibleservers).
