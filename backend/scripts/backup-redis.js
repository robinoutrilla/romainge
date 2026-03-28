// ═══════════════════════════════════════════════════════════════
// scripts/backup-redis.js — Backup y restauración de sesiones Redis
// ═══════════════════════════════════════════════════════════════
// Uso:
//   node scripts/backup-redis.js                  # Backup
//   node scripts/backup-redis.js restore <file>   # Restaurar
//
// Cron ejemplo (diario a las 3:00):
//   0 3 * * * cd /app/backend && node scripts/backup-redis.js
// ═══════════════════════════════════════════════════════════════

import "dotenv/config";
import Redis from "ioredis";
import { createGzip, createGunzip } from "zlib";
import { createReadStream, createWriteStream } from "fs";
import { readdir, unlink, mkdir, stat } from "fs/promises";
import { pipeline } from "stream/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUPS_DIR = join(__dirname, "..", "backups");
const RETENTION_DAYS = 30;
const SCAN_PATTERNS = ["session:*", "romainge:*"];
const SCAN_COUNT = 200;

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function logError(msg) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] ERROR: ${msg}`);
}

function createRedisClient() {
  const url = process.env.REDIS_URL;
  if (!url) {
    logError("REDIS_URL not set in environment");
    process.exit(1);
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    tls: url.startsWith("rediss://") ? {} : undefined,
    lazyConnect: true,
  });
  client.on("error", (err) => logError(`Redis: ${err.message}`));
  return client;
}

async function scanKeys(redis, pattern) {
  const keys = [];
  let cursor = "0";
  do {
    const [nextCursor, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", SCAN_COUNT);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");
  return keys;
}

async function backup() {
  const redis = createRedisClient();
  await redis.connect();
  log("Connected to Redis");

  await mkdir(BACKUPS_DIR, { recursive: true });

  // Scan all matching keys
  let allKeys = [];
  for (const pattern of SCAN_PATTERNS) {
    const keys = await scanKeys(redis, pattern);
    allKeys.push(...keys);
    log(`Pattern "${pattern}": ${keys.length} keys found`);
  }
  allKeys = [...new Set(allKeys)]; // deduplicate
  log(`Total unique keys: ${allKeys.length}`);

  if (allKeys.length === 0) {
    log("No keys to backup — exiting");
    await redis.quit();
    return;
  }

  // Export key data with types and TTLs
  const data = [];
  for (const key of allKeys) {
    const type = await redis.type(key);
    let value;
    if (type === "string") {
      value = await redis.get(key);
    } else if (type === "hash") {
      value = await redis.hgetall(key);
    } else if (type === "list") {
      value = await redis.lrange(key, 0, -1);
    } else if (type === "set") {
      value = await redis.smembers(key);
    } else if (type === "zset") {
      value = await redis.zrange(key, 0, -1, "WITHSCORES");
    } else {
      log(`Skipping key "${key}" with unsupported type "${type}"`);
      continue;
    }
    const ttl = await redis.ttl(key);
    data.push({ key, type, value, ttl: ttl > 0 ? ttl : -1 });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.json.gz`;
  const filepath = join(BACKUPS_DIR, filename);

  const json = JSON.stringify({ createdAt: new Date().toISOString(), count: data.length, keys: data });
  const tmpPath = filepath.replace(".gz", "");

  // Write JSON then gzip
  const { writeFile } = await import("fs/promises");
  await writeFile(tmpPath, json, "utf-8");
  await pipeline(createReadStream(tmpPath), createGzip(), createWriteStream(filepath));
  await unlink(tmpPath);

  log(`Backup saved: ${filename} (${data.length} keys)`);

  // Retention cleanup
  await cleanOldBackups();

  await redis.quit();
  log("Done");
}

async function restore(filename) {
  const filepath = join(BACKUPS_DIR, filename);

  try {
    await stat(filepath);
  } catch {
    logError(`Backup file not found: ${filepath}`);
    process.exit(1);
  }

  const redis = createRedisClient();
  await redis.connect();
  log("Connected to Redis");

  // Decompress and read
  const chunks = [];
  const gunzip = createGunzip();
  const input = createReadStream(filepath);
  for await (const chunk of input.pipe(gunzip)) {
    chunks.push(chunk);
  }
  const { keys: data, createdAt, count } = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  log(`Restoring backup from ${createdAt} (${count} keys)`);

  let restored = 0;
  const pipe = redis.pipeline();

  for (const { key, type, value, ttl } of data) {
    if (type === "string") {
      pipe.set(key, value);
    } else if (type === "hash") {
      pipe.del(key);
      pipe.hmset(key, value);
    } else if (type === "list") {
      pipe.del(key);
      if (value.length) pipe.rpush(key, ...value);
    } else if (type === "set") {
      pipe.del(key);
      if (value.length) pipe.sadd(key, ...value);
    } else if (type === "zset") {
      pipe.del(key);
      for (let i = 0; i < value.length; i += 2) {
        pipe.zadd(key, value[i + 1], value[i]);
      }
    }
    if (ttl > 0) pipe.expire(key, ttl);
    restored++;
  }

  await pipe.exec();
  log(`Restored ${restored} keys`);

  await redis.quit();
  log("Done");
}

async function cleanOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;

  try {
    const files = await readdir(BACKUPS_DIR);
    for (const file of files) {
      if (!file.endsWith(".json.gz")) continue;
      const fp = join(BACKUPS_DIR, file);
      const info = await stat(fp);
      if (info.mtimeMs < cutoff) {
        await unlink(fp);
        deleted++;
      }
    }
    if (deleted > 0) log(`Retention cleanup: deleted ${deleted} old backup(s)`);
  } catch (err) {
    logError(`Cleanup failed: ${err.message}`);
  }
}

// ── Main ──────────────────────────────────────────────────────

const args = process.argv.slice(2);

try {
  if (args[0] === "restore") {
    if (!args[1]) {
      logError("Usage: node scripts/backup-redis.js restore <filename>");
      process.exit(1);
    }
    await restore(args[1]);
  } else {
    await backup();
  }
} catch (err) {
  logError(err.message);
  process.exit(1);
}
