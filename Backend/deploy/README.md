# Desplegar el backend y su base de datos en Azure

Solo se publica `Backend/`. El frontend original queda intacto.

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
gratuito vigente. `eastus2` es el valor inicial del script; puede cambiarse con
`-Location` para una región permitida por la cuenta.

## Preparar sin crear recursos

Desde `Backend/`, con Azure CLI y Bicep instalados:

```powershell
.\deploy\azure.ps1 -PrepareOnly
```

Compila las plantillas y crea `deploy/out/backend.zip`. El ZIP contiene `src/`,
`public/`, `package.json` y `package-lock.json`; las dependencias se instalan en
Azure sobre Linux. Los archivos SQLite, credenciales, evidencia y dependencias
locales quedan fuera del paquete. `deploy/out/` está excluido de Git.

## Crear y publicar

Una vez reactivada la suscripción y comprobados sus beneficios:

```powershell
.\deploy\azure.ps1 -SubscriptionId '<id-de-la-suscripcion>' -Location eastus2
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
Crea un perfil de prueba único y lo elimina con sus datos al terminar.

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

La plantilla compila localmente y el paquete se genera correctamente. Las 15
pruebas locales de SQLite siguen pasando tras añadir PostgreSQL. La validación
real de PostgreSQL, las cuotas y las URLs públicas requieren completar el
despliegue en una suscripción habilitada.

Fuentes oficiales:

- [Beneficios de Azure for Students](https://azure.microsoft.com/en-us/free/students/).
- [Configuración de Node.js en App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs).
- [Limitaciones de bases locales sobre montajes de App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-connect-to-azure-storage).
- [API de PostgreSQL Flexible Server](https://learn.microsoft.com/en-us/azure/templates/microsoft.dbforpostgresql/2024-08-01/flexibleservers).
