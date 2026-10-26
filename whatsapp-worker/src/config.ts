/**
 * HanuJai High School ERP — WhatsApp Worker Configuration Loader
 * Campus: HanuJai High School, Jaipur, Rajasthan, India
 */

import * as fs from 'fs';
import * as path from 'path';

export interface WorkerConfig {
  provider: 'baileys' | 'dry_run' | 'cloud_api';
  sendEnabled: boolean;
  dryRun: boolean;
  authDir: string;
  testAllowlist: string[];
  workerPort: number;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
}

function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;

  const content = fs.readFileSync(filePath, 'utf-8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      result[key] = val;
    }
  });
  return result;
}

export function loadWorkerConfig(): WorkerConfig {
  // Try local .env.local first, then parent directory .env.local
  const cwd = process.cwd();
  const localEnvPath = path.resolve(cwd, '.env.local');
  const parentEnvPath = path.resolve(cwd, '..', '.env.local');

  const fileEnv = fs.existsSync(localEnvPath)
    ? parseEnvFile(localEnvPath)
    : parseEnvFile(parentEnvPath);

  const get = (key: string, fallback = ''): string => {
    return process.env[key] || fileEnv[key] || fallback;
  };

  const provider = (get('WHATSAPP_PROVIDER', 'baileys') as 'baileys' | 'dry_run' | 'cloud_api');
  const sendEnabled = get('WHATSAPP_SEND_ENABLED', 'false') === 'true';
  const dryRun = get('WHATSAPP_DRY_RUN', 'true') === 'true';

  // Normalize allowlist phone numbers to pure digits
  const rawAllowlist = get('WHATSAPP_TEST_ALLOWLIST') || get('WHATSAPP_TEST_RECIPIENTS') || '';
  const testAllowlist = rawAllowlist
    .split(',')
    .map(s => s.trim().replace(/\D/g, ''))
    .filter(Boolean);

  // Auth dir: resolve relative to project root or worker directory
  let authDir = get('WHATSAPP_AUTH_DIR', './.baileys_auth');
  if (!path.isAbsolute(authDir)) {
    // If running inside whatsapp-worker, put auth at root or local
    authDir = path.resolve(cwd, authDir);
  }

  const workerPort = parseInt(get('WHATSAPP_WORKER_PORT', '5050'), 10) || 5050;

  const firebase = {
    apiKey: get('VITE_FIREBASE_API_KEY'),
    authDomain: get('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: get('VITE_FIREBASE_PROJECT_ID', 'hanujai-erp-demo'),
    storageBucket: get('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: get('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: get('VITE_FIREBASE_APP_ID'),
  };

  return {
    provider,
    sendEnabled,
    dryRun,
    authDir,
    testAllowlist,
    workerPort,
    firebase,
  };
}
