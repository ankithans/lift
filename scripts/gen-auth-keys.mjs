// Prints JWT_PRIVATE_KEY and JWKS for Convex Auth as KEY=value lines (stdout only).
import { generateKeyPairSync } from 'node:crypto'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trimEnd().replace(/\n/g, ' ')
const jwk = publicKey.export({ format: 'jwk' })
console.log(JSON.stringify({ JWT_PRIVATE_KEY: pem, JWKS: JSON.stringify({ keys: [{ use: 'sig', ...jwk }] }) }))
