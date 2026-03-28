import { readFileSync, watch } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = join(__dirname, '..', 'config', 'feature-flags.json');

const ENV_PREFIX = 'FF_';

let flags = {};
let watcher = null;

/**
 * Load flags from the JSON config file.
 * Returns the parsed object or an empty object on failure.
 */
function loadFromFile() {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[feature-flags] Failed to read ${CONFIG_PATH}:`, err.message);
    return {};
  }
}

/**
 * Collect environment variable overrides.
 * FF_VOICE_RELAY_ENABLED=true  ->  voice_relay_enabled = true
 * FF_SOME_FLAG=30              ->  some_flag = 30  (percentage rollout)
 * FF_SOME_FLAG=false           ->  some_flag = false
 */
function loadFromEnv() {
  const overrides = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(ENV_PREFIX)) continue;
    const flagName = key.slice(ENV_PREFIX.length).toLowerCase();
    overrides[flagName] = parseValue(value);
  }
  return overrides;
}

/**
 * Parse a string value into its appropriate type.
 * "true"/"false" become booleans, numeric strings become numbers,
 * and JSON objects are parsed (for percentage rollout configs).
 */
function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Reload flags from the config file and apply env overrides.
 * Called automatically on file changes and can be called manually.
 */
export function reloadFlags() {
  const fileFlags = loadFromFile();
  const envOverrides = loadFromEnv();
  flags = { ...fileFlags, ...envOverrides };
  return flags;
}

/**
 * Evaluate whether a flag is enabled.
 *
 * - Boolean flags: returns the boolean directly.
 * - Percentage rollout: flag value is a number 0-100 or an object
 *   `{ enabled: true, percentage: 25 }`. A deterministic hash of the
 *   optional `identifier` (e.g. session ID) decides inclusion; without
 *   an identifier a random roll is used.
 * - Missing flags default to `false`.
 */
export function isEnabled(flagName, identifier) {
  const value = flags[flagName];

  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;

  // Numeric value treated as percentage (0-100)
  if (typeof value === 'number') {
    return rollPercentage(value, flagName, identifier);
  }

  // Object with { enabled, percentage }
  if (typeof value === 'object' && value !== null) {
    if (value.enabled === false) return false;
    if (typeof value.percentage === 'number') {
      return rollPercentage(value.percentage, flagName, identifier);
    }
    return Boolean(value.enabled);
  }

  return Boolean(value);
}

/**
 * Get the raw value of a flag (boolean, number, or object).
 * Returns `undefined` if the flag does not exist.
 */
export function getFlag(flagName) {
  return flags[flagName];
}

/**
 * Get a shallow copy of all current flags.
 */
export function getAllFlags() {
  return { ...flags };
}

/**
 * Simple deterministic hash for percentage rollout.
 * When an identifier is provided the result is stable for the same
 * flag + identifier pair. Without an identifier, Math.random is used.
 */
function rollPercentage(percentage, flagName, identifier) {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;

  if (identifier !== undefined && identifier !== null) {
    const hash = simpleHash(`${flagName}:${identifier}`);
    return (hash % 100) < percentage;
  }

  return (Math.random() * 100) < percentage;
}

/**
 * DJB2 string hash — fast, deterministic, good distribution.
 */
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Start watching the config file for changes (hot-reload).
 * Safe to call multiple times — only one watcher will be active.
 */
function startWatcher() {
  if (watcher) return;
  try {
    watcher = watch(CONFIG_PATH, (eventType) => {
      if (eventType === 'change') {
        console.log('[feature-flags] Config file changed, reloading flags');
        reloadFlags();
      }
    });
    watcher.on('error', (err) => {
      console.error('[feature-flags] Watcher error:', err.message);
      watcher = null;
    });
  } catch (err) {
    console.error('[feature-flags] Could not watch config file:', err.message);
  }
}

// Initial load
reloadFlags();
startWatcher();
