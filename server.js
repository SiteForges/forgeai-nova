require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const Groq = require('groq-sdk');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ACCOUNT_STORE_PATH = path.join(__dirname, 'forgeai-accounts.json');
const OLLAMA_BASE_URL = String(process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = String(process.env.OLLAMA_MODEL || 'qwen3:4b').trim();
const QWEN_36_MODEL = String(process.env.OLLAMA_QWEN_36_MODEL || 'qwen3.6:27b').trim();
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const OWNER_ADMIN_TOKEN = String(process.env.OWNER_ADMIN_TOKEN || '').trim();
const OWNER_EMAILS = new Set(
  String(process.env.OWNER_EMAILS || 'thisisalexanderbatti@gmail.com')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);
const PRO_ACCOUNT_EMAILS = new Set(
  String(process.env.PRO_ACCOUNT_EMAILS || 'thisisalexanderbatti@gmail.com')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);
const SUPPORT_CONTACT = {
  ownerName: 'ALEXADNER BATTI',
  supportEmail: 'thisisalexadnerbatti@gmail.com',
  supportPhone: '6198758774',
  supportPhoneDisplay: '(619) 875-8774',
  birthday: 'August 21, 2012',
};
const QWEN_SETUP_COMMAND = `ollama run ${QWEN_36_MODEL}`;
const GEMMA_3_MODEL = 'gemma3:4b';
const GEMMA_4_MODEL = 'gemma4';
const ADMIN_MODEL_COMMANDS = new Map([
  ['qwen3-4b-pull', { args: ['pull', OLLAMA_MODEL], label: 'Download Qwen3 4B' }],
  ['qwen36-27b-pull', { args: ['pull', QWEN_36_MODEL], label: 'Download Qwen3.6 27B' }],
  ['gemma3-4b-pull', { args: ['pull', GEMMA_3_MODEL], label: 'Download Gemma3 4B' }],
  ['gemma4-pull', { args: ['pull', GEMMA_4_MODEL], label: 'Download Gemma4' }],
  ['qwen3-4b-run', { args: ['run', OLLAMA_MODEL], label: 'Test Qwen3 4B' }],
  ['qwen36-27b-run', { args: ['run', QWEN_36_MODEL], label: 'Test Qwen3.6 27B' }],
  ['gemma3-4b-run', { args: ['run', GEMMA_3_MODEL], label: 'Test Gemma3 4B' }],
  ['gemma4-run', { args: ['run', GEMMA_4_MODEL], label: 'Test Gemma4' }],
  ['qwen3-4b-rm', { args: ['rm', OLLAMA_MODEL], label: 'Remove Qwen3 4B' }],
  ['qwen36-27b-rm', { args: ['rm', QWEN_36_MODEL], label: 'Remove Qwen3.6 27B' }],
  ['gemma3-4b-rm', { args: ['rm', GEMMA_3_MODEL], label: 'Remove Gemma3 4B' }],
  ['gemma4-rm', { args: ['rm', GEMMA_4_MODEL], label: 'Remove Gemma4' }],
]);
const MANAGED_OLLAMA_MODELS = [
  { key: 'qwen3-4b', label: 'Qwen3 4B', model: OLLAMA_MODEL, pullCommand: `ollama pull ${OLLAMA_MODEL}`, runCommand: `ollama run ${OLLAMA_MODEL}` },
  { key: 'qwen36-27b', label: 'Qwen3.6 27B', model: QWEN_36_MODEL, pullCommand: `ollama pull ${QWEN_36_MODEL}`, runCommand: `ollama run ${QWEN_36_MODEL}` },
  { key: 'gemma3-4b', label: 'Gemma3 4B', model: GEMMA_3_MODEL, pullCommand: `ollama pull ${GEMMA_3_MODEL}`, runCommand: `ollama run ${GEMMA_3_MODEL}` },
  { key: 'gemma4', label: 'Gemma4', model: GEMMA_4_MODEL, pullCommand: `ollama pull ${GEMMA_4_MODEL}`, runCommand: `ollama run ${GEMMA_4_MODEL}` },
];
const LOCAL_MODEL_BY_PREFERENCE = {
  qwen36: { model: QWEN_36_MODEL, label: 'Qwen3.6 27B' },
  fallback: { model: OLLAMA_MODEL, label: 'Qwen3 4B' },
  gemma4: { model: GEMMA_4_MODEL, label: 'Gemma4' },
  gemma3: { model: GEMMA_3_MODEL, label: 'Gemma3 4B' },
};

const DEFAULT_TOKEN_LIMIT = 1000;
const PRO_TOKEN_LIMIT = 1000;
const DEFAULT_API_TOKEN_LIMIT = 100;
const BILLING_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000;
const PENDING_ACCESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const DONATION_URL = 'https://paypal.me/AlexanderBatti/14';
const DONATION_LINKS = [
  { code: 'support_200', tokens: 200, amountUsd: 5, donationUrl: 'https://paypal.me/AlexanderBatti/5' },
  { code: 'support_400', tokens: 400, amountUsd: 10, donationUrl: 'https://paypal.me/AlexanderBatti/10' },
  { code: 'support_800', tokens: 800, amountUsd: 15, donationUrl: 'https://paypal.me/AlexanderBatti/15' },
  { code: 'support_1200', tokens: 1200, amountUsd: 20, donationUrl: 'https://paypal.me/AlexanderBatti/20' },
  { code: 'support_200000', tokens: 200000, amountUsd: 2000, donationUrl: 'https://paypal.me/AlexanderBatti/2000' },
];

const MODEL_PRESETS = {
  fast: {
    candidates: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'],
    temperature: 0.35,
    maxTokens: 900,
  },
  smart: {
    candidates: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile'],
    temperature: 0.7,
    maxTokens: 1200,
  },
  creative: {
    candidates: ['mixtral-8x7b-32768', 'llama-3.3-70b-versatile'],
    temperature: 0.95,
    maxTokens: 1300,
  },
};

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));

function createProviderError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function normalizeModelMode(mode) {
  return Object.prototype.hasOwnProperty.call(MODEL_PRESETS, mode) ? mode : 'smart';
}

function normalizeProviderMode(mode) {
  return ['auto', 'groq', 'ollama'].includes(mode) ? mode : 'auto';
}

function normalizeAssistantMode(mode) {
  return ['general', 'email', 'code', 'prompt'].includes(mode) ? mode : 'general';
}

function normalizeLocalModelPreference(mode) {
  return ['default', 'qwen36', 'fallback', 'gemma4', 'gemma3'].includes(mode) ? mode : 'default';
}

function buildOllamaRunCommand(model) {
  return `ollama run ${String(model || '').trim()}`;
}

function normalizePlan(plan) {
  if (plan === 'owner') return 'owner';
  return plan === 'pro' ? 'pro' : 'free';
}

function getPlanLimit(plan) {
  const normalizedPlan = normalizePlan(plan);
  if (normalizedPlan === 'owner') return Number.MAX_SAFE_INTEGER;
  return normalizedPlan === 'pro' ? PRO_TOKEN_LIMIT : DEFAULT_TOKEN_LIMIT;
}

function getApiTokenLimit() {
  return DEFAULT_API_TOKEN_LIMIT;
}

function hasGroqKey() {
  return Boolean(String(process.env.GROQ_API_KEY || '').trim());
}

function buildAccountId(kind, email, fallbackId = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail) {
    const safeEmail = normalizedEmail
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${kind}-${safeEmail || 'user'}`;
  }

  const safeFallback = String(fallbackId || '').trim();
  return safeFallback || `${kind || 'acct'}-${Math.random().toString(36).slice(2, 10)}`;
}

function trimText(text, max = 180) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}...`;
}

function normalizeMemory(memory) {
  const profile = memory && typeof memory.profile === 'object' ? memory.profile : {};
  const notes = Array.isArray(memory?.notes) ? memory.notes : [];

  return {
    profile: {
      name: typeof profile.name === 'string' ? profile.name.trim() : '',
      job: typeof profile.job === 'string' ? profile.job.trim() : '',
      location: typeof profile.location === 'string' ? profile.location.trim() : '',
    },
    notes: notes
      .filter((note) => note && typeof note === 'object')
      .map((note) => ({
        id: typeof note.id === 'string' && note.id.trim() ? note.id.trim() : `mem_${crypto.randomUUID()}`,
        text: trimText(note.text || '', 180),
        createdAt: note.createdAt || new Date().toISOString(),
      }))
      .filter((note) => note.text)
      .slice(0, 30),
  };
}

function sanitizeMemory(memory) {
  const normalized = normalizeMemory(memory);
  return {
    profile: normalized.profile,
    notes: normalized.notes,
  };
}

function memoryToPrompt(memory) {
  const normalized = normalizeMemory(memory);
  const lines = [];

  if (normalized.profile.name) lines.push(`Name: ${normalized.profile.name}`);
  if (normalized.profile.job) lines.push(`Job: ${normalized.profile.job}`);
  if (normalized.profile.location) lines.push(`Location: ${normalized.profile.location}`);
  normalized.notes.slice(0, 6).forEach((note, index) => {
    lines.push(`Memory ${index + 1}: ${note.text}`);
  });

  return lines.join('\n');
}

function extractMemoryUpdates(message) {
  const text = String(message || '').trim();
  if (!text) {
    return {
      profile: {},
      notes: [],
    };
  }

  const profile = {};
  const notes = [];

  const nameMatch = text.match(/(?:remember\s+that\s+)?my name is\s+([A-Za-z][A-Za-z' -]{0,40}?)(?=\s+(?:and|but|i\s|my\s)|[.,!?]|$)/i);
  if (nameMatch) {
    profile.name = trimText(nameMatch[1], 60);
  }

  const jobMatch = text.match(/(?:remember\s+that\s+)?(?:i work as|my job is)\s+([A-Za-z0-9 ,.'&/-]{2,80}?)(?=\s+(?:and|but|i\s|my\s)|[.,!?]|$)/i);
  if (jobMatch) {
    profile.job = trimText(jobMatch[1], 80);
  }

  const locationMatch = text.match(/(?:remember\s+that\s+)?(?:i live in|i am based in|i'm based in)\s+([A-Za-z0-9 ,.'-]{2,80}?)(?=\s+(?:and|but|i\s|my\s)|[.,!?]|$)/i);
  if (locationMatch) {
    profile.location = trimText(locationMatch[1], 80);
  }

  const explicitRememberMatch = text.match(/(?:remember that|please remember|remember this:?)\s+(.+)/i);
  if (explicitRememberMatch) {
    notes.push(trimText(explicitRememberMatch[1], 180));
  }

  return {
    profile,
    notes,
  };
}

function mergeMemory(record, updates = {}) {
  const memory = normalizeMemory(record.memory);
  const profileUpdates = updates.profile && typeof updates.profile === 'object' ? updates.profile : {};

  ['name', 'job', 'location'].forEach((key) => {
    if (typeof profileUpdates[key] === 'string' && profileUpdates[key].trim()) {
      memory.profile[key] = trimText(profileUpdates[key], 80);
    }
  });

  if (Array.isArray(updates.notes)) {
    updates.notes
      .map((note) => trimText(note, 180))
      .filter(Boolean)
      .forEach((text) => {
        if (!memory.notes.some((note) => note.text.toLowerCase() === text.toLowerCase())) {
          memory.notes.unshift({
            id: `mem_${crypto.randomUUID()}`,
            text,
            createdAt: new Date().toISOString(),
          });
        }
      });
  }

  memory.notes = memory.notes.slice(0, 30);
  record.memory = memory;
  return record;
}

function removeMemoryNote(record, noteId) {
  const memory = normalizeMemory(record.memory);
  memory.notes = memory.notes.filter((note) => note.id !== noteId);
  record.memory = memory;
  return record;
}

function isOwnerIdentity(account) {
  return Boolean(
    account &&
    account.kind === 'google' &&
    account.emailVerified === true &&
    OWNER_EMAILS.has(String(account.email || '').trim().toLowerCase())
  );
}

function isProIdentity(account) {
  return Boolean(
    account &&
    PRO_ACCOUNT_EMAILS.has(String(account.email || '').trim().toLowerCase())
  );
}

function applyBillingCycle(record, now = Date.now()) {
  if (record.pendingAccess && typeof record.pendingAccess === 'object') {
    const pendingUntil = Date.parse(record.pendingAccess.pendingUntil || '');
    const isVerified = record.pendingAccess.status === 'verified';
    if (!isVerified && Number.isFinite(pendingUntil) && pendingUntil <= now) {
      record.plan = normalizePlan(record.pendingAccess.previousPlan || 'free');
      record.role = record.pendingAccess.previousRole === 'owner' ? 'owner' : 'member';
      record.isUnlimited = Boolean(record.pendingAccess.previousIsUnlimited);
      record.tokenLimit = Number.isFinite(record.pendingAccess.previousTokenLimit)
        ? record.pendingAccess.previousTokenLimit
        : getPlanLimit(record.plan);
      record.apiTokenLimit = Number.isFinite(record.pendingAccess.previousApiTokenLimit)
        ? record.pendingAccess.previousApiTokenLimit
        : getApiTokenLimit();
      record.apiTokensRemaining = Number.isFinite(record.pendingAccess.previousApiTokensRemaining)
        ? record.pendingAccess.previousApiTokensRemaining
        : record.apiTokensRemaining;
      record.pendingAccess = {
        ...record.pendingAccess,
        status: 'revoked',
        revokedAt: new Date().toISOString(),
      };
    }
  }

  if (isOwnerIdentity(record)) {
    record.plan = 'owner';
    record.role = 'owner';
    record.isUnlimited = true;
    record.tokenLimit = Number.MAX_SAFE_INTEGER;
    record.tokensUsed = 0;
    record.tokensRemaining = Number.MAX_SAFE_INTEGER;
    record.lastResetAt = new Date(now).toISOString();
    record.renewalAt = null;
    return record;
  }

  const plan = isProIdentity(record) ? 'pro' : normalizePlan(record.plan);
  const limit = getPlanLimit(plan);
  const lastResetAt = record.lastResetAt ? Date.parse(record.lastResetAt) : NaN;
  const shouldReset =
    !Number.isFinite(lastResetAt) ||
    now - lastResetAt >= BILLING_INTERVAL_MS ||
    record.tokenLimit !== limit;

  record.plan = plan;
  record.role = 'member';
  record.isUnlimited = false;
  record.tokenLimit = limit;

  if (!Number.isFinite(record.tokensUsed)) {
    record.tokensUsed = 0;
  }

  if (shouldReset) {
    record.tokensUsed = 0;
    record.lastResetAt = new Date(now).toISOString();
  }

  record.tokensRemaining = Math.max(0, limit - record.tokensUsed);
  record.renewalAt = new Date(Date.parse(record.lastResetAt) + BILLING_INTERVAL_MS).toISOString();
  return record;
}

function normalizeAccountInput(account) {
  if (!account || typeof account !== 'object') return null;

  const kind = ['local', 'guest', 'google'].includes(account.kind) ? account.kind : 'local';
  const rawName = typeof account.name === 'string' ? account.name.trim() : '';
  const rawEmail = typeof account.email === 'string' ? account.email.trim() : '';
  const fallbackId = typeof account.id === 'string' && account.id.trim() ? account.id.trim() : '';

  const name = rawName || (kind === 'guest' ? 'Guest' : 'ForgeAI User');
  const email = rawEmail || (kind === 'guest' ? `${fallbackId || 'guest'}@guest.local` : 'user@example.com');
  const id =
    kind === 'guest'
      ? (fallbackId || buildAccountId(kind, '', `guest-${Date.now().toString(36)}`))
      : buildAccountId(kind, email, fallbackId || `${kind}-${Date.now().toString(36)}`);

  return {
    id,
    kind,
    name,
    email,
    emailVerified: account.emailVerified === true,
  };
}

function sanitizeAccountRecord(record) {
  if (!record) return null;

  return {
    id: record.id,
    kind: record.kind,
    name: record.name,
    email: record.email,
    emailVerified: record.emailVerified === true,
    role: record.role || (isOwnerIdentity(record) ? 'owner' : 'member'),
    isUnlimited: Boolean(record.isUnlimited),
    plan: normalizePlan(record.plan),
    planLabel: isOwnerIdentity(record) ? 'Owner' : normalizePlan(record.plan) === 'pro' ? 'PRO AI' : 'Free',
    tokenLimit: record.tokenLimit,
    tokensUsed: record.tokensUsed,
    tokensRemaining: record.tokensRemaining,
    apiTokenLimit: record.apiTokenLimit,
    apiTokensUsed: record.apiTokensUsed,
    apiTokensRemaining: record.apiTokensRemaining,
    lastResetAt: record.lastResetAt,
    renewalAt: record.renewalAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function hashApiKey(secret) {
  return crypto.createHash('sha256').update(String(secret || '')).digest('hex');
}

function createApiKeySecret() {
  return `forge_live_${crypto.randomBytes(24).toString('hex')}`;
}

function sanitizeApiKeyRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    accountId: record.accountId,
    label: record.label,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt || null,
    revokedAt: record.revokedAt || null,
    isActive: record.isActive !== false && !record.revokedAt,
  };
}

function requireOwnerAdmin(req) {
  const supplied = String(req.headers['x-owner-admin-token'] || '').trim();
  if (!OWNER_ADMIN_TOKEN || supplied !== OWNER_ADMIN_TOKEN) {
    throw createProviderError('OWNER_ADMIN_REQUIRED', 'Owner admin authorization is required.');
  }
}

function canAccessAdminTools(account) {
  const normalizedEmail = String(account?.email || '').trim().toLowerCase();
  return Boolean(account && (account.role === 'owner' || OWNER_EMAILS.has(normalizedEmail)));
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true, ...options }, (error, stdout, stderr) => {
      if (error) {
        reject(createProviderError('OLLAMA_COMMAND_FAILED', stderr || error.message, { stdout, stderr }));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function ensureAdminAccount(req) {
  const account = normalizeAccountInput(req.body?.account);
  if (!account || !canAccessAdminTools(account)) {
    throw createProviderError('OWNER_ADMIN_REQUIRED', 'Admin account required.');
  }
  if (OWNER_ADMIN_TOKEN) {
    requireOwnerAdmin(req);
  }
  return account;
}

function readAccountStore() {
  try {
    const raw = fs.readFileSync(ACCOUNT_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        accounts: parsed.accounts && typeof parsed.accounts === 'object' ? parsed.accounts : {},
        apiKeys: parsed.apiKeys && typeof parsed.apiKeys === 'object' ? parsed.apiKeys : {},
        paymentRequests: Array.isArray(parsed.paymentRequests) ? parsed.paymentRequests : [],
      };
    }
  } catch {
    // Start fresh when the account store does not exist.
  }

  return { accounts: {}, apiKeys: {}, paymentRequests: [] };
}

let accountStore = readAccountStore();

function applyEntitlementsToStoredAccounts() {
  let changed = false;
  Object.values(accountStore.accounts || {}).forEach((record) => {
    if (!record || typeof record !== 'object') return;
    const beforePlan = record.plan;
    const beforeRole = record.role;
    const beforeLimit = record.tokenLimit;
    const beforeRemaining = record.tokensRemaining;
    applyBillingCycle(record);
    if (
      beforePlan !== record.plan ||
      beforeRole !== record.role ||
      beforeLimit !== record.tokenLimit ||
      beforeRemaining !== record.tokensRemaining
    ) {
      record.updatedAt = new Date().toISOString();
      accountStore.accounts[record.id] = record;
      changed = true;
    }
  });

  if (changed) {
    writeAccountStore();
  }
}

applyEntitlementsToStoredAccounts();

function writeAccountStore() {
  const tempPath = `${ACCOUNT_STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(accountStore, null, 2));
  fs.renameSync(tempPath, ACCOUNT_STORE_PATH);
}

function getOrCreateAccountRecord(accountInput) {
  const input = normalizeAccountInput(accountInput);
  if (!input) {
    throw createProviderError('ACCOUNT_REQUIRED', 'Sign in to use ForgeAI.');
  }

  const existing = accountStore.accounts[input.id] || {};
  const record = {
    id: input.id,
    kind: input.kind || existing.kind || 'local',
    name: input.name || existing.name || 'ForgeAI User',
    email: input.email || existing.email || 'user@example.com',
    emailVerified: input.emailVerified === true || existing.emailVerified === true,
    role: existing.role || 'member',
    plan: normalizePlan(existing.plan || 'free'),
    tokenLimit: Number.isFinite(existing.tokenLimit) ? existing.tokenLimit : getPlanLimit(existing.plan || 'free'),
    tokensUsed: Number.isFinite(existing.tokensUsed) ? existing.tokensUsed : 0,
    tokensRemaining: Number.isFinite(existing.tokensRemaining)
      ? existing.tokensRemaining
      : getPlanLimit(existing.plan || 'free'),
    apiTokenLimit: Number.isFinite(existing.apiTokenLimit) ? existing.apiTokenLimit : getApiTokenLimit(),
    apiTokensUsed: Number.isFinite(existing.apiTokensUsed) ? existing.apiTokensUsed : 0,
    apiTokensRemaining: Number.isFinite(existing.apiTokensRemaining)
      ? existing.apiTokensRemaining
      : Math.max(0, getApiTokenLimit() - (Number.isFinite(existing.apiTokensUsed) ? existing.apiTokensUsed : 0)),
    lastResetAt: existing.lastResetAt || new Date().toISOString(),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    memory: normalizeMemory(existing.memory),
  };

  applyBillingCycle(record);
  accountStore.accounts[record.id] = record;
  writeAccountStore();
  return record;
}

function reserveUsage(accountInput, amount) {
  const record = getOrCreateAccountRecord(accountInput);
  applyBillingCycle(record);

  if (record.isUnlimited) {
    accountStore.accounts[record.id] = record;
    writeAccountStore();
    return record;
  }

  if (record.tokensRemaining < amount) {
    throw createProviderError(
      'USAGE_EXHAUSTED',
      `This account has ${record.tokensRemaining} tokens left. Sign in with another account to continue.`,
      {
        account: sanitizeAccountRecord(record),
        memory: sanitizeMemory(record.memory),
      }
    );
  }

  record.tokensUsed += amount;
  record.tokensRemaining = Math.max(0, record.tokenLimit - record.tokensUsed);
  record.updatedAt = new Date().toISOString();
  accountStore.accounts[record.id] = record;
  writeAccountStore();
  return record;
}

function reserveApiUsage(accountInput, amount) {
  const record = getOrCreateAccountRecord(accountInput);
  applyBillingCycle(record);

  if (record.isUnlimited) {
    record.apiTokenLimit = Number.MAX_SAFE_INTEGER;
    record.apiTokensUsed = 0;
    record.apiTokensRemaining = Number.MAX_SAFE_INTEGER;
    accountStore.accounts[record.id] = record;
    writeAccountStore();
    return record;
  }

  if (!Number.isFinite(record.apiTokenLimit) || record.apiTokenLimit <= 0) {
    record.apiTokenLimit = getApiTokenLimit();
  }

  if (!Number.isFinite(record.apiTokensUsed)) {
    record.apiTokensUsed = 0;
  }

  if (!Number.isFinite(record.apiTokensRemaining)) {
    record.apiTokensRemaining = Math.max(0, record.apiTokenLimit - record.apiTokensUsed);
  }

  if (record.apiTokensRemaining < amount) {
    throw createProviderError(
      'API_USAGE_EXHAUSTED',
      `This API account has ${record.apiTokensRemaining} API tokens left. Buy more API tokens to continue.`,
      {
        account: sanitizeAccountRecord(record),
        memory: sanitizeMemory(record.memory),
      }
    );
  }

  record.apiTokensUsed += amount;
  record.apiTokensRemaining = Math.max(0, record.apiTokenLimit - record.apiTokensUsed);
  record.updatedAt = new Date().toISOString();
  accountStore.accounts[record.id] = record;
  writeAccountStore();
  return record;
}

function estimateTokenUsage({ message, history, providerMode, modelMode, assistantMode, localModelPreference }) {
  const base = 8;
  const lengthCost = Math.ceil(String(message || '').length / 140);
  const historyCost = Math.min(6, Math.ceil((Array.isArray(history) ? history.length : 0) / 3));
  const providerCost = providerMode === 'ollama' ? 0 : providerMode === 'groq' ? 3 : 2;
  const modeCost = modelMode === 'creative' ? 8 : modelMode === 'smart' ? 4 : 0;
  const assistantCost =
    assistantMode === 'code' ? 4 : assistantMode === 'prompt' ? 3 : assistantMode === 'email' ? 2 : 0;
  const localModelCost =
    localModelPreference === 'qwen36'
      ? 5
      : localModelPreference === 'gemma4'
        ? 3
        : localModelPreference === 'gemma3'
          ? 1
          : localModelPreference === 'fallback'
            ? 1
            : 0;
  return Math.max(
    10,
    Math.min(36, base + lengthCost + historyCost + providerCost + modeCost + assistantCost + localModelCost)
  );
}

function grantPurchasedTokens(accountInput, tokenAmount) {
  const record = getOrCreateAccountRecord(accountInput);
  applyBillingCycle(record);
  if (record.isUnlimited) {
    record.apiTokenLimit = Number.MAX_SAFE_INTEGER;
    record.apiTokensUsed = 0;
    record.apiTokensRemaining = Number.MAX_SAFE_INTEGER;
    accountStore.accounts[record.id] = record;
    writeAccountStore();
    return record;
  }

  const tokens = Math.max(0, Number(tokenAmount) || 0);
  if (!tokens) {
    throw createProviderError('INVALID_TOKEN_AMOUNT', 'Token grant amount must be greater than zero.');
  }

  record.apiTokenLimit = Math.max(getApiTokenLimit(), Number(record.apiTokenLimit) || getApiTokenLimit());
  record.apiTokensRemaining = Math.max(0, Number(record.apiTokensRemaining) || 0) + tokens;
  record.apiTokenLimit = Math.max(record.apiTokenLimit, record.apiTokensUsed + record.apiTokensRemaining);
  record.lastTopUpAt = new Date().toISOString();
  record.updatedAt = record.lastTopUpAt;
  accountStore.accounts[record.id] = record;
  writeAccountStore();
  return record;
}

function queuePendingPurchase(accountInput, purchaseInput) {
  const record = getOrCreateAccountRecord(accountInput);
  const requestedPlan = normalizePlan(purchaseInput?.plan);
  const requestedTokens = Math.max(0, Number(purchaseInput?.tokens) || 0);
  const requestedAmount = Math.max(0, Number(purchaseInput?.amountUsd) || 0);
  const requestedType = requestedPlan === 'pro' ? 'plan' : 'tokens';
  const now = new Date();
  const pendingUntil = new Date(now.getTime() + PENDING_ACCESS_WINDOW_MS).toISOString();

  if (requestedType === 'plan') {
    const alreadyPro = record.plan === 'pro' || record.pendingAccess?.status === 'pending' || isProIdentity(record);
    if (alreadyPro) {
      throw createProviderError('ALREADY_OWNED', 'You already have PRO AI on this account.');
    }
  }

  const pendingAccess = {
    id: `pending_${crypto.randomUUID()}`,
    type: requestedType,
    status: 'pending',
    plan: requestedPlan,
    tokens: requestedTokens,
    amountUsd: requestedAmount,
    requestedAt: now.toISOString(),
    pendingUntil,
    previousPlan: record.plan,
    previousRole: record.role,
    previousIsUnlimited: record.isUnlimited,
    previousTokenLimit: record.tokenLimit,
    previousApiTokenLimit: record.apiTokenLimit,
    previousApiTokensRemaining: record.apiTokensRemaining,
  };

  if (requestedType === 'plan') {
    record.plan = 'pro';
    record.role = isOwnerIdentity(record) ? 'owner' : 'member';
    record.isUnlimited = false;
    record.tokenLimit = PRO_TOKEN_LIMIT;
    record.tokensRemaining = Math.max(record.tokensRemaining, PRO_TOKEN_LIMIT);
  } else if (requestedTokens > 0) {
    record.apiTokenLimit = Math.max(getApiTokenLimit(), record.apiTokenLimit || getApiTokenLimit());
    record.apiTokensRemaining = Math.max(0, record.apiTokensRemaining) + requestedTokens;
  }

  record.pendingAccess = pendingAccess;
  record.updatedAt = now.toISOString();
  accountStore.accounts[record.id] = record;
  accountStore.paymentRequests = Array.isArray(accountStore.paymentRequests) ? accountStore.paymentRequests : [];
  accountStore.paymentRequests.unshift({
    id: pendingAccess.id,
    accountId: record.id,
    name: record.name,
    email: record.email,
    plan: requestedPlan,
    tokens: requestedTokens,
    amountUsd: requestedAmount,
    status: 'pending',
    requestedAt: pendingAccess.requestedAt,
    pendingUntil,
  });
  accountStore.paymentRequests = accountStore.paymentRequests.slice(0, 500);
  writeAccountStore();
  return record;
}

function verifyPendingPurchase(accountInput, requestId) {
  const record = getOrCreateAccountRecord(accountInput);
  if (!record.pendingAccess || record.pendingAccess.id !== requestId) {
    throw createProviderError('PENDING_PURCHASE_NOT_FOUND', 'Pending purchase not found for this account.');
  }
  record.pendingAccess = {
    ...record.pendingAccess,
    status: 'verified',
    verifiedAt: new Date().toISOString(),
  };
  record.updatedAt = new Date().toISOString();
  accountStore.accounts[record.id] = record;
  accountStore.paymentRequests = (accountStore.paymentRequests || []).map((request) =>
    request.id === requestId ? { ...request, status: 'verified', verifiedAt: new Date().toISOString() } : request
  );
  writeAccountStore();
  return record;
}

function createApiKeyForAccount(accountInput, label = 'Default key') {
  const record = getOrCreateAccountRecord(accountInput);
  const secret = createApiKeySecret();
  const keyRecord = {
    id: `key_${crypto.randomUUID()}`,
    accountId: record.id,
    label: String(label || 'Default key').trim() || 'Default key',
    keyHash: hashApiKey(secret),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
    isActive: true,
  };

  accountStore.apiKeys[keyRecord.id] = keyRecord;
  writeAccountStore();

  return {
    plainTextKey: secret,
    record: keyRecord,
  };
}

function listApiKeysForAccount(accountId) {
  return Object.values(accountStore.apiKeys || {})
    .filter((record) => record.accountId === accountId)
    .map((record) => sanitizeApiKeyRecord(record));
}

function resolveApiKeyRecord(secret) {
  const normalized = String(secret || '').trim();
  if (!normalized) return null;
  const targetHash = hashApiKey(normalized);
  const found = Object.values(accountStore.apiKeys || {}).find(
    (record) => record.keyHash === targetHash && record.isActive !== false && !record.revokedAt
  );
  if (!found) return null;
  found.lastUsedAt = new Date().toISOString();
  accountStore.apiKeys[found.id] = found;
  writeAccountStore();
  return found;
}

async function verifyGoogleIdToken(idToken) {
  if (!GOOGLE_CLIENT_ID) {
    throw createProviderError('GOOGLE_AUTH_DISABLED', 'Google sign-in is not configured yet.');
  }

  const token = String(idToken || '').trim();
  if (!token) {
    throw createProviderError('GOOGLE_TOKEN_MISSING', 'Google credential is missing.');
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw createProviderError('GOOGLE_TOKEN_INVALID', 'Google could not verify this sign-in.');
  }

  const payload = await response.json();
  if (payload.aud !== GOOGLE_CLIENT_ID) {
    throw createProviderError('GOOGLE_AUDIENCE_MISMATCH', 'Google sign-in audience mismatch.');
  }
  if (payload.email_verified !== 'true') {
    throw createProviderError('GOOGLE_EMAIL_UNVERIFIED', 'Google account email is not verified.');
  }

  return {
    id: buildAccountId('google', payload.email, ''),
    kind: 'google',
    name: payload.name || payload.given_name || 'Google User',
    email: payload.email,
    emailVerified: true,
  };
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((message) => message && typeof message === 'object')
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: typeof message.content === 'string' ? message.content.trim() : '',
    }))
    .filter((message) => message.content.length > 0)
    .slice(-24);
}

function buildSystemPrompt({ liveContextAvailable, assistantMode }) {
  const mode = normalizeAssistantMode(assistantMode);
  const modeInstruction =
    mode === 'email'
      ? 'You are in Write Email mode. Help write, rewrite, shorten, polish, and professionalize emails with clear subject lines, tone options, and concise business-ready drafts.'
      : mode === 'code'
        ? 'You are in Code Helper mode. Prioritize code quality, debugging clarity, implementation details, safe edits, and practical next steps.'
        : mode === 'prompt'
          ? 'You are in Prompt Builder mode. Create strong, structured prompts for apps, websites, coding tools, image generation, and AI assistants. Offer copy-paste ready prompts.'
          : 'You are in General Chat mode. Be helpful, warm, and broadly capable.';

  return [
    'You are ForgeAI Nova, a premium, calm, capable AI assistant.',
    modeInstruction,
    'Write clearly, naturally, and helpfully.',
    'Keep responses concise unless the user asks for more detail.',
    'When the user asks for code, provide practical code and brief setup notes when useful.',
    `For support requests, share this contact info exactly: ${SUPPORT_CONTACT.ownerName}, email ${SUPPORT_CONTACT.supportEmail}, phone ${SUPPORT_CONTACT.supportPhoneDisplay}.`,
    liveContextAvailable
      ? 'You have fresh context available. Prefer it over general memory for current information.'
      : 'Use only the provided conversation and memory. Do not invent missing facts.',
  ].join(' ');
}

function buildProviderMessages({ message, history, webContext, memory, assistantMode }) {
  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt({
        liveContextAvailable: Boolean(webContext),
        assistantMode,
      }),
    },
  ];

  const memorySummary = memoryToPrompt(memory);
  if (memorySummary) {
    messages.push({
      role: 'system',
      content: `Known user memory for personalization:\n${memorySummary}`,
    });
  }

  messages.push(...history);

  if (webContext) {
    messages.push({
      role: 'system',
      content:
        'Additional context for the next answer. Use it carefully and do not invent facts beyond the evidence below.\n\n' +
        webContext,
    });
  }

  messages.push({
    role: 'user',
    content: message,
  });

  return messages;
}

async function inspectOllamaCatalog() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return {
        reachable: false,
        installedModels: [],
        qwen36Available: false,
        fallbackAvailable: false,
      };
    }
    const data = await response.json();
    const installedModels = Array.isArray(data.models)
      ? data.models.map((model) => String(model.name || '').trim()).filter(Boolean)
      : [];
    return {
      reachable: true,
      installedModels,
      qwen36Available: installedModels.includes(QWEN_36_MODEL),
      fallbackAvailable: installedModels.includes(OLLAMA_MODEL),
    };
  } catch {
    return {
      reachable: false,
      installedModels: [],
      qwen36Available: false,
      fallbackAvailable: false,
    };
  }
}

async function isOllamaInstalledAndReachable() {
  try {
    await runCommand('ollama', ['list'], { timeout: 12000 });
    return true;
  } catch {
    return false;
  }
}

function parseOllamaList(stdout) {
  return String(stdout || '')
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean);
}

async function readModelInventory() {
  try {
    const { stdout } = await runCommand('ollama', ['list'], { timeout: 12000 });
    const installedModels = parseOllamaList(stdout);
    return {
      installed: true,
      running: true,
      installedModels,
      models: MANAGED_OLLAMA_MODELS.map((item) => ({
        ...item,
        installed: installedModels.includes(item.model),
      })),
    };
  } catch (error) {
    return {
      installed: false,
      running: false,
      installedModels: [],
      models: MANAGED_OLLAMA_MODELS.map((item) => ({
        ...item,
        installed: false,
      })),
      error: error?.message || 'Ollama is missing or offline.',
    };
  }
}

async function executeAllowedOllamaCommand(actionKey) {
  const command = ADMIN_MODEL_COMMANDS.get(actionKey);
  if (!command) {
    throw createProviderError('COMMAND_NOT_ALLOWED', 'That model action is not allowed.');
  }
  if (command.args[0] === 'run') {
    const model = command.args[1];
    const inventory = await readModelInventory();
    const installed = Array.isArray(inventory.installedModels) && inventory.installedModels.includes(model);
    if (!installed) {
      throw createProviderError(
        'OLLAMA_MODEL_MISSING',
        `${command.label} is not installed locally. Run "${buildOllamaRunCommand(model)}" in PowerShell, then refresh and click Check Installed Models.`,
        { requestedModel: model, setupCommand: buildOllamaRunCommand(model), preferredLabel: command.label }
      );
    }

    try {
      await runCommand('ollama', ['show', model], { timeout: 5000 });
    } catch {
      // The model is installed; if the local CLI is slow, fall back to the status message below.
    }

    return {
      actionKey,
      label: command.label,
      reply: `${command.label} is installed locally and ready to use.`,
      provider: 'ollama',
      modelUsed: model,
      mode: 'test',
    };
  }
  const result = await runCommand('ollama', command.args, { timeout: 180000 });
  return {
    actionKey,
    label: command.label,
    mode: command.args[0],
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function generateGroqReply({ providerMessages, modelMode }) {
  if (!hasGroqKey()) {
    throw createProviderError('GROQ_MISSING_KEY', 'GROQ_API_KEY is missing.');
  }

  const preset = MODEL_PRESETS[normalizeModelMode(modelMode)];
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  let lastError = null;

  for (const model of preset.candidates) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: providerMessages,
        temperature: preset.temperature,
        max_tokens: preset.maxTokens,
      });

      const reply = completion?.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        throw createProviderError('GROQ_EMPTY', `Groq returned an empty response for model ${model}.`);
      }

      return {
        reply,
        provider: 'groq',
        modelUsed: model,
      };
    } catch (error) {
      lastError = createProviderError(
        'GROQ_UNAVAILABLE',
        error?.message || `Groq failed for model ${model}.`,
        { cause: error }
      );
    }
  }

  throw lastError || createProviderError('GROQ_UNAVAILABLE', 'Groq is unavailable right now.');
}

async function generateOllamaReply({ providerMessages, model = OLLAMA_MODEL, preferredLabel = 'local model', numPredict = null }) {
  const payload = {
    model,
    messages: providerMessages,
    stream: false,
  };
  if (Number.isFinite(numPredict) && numPredict > 0) {
    payload.options = { num_predict: numPredict };
  }

  let response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    throw createProviderError(
      'OLLAMA_UNAVAILABLE',
      'Groq is unavailable, and Ollama is not running. Start Ollama or add a working Groq API key.',
      { cause: error, requestedModel: model, preferredLabel }
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 404 && model === QWEN_36_MODEL) {
      throw createProviderError(
        'OLLAMA_MODEL_MISSING',
        `${preferredLabel || 'The selected model'} is not installed locally. Run "${buildOllamaRunCommand(model)}" in PowerShell, then try again.`,
        {
          status: response.status,
          body: text,
          requestedModel: model,
          setupCommand: buildOllamaRunCommand(model),
          preferredLabel,
        }
      );
    }
    if (response.status === 404) {
      throw createProviderError(
        'OLLAMA_MODEL_MISSING',
        `${preferredLabel || 'The selected model'} is not installed locally. Run "${buildOllamaRunCommand(model)}" in PowerShell, then try again.`,
        {
          status: response.status,
          body: text,
          requestedModel: model,
          setupCommand: buildOllamaRunCommand(model),
          preferredLabel,
        }
      );
    }
    if ([500, 502, 503].includes(response.status)) {
      throw createProviderError(
        'OLLAMA_UNAVAILABLE',
        'Groq is unavailable, and Ollama is not running. Start Ollama or add a working Groq API key.',
        { status: response.status, body: text, requestedModel: model, preferredLabel }
      );
    }

    throw createProviderError(
      'OLLAMA_FAILED',
      `Ollama returned an error (${response.status}): ${text || response.statusText}`,
      { status: response.status, requestedModel: model, preferredLabel }
    );
  }

  const data = await response.json();
  const reply = data?.message?.content?.trim();
  if (!reply) {
    throw createProviderError('OLLAMA_FAILED', 'Ollama returned an empty response.');
  }

  return {
    reply,
    provider: 'ollama',
    modelUsed: model,
  };
}

function buildFriendlyFailureReply({ providerMode, error }) {
  if (error?.code === 'OLLAMA_MODEL_MISSING') {
    return `Qwen 3.6 is not installed locally yet. Run "${error.setupCommand || QWEN_SETUP_COMMAND}" in PowerShell, or switch back to the default model.`;
  }
  if (providerMode === 'groq') {
    if (error?.code === 'GROQ_MISSING_KEY') {
      return 'Groq Only mode is selected, but GROQ_API_KEY is missing. Add a working Groq API key or switch provider modes.';
    }
    return 'Groq Only mode is selected, and Groq is unavailable right now. Try again, check your Groq key, or switch provider modes.';
  }

  if (providerMode === 'ollama') {
    if (error?.code === 'OLLAMA_UNAVAILABLE') {
      return 'Ollama Only mode is selected, but Ollama is not running. Start Ollama or switch provider modes.';
    }
    return 'Ollama Only mode is selected, but the local model could not answer. Check that Ollama is running and the model is installed.';
  }

  if (error?.code === 'OLLAMA_UNAVAILABLE') {
    return 'Groq is unavailable, and Ollama is not running. Start Ollama or add a working Groq API key.';
  }

  return 'ForgeAI could not generate a response right now. Try again in a moment.';
}

async function resolveProviderReply({
  message,
  history,
  modelMode,
  providerMode,
  webContext,
  memory,
  assistantMode,
  localModelPreference,
}) {
  const providerMessages = buildProviderMessages({
    message,
    history,
    webContext,
    memory,
    assistantMode,
  });
  const localPreference = normalizeLocalModelPreference(localModelPreference);
  const runPreferredLocalModel = async (preference) => {
    const entry = LOCAL_MODEL_BY_PREFERENCE[preference];
    if (!entry) return null;
    return generateOllamaReply({ providerMessages, model: entry.model, preferredLabel: entry.label });
  };
  const tryDefaultAuto = async () => {
    try {
      return await generateGroqReply({ providerMessages, modelMode });
    } catch (groqError) {
      const autoLocalOrder = ['qwen36', 'gemma4', 'fallback', 'gemma3'];
      let lastLocalError = null;
      for (const preference of autoLocalOrder) {
        try {
          const reply = await runPreferredLocalModel(preference);
          if (reply) return reply;
        } catch (error) {
          lastLocalError = error;
        }
      }
      throw createProviderError('AUTO_FAILED', buildFriendlyFailureReply({ providerMode, error: lastLocalError }), {
        groqError,
        ollamaError: lastLocalError,
      });
    }
  };

  if (providerMode === 'groq') {
    return generateGroqReply({ providerMessages, modelMode });
  }

  if (providerMode === 'ollama') {
    if (localPreference !== 'default') {
      try {
        const preferredReply = await runPreferredLocalModel(localPreference);
        if (preferredReply) return preferredReply;
      } catch (preferredError) {
        if (preferredError?.code !== 'OLLAMA_MODEL_MISSING' || localPreference === 'fallback') {
          throw preferredError;
        }
      }
    }
    return generateOllamaReply({
      providerMessages,
      model: OLLAMA_MODEL,
      preferredLabel: localPreference === 'fallback' ? 'Qwen3 4B' : 'Default AI',
    });
  }

  if (localPreference !== 'default') {
    try {
      const preferredReply = await runPreferredLocalModel(localPreference);
      if (preferredReply) return preferredReply;
    } catch (preferredError) {
      if (preferredError?.code !== 'OLLAMA_MODEL_MISSING') {
        throw preferredError;
      }
    }
  }

  return tryDefaultAuto();
}

function respondWithMessage(res, payload) {
  res.json({
    reply: payload.reply,
    provider: payload.provider || 'error',
    modelUsed: payload.modelUsed || null,
    webUsed: Boolean(payload.webUsed),
    sources: Array.isArray(payload.sources) ? payload.sources : [],
    error: Boolean(payload.error),
    usageCost: Number.isFinite(payload.usageCost) ? payload.usageCost : null,
    account: payload.account || null,
    memory: payload.memory || null,
    support: SUPPORT_CONTACT,
  });
}

function buildAccountResponse(record) {
  return {
    account: sanitizeAccountRecord(record),
    memory: sanitizeMemory(record.memory),
  };
}

app.get('/api/account', (req, res) => {
  try {
    const accountId = typeof req.query.accountId === 'string' ? req.query.accountId.trim() : '';
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required.' });
    }

    const record = getOrCreateAccountRecord({
      id: accountId,
      name: typeof req.query.name === 'string' ? req.query.name : undefined,
      email: typeof req.query.email === 'string' ? req.query.email : undefined,
      kind: typeof req.query.kind === 'string' ? req.query.kind : undefined,
    });

    return res.json(buildAccountResponse(record));
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Unable to load account.',
    });
  }
});

app.get('/api/memory', (req, res) => {
  try {
    const accountId = typeof req.query.accountId === 'string' ? req.query.accountId.trim() : '';
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required.' });
    }

    const record = getOrCreateAccountRecord({
      id: accountId,
      kind: typeof req.query.kind === 'string' ? req.query.kind : undefined,
      email: typeof req.query.email === 'string' ? req.query.email : undefined,
      name: typeof req.query.name === 'string' ? req.query.name : undefined,
    });

    return res.json({
      memory: sanitizeMemory(record.memory),
      account: sanitizeAccountRecord(record),
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Unable to load memory.',
    });
  }
});

app.post('/api/memory', (req, res) => {
  try {
    const account = normalizeAccountInput(req.body.account);
    if (!account) {
      return res.status(400).json({ error: 'Account required.' });
    }

    const record = getOrCreateAccountRecord(account);

    if (typeof req.body.removeNoteId === 'string' && req.body.removeNoteId.trim()) {
      removeMemoryNote(record, req.body.removeNoteId.trim());
    }

    if (req.body.profile && typeof req.body.profile === 'object') {
      mergeMemory(record, { profile: req.body.profile });
    }

    if (typeof req.body.note === 'string' && req.body.note.trim()) {
      mergeMemory(record, { notes: [req.body.note.trim()] });
    }

    record.updatedAt = new Date().toISOString();
    accountStore.accounts[record.id] = record;
    writeAccountStore();

    return res.json({
      memory: sanitizeMemory(record.memory),
      account: sanitizeAccountRecord(record),
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Unable to update memory.',
    });
  }
});

app.get('/api/developer/packs', (req, res) => {
  res.json({ donationLinks: DONATION_LINKS });
});

app.get('/api/developer/keys', (req, res) => {
  try {
    const accountId = typeof req.query.accountId === 'string' ? req.query.accountId.trim() : '';
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required.' });
    }

    return res.json({
      keys: listApiKeysForAccount(accountId),
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Unable to load API keys.',
    });
  }
});

app.post('/api/developer/keys', (req, res) => {
  try {
    const account = normalizeAccountInput(req.body.account);
    if (!account) {
      return res.status(400).json({ error: 'Account required.' });
    }

    const created = createApiKeyForAccount(account, req.body.label);
    const record = getOrCreateAccountRecord(account);

    return res.json({
      apiKey: created.plainTextKey,
      key: sanitizeApiKeyRecord(created.record),
      account: sanitizeAccountRecord(record),
      memory: sanitizeMemory(record.memory),
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Unable to create API key.',
    });
  }
});

app.get('/api/auth/config', (req, res) => {
  res.json({
    googleEnabled: Boolean(GOOGLE_CLIENT_ID),
    googleClientId: GOOGLE_CLIENT_ID || null,
  });
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const account = await verifyGoogleIdToken(req.body.credential);
    const record = getOrCreateAccountRecord(account);
    return res.json(buildAccountResponse(record));
  } catch (error) {
    return res.status(400).json({
      error: error?.message || 'Google sign-in failed.',
    });
  }
});

app.get('/api/health', async (req, res) => {
  const ollamaCatalog = await inspectOllamaCatalog();
  const modelInventory = await readModelInventory();
  res.json({
    ok: true,
    groqConfigured: hasGroqKey(),
    googleConfigured: Boolean(GOOGLE_CLIENT_ID),
    ollamaBaseUrl: OLLAMA_BASE_URL,
    ollamaModel: OLLAMA_MODEL,
    qwen36Model: QWEN_36_MODEL,
    qwen36Available: ollamaCatalog.qwen36Available,
    fallbackModelAvailable: ollamaCatalog.fallbackAvailable,
    ollamaReachable: ollamaCatalog.reachable,
    ollamaInstalled: modelInventory.installed,
    ollamaRunning: modelInventory.running,
    installedModels: modelInventory.installedModels,
    managedModels: modelInventory.models,
    support: SUPPORT_CONTACT,
    qwenSetupCommand: QWEN_SETUP_COMMAND,
    gemmaSetupCommands: {
      gemma3: 'ollama pull gemma3:4b',
      gemma4: 'ollama pull gemma4',
    },
    donationUrl: DONATION_URL,
    donationLinks: DONATION_LINKS,
    freeTokenLimit: DEFAULT_TOKEN_LIMIT,
    proTokenLimit: PRO_TOKEN_LIMIT,
    apiStarterTokens: DEFAULT_API_TOKEN_LIMIT,
  });
});

app.get('/api/admin/models', async (req, res) => {
  try {
    const account = normalizeAccountInput({
      id: req.query.accountId,
      name: req.query.name,
      email: req.query.email,
      kind: req.query.kind,
    });
    if (!canAccessAdminTools(account)) {
      return res.status(403).json({ error: 'Admin account required.' });
    }
    const inventory = await readModelInventory();
    return res.json({
      ok: true,
      inventory,
      adminCommands: MANAGED_OLLAMA_MODELS.map((item) => ({
        ...item,
        removeCommand: `ollama rm ${item.model}`,
      })),
      instructions:
        'To use local AI models, install Ollama first. Then open PowerShell and run the model download command. After the download finishes, refresh this page and click Check Installed Models.',
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Unable to load model inventory.' });
  }
});

app.post('/api/admin/models/check', async (req, res) => {
  try {
    await ensureAdminAccount(req);
    const inventory = await readModelInventory();
    return res.json({ ok: true, inventory });
  } catch (error) {
    return res.status(error?.code === 'OWNER_ADMIN_REQUIRED' ? 403 : 500).json({
      error: error?.message || 'Unable to check installed models.',
    });
  }
});

app.post('/api/admin/models/action', async (req, res) => {
  try {
    await ensureAdminAccount(req);
    const actionKey = String(req.body?.actionKey || '').trim();
    const inventory = await readModelInventory();
    if (!inventory.installed || !inventory.running) {
      return res.status(503).json({
        error:
          'Ollama is missing or offline. Install Ollama, start it, and then try again or use the copy command shown in settings.',
        inventory,
      });
    }
    const output = await executeAllowedOllamaCommand(actionKey);
    const refreshed = await readModelInventory();
    return res.json({
      ok: true,
      output,
      inventory: refreshed,
    });
  } catch (error) {
    const status = error?.code === 'OWNER_ADMIN_REQUIRED' ? 403 : 500;
    return res.status(status).json({
      error: error?.message || 'Unable to process model action.',
    });
  }
});

app.post('/api/donations/claim', (req, res) => {
  try {
    const account = normalizeAccountInput(req.body?.account);
    if (!account) {
      return res.status(400).json({ error: 'Account required.' });
    }

    const record = queuePendingPurchase(account, {
      plan: req.body?.plan,
      tokens: req.body?.tokens,
      amountUsd: req.body?.amountUsd,
    });

    return res.json({
      ok: true,
      message: 'Temporary access granted and logged for review. It will auto-revoke if not verified within 24 hours.',
      account: sanitizeAccountRecord(record),
      memory: sanitizeMemory(record.memory),
    });
  } catch (error) {
    const status = error?.code === 'ACCOUNT_REQUIRED' ? 400 : 500;
    return res.status(status).json({
      error: error?.message || 'Unable to create a pending donation record.',
    });
  }
});

app.post('/api/admin/token-credit', (req, res) => {
  try {
    requireOwnerAdmin(req);
    const account = normalizeAccountInput(req.body.account);
    if (!account) {
      return res.status(400).json({ error: 'Account required.' });
    }

    const record = grantPurchasedTokens(account, req.body.tokens);
    return res.json({
      ok: true,
      account: sanitizeAccountRecord(record),
      memory: sanitizeMemory(record.memory),
    });
  } catch (error) {
    const status = error?.code === 'OWNER_ADMIN_REQUIRED' ? 403 : 500;
    return res.status(status).json({
      error: error?.message || 'Unable to credit tokens.',
    });
  }
});

async function handleChatRequest({
  message,
  history,
  modelMode,
  providerMode,
  assistantMode,
  localModelPreference,
  accountInput,
}) {
  const accountRecord = getOrCreateAccountRecord(accountInput);

  const memoryUpdates = extractMemoryUpdates(message);
  if (Object.keys(memoryUpdates.profile).length > 0 || memoryUpdates.notes.length > 0) {
    mergeMemory(accountRecord, memoryUpdates);
    accountRecord.updatedAt = new Date().toISOString();
    accountStore.accounts[accountRecord.id] = accountRecord;
    writeAccountStore();
  }

  const usageCost = estimateTokenUsage({
    message,
    history,
    providerMode,
    modelMode,
    assistantMode,
    localModelPreference,
  });

  const usageRecord = reserveUsage(accountRecord, usageCost);

  try {
    const replyData = await resolveProviderReply({
      message,
      history,
      modelMode,
      providerMode,
      webContext: '',
      memory: usageRecord.memory,
      assistantMode,
      localModelPreference,
    });

    return {
      ...replyData,
      webUsed: false,
      sources: [],
      error: false,
      usageCost,
      account: sanitizeAccountRecord(usageRecord),
      memory: sanitizeMemory(usageRecord.memory),
    };
  } catch (error) {
    return {
      reply: buildFriendlyFailureReply({ providerMode, error: error?.ollamaError || error }),
      provider: 'error',
      modelUsed: null,
      webUsed,
      sources,
      error: true,
      usageCost,
      account: sanitizeAccountRecord(usageRecord),
      memory: sanitizeMemory(usageRecord.memory),
    };
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const history = normalizeHistory(req.body.history);
    const modelMode = normalizeModelMode(req.body.modelMode);
    const providerMode = normalizeProviderMode(req.body.providerMode);
    const assistantMode = normalizeAssistantMode(req.body.assistantMode);
    const localModelPreference = normalizeLocalModelPreference(req.body.localModelPreference);
    const account = normalizeAccountInput(req.body.account);

    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    if (!account) {
      return res.status(400).json({ error: 'Account required. Please sign in or continue as a guest.' });
    }

    try {
      const payload = await handleChatRequest({
        message,
        history,
        modelMode,
        providerMode,
        assistantMode,
        localModelPreference,
        accountInput: account,
      });

      return respondWithMessage(res, payload);
    } catch (error) {
      if (error?.code === 'USAGE_EXHAUSTED') {
        return res.status(402).json({
          error: error.message,
          account: error.account || null,
          memory: error.memory || null,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('ForgeAI chat error:', error);
    return res.status(500).json({
      error: 'ForgeAI could not generate a response right now.',
    });
  }
});

app.post('/api/v1/chat', async (req, res) => {
  try {
    const apiKey =
      String(req.headers['x-api-key'] || '').trim() ||
      String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() ||
      String(req.body.apiKey || '').trim();
    const keyRecord = resolveApiKeyRecord(apiKey);

    if (!keyRecord) {
      return res.status(401).json({
        error: 'A valid ForgeAI API key is required.',
      });
    }

    const accountRecord = accountStore.accounts[keyRecord.accountId];
    if (!accountRecord) {
      return res.status(404).json({
        error: 'The account attached to this API key no longer exists.',
      });
    }

    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const history = normalizeHistory(req.body.history);
    const modelMode = normalizeModelMode(req.body.modelMode);
    const providerMode = normalizeProviderMode(req.body.providerMode);
    const assistantMode = normalizeAssistantMode(req.body.assistantMode);
    const localModelPreference = normalizeLocalModelPreference(req.body.localModelPreference);

    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const usageCost = estimateTokenUsage({
      message,
      history,
      providerMode,
      modelMode,
      assistantMode,
      localModelPreference,
    });

    let usageRecord;
    try {
      usageRecord = reserveApiUsage(accountRecord, usageCost);
    } catch (error) {
      if (error?.code === 'API_USAGE_EXHAUSTED') {
        return res.status(402).json({
          error: error.message,
          account: error.account || null,
          memory: error.memory || null,
        });
      }
      throw error;
    }

    try {
      const replyData = await resolveProviderReply({
        message,
        history,
        modelMode,
        providerMode,
        webContext: '',
        memory: usageRecord.memory,
        assistantMode,
        localModelPreference,
      });

      return respondWithMessage(res, {
        ...replyData,
        webUsed: false,
        sources: [],
        error: false,
        usageCost,
        account: sanitizeAccountRecord(usageRecord),
        memory: sanitizeMemory(usageRecord.memory),
      });
    } catch (error) {
      return respondWithMessage(res, {
        reply: buildFriendlyFailureReply({
          providerMode,
          error: error?.ollamaError || error,
        }),
        provider: 'error',
        modelUsed: null,
        webUsed,
        sources,
        error: true,
        usageCost,
        account: sanitizeAccountRecord(usageRecord),
        memory: sanitizeMemory(usageRecord.memory),
      });
    }
  } catch (error) {
    console.error('ForgeAI API key chat error:', error);
    return res.status(500).json({
      error: 'ForgeAI could not generate a response right now.',
    });
  }
});

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    return;
  }

  next();
});

app.listen(PORT, () => {
  console.log(`ForgeAI is running on http://localhost:${PORT}`);
});
