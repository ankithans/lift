// Calls the Convex /admin HTTP action on prod. Usage: node scripts/admin.mjs <op> [jsonArgs|@file.json]
import { readFileSync } from 'node:fs'
const vars = Object.fromEntries(readFileSync(`${process.env.HOME}/.config/lift/secrets.env`, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const [op, raw = '{}'] = process.argv.slice(2)
const args = raw.startsWith('@') ? JSON.parse(readFileSync(raw.slice(1), 'utf8')) : JSON.parse(raw)
const res = await fetch(`${vars.CONVEX_SITE_URL_PROD}/admin`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-admin-secret': vars.ADMIN_SECRET },
  body: JSON.stringify({ op, args }),
})
console.log(res.status, await res.text())
if (!res.ok) process.exit(1)
