require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Groq = require('groq-sdk');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ACCOUNT_STORE_PATH = path.join(__dirname, 'forgeai-accounts.json');
const OLLAMA_BASE_URL = String(process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = String(process.env.OLLAMA_MODEL || 'qwen3:4b').trim();
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const OWNER_ADMIN_TOKEN = String(process.env.OWNER_ADMIN_TOKEN || '').trim();
const OWNER_EMAILS = new Set(
  String(process.env.OWNER_EMAILS || 'thisisalexanderbatti@gmail.com')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

const DEFAULT_TOKEN_LIMIT = 200;
const PRO_TOKEN_LIMIT = 1000;
const DEFAULT_API_TOKEN_LIMIT = 100;
const BILLING_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000;
const PAYPAL_ME_URL = 'https://paypal.me/AlexanderBatti/14';
const PAYPAL_TOKEN_PACKS = [
  { code: 'pack_200', tokens: 200, amountUsd: 5, paypalUrl: 'https://paypal.me/AlexanderBatti/5' },
  { code: 'pack_400', tokens: 400, amountUsd: 10, paypalUrl: 'https://paypal.me/AlexanderBatti/10' },
  { code: 'pack_800', tokens: 800, amountUsd: 15, paypalUrl: 'https://paypal.me/AlexanderBatti/15' },
  { code: 'pack_1200', tokens: 1200, amountUsd: 20, paypalUrl: 'https://paypal.me/AlexanderBatti/20' },
  { code: 'pack_200000', tokens: 200000, amountUsd: 2000, paypalUrl: 'https://paypal.me/AlexanderBatti/2000' },
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

const LIVE_QUERY_REGEX =
  /\b(today|now|current|latest|news|weather|temperature|forecast|price|prices|stock|stocks|sports|score|scores|game|games|match|earnings|release date|breaking|headline|headlines|updates|what happened|who won|how much is)\b/i;

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

function hasTavilyKey() {
  const tavilyKey = String(process.env.TAVILY_API_KEY || '').trim();
  const groqKey = String(process.env.GROQ_API_KEY || '').trim();
  if (!tavilyKey) return false;
  if (groqKey && tavilyKey === groqKey) return false;
  return true;
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

function applyBillingCycle(record, now = Date.now()) {
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

  const plan = normalizePlan(record.plan);
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

function estimateTokenUsage({ message, history, webMode, providerMode, modelMode }) {
  const base = 8;
  const lengthCost = Math.ceil(String(message || '').length / 140);
  const historyCost = Math.min(6, Math.ceil((Array.isArray(history) ? history.length : 0) / 3));
  const providerCost = providerMode === 'ollama' ? 0 : providerMode === 'groq' ? 3 : 2;
  const modeCost = modelMode === 'creative' ? 8 : modelMode === 'smart' ? 4 : 0;
  const webCost = webMode ? 4 : 0;
  return Math.max(10, Math.min(30, base + lengthCost + historyCost + providerCost + modeCost + webCost));
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

function looksLikeLiveQuestion(text) {
  return LIVE_QUERY_REGEX.test(String(text || ''));
}

function buildSystemPrompt({ liveContextAvailable }) {
  return [
    'You are ForgeAI Nova, a premium, calm, capable AI assistant.',
    'Write clearly, naturally, and helpfully.',
    'Keep responses concise unless the user asks for more detail.',
    'When the user asks for code, provide practical code and brief setup notes when useful.',
    liveContextAvailable
      ? 'You have fresh search results available. Prefer those over general memory for current information.'
      : 'Live web data is unavailable right now, so do not invent current facts.',
  ].join(' ');
}

function buildProviderMessages({ message, history, webContext, memory }) {
  const messages = [
    {
      role: 'system',
      content: buildSystemPrompt({ liveContextAvailable: Boolean(webContext) }),
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
        'Fresh live web context for the next answer. Use it carefully and do not invent facts beyond the evidence below.\n\n' +
        webContext,
    });
  }

  messages.push({
    role: 'user',
    content: message,
  });

  return messages;
}

async function searchTavily(query) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      max_results: 5,
      include_answer: true,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw createProviderError('TAVILY_FAILED', `Tavily search failed (${response.status}): ${text || response.statusText}`);
  }

  const data = await response.json();
  return {
    answer: typeof data.answer === 'string' ? data.answer.trim() : '',
    results: Array.isArray(data.results) ? data.results : [],
  };
}

function buildSearchContext(query, search) {
  const lines = [`Search query: ${query}`];

  if (search.answer) {
    lines.push(`Tavily summary: ${trimText(search.answer, 500)}`);
  }

  if (search.results.length > 0) {
    lines.push('Top results:');
  }

  search.results.forEach((result, index) => {
    const title = trimText(result.title || `Result ${index + 1}`, 120);
    const content = trimText(result.content || result.snippet || '', 240);
    const url = result.url || result.raw_url || '';
    lines.push(`${index + 1}. ${title}${content ? ` - ${content}` : ''}${url ? ` (${url})` : ''}`);
  });

  return lines.join('\n').slice(0, 4500);
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

async function generateOllamaReply({ providerMessages }) {
  const payload = {
    model: OLLAMA_MODEL,
    messages: providerMessages,
    stream: false,
  };

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
      { cause: error }
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if ([404, 500, 502, 503].includes(response.status)) {
      throw createProviderError(
        'OLLAMA_UNAVAILABLE',
        'Groq is unavailable, and Ollama is not running. Start Ollama or add a working Groq API key.',
        { status: response.status, body: text }
      );
    }

    throw createProviderError(
      'OLLAMA_FAILED',
      `Ollama returned an error (${response.status}): ${text || response.statusText}`,
      { status: response.status }
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
    modelUsed: OLLAMA_MODEL,
  };
}

function buildFriendlyFailureReply({ providerMode, error }) {
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

async function resolveProviderReply({ message, history, modelMode, providerMode, webContext, memory }) {
  const providerMessages = buildProviderMessages({
    message,
    history,
    webContext,
    memory,
  });

  if (providerMode === 'groq') {
    return generateGroqReply({ providerMessages, modelMode });
  }

  if (providerMode === 'ollama') {
    return generateOllamaReply({ providerMessages });
  }

  try {
    return await generateGroqReply({ providerMessages, modelMode });
  } catch (groqError) {
    try {
      return await generateOllamaReply({ providerMessages });
    } catch (ollamaError) {
      throw createProviderError('AUTO_FAILED', buildFriendlyFailureReply({ providerMode, error: ollamaError }), {
        groqError,
        ollamaError,
      });
    }
  }
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
  res.json({ packs: PAYPAL_TOKEN_PACKS });
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

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    groqConfigured: hasGroqKey(),
    tavilyConfigured: hasTavilyKey(),
    googleConfigured: Boolean(GOOGLE_CLIENT_ID),
    ollamaBaseUrl: OLLAMA_BASE_URL,
    ollamaModel: OLLAMA_MODEL,
    paypalUrl: PAYPAL_ME_URL,
    tokenPacks: PAYPAL_TOKEN_PACKS,
    freeTokenLimit: DEFAULT_TOKEN_LIMIT,
    proTokenLimit: PRO_TOKEN_LIMIT,
    apiStarterTokens: DEFAULT_API_TOKEN_LIMIT,
  });
});

app.post('/api/billing/claim', (req, res) => {
  return res.status(403).json({
      error: 'Self-service upgrades are disabled. API token credits and Pro access must be granted after manual payment verification.',
  });
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

async function handleChatRequest({ message, history, modelMode, providerMode, webMode, accountInput }) {
  const tavilyConfigured = hasTavilyKey();
  const liveRequested = webMode || looksLikeLiveQuestion(message);
  const accountRecord = getOrCreateAccountRecord(accountInput);

  if (liveRequested && !tavilyConfigured) {
    return {
      reply:
        'Live web search is not set up yet. Add TAVILY_API_KEY to enable current news, weather, prices, sports, and other real-time answers.',
      provider: 'error',
      modelUsed: null,
      webUsed: false,
      sources: [],
      error: true,
      account: sanitizeAccountRecord(accountRecord),
      memory: sanitizeMemory(accountRecord.memory),
    };
  }

  const memoryUpdates = extractMemoryUpdates(message);
  if (Object.keys(memoryUpdates.profile).length > 0 || memoryUpdates.notes.length > 0) {
    mergeMemory(accountRecord, memoryUpdates);
    accountRecord.updatedAt = new Date().toISOString();
    accountStore.accounts[accountRecord.id] = accountRecord;
    writeAccountStore();
  }

  let webContext = '';
  let webUsed = false;
  let sources = [];

  if (liveRequested) {
    const search = await searchTavily(message);
    webContext = buildSearchContext(message, search);
    webUsed = true;
    sources = search.results.map((result) => ({
      title: result.title || 'Untitled result',
      url: result.url || result.raw_url || '',
    }));
  }

  const usageCost = estimateTokenUsage({
    message,
    history,
    webMode,
    providerMode,
    modelMode,
  });

  const usageRecord = reserveUsage(accountRecord, usageCost);

  try {
    const replyData = await resolveProviderReply({
      message,
      history,
      modelMode,
      providerMode,
      webContext,
      memory: usageRecord.memory,
    });

    return {
      ...replyData,
      webUsed,
      sources,
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
    const webMode = Boolean(req.body.webMode);
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
        webMode,
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
    const webMode = Boolean(req.body.webMode);

    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const tavilyConfigured = hasTavilyKey();
    const liveRequested = webMode || looksLikeLiveQuestion(message);

    if (liveRequested && !tavilyConfigured) {
      return respondWithMessage(res, {
        reply:
          'Live web search is not set up yet. Add TAVILY_API_KEY to enable current news, weather, prices, sports, and other real-time answers.',
        provider: 'error',
        modelUsed: null,
        webUsed: false,
        sources: [],
        error: true,
        account: sanitizeAccountRecord(accountRecord),
        memory: sanitizeMemory(accountRecord.memory),
      });
    }

    let webContext = '';
    let webUsed = false;
    let sources = [];

    if (liveRequested) {
      const search = await searchTavily(message);
      webContext = buildSearchContext(message, search);
      webUsed = true;
      sources = search.results.map((result) => ({
        title: result.title || 'Untitled result',
        url: result.url || result.raw_url || '',
      }));
    }

    const usageCost = estimateTokenUsage({
      message,
      history,
      webMode,
      providerMode,
      modelMode,
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
        webContext,
        memory: usageRecord.memory,
      });

      return respondWithMessage(res, {
        ...replyData,
        webUsed,
        sources,
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
