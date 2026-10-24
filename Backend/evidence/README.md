# Evidencia del backend

Verificación realizada el 24 de octubre de 2026.

## Ejecución reproducible

Desde `Backend/`, ejecutar `npm test` y `npm run evidence`.

- Las 15 pruebas de integración terminaron correctamente.
- [resultado.json](resultado.json) registra respuestas rápidas de 14–17 ms mientras
  la petición con demora de 3 segundos tardó 3048 ms.
- La consulta SQL real tardó 792 ms; otras peticiones respondieron en 3–4 ms y el
  temporizador de JavaScript avanzó 50 veces durante la consulta.
- Favoritos y valoraciones se guardaron por HTTP, se cerraron el servidor y la
  conexión ORM, y se recuperaron después de abrir una conexión nueva al mismo
  archivo SQLite.

Son mediciones de esta ejecución, no garantías de rendimiento. Al repetir el
script, los tiempos y los identificadores de petición cambian.

## Verificación en navegador

El cliente probado fue `Backend/public/laboratorio.html`.

1. Se guardó y consultó un favorito.
2. Se guardó una valoración de 5/5 con un comentario de prueba.
3. Se verificó que tres peticiones respondieron durante la espera de 3 segundos.
4. Se verificó la concurrencia durante una consulta SQL real: dos respuestas de
   7 ms durante una consulta de 1028 ms, con 65 ticks del temporizador JS.
5. Se detuvo el proceso del backend, se inició otra vez, se recargó la página y
   se recuperaron el favorito y la valoración desde el archivo SQLite.

Capturas reales:

- [Espera no bloqueante](navegador-concurrencia.png).
- [Consulta ORM no bloqueante](navegador-orm.png).
- [Valoración recuperada después de reiniciar el proceso](navegador-persistencia.png).

Las capturas muestran datos ficticios de prueba. `Frontend/` se verificó contra
el remoto: sus 26 archivos se conservaron sin cambios. Esta entrega contiene
únicamente archivos de `Backend/`.
