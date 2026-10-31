import { isIP } from 'node:net'

// Diagnóstico ejecutado mediante la consola autenticada de Azure, nunca como ruta pública.
const response = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(10000) })
if (!response.ok) throw new Error('No se pudo consultar la IP de salida.')
const ip = (await response.text()).trim()
if (isIP(ip) !== 4) throw new Error('El diagnóstico no devolvió una dirección IPv4 válida.')
const [first, second] = ip.split('.').map(Number)
if (first === 0 || first === 10 || first === 127 || first >= 224 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || (first === 169 && second === 254)) {
  throw new Error('Se esperaba una IP de salida pública, nunca una regla global o privada.')
}
console.log('EGRESS_IP=' + ip)
