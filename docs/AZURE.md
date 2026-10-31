# Azure: configuración y despliegue de EventosFISI

Este documento registra el despliegue realizado y verificado el **30 de octubre de 2026**, hora de Lima. Los recursos pueden detenerse o retirarse posteriormente; las comprobaciones describen esa publicación.

## URLs públicas

| Uso | URL |
|---|---|
| Web React | https://eventosfisi-api-e4262df5.azurewebsites.net/ |
| Detalle de un evento | https://eventosfisi-api-e4262df5.azurewebsites.net/eventos/1 |
| API: eventos | https://eventosfisi-api-e4262df5.azurewebsites.net/api/events |
| API: disponibilidad HTTP | https://eventosfisi-api-e4262df5.azurewebsites.net/api/health |
| API: disponibilidad de PostgreSQL | https://eventosfisi-api-e4262df5.azurewebsites.net/api/ready |
| Laboratorio | https://eventosfisi-api-e4262df5.azurewebsites.net/laboratorio.html |

## Arquitectura

El navegador accede por HTTPS a un único App Service. Express sirve tres partes:

| Ruta | Contenido y origen de los datos |
|---|---|
| `/`, `/eventos/:id`, `/mis-eventos` | React compilado en `Backend/web/`; catálogo local, perfil e inscripciones en `localStorage` |
| `/api/*` | API Express; Sequelize accede a PostgreSQL mediante el controlador `pg` |
| `/laboratorio.html` y sus recursos | Cliente de prueba que llama a la API; perfiles, favoritos y valoraciones se guardan en PostgreSQL |

Las rutas React devuelven `index.html` para que un enlace directo o una recarga funcionen. Las rutas desconocidas de API y los archivos estáticos inexistentes conservan la respuesta 404. Cuando no existe una compilación en `Backend/web/`, la raíz del backend redirige al laboratorio, como en la ejecución local original.

Publicar ambas partes en el mismo dominio no conecta automáticamente el frontend con la API: esa integración sigue pendiente.

## Recursos utilizados

| Recurso | Configuración desplegada |
|---|---|
| Tipo de suscripción | Azure for Students, activa al desplegar, con `spendingLimit=On` |
| Grupo de recursos | `rg-eventos-fisi` |
| Región de metadatos del grupo | North Central US |
| Región de App Service y PostgreSQL | Brazil South (`brazilsouth`) |
| Plan App Service | `eventosfisi-api-e4262df5-plan`, Linux, **F1 / Free**, capacidad 1 |
| Aplicación | `eventosfisi-api-e4262df5` |
| Runtime | Node.js 24 LTS; inicio con `npm start` |
| PostgreSQL Flexible Server | `eventosfisi-pg-e4262df5`, versión 16 |
| Cómputo de PostgreSQL | Burstable `Standard_B1ms` |
| Base de datos | `eventos` |
| Almacenamiento de PostgreSQL | 32 GB, crecimiento automático desactivado |
| Copias de seguridad | Retención de 7 días; redundancia geográfica desactivada |
| Alta disponibilidad | Desactivada |
| Conexión a la BD | TLS con validación del certificado |
| Firewall de PostgreSQL | 25 reglas para las IP de salida actuales y posibles de App Service |

La región del grupo describe sus metadatos; sus recursos pueden estar en otra región permitida. La suscripción usada permitía Chile Central, Brazil South, North Central US, West US y West Central US. La validación inicial de F1 en North Central US reportó cuota cero. Se validaron las otras regiones permitidas y se eligió Brazil South; el grupo existente se reutilizó.

Los nombres se calculan con un sufijo derivado de la suscripción y `NamePrefix`. Otra suscripción puede producir nombres y URLs diferentes. El ID de suscripción, datos personales y credenciales no son necesarios en esta documentación pública; los comandos usan un marcador.

## Configuración de ejecución

La plantilla [`main.bicep`](../Backend/deploy/main.bicep) establece:

| Variable o propiedad | Valor o función |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` para escuchar las peticiones de App Service |
| `DATABASE_URL` | Conexión PostgreSQL generada durante el despliegue; su valor es secreto |
| `DB_SSL` | `require` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true`; habilita la instalación y compilación remotas |
| `ENABLE_ORYX_BUILD` | `true` |
| `linuxFxVersion` | `NODE\|24-lts` |
| `httpsOnly` | `true` |
| TLS mínimo | 1.2 para la aplicación y SCM |
| `alwaysOn` | `false` |
| FTPS | Desactivado |

`src/server.js` lee el puerto asignado mediante `PORT`. `DATABASE_URL` selecciona PostgreSQL; sin ella, el backend utiliza SQLite local. El modo `--memory` utiliza SQLite temporal para los ejercicios locales.

La contraseña inicial de PostgreSQL se genera aleatoriamente y se entrega a Bicep como parámetro seguro mediante un archivo temporal. El archivo se elimina al terminar. La conexión queda en la configuración de App Service. El repositorio no contiene su valor, tokens de Azure ni perfiles de publicación.

## Cómo se realizó la publicación

1. Se comprobó la suscripción activa y sus políticas de regiones y cuota, conservando el límite de gasto estudiantil.
2. Se instalaron las dependencias con `npm ci`. La web se compiló con `npm run build` en `Frontend/` y el contenido de `dist/` se copió a `Backend/web/`.
3. Se adaptó Express para servir la web compilada y sus rutas sin alterar `/api/*` ni el laboratorio. Los archivos fuente de `Frontend/` conservaron su comportamiento original.
4. Se compilaron las plantillas Bicep y se generó `Backend/deploy/out/backend.zip`, con `src/`, `public/`, `web/`, `package.json` y `package-lock.json`. Las dependencias locales, credenciales, bases SQLite y evidencia quedaron fuera del ZIP.
5. Se registraron los proveedores `Microsoft.Web` y `Microsoft.DBforPostgreSQL`. Se validó y creó la infraestructura en Brazil South.
6. Se adelantó la publicación del ZIP mientras Azure terminaba las reglas del firewall. Oryx instaló las dependencias para Linux; App Service confirmó la compilación y el arranque correctos. También se esperó la finalización de toda la infraestructura y sus 25 reglas.
7. Se comprobaron la web y la API por HTTPS y se revisaron visualmente el catálogo y el detalle de un evento con URL directa.

El comando de publicación del paquete, ejecutado desde `Backend/`, es:

```powershell
az webapp deploy --subscription '<id-suscripcion-activa>' --resource-group rg-eventos-fisi --name eventosfisi-api-e4262df5 --src-path deploy/out/backend.zip --type zip --output none
```

Para repetir el proceso completo o actualizar el código, seguir la [guía de despliegue](../Backend/deploy/README.md). `-UpdateOnly` publica código sin cambiar la infraestructura ni regenerar credenciales.

## Qué se comprobó

| Comprobación | Resultado observado |
|---|---|
| Compilación de producción de React/Vite | Correcta |
| Pruebas locales de la API sobre SQLite | 15 pruebas aprobadas |
| Plantilla principal y módulo de firewall | `Succeeded`; 25 reglas completas |
| Publicación y arranque de App Service | Completados correctamente |
| Portada, rutas React, JS/CSS, laboratorio y respuestas 404 por HTTPS | Correctos |
| `/api/ready` | Conexión PostgreSQL confirmada |
| Perfil temporal, favoritos y valoraciones por HTTP | Escritura y consulta correctas; datos de prueba eliminados al terminar |
| Navegador | Catálogo y detalle de evento renderizados correctamente |

El [resumen estructurado](../Backend/evidence/azure-deploy.json) registra los resultados. Para repetir las comprobaciones, desde `Backend/` con sus dependencias instaladas:

```powershell
npm test
node scripts/smoke-remote.js https://eventosfisi-api-e4262df5.azurewebsites.net
node scripts/smoke-web.js https://eventosfisi-api-e4262df5.azurewebsites.net
```

`smoke-remote.js` crea un perfil temporal único, guarda y consulta favoritos y valoraciones, y borra ese perfil con sus datos al terminar. `smoke-web.js` solo lee recursos HTTP. También puede comprobar la web local sin argumento, después de generar `Backend/web/`.

Las pruebas de concurrencia y persistencia tras reabrir SQLite están documentadas en la [evidencia local](../Backend/evidence/README.md). En Azure se confirmó escritura y consulta sobre PostgreSQL; no se realizó una prueba específica de conservación de registros atravesando un reinicio de App Service. Las pruebas de concurrencia del laboratorio pueden ejecutarse en la página; sus tiempos dependen de la carga y la red.

## Laboratorio para la presentación

1. Guardar un perfil con datos de prueba.
2. Guardar un evento como favorito y consultar la lista.
3. Guardar una valoración y consultar su puntuación, comentario y promedio.
4. Recargar en el mismo navegador para recuperar el perfil y los favoritos desde el servidor; seleccionar el evento y consultar de nuevo sus valoraciones.
5. Ejecutar **Probar espera de 3 segundos** y revisar qué peticiones terminaron durante la espera. **Probar consulta ORM** hace una consulta SQL real mediante Sequelize y mide la disponibilidad del servidor durante ella.

El laboratorio guarda un identificador de sesión en el navegador, que acompaña a sus llamadas HTTP. Los registros pertenecientes a esa sesión se guardan en PostgreSQL. Abrir otro navegador o borrar el identificador genera otra sesión; esto no equivale a un sistema de autenticación con cuentas y contraseñas.

Al día de la publicación, los nueve eventos originales ya habían pasado. La interfaz muestra cero próximos y limita las nuevas inscripciones según esas fechas. Favoritos y valoraciones permiten demostrar la base de datos con el catálogo existente.

## Costos y límites

- **App Service F1:** nivel gratuito con 1 GB de memoria y 60 minutos de CPU diarios. Son minutos de procesamiento; no significa que el sitio se elimine después de una hora. Puede entrar en reposo y tardar en responder al primer acceso.
- **PostgreSQL:** la oferta estudiantil publica 750 horas mensuales de B1ms, 32 GB de almacenamiento y 32 GB de backup durante el período elegible de 12 meses para nuevos clientes. La configuración desplegada coincide con ese tamaño.
- **Vigencia y saldo:** no se verificaron la vigencia individual del beneficio, el saldo ni el total facturado. Si el beneficio no aplica o se supera su cuota, PostgreSQL puede consumir crédito estudiantil. La publicación no garantiza gratuidad permanente.
- **Suscripción:** se mantuvo `spendingLimit=On` y no se cambió a pago por uso.

Consultar los beneficios y el consumo en la cuenta antes de dejar los recursos funcionando a largo plazo. Los presupuestos y alertas, si se configuran, sirven para notificar el consumo; no sustituyen el límite de gasto.

## Operación y retirada

Consultar la infraestructura y obtener el dominio sin mostrar configuraciones secretas:

```powershell
az deployment group show --subscription '<id-suscripcion-activa>' --resource-group rg-eventos-fisi --name eventos-fisi --query properties.provisioningState --output tsv
az webapp show --subscription '<id-suscripcion-activa>' --resource-group rg-eventos-fisi --name eventosfisi-api-e4262df5 --query defaultHostName --output tsv
az postgres flexible-server show --subscription '<id-suscripcion-activa>' --resource-group rg-eventos-fisi --name eventosfisi-pg-e4262df5 --query state --output tsv
```

La publicación quedó disponible sin un borrado programado. Para retirar **todo este despliegue**, el siguiente comando elimina los recursos del grupo, **incluida la base de datos y sus registros**. Exportar primero los datos que se quieran conservar y comprobar el grupo seleccionado:

```powershell
az resource list --subscription '<id-suscripcion-activa>' --resource-group rg-eventos-fisi --output table
az group delete --subscription '<id-suscripcion-activa>' --name rg-eventos-fisi
```

Detener únicamente la aplicación no elimina PostgreSQL ni su almacenamiento.

## Fuentes oficiales

- [Precios y límites de App Service Linux](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/).
- [Beneficios de Azure for Students](https://azure.microsoft.com/en-us/free/students/).
- [Configuración de Node.js en App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs).
- [Publicación de un paquete ZIP](https://learn.microsoft.com/en-us/azure/app-service/deploy-zip).
- [PostgreSQL Flexible Server en Bicep](https://learn.microsoft.com/en-us/azure/templates/microsoft.dbforpostgresql/2024-08-01/flexibleservers).
