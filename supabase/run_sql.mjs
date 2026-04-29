// Wendet eine SQL-Datei via pg gegen Supabase an.
// Aufruf: DB_URL="postgres://..." node run_sql.mjs <sql-file>
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.DB_URL;
if (!url) { console.error('DB_URL fehlt'); process.exit(1); }
const file = process.argv[2];
if (!file) { console.error('Usage: node run_sql.mjs <file.sql>'); process.exit(1); }

const sql = readFileSync(file, 'utf-8');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

await client.connect();
console.log(`Verbunden, führe ${file} aus (${sql.length} Bytes)...`);
try {
  await client.query(sql);
  console.log('✓ SQL erfolgreich angewendet');
} catch (err) {
  console.error('✗ Fehler:', err.message);
  if (err.position) console.error('  Position:', err.position);
  if (err.detail) console.error('  Detail:', err.detail);
  process.exit(1);
} finally {
  await client.end();
}
