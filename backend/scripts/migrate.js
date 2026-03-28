import 'dotenv/config';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRISMA_DIR = join(__dirname, '..', 'prisma');
const LOG_FILE = join(PRISMA_DIR, 'migration-log.json');
const ROLLBACK_DIR = join(PRISMA_DIR, 'rollbacks');
const BACKUP_DIR = join(PRISMA_DIR, 'backups');

// --- Colored output helpers ---
const color = {
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`,
  cyan: (t) => `\x1b[36m${t}\x1b[0m`,
  dim: (t) => `\x1b[2m${t}\x1b[0m`,
};

const ts = () => color.dim(`[${new Date().toISOString()}]`);
const log = (msg) => console.log(`${ts()} ${msg}`);
const ok = (msg) => log(color.green(`✓ ${msg}`));
const warn = (msg) => log(color.yellow(`⚠ ${msg}`));
const fail = (msg) => log(color.red(`✗ ${msg}`));

// --- Migration log ---
function readLog() {
  if (!existsSync(LOG_FILE)) return [];
  return JSON.parse(readFileSync(LOG_FILE, 'utf-8'));
}

function writeLog(entries) {
  writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2));
}

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: join(__dirname, '..'), stdio: opts.silent ? 'pipe' : 'inherit', encoding: 'utf-8' });
}

function runCapture(cmd) {
  return execSync(cmd, { cwd: join(__dirname, '..'), stdio: 'pipe', encoding: 'utf-8' });
}

// --- Backup ---
function backup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { warn('DATABASE_URL not set — skipping pg_dump backup'); return null; }
  mkdirSync(BACKUP_DIR, { recursive: true });
  const name = `backup_${Date.now()}.sql`;
  const path = join(BACKUP_DIR, name);
  try {
    log(`Creating backup ${color.cyan(name)}...`);
    run(`pg_dump "${dbUrl}" --no-owner --no-acl -f "${path}"`, { silent: true });
    ok(`Backup saved to prisma/backups/${name}`);
    return path;
  } catch (e) {
    warn(`pg_dump failed: ${e.message?.split('\n')[0]}`);
    return null;
  }
}

// --- Commands ---
function status() {
  log(color.cyan('Migration status:'));
  run('npx prisma migrate status');
  const entries = readLog();
  if (entries.length) {
    log(color.cyan(`\nMigration log (${entries.length} entries):`));
    entries.forEach((e) => console.log(`  ${color.dim(e.appliedAt)} ${e.action.padEnd(10)} ${e.name}`));
  }
}

function migrate() {
  log(color.cyan('Applying pending migrations...'));
  backup();
  const before = runCapture('npx prisma migrate status');
  run('npx prisma migrate deploy');
  const after = runCapture('npx prisma migrate status');

  // Detect newly applied migrations
  const applied = after.match(/(\d{14}_\w+)/g) || [];
  const wasPending = before.match(/Not yet applied migration[s]?:\s*([\s\S]*?)(?:\n\n|$)/)?.[1] || '';
  const newOnes = applied.filter((m) => wasPending.includes(m));

  const entries = readLog();
  for (const name of newOnes.length ? newOnes : ['latest']) {
    entries.push({ name, action: 'migrate', appliedAt: new Date().toISOString() });
  }
  writeLog(entries);

  ok('Migrations applied');
  run('npx prisma migrate status');
}

function rollback() {
  const entries = readLog();
  if (!entries.length) { fail('No migrations in log to rollback'); process.exit(1); }

  const last = entries[entries.length - 1];
  log(`Rolling back ${color.cyan(last.name)}...`);
  backup();

  // Generate rollback SQL stub
  mkdirSync(ROLLBACK_DIR, { recursive: true });
  const rbFile = join(ROLLBACK_DIR, `rollback_${last.name}_${Date.now()}.sql`);
  const migDir = join(PRISMA_DIR, 'migrations', last.name);
  let reverseSql = `-- Rollback for migration: ${last.name}\n-- Generated: ${new Date().toISOString()}\n`;

  if (existsSync(join(migDir, 'migration.sql'))) {
    const sql = readFileSync(join(migDir, 'migration.sql'), 'utf-8');
    const tables = [...sql.matchAll(/CREATE TABLE[^"]*"([^"]+)"/gi)].map((m) => m[1]);
    const columns = [...sql.matchAll(/ALTER TABLE[^"]*"([^"]+)"[^"]*ADD[^"]*"([^"]+)"/gi)];
    tables.forEach((t) => { reverseSql += `DROP TABLE IF EXISTS "${t}" CASCADE;\n`; });
    columns.forEach((m) => { reverseSql += `ALTER TABLE "${m[1]}" DROP COLUMN IF EXISTS "${m[2]}";\n`; });
    if (!tables.length && !columns.length) reverseSql += '-- TODO: Add manual reverse operations\n';
  } else {
    reverseSql += '-- Original migration SQL not found — add manual reverse operations\n';
  }

  writeFileSync(rbFile, reverseSql);
  ok(`Rollback SQL saved to prisma/rollbacks/${rbFile.split('/').pop()}`);

  // Mark in log
  entries.push({ name: last.name, action: 'rollback', appliedAt: new Date().toISOString() });
  writeLog(entries);

  warn('Review the rollback SQL file, then run it manually against your database.');
  log(`  ${color.dim(`psql $DATABASE_URL -f "${rbFile}"`)}`);
  log(`  Then run: ${color.dim('npx prisma migrate resolve --rolled-back ' + last.name)}`);
}

function reset() {
  log(color.cyan('Resetting database (rollback all + re-apply)...'));
  backup();
  run('npx prisma migrate reset --force');
  writeLog([{ name: 'full-reset', action: 'reset', appliedAt: new Date().toISOString() }]);
  ok('Database reset complete');
  run('npx prisma migrate status');
}

// --- CLI ---
const command = process.argv[2];
const commands = { migrate, rollback, status, reset };

if (!command || !commands[command]) {
  console.log(`\n  ${color.cyan('RomainGE Migration Manager')}\n`);
  console.log(`  Usage: node scripts/migrate.js ${color.yellow('<command>')}\n`);
  console.log(`  Commands:`);
  console.log(`    ${color.green('migrate')}   Apply pending migrations`);
  console.log(`    ${color.green('rollback')}  Undo last migration (generates rollback SQL)`);
  console.log(`    ${color.green('status')}    Show current migration state`);
  console.log(`    ${color.green('reset')}     Rollback all + re-apply (destructive)\n`);
  process.exit(command ? 1 : 0);
}

try {
  commands[command]();
} catch (e) {
  fail(e.message);
  process.exit(1);
}
