const CURRENT_ACCOUNT_KEY = 'forgeai.currentAccount.v2';
const DEVICE_ID_KEY = 'forgeai.deviceId.v1';
const STATIC_EXPORT = Boolean(window.FORGEAI_STATIC_EXPORT);
const PROVIDER_BADGES = {
  standby: { label: 'Waiting', className: '' },
  groq: { label: 'Groq', className: 'groq' },
  ollama: { label: 'Ollama Local', className: 'ollama' },
  error: { label: 'Error', className: 'error' },
};
const ASSISTANT_MODE_LABELS = {
  general: 'General Chat',
  email: 'Write Email',
  code: 'Code Helper',
  prompt: 'Prompt Builder',
};
const VOICE_STYLE_LABELS = {
  calm: 'Calm',
  professional: 'Professional',
  friendly: 'Friendly',
  deep: 'Deep',
  fast: 'Fast',
  slow: 'Slow',
};

const state = {
  health: null,
  modelInventory: null,
  account: null,
  memory: {
    profile: { name: '', job: '', location: '' },
    notes: [],
  },
  settings: {
    providerMode: 'auto',
    modelMode: 'smart',
    assistantMode: 'general',
    localModelPreference: 'default',
    voiceStyle: 'friendly',
  },
  conversations: [],
  activeConversationId: null,
  apiKeys: [],
  supportLinks: [],
  searchQuery: '',
  status: 'Ready when you are.',
  isSending: false,
  settingsOpen: false,
  activeSettingsTab: 'account',
  voice: {
    recognition: null,
    recognitionActive: false,
    recognitionPurpose: 'composer',
    callOpen: false,
    micMuted: false,
    status: 'Ready',
    userCaption: 'Waiting for your microphone.',
    aiCaption: 'Spoken replies will appear here.',
  },
};

const els = {
  authOverlay: document.querySelector('[data-auth-overlay]'),
  authForm: document.querySelector('[data-auth-form]'),
  authName: document.querySelector('[data-auth-name]'),
  authEmail: document.querySelector('[data-auth-email]'),
  authGuest: document.querySelector('[data-auth-guest]'),
  chatSearch: document.querySelector('[data-chat-search]'),
  chatList: document.querySelector('[data-chat-list]'),
  thread: document.querySelector('[data-thread]'),
  input: document.querySelector('[data-input]'),
  composer: document.querySelector('[data-composer]'),
  sendButton: document.querySelector('[data-send-button]'),
  activeTitle: document.querySelector('[data-active-title]'),
  providerBadge: document.querySelector('[data-provider-badge]'),
  status: document.querySelector('[data-status]'),
  usageText: document.querySelector('[data-usage-text]'),
  usageFill: document.querySelector('[data-usage-fill]'),
  usageCaption: document.querySelector('[data-usage-caption]'),
  accountName: document.querySelector('[data-account-name]'),
  accountBadge: document.querySelector('[data-account-badge]'),
  accountEmail: document.querySelector('[data-account-email]'),
  accountAvatar: document.querySelector('[data-account-avatar]'),
  sidebar: document.querySelector('[data-sidebar]'),
  sidebarBackdrop: document.querySelector('[data-sidebar-backdrop]'),
  openSidebarButtons: document.querySelectorAll('[data-open-sidebar]'),
  closeSidebarButtons: document.querySelectorAll('[data-close-sidebar]'),
  newChatButtons: document.querySelectorAll('[data-new-chat]'),
  clearChatsButton: document.querySelector('[data-clear-chats]'),
  openSettingsButtons: document.querySelectorAll('[data-open-settings]'),
  closeSettingsButton: document.querySelector('[data-close-settings]'),
  settingsOverlay: document.querySelector('[data-settings-overlay]'),
  settingsTabs: document.querySelectorAll('[data-settings-tab]'),
  settingsSections: document.querySelectorAll('[data-settings-section]'),
  switchAccountButtons: document.querySelectorAll('[data-switch-account]'),
  signOutButton: document.querySelector('[data-sign-out]'),
  providerMode: document.querySelector('[data-provider-mode]'),
  modelPreference: document.querySelector('[data-model-preference]'),
  modelPreferenceToolbar: document.querySelector('[data-model-preference-toolbar]'),
  modelHelp: document.querySelector('[data-model-help]'),
  assistantMode: document.querySelector('[data-assistant-mode]'),
  assistantModeCards: document.querySelectorAll('[data-assistant-mode-card]'),
  modelButtons: document.querySelectorAll('[data-model-mode]'),
  voiceStyle: document.querySelector('[data-voice-style]'),
  voiceStyleToolbar: document.querySelector('[data-voice-style-toolbar]'),
  settingsName: document.querySelector('[data-settings-name]'),
  settingsEmail: document.querySelector('[data-settings-email]'),
  settingsPlan: document.querySelector('[data-settings-plan]'),
  settingsUsage: document.querySelector('[data-settings-usage]'),
  healthGroq: document.querySelector('[data-health-groq]'),
  healthOllama: document.querySelector('[data-health-ollama]'),
  healthLocalModels: document.querySelector('[data-health-local-models]'),
  localModelsPanel: document.querySelector('[data-local-models-panel]'),
  checkModelsButton: document.querySelector('[data-check-models]'),
  modelsGrid: document.querySelector('[data-models-grid]'),
  modelsSetupMessage: document.querySelector('[data-models-setup-message]'),
  createApiKeyButton: document.querySelector('[data-create-api-key]'),
  openSupportTabButton: document.querySelector('[data-open-billing-tab]'),
  apiKeyOutput: document.querySelector('[data-api-key-output]'),
  apiHero: document.querySelector('[data-api-hero]'),
  apiKeyList: document.querySelector('[data-api-key-list]'),
  memoryProfileForm: document.querySelector('[data-memory-profile-form]'),
  memoryName: document.querySelector('[data-memory-name]'),
  memoryJob: document.querySelector('[data-memory-job]'),
  memoryLocation: document.querySelector('[data-memory-location]'),
  memoryNoteForm: document.querySelector('[data-memory-note-form]'),
  memoryNote: document.querySelector('[data-memory-note]'),
  memoryList: document.querySelector('[data-memory-list]'),
  supportOverview: document.querySelector('[data-billing-overview]'),
  micToggleButton: document.querySelector('[data-mic-toggle]'),
  voiceStatusLine: document.querySelector('[data-voice-status-line]'),
  openVoiceCallButtons: document.querySelectorAll('[data-open-voice-call]'),
  voiceOverlay: document.querySelector('[data-voice-overlay]'),
  closeVoiceCallButton: document.querySelector('[data-close-voice-call]'),
  voiceListenButton: document.querySelector('[data-voice-listen]'),
  voiceMuteButton: document.querySelector('[data-voice-mute]'),
  voiceStopButton: document.querySelector('[data-voice-stop]'),
  voiceCallState: document.querySelector('[data-voice-call-state]'),
  voiceCallHelp: document.querySelector('[data-voice-call-help]'),
  voiceUserCaption: document.querySelector('[data-voice-user-caption]'),
  voiceAiCaption: document.querySelector('[data-voice-ai-caption]'),
  toastStack: document.querySelector('[data-toast-stack]'),
};

function uid(prefix = 'id') {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const value = uid('device');
  localStorage.setItem(DEVICE_ID_KEY, value);
  return value;
}

function buildAccountId(kind, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (kind === 'guest') {
    return `guest-${getDeviceId()}`;
  }
  return `${kind}-${normalizedEmail.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'user'}`;
}

function normalizePlan(plan) {
  if (plan === 'owner') return 'owner';
  return plan === 'pro' ? 'pro' : 'free';
}

function normalizeAssistantMode(mode) {
  return Object.prototype.hasOwnProperty.call(ASSISTANT_MODE_LABELS, mode) ? mode : 'general';
}

function normalizeLocalModelPreference(value) {
  return ['default', 'qwen36', 'fallback', 'gemma4', 'gemma3'].includes(value) ? value : 'default';
}

function normalizeVoiceStyle(value) {
  return Object.prototype.hasOwnProperty.call(VOICE_STYLE_LABELS, value) ? value : 'friendly';
}

function getPlanLabel(plan) {
  const normalized = normalizePlan(plan);
  if (normalized === 'owner') return 'Owner';
  if (normalized === 'pro') return 'PRO AI';
  return 'Free';
}

function hasProAccess(account = state.account) {
  return Boolean(account);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getStorageKeys(accountId) {
  return {
    conversations: `forgeai.${accountId}.conversations.v2`,
    activeConversationId: `forgeai.${accountId}.activeConversationId.v2`,
    settings: `forgeai.${accountId}.settings.v2`,
  };
}

function createConversation() {
  const now = new Date().toISOString();
  return {
    id: uid('chat'),
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function normalizeAccount(account) {
  if (!account || typeof account !== 'object') return null;
  const planFromLabel = String(account.planLabel || '').trim().toLowerCase();
  const resolvedPlan =
    planFromLabel === 'pro ai'
      ? 'pro'
      : planFromLabel === 'owner'
        ? 'owner'
        : normalizePlan(account.plan);

  return {
    id: String(account.id || '').trim(),
    kind: ['local', 'guest', 'google'].includes(account.kind) ? account.kind : 'local',
    name: String(account.name || 'ForgeAI User').trim(),
    email: String(account.email || 'user@example.com').trim(),
    plan: resolvedPlan,
    role: account.role === 'owner' ? 'owner' : 'member',
    isUnlimited: account.isUnlimited === true,
    tokenLimit: Number.isFinite(account.tokenLimit) ? account.tokenLimit : 200,
    tokensUsed: Number.isFinite(account.tokensUsed) ? account.tokensUsed : 0,
    tokensRemaining: Number.isFinite(account.tokensRemaining)
      ? account.tokensRemaining
      : Math.max(0, (Number(account.tokenLimit) || 200) - (Number(account.tokensUsed) || 0)),
    apiTokenLimit: Number.isFinite(account.apiTokenLimit) ? account.apiTokenLimit : 100,
    apiTokensUsed: Number.isFinite(account.apiTokensUsed) ? account.apiTokensUsed : 0,
    apiTokensRemaining: Number.isFinite(account.apiTokensRemaining)
      ? account.apiTokensRemaining
      : Math.max(0, (Number(account.apiTokenLimit) || 100) - (Number(account.apiTokensUsed) || 0)),
    renewalAt: account.renewalAt || null,
    createdAt: account.createdAt || new Date().toISOString(),
    updatedAt: account.updatedAt || new Date().toISOString(),
  };
}

function normalizeMemory(memory) {
  return {
    profile: {
      name: String(memory?.profile?.name || '').trim(),
      job: String(memory?.profile?.job || '').trim(),
      location: String(memory?.profile?.location || '').trim(),
    },
    notes: Array.isArray(memory?.notes)
      ? memory.notes.map((note) => ({
          id: String(note.id || uid('mem')),
          text: String(note.text || '').trim(),
          createdAt: note.createdAt || new Date().toISOString(),
        })).filter((note) => note.text)
      : [],
  };
}

function setCurrentAccount(account) {
  if (!account) {
    localStorage.removeItem(CURRENT_ACCOUNT_KEY);
    state.account = null;
    return;
  }

  state.account = normalizeAccount(account);
  writeJSON(CURRENT_ACCOUNT_KEY, state.account);
}

function getCurrentAccount() {
  return normalizeAccount(readJSON(CURRENT_ACCOUNT_KEY, null));
}

function getActiveConversation() {
  return state.conversations.find((conversation) => conversation.id === state.activeConversationId) || null;
}

function persistAccountState() {
  if (!state.account) return;
  const keys = getStorageKeys(state.account.id);
  writeJSON(keys.conversations, state.conversations);
  writeJSON(keys.settings, state.settings);
  localStorage.setItem(keys.activeConversationId, state.activeConversationId || '');
  writeJSON(CURRENT_ACCOUNT_KEY, state.account);
}

function loadAccountWorkspace() {
  if (!state.account) {
    state.conversations = [];
    state.activeConversationId = null;
    return;
  }

  const keys = getStorageKeys(state.account.id);
  const savedConversations = readJSON(keys.conversations, []);
  const savedSettings = readJSON(keys.settings, {});
  const savedActiveConversationId = localStorage.getItem(keys.activeConversationId);

  state.settings = {
    providerMode: ['auto', 'groq', 'ollama'].includes(savedSettings.providerMode) ? savedSettings.providerMode : 'auto',
    modelMode: ['fast', 'smart', 'creative'].includes(savedSettings.modelMode) ? savedSettings.modelMode : 'smart',
    assistantMode: normalizeAssistantMode(savedSettings.assistantMode),
    localModelPreference: normalizeLocalModelPreference(savedSettings.localModelPreference),
    voiceStyle: normalizeVoiceStyle(savedSettings.voiceStyle),
  };

  state.conversations = Array.isArray(savedConversations) ? savedConversations : [];
  if (state.conversations.length === 0) {
    state.conversations = [createConversation()];
  }

  state.activeConversationId =
    savedActiveConversationId && state.conversations.some((conversation) => conversation.id === savedActiveConversationId)
      ? savedActiveConversationId
      : state.conversations[0].id;
}

function createLocalAccount(name, email) {
  return {
    id: buildAccountId('local', email),
    kind: 'local',
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
  };
}

function createGuestAccount() {
  return {
    id: buildAccountId('guest', ''),
    kind: 'guest',
    name: 'Guest',
    email: `${getDeviceId()}@guest.local`,
  };
}

function escapeHTML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(text) {
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(text) {
  const source = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!source) return '<p></p>';

  const lines = source.split('\n');
  const blocks = [];
  let listItems = [];

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(escapeHTML(item))}</li>`).join('')}</ul>`);
    listItems = [];
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      return;
    }

    flushList();
    blocks.push(`<p>${renderInlineMarkdown(escapeHTML(trimmed))}</p>`);
  });

  flushList();
  return blocks.join('');
}

function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatRenewal(account) {
  if (!account) return 'Free plan renews every 2 days.';
  if (account.isUnlimited) return 'Unlimited owner access.';
  if (!account.renewalAt) return `${getPlanLabel(account.plan)} plan renews every 2 days.`;
  return `${getPlanLabel(account.plan)} renews ${formatShortDate(account.renewalAt)}.`;
}

function getAvatarColor(seedText) {
  const palette = ['#4c7cf7', '#2ea37a', '#b66af5', '#d97a34', '#4b93a8', '#bd5d7a', '#8d74e8', '#3d8b63'];
  const seed = String(seedText || 'forgeai').toUpperCase();
  let total = 0;
  for (let index = 0; index < seed.length; index += 1) {
    total += seed.charCodeAt(index) * (index + 1);
  }
  return palette[total % palette.length];
}

function messagePreview(text) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (!compact) return 'Empty chat';
  if (compact.length <= 64) return compact;
  return `${compact.slice(0, 64).trimEnd()}...`;
}

function generateConversationTitle(message) {
  const compact = String(message || '').replace(/\s+/g, ' ').trim();
  if (!compact) return 'New chat';
  return compact.length > 36 ? `${compact.slice(0, 36).trimEnd()}...` : compact;
}

function buildConversationHistory(conversation, untilIndex = conversation.messages.length) {
  return conversation.messages
    .slice(0, untilIndex)
    .filter((message) => (message.role === 'user' || message.role === 'assistant') && !message.isTyping)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function estimateClientTokenCost(message, history = []) {
  const base = 8;
  const lengthCost = Math.ceil(String(message || '').length / 140);
  const historyCost = Math.min(6, Math.ceil(history.length / 3));
  const providerCost = state.settings.providerMode === 'ollama' ? 0 : state.settings.providerMode === 'groq' ? 3 : 2;
  const modeCost = state.settings.modelMode === 'creative' ? 8 : state.settings.modelMode === 'smart' ? 4 : 0;
  const webCost = 0;
  const assistantCost =
    state.settings.assistantMode === 'code'
      ? 4
      : state.settings.assistantMode === 'prompt'
        ? 3
        : state.settings.assistantMode === 'email'
          ? 2
          : 0;
  const localModelCost =
    state.settings.localModelPreference === 'qwen36'
      ? 5
      : state.settings.localModelPreference === 'gemma4'
        ? 3
        : state.settings.localModelPreference === 'gemma3'
          ? 1
          : state.settings.localModelPreference === 'fallback'
            ? 1
            : 0;
  return Math.max(10, Math.min(36, base + lengthCost + historyCost + providerCost + modeCost + webCost + assistantCost + localModelCost));
}

function showToast(title, body = '', kind = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${kind}`;
  toast.innerHTML = `<strong>${escapeHTML(title)}</strong>${body ? `<small>${escapeHTML(body)}</small>` : ''}`;
  els.toastStack.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 3500);
}

function setStatus(text) {
  state.status = text;
  els.status.textContent = text;
}

function setVoiceStatus(status, detail = '') {
  state.voice.status = status;
  if (els.voiceStatusLine) {
    els.voiceStatusLine.textContent = detail ? `Voice: ${status} - ${detail}` : `Voice: ${status}`;
  }
  if (els.voiceCallState) {
    els.voiceCallState.textContent = status;
  }
  if (detail && els.voiceCallHelp) {
    els.voiceCallHelp.textContent = detail;
  }
}

function setSending(isSending) {
  state.isSending = isSending;
  els.sendButton.disabled = isSending || !state.account;
  els.input.disabled = isSending || !state.account;
}

function openSidebar() {
  document.body.classList.add('sidebar-open');
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
}

function openSettings(tab = state.activeSettingsTab) {
  state.settingsOpen = true;
  state.activeSettingsTab = tab;
  els.settingsOverlay.hidden = false;
  document.body.classList.add('settings-open');
  renderSettingsTabs();
}

function closeSettings() {
  state.settingsOpen = false;
  els.settingsOverlay.hidden = true;
  document.body.classList.remove('settings-open');
}

function setAuthLocked(locked) {
  document.body.classList.toggle('auth-locked', locked);
  els.authOverlay.hidden = !locked;
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.');
    error.payload = data;
    throw error;
  }
  return data;
}

async function refreshHealth() {
  if (STATIC_EXPORT) {
    state.health = {
      ok: true,
      groqConfigured: false,
      ollamaModel: 'Backend required',
      qwen36Model: 'qwen3.6:27b',
      qwen36Available: false,
      fallbackModelAvailable: false,
      ollamaReachable: false,
      ollamaInstalled: false,
      installedModels: [],
      managedModels: [],
      qwenSetupCommand: 'ollama run qwen3.6:27b',
    };
    state.supportLinks = [
      { code: 'support_200', tokens: 200, amountUsd: 5, donationUrl: 'https://paypal.me/AlexanderBatti/5' },
      { code: 'support_400', tokens: 400, amountUsd: 10, donationUrl: 'https://paypal.me/AlexanderBatti/10' },
      { code: 'support_800', tokens: 800, amountUsd: 15, donationUrl: 'https://paypal.me/AlexanderBatti/15' },
      { code: 'support_1200', tokens: 1200, amountUsd: 20, donationUrl: 'https://paypal.me/AlexanderBatti/20' },
      { code: 'support_200000', tokens: 200000, amountUsd: 2000, donationUrl: 'https://paypal.me/AlexanderBatti/2000' },
    ];
    return;
  }

  try {
    const data = await fetchJSON('/api/health');
    state.health = data;
    state.modelInventory = Array.isArray(data.managedModels)
      ? { models: data.managedModels, installedModels: data.installedModels || [] }
      : null;
    state.supportLinks = Array.isArray(data.donationLinks) ? data.donationLinks : [];
  } catch {
    state.health = null;
    state.modelInventory = null;
    state.supportLinks = [];
  }
}

async function refreshAccountFromServer() {
  if (STATIC_EXPORT || !state.account) return;
  const query = new URLSearchParams({
    accountId: state.account.id,
    name: state.account.name,
    email: state.account.email,
    kind: state.account.kind,
  });

  const data = await fetchJSON(`/api/account?${query.toString()}`);
  state.account = normalizeAccount(data.account);
  state.memory = normalizeMemory(data.memory);
  persistAccountState();
}

async function refreshMemory() {
  if (STATIC_EXPORT || !state.account) return;
  const query = new URLSearchParams({
    accountId: state.account.id,
    name: state.account.name,
    email: state.account.email,
    kind: state.account.kind,
  });
  const data = await fetchJSON(`/api/memory?${query.toString()}`);
  state.memory = normalizeMemory(data.memory);
  if (data.account) {
    state.account = normalizeAccount(data.account);
  }
  persistAccountState();
}

async function refreshApiKeys() {
  if (STATIC_EXPORT) {
    state.apiKeys = [];
    return;
  }
  if (!state.account) {
    state.apiKeys = [];
    return;
  }

  const data = await fetchJSON(`/api/developer/keys?accountId=${encodeURIComponent(state.account.id)}`);
  state.apiKeys = Array.isArray(data.keys) ? data.keys : [];
}

function updateAccountAndMemory(account, memory) {
  if (account) {
    state.account = normalizeAccount(account);
  }
  if (memory) {
    state.memory = normalizeMemory(memory);
  }
  persistAccountState();
}

function createMessage(role, content, extra = {}) {
  return {
    id: uid('msg'),
    role,
    content,
    createdAt: new Date().toISOString(),
    isTyping: false,
    provider: null,
    modelUsed: null,
    webUsed: false,
    sources: [],
    error: false,
    prompt: '',
    ...extra,
  };
}

function renderProviderBadge(provider = 'standby') {
  const badge = PROVIDER_BADGES[provider] || PROVIDER_BADGES.standby;
  els.providerBadge.textContent = badge.label;
  els.providerBadge.className = `provider-badge ${badge.className}`.trim();
}

function renderAccount() {
  if (!state.account) {
    els.accountName.textContent = 'Not signed in';
    els.accountEmail.textContent = 'Choose an account to start.';
    els.accountAvatar.textContent = 'F';
    els.accountAvatar.style.background = '#4c7cf7';
    els.accountBadge.hidden = true;
    els.usageText.textContent = '1000 / 1000 tokens';
    els.usageFill.style.width = '0%';
    els.usageCaption.textContent = 'Free plan renews every 2 days.';
    els.settingsName.textContent = 'Not signed in';
    els.settingsEmail.textContent = 'Not signed in';
    els.settingsPlan.textContent = 'Free';
    els.settingsUsage.textContent = '1000 / 1000 tokens';
    return;
  }

  const initials = state.account.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';

  els.accountName.textContent = state.account.name;
  els.accountEmail.textContent =
    state.account.kind === 'guest' ? 'Guest mode on this device' : state.account.email;
  els.accountAvatar.textContent = initials;
  els.accountAvatar.style.background = getAvatarColor(`${state.account.name}|${state.account.email}`);
  els.accountBadge.hidden = normalizePlan(state.account.plan) !== 'pro';

  const usageText = state.account.isUnlimited
    ? 'Unlimited tokens'
    : `${state.account.tokensRemaining} / ${state.account.tokenLimit} tokens`;
  const apiUsageText = state.account.isUnlimited
    ? 'Unlimited API tokens'
    : `${state.account.apiTokensRemaining} / ${state.account.apiTokenLimit} API tokens`;
  els.usageText.textContent = usageText;
  els.settingsName.textContent = state.account.name;
  els.settingsEmail.textContent = state.account.email;
  els.settingsPlan.textContent = getPlanLabel(state.account.plan);
  els.settingsUsage.textContent = `${usageText} | ${apiUsageText}`;
  els.usageCaption.textContent = formatRenewal(state.account);
  if (state.health?.support && els.settingsEmail) {
    // Support info is shown in the Account section markup.
  }

  const usedRatio = state.account.isUnlimited
    ? 0
    : state.account.tokenLimit > 0
      ? Math.max(0, Math.min(1, state.account.tokensUsed / state.account.tokenLimit))
      : 0;
  els.usageFill.style.width = `${usedRatio * 100}%`;
}

function renderHealth() {
  els.healthGroq.textContent = state.health?.groqConfigured ? 'Connected' : 'Missing key';
  if (!state.health?.ollamaReachable) {
    els.healthOllama.textContent = 'Offline';
  } else if (state.health?.qwen36Available) {
    els.healthOllama.textContent = `${state.health.qwen36Model} ready`;
  } else {
    els.healthOllama.textContent = state.health?.ollamaModel ? `${state.health.ollamaModel} ready` : 'Available';
  }
  els.healthLocalModels.textContent = state.health?.ollamaInstalled
    ? `${Array.isArray(state.health?.installedModels) ? state.health.installedModels.length : 0} installed`
    : 'Setup needed';
}

function renderSettingsTabs() {
  els.settingsTabs.forEach((button) => {
    const isActive = button.dataset.settingsTab === state.activeSettingsTab;
    button.classList.toggle('active', isActive);
  });

  els.settingsSections.forEach((section) => {
    section.classList.toggle('active', section.dataset.settingsSection === state.activeSettingsTab);
  });
}

function renderApiKeys() {
  const starterTokens = Number.isFinite(state.health?.apiStarterTokens) ? state.health.apiStarterTokens : 100;
  const walletSummary = !state.account
    ? `${starterTokens} starter API tokens are ready after sign-in.`
    : state.account.isUnlimited
      ? 'Unlimited API token access for this account.'
      : `${state.account.apiTokensRemaining} of ${state.account.apiTokenLimit} API tokens remaining.`;
  const routingSummary = state.settings.providerMode === 'ollama'
    ? 'Requests are set to Ollama only for API and chat responses.'
    : state.settings.providerMode === 'groq'
      ? 'Requests are set to Groq only for API and chat responses.'
      : 'Requests use Groq first and fall back to Ollama automatically.';
  if (els.apiHero) {
    els.apiHero.innerHTML = `
      <div class="overview-card accent">
        <span class="detail-label">Support</span>
        <strong>${escapeHTML(walletSummary)}</strong>
        <p>Use your API key with ForgeAI from the backend. Everything stays tied to your account.</p>
      </div>
      <div class="overview-card">
        <span class="detail-label">Routing</span>
        <strong>${escapeHTML(routingSummary)}</strong>
        <p>Model mode and provider mode carry into the backend API request path.</p>
      </div>
      <div class="overview-card">
        <span class="detail-label">Local AI</span>
        <strong>${escapeHTML(state.health?.ollamaReachable ? 'Ollama is connected and ready.' : 'Ollama needs attention.')}</strong>
        <p>ForgeAI can use local Ollama models directly from the backend on this computer.</p>
      </div>
    `;
  }

  const apiSummary = !state.account
    ? '<div class="list-item"><strong>Starter wallet</strong><p>Sign in to see your API balance, generate a key, and keep usage tied to your account.</p></div>'
    : `<div class="list-item"><strong>Starter wallet</strong><p>${state.account.isUnlimited ? 'Unlimited API tokens' : `${state.account.apiTokensRemaining} / ${state.account.apiTokenLimit} API tokens remaining`}</p><p>${state.apiKeys.length ? 'Active keys are listed below.' : 'Create your first key to start calling the ForgeAI API.'}</p></div>`;
  els.apiKeyList.innerHTML = state.apiKeys
    .reduce((markup, key) => {
      return markup + `
        <div class="list-item">
          <strong>${escapeHTML(key.label || 'API key')}</strong>
          <p>Created ${escapeHTML(formatShortDate(key.createdAt))}</p>
          <p>${key.lastUsedAt ? `Last used ${escapeHTML(formatShortDate(key.lastUsedAt))}` : 'Not used yet'}</p>
        </div>
      `;
    }, apiSummary);
}

function renderMemory() {
  const profile = state.memory.profile;
  els.memoryName.value = profile.name || '';
  els.memoryJob.value = profile.job || '';
  els.memoryLocation.value = profile.location || '';

  els.memoryList.innerHTML = state.memory.notes
    .map((note) => {
      return `
        <div class="list-item">
          <strong>${escapeHTML(note.text)}</strong>
          <div class="inline-actions">
            <span class="muted-copy">${escapeHTML(formatShortDate(note.createdAt))}</span>
            <button class="text-button danger" type="button" data-remove-memory="${note.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderTokenPacks() {
  if (els.supportOverview) {
    const chatAllowance = !state.account
      ? 'Free account: 1000 chat tokens every 2 days.'
      : state.account.isUnlimited
        ? 'Owner account: unlimited chat and API usage.'
        : `${getPlanLabel(state.account.plan)} account: ${state.account.tokensRemaining} / ${state.account.tokenLimit} chat tokens remaining.`;
    const donationNote = 'ForgeAI is fully free. Donations help keep the project running but never unlock special features.';

    els.supportOverview.innerHTML = `
      <div class="overview-card">
        <span class="detail-label">Chat allowance</span>
        <strong>${escapeHTML(chatAllowance)}</strong>
        <p>Chat usage renews automatically based on your plan.</p>
      </div>
      <div class="overview-card accent">
        <span class="detail-label">Support</span>
        <strong>Free access</strong>
        <p>${escapeHTML(donationNote)}</p>
      </div>
    `;
  }
}

function getLatestAssistantMessage() {
  const conversation = getActiveConversation();
  if (!conversation) return null;
  return [...conversation.messages].reverse().find((message) => message.role === 'assistant' && !message.isTyping) || null;
}

function renderChatList() {
  const query = state.searchQuery.trim().toLowerCase();
  const filtered = query
    ? state.conversations.filter((conversation) => {
        const haystack = `${conversation.title} ${conversation.messages.map((message) => message.content).join(' ')}`.toLowerCase();
        return haystack.includes(query);
      })
    : state.conversations;

  els.chatList.innerHTML = filtered
    .map((conversation) => {
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      return `
        <div class="chat-item ${conversation.id === state.activeConversationId ? 'active' : ''}">
          <button type="button" class="chat-main" data-chat-id="${conversation.id}">
            <strong>${escapeHTML(conversation.title)}</strong>
            <p>${escapeHTML(lastMessage ? messagePreview(lastMessage.content) : 'Start a new conversation.')}</p>
            <span class="chat-meta">${escapeHTML(formatShortDate(conversation.updatedAt))}</span>
          </button>
          <button class="icon-button" type="button" data-delete-chat="${conversation.id}" aria-label="Delete chat">
            <svg viewBox="0 0 24 24" fill="none"><use href="#icon-trash"></use></svg>
          </button>
        </div>
      `;
    })
    .join('');
}

function renderIntro() {
  const proLocked = !hasProAccess();
  return `
    <div class="intro-screen">
      <div class="intro-mark">
        <span class="logo-mark" aria-hidden="true">
          <img src="assets/forgeai-logo.png" alt="" />
        </span>
        ForgeAI Nova
      </div>
      <h2>Your AI assistant for writing, coding, learning, and premium local or cloud AI help.</h2>
      <p>
        Nova uses Groq first, falls back to Ollama when needed, keeps chats separated per account on this device,
        and can remember details like your name, role, or preferences inside your own workspace.
      </p>
      <div class="intro-actions">
        <button class="primary-button compact" type="button" data-start-chat>Start chatting</button>
        <button class="secondary-button compact" type="button" data-open-settings-inline>Open settings</button>
      </div>
      <div class="quick-grid">
        <button class="quick-card interactive" type="button" data-assistant-mode-card="email" data-pro-feature="${proLocked ? 'locked' : 'open'}">
          <span class="feature-pill">PRO AI</span>
          <strong>Email Writer</strong>
          <p>Write, rewrite, shorten, or professionalize emails with one focused mode.</p>
        </button>
        <button class="quick-card interactive" type="button" data-assistant-mode-card="code" data-pro-feature="${proLocked ? 'locked' : 'open'}">
          <span class="feature-pill">PRO AI</span>
          <strong>Code Helper</strong>
          <p>Generate code, fix bugs, explain errors, and plan website edits with better technical context.</p>
        </button>
        <button class="quick-card interactive" type="button" data-assistant-mode-card="prompt" data-pro-feature="${proLocked ? 'locked' : 'open'}">
          <span class="feature-pill">PRO AI</span>
          <strong>Prompt Builder</strong>
          <p>Create sharper prompts for websites, apps, coding tools, image systems, and AI assistants.</p>
        </button>
        <button class="quick-card interactive" type="button" data-open-voice-call-inline data-pro-feature="${proLocked ? 'locked' : 'open'}">
          <span class="feature-pill">VOICE</span>
          <strong>Voice Chat</strong>
          <p>Talk naturally, see live captions, and hear Nova answer back with your saved voice style.</p>
        </button>
        <div class="quick-card">
          <strong>Chat</strong>
          <p>Clean conversation view, copy, regenerate, chat history, and auto-save.</p>
        </div>
        <div class="quick-card">
          <strong>Memory</strong>
          <p>Save facts per account so Nova remembers names, jobs, locations, and preferences.</p>
        </div>
        <div class="quick-card">
          <strong>Developer access</strong>
          <p>Create API keys and manage support from one settings area instead of hunting through the UI.</p>
        </div>
      </div>
    </div>
  `;
}

function renderMessages(conversation) {
  return conversation.messages
    .map((message) => {
      const isUser = message.role === 'user';
      const providerLine = !isUser && !message.isTyping
        ? `
            <div class="message-meta">
              ${message.provider === 'error' ? 'Answered by Error' : `Answered by ${escapeHTML(PROVIDER_BADGES[message.provider || 'standby']?.label || 'ForgeAI')}`}
            </div>
          `
        : '';

      return `
        <article class="message ${message.role}">
          <div class="bubble">
            <div class="message-header">
              <div class="message-title">
                <span class="message-avatar">${isUser ? 'Y' : 'N'}</span>
                <span>${isUser ? 'You' : 'Nova'}</span>
              </div>
              <span class="message-time">${escapeHTML(formatTime(message.createdAt))}</span>
            </div>

            ${
              message.isTyping
                ? '<div class="typing"><span></span><span></span><span></span></div>'
                : `<div class="message-content">${isUser ? `<p>${escapeHTML(message.content).replace(/\n/g, '<br>')}</p>` : renderMarkdown(message.content)}</div>`
            }

            ${
              !isUser && !message.isTyping
                ? `
                  <div class="message-actions">
                    <button type="button" class="message-action" data-copy-message="${message.id}">
                      <svg viewBox="0 0 24 24" fill="none"><use href="#icon-copy"></use></svg>
                      Copy
                    </button>
                    <button type="button" class="message-action" data-regenerate-message="${message.id}">
                      <svg viewBox="0 0 24 24" fill="none"><use href="#icon-refresh"></use></svg>
                      Regenerate
                    </button>
                  </div>
                  ${providerLine}
                `
                : ''
            }
          </div>
        </article>
      `;
    })
    .join('');
}

function renderThread() {
  const conversation = getActiveConversation();
  if (!conversation || conversation.messages.length === 0) {
    els.thread.innerHTML = renderIntro();
    els.activeTitle.textContent = 'New chat';
    renderProviderBadge('standby');
    return;
  }

  els.activeTitle.textContent = conversation.title || 'New chat';
  els.thread.innerHTML = renderMessages(conversation);
  const latest = getLatestAssistantMessage();
  renderProviderBadge(latest?.provider || 'standby');
}

function renderControls() {
  els.providerMode.value = state.settings.providerMode;
  if (els.modelPreference) els.modelPreference.value = state.settings.localModelPreference;
  if (els.modelPreferenceToolbar) els.modelPreferenceToolbar.value = state.settings.localModelPreference;
  if (els.assistantMode) els.assistantMode.value = state.settings.assistantMode;
  if (els.voiceStyle) els.voiceStyle.value = state.settings.voiceStyle;
  if (els.voiceStyleToolbar) els.voiceStyleToolbar.value = state.settings.voiceStyle;
  els.modelButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.modelMode === state.settings.modelMode);
  });
  els.assistantModeCards.forEach((button) => {
    button.classList.toggle('active', button.dataset.assistantModeCard === state.settings.assistantMode);
  });

  if (els.modelHelp) {
    if (state.settings.localModelPreference === 'qwen36') {
      els.modelHelp.textContent = state.health?.qwen36Available
        ? `Qwen 3.6 is available locally through Ollama as ${state.health.qwen36Model}.`
        : `Qwen 3.6 is not installed locally yet. Run "${state.health?.qwenSetupCommand || 'ollama run qwen3.6:27b'}" in PowerShell, then try again.`;
    } else if (state.settings.localModelPreference === 'gemma4') {
      els.modelHelp.textContent = 'Gemma4 uses Ollama locally when it is installed on this computer.';
    } else if (state.settings.localModelPreference === 'gemma3') {
      els.modelHelp.textContent = 'Gemma3 4B is the lighter local option for faster responses on weaker computers.';
    } else if (state.settings.localModelPreference === 'fallback') {
      els.modelHelp.textContent = `Qwen3 4B uses your local Ollama model: ${state.health?.ollamaModel || 'local model'}.`;
    } else {
      els.modelHelp.textContent = 'Auto mode uses Groq first, then Qwen3.6 27B, Gemma4, Qwen3 4B, and Gemma3 4B when they are available locally.';
    }
  }

  if (els.voiceMuteButton) {
    els.voiceMuteButton.textContent = state.voice.micMuted ? 'Unmute mic' : 'Mute mic';
  }
  if (els.voiceUserCaption) {
    els.voiceUserCaption.textContent = state.voice.userCaption;
  }
  if (els.voiceAiCaption) {
    els.voiceAiCaption.textContent = state.voice.aiCaption;
  }
}

function isOwnerAccount() {
  return Boolean(
    state.account &&
      (state.account.role === 'owner' || String(state.account.email || '').trim().toLowerCase() === 'thisisalexanderbatti@gmail.com')
  );
}

function renderModelManager() {
  if (!els.localModelsPanel || !els.modelsGrid) return;

  const canSee = isOwnerAccount();
  els.localModelsPanel.hidden = !canSee;
  if (!canSee) return;

  const models = Array.isArray(state.modelInventory?.models)
    ? state.modelInventory.models
    : Array.isArray(state.health?.managedModels)
      ? state.health.managedModels
      : [];

  if (els.modelsSetupMessage) {
    els.modelsSetupMessage.textContent =
      state.modelInventory?.error ||
      'To use local AI models, install Ollama first. Then open PowerShell and run the model download command. After the download finishes, refresh this page and click Check Installed Models.';
  }

  els.modelsGrid.innerHTML = models
    .map(
      (model) => `
        <div class="model-card">
          <div class="model-card-head">
            <div>
              <strong>${escapeHTML(model.label)}</strong>
              <p>${escapeHTML(model.model)}</p>
            </div>
            <span class="model-status ${model.installed ? 'ready' : 'missing'}">${model.installed ? 'Installed' : 'Not installed'}</span>
          </div>
          <div class="inline-actions wrap">
            <button class="secondary-button compact" type="button" data-model-action="${model.key}-pull">Download</button>
            <button class="secondary-button compact" type="button" data-model-action="${model.key}-run">Test Model</button>
            <button class="text-button danger" type="button" data-model-action="${model.key}-rm">Remove Model</button>
          </div>
          <div class="model-command-row">
            <code>${escapeHTML(model.pullCommand)}</code>
            <button class="message-action" type="button" data-copy-command="${escapeHTML(model.pullCommand)}">Copy</button>
          </div>
          <div class="model-command-row">
            <code>${escapeHTML(model.runCommand)}</code>
            <button class="message-action" type="button" data-copy-command="${escapeHTML(model.runCommand)}">Copy</button>
          </div>
        </div>
      `
    )
    .join('');
}

function renderAll() {
  renderAccount();
  renderHealth();
  renderChatList();
  renderThread();
  renderControls();
  renderModelManager();
  renderApiKeys();
  renderMemory();
  renderTokenPacks();
  renderSettingsTabs();
  els.status.textContent = state.status;
  requestAnimationFrame(() => {
    els.thread.scrollTop = els.thread.scrollHeight;
  });
}

function focusComposer() {
  window.setTimeout(() => {
    if (!els.input.disabled) {
      els.input.focus();
    }
  }, 30);
}

function resizeComposer() {
  els.input.style.height = 'auto';
  els.input.style.height = `${Math.min(els.input.scrollHeight, 220)}px`;
}

function sortConversations() {
  state.conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function createNewChat() {
  const conversation = createConversation();
  state.conversations.unshift(conversation);
  state.activeConversationId = conversation.id;
  persistAccountState();
  renderAll();
  closeSidebar();
  focusComposer();
}

function clearAllChats() {
  state.conversations = [createConversation()];
  state.activeConversationId = state.conversations[0].id;
  persistAccountState();
  renderAll();
  showToast('Chats cleared', 'This account now has a fresh workspace.');
}

function deleteChat(chatId) {
  state.conversations = state.conversations.filter((conversation) => conversation.id !== chatId);
  if (state.conversations.length === 0) {
    state.conversations = [createConversation()];
  }
  if (!state.conversations.some((conversation) => conversation.id === state.activeConversationId)) {
    state.activeConversationId = state.conversations[0].id;
  }
  persistAccountState();
  renderAll();
}

function setActiveConversation(chatId) {
  if (!state.conversations.some((conversation) => conversation.id === chatId)) return;
  state.activeConversationId = chatId;
  persistAccountState();
  renderAll();
  closeSidebar();
}

async function signInAccount(account) {
  setCurrentAccount(account);
  loadAccountWorkspace();
  try {
    await refreshAccountFromServer();
    await Promise.all([refreshMemory(), refreshApiKeys()]);
    await refreshModelInventory();
  } catch {
    // Static Pages builds and offline sessions keep a local-only account.
    state.memory = normalizeMemory({});
    state.apiKeys = [];
  }
  setAuthLocked(false);
  setSending(false);
  setStatus('Signed in and ready.');
  renderAll();
  focusComposer();
}

function signOutAccount() {
  stopRecognition();
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  closeVoiceCall();
  setCurrentAccount(null);
  state.memory = normalizeMemory({});
  state.apiKeys = [];
  state.conversations = [];
  state.activeConversationId = null;
  closeSettings();
  setAuthLocked(true);
  renderAll();
  els.authName.focus();
}

async function createApiKey() {
  if (STATIC_EXPORT) {
    throw new Error('API keys are disabled in the GitHub Pages preview. Run the full backend to create keys.');
  }
  if (!state.account) return;
  const data = await fetchJSON('/api/developer/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account: state.account,
      label: `Nova key ${new Date().toLocaleDateString()}`,
    }),
  });

  updateAccountAndMemory(data.account, data.memory);
  els.apiKeyOutput.hidden = false;
  els.apiKeyOutput.textContent = `New API key: ${data.apiKey}`;
  await refreshApiKeys();
  renderAll();
  showToast('API key created', 'Copy it now. It will not be shown again.');
}

async function saveProfileMemory() {
  if (!state.account) return;
  if (STATIC_EXPORT) {
    state.memory.profile = {
      name: els.memoryName.value.trim(),
      job: els.memoryJob.value.trim(),
      location: els.memoryLocation.value.trim(),
    };
    persistAccountState();
    renderAll();
    showToast('Memory saved', 'Saved locally in the static preview.');
    return;
  }
  const data = await fetchJSON('/api/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account: state.account,
      profile: {
        name: els.memoryName.value.trim(),
        job: els.memoryJob.value.trim(),
        location: els.memoryLocation.value.trim(),
      },
    }),
  });
  updateAccountAndMemory(data.account, data.memory);
  renderAll();
  showToast('Memory saved', 'Profile memory updated for this account.');
}

async function saveMemoryNote() {
  if (!state.account) return;
  const note = els.memoryNote.value.trim();
  if (!note) {
    showToast('Missing note', 'Type a memory note before saving.', 'error');
    return;
  }
  if (STATIC_EXPORT) {
    state.memory.notes.unshift({
      id: uid('mem'),
      text: note,
      createdAt: new Date().toISOString(),
    });
    els.memoryNote.value = '';
    persistAccountState();
    renderAll();
    showToast('Memory saved', 'Saved locally in the static preview.');
    return;
  }
  const data = await fetchJSON('/api/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account: state.account,
      note,
    }),
  });
  els.memoryNote.value = '';
  updateAccountAndMemory(data.account, data.memory);
  renderAll();
  showToast('Memory saved', 'Nova will remember that note for this account.');
}

async function removeMemoryNote(noteId) {
  if (!state.account) return;
  if (STATIC_EXPORT) {
    state.memory.notes = state.memory.notes.filter((note) => note.id !== noteId);
    persistAccountState();
    renderAll();
    return;
  }
  const data = await fetchJSON('/api/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account: state.account,
      removeNoteId: noteId,
    }),
  });
  updateAccountAndMemory(data.account, data.memory);
  renderAll();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const fallback = document.createElement('textarea');
  fallback.value = text;
  document.body.appendChild(fallback);
  fallback.select();
  document.execCommand('copy');
  fallback.remove();
}

function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function closeVoiceCall() {
  state.voice.callOpen = false;
  if (els.voiceOverlay) {
    els.voiceOverlay.hidden = true;
  }
  document.body.classList.remove('voice-open');
}

function openVoiceCall() {
  if (!state.account) {
    showToast('Sign in required', 'Sign in before starting a voice call.', 'error');
    return;
  }
  state.voice.callOpen = true;
  state.voice.userCaption = state.voice.userCaption || 'Waiting for your microphone.';
  state.voice.aiCaption = state.voice.aiCaption || 'Spoken replies will appear here.';
  if (els.voiceOverlay) {
    els.voiceOverlay.hidden = false;
  }
  document.body.classList.add('voice-open');
  renderControls();
  setVoiceStatus('Ready', 'Start listening when you want to speak with Nova.');
}

function stopRecognition() {
  if (state.voice.recognition) {
    try {
      state.voice.recognition.stop();
    } catch {}
  }
  state.voice.recognitionActive = false;
}

function pickSpeechVoice(style) {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (!voices.length) return null;

  const styleMatchers = {
    calm: ['aria', 'sara', 'serena', 'libby', 'jenny'],
    professional: ['guy', 'davis', 'daniel', 'microsoft david', 'google us english'],
    friendly: ['jenny', 'aria', 'samantha', 'alloy', 'ava'],
    deep: ['guy', 'davis', 'alex', 'roger'],
    fast: ['aria', 'guy', 'jenny'],
    slow: ['sara', 'serena', 'libby'],
  };

  const terms = styleMatchers[style] || styleMatchers.friendly;
  return (
    voices.find((voice) => terms.some((term) => voice.name.toLowerCase().includes(term))) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ||
    voices[0]
  );
}

function speakReply(text, options = {}) {
  if (!window.speechSynthesis || !text) return Promise.resolve();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const selectedVoice = pickSpeechVoice(state.settings.voiceStyle);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  const style = state.settings.voiceStyle;
  utterance.rate = style === 'fast' ? 1.2 : style === 'slow' ? 0.88 : 1;
  utterance.pitch = style === 'deep' ? 0.8 : style === 'friendly' ? 1.08 : 1;

  return new Promise((resolve) => {
    utterance.onend = () => {
      if (options.resumeCall && state.voice.callOpen && !state.voice.micMuted) {
        window.setTimeout(() => {
          startVoiceCapture('call');
        }, 250);
      }
      resolve();
    };
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

function createRecognitionInstance(purpose) {
  const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
  if (!SpeechRecognitionCtor) {
    throw new Error('Speech recognition is not supported in this browser.');
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = purpose === 'call';

  recognition.onstart = () => {
    state.voice.recognitionActive = true;
    state.voice.recognitionPurpose = purpose;
    setVoiceStatus('Listening', purpose === 'call' ? 'Voice call is listening for your next message.' : 'Speak clearly and Nova will transcribe your words.');
    renderControls();
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript;
    }
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) return;

    if (purpose === 'call') {
      state.voice.userCaption = cleanTranscript;
    } else {
      els.input.value = cleanTranscript;
      resizeComposer();
    }

    const finalResult = event.results[event.results.length - 1];
    if (finalResult?.isFinal) {
      if (purpose === 'call') {
        stopRecognition();
        sendMessage(cleanTranscript, { fromVoiceCall: true });
      } else {
        setVoiceStatus('Ready', 'Transcript added to the message box. You can edit it before sending.');
      }
      renderControls();
    }
  };

  recognition.onerror = (event) => {
    state.voice.recognitionActive = false;
    const message =
      event.error === 'not-allowed'
        ? 'Microphone permission was denied.'
        : event.error === 'no-speech'
          ? 'No speech was detected.'
          : 'Voice capture failed.';
    setVoiceStatus('Error', message);
    showToast('Voice error', message, 'error');
    renderControls();
  };

  recognition.onend = () => {
    state.voice.recognitionActive = false;
    if (purpose !== 'call') {
      renderControls();
    }
  };

  return recognition;
}

function startVoiceCapture(purpose = 'composer') {
  if (!state.account) {
    showToast('Sign in required', 'Sign in before using voice tools.', 'error');
    return;
  }
  if (state.voice.recognitionActive) {
    stopRecognition();
    setVoiceStatus('Ready', 'Voice capture stopped.');
    renderControls();
    return;
  }
  if (purpose === 'call' && state.voice.micMuted) {
    setVoiceStatus('Ready', 'Unmute your microphone to keep talking.');
    renderControls();
    return;
  }

  try {
    state.voice.recognition = createRecognitionInstance(purpose);
    setVoiceStatus('Processing', 'Preparing your microphone.');
    state.voice.recognition.start();
  } catch (error) {
    setVoiceStatus('Error', error.message || 'Voice capture is unavailable.');
    showToast('Voice unavailable', error.message || 'Voice capture is unavailable.', 'error');
    renderControls();
  }
}

async function sendToBackend(message, history) {
  if (STATIC_EXPORT) {
    return {
      reply:
        'This GitHub Pages build is a static preview of ForgeAI Nova. Run the full Node backend locally or deploy the server to use Groq, Ollama fallback, memory sync, and full AI chat.',
      provider: 'error',
      modelUsed: null,
      webUsed: false,
      sources: [],
      error: true,
      usageCost: 0,
      account: state.account,
      memory: state.memory,
    };
  }

  return fetchJSON('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      modelMode: state.settings.modelMode,
      providerMode: state.settings.providerMode,
      assistantMode: state.settings.assistantMode,
      localModelPreference: state.settings.localModelPreference,
      account: state.account,
    }),
  });
}

async function refreshModelInventory() {
  if (STATIC_EXPORT || !state.account || !isOwnerAccount()) return;
  try {
    const query = new URLSearchParams({
      accountId: state.account.id,
      name: state.account.name,
      email: state.account.email,
      kind: state.account.kind,
    });
    const data = await fetchJSON(`/api/admin/models?${query.toString()}`);
    state.modelInventory = data.inventory || null;
    renderAll();
  } catch (error) {
    showToast('Model check failed', error.message, 'error');
  }
}

async function handleModelAction(actionKey) {
  if (!state.account || !isOwnerAccount()) {
    showToast('Admin only', 'Only the owner account can manage local models.', 'error');
    return;
  }

  try {
    const data = await fetchJSON('/api/admin/models/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionKey,
        account: state.account,
      }),
    });
    state.modelInventory = data.inventory || state.modelInventory;
    renderAll();
    const message = data.output?.reply || data.output?.label || 'Local model action finished.';
    showToast('Model action complete', message);
  } catch (error) {
    showToast('Model action failed', error.message, 'error');
  }
}

async function sendMessage(message, options = {}) {
  const conversation = getActiveConversation();
  if (!conversation || !state.account || state.isSending) return;

  const trimmed = String(message || '').trim();
  if (!trimmed) {
    showToast('Empty message', 'Type something before sending.', 'error');
    return;
  }

  const history = options.history || buildConversationHistory(conversation);
  const estimatedCost = estimateClientTokenCost(trimmed, history);

  if (!state.account.isUnlimited && state.account.tokensRemaining < estimatedCost) {
    setStatus('No tokens left for this message.');
    renderAll();
    showToast('Usage limit reached', `This account has ${state.account.tokensRemaining} tokens left.`, 'error');
    return;
  }

  setSending(true);
  setStatus(`Nova is thinking... about ${estimatedCost} tokens in ${ASSISTANT_MODE_LABELS[state.settings.assistantMode]}.`);
  if (options.fromVoiceCall) {
    state.voice.aiCaption = 'Nova is thinking...';
    setVoiceStatus('Processing', 'Nova is preparing a spoken reply.');
    renderControls();
  }

  let assistantMessage;

  if (options.regenerateMessageId) {
    assistantMessage = conversation.messages.find((item) => item.id === options.regenerateMessageId);
    if (!assistantMessage) {
      setSending(false);
      return;
    }
    assistantMessage.isTyping = true;
    assistantMessage.content = '';
    assistantMessage.provider = null;
    assistantMessage.error = false;
  } else {
    const userMessage = createMessage('user', trimmed);
    conversation.messages.push(userMessage);
    if (conversation.messages.length === 1) {
      conversation.title = generateConversationTitle(trimmed);
    }
    assistantMessage = createMessage('assistant', '', {
      isTyping: true,
      prompt: trimmed,
    });
    conversation.messages.push(assistantMessage);
  }

  conversation.updatedAt = new Date().toISOString();
  sortConversations();
  persistAccountState();
  renderAll();

  try {
    const result = await sendToBackend(trimmed, history);
    updateAccountAndMemory(result.account, result.memory);

    assistantMessage.isTyping = false;
    assistantMessage.content = result.reply;
    assistantMessage.provider = result.provider || 'error';
    assistantMessage.modelUsed = result.modelUsed || null;
    assistantMessage.webUsed = Boolean(result.webUsed);
    assistantMessage.sources = Array.isArray(result.sources) ? result.sources : [];
    assistantMessage.error = Boolean(result.error);
    assistantMessage.prompt = trimmed;

    conversation.updatedAt = new Date().toISOString();
    sortConversations();
    persistAccountState();

    const providerLabel = PROVIDER_BADGES[result.provider || 'error']?.label || 'ForgeAI';
    setStatus(
      result.usageCost
        ? `${providerLabel} answered. ${result.usageCost} tokens used.`
        : `${providerLabel} answered.`
    );
    if (options.fromVoiceCall) {
      state.voice.aiCaption = result.reply;
      setVoiceStatus('Ready', `${providerLabel} answered. Spoken reply is playing.`);
      renderControls();
      await speakReply(result.reply, { resumeCall: true });
    }

    renderAll();
    if (result.error) {
      showToast('Provider issue', result.reply, 'error');
    }
  } catch (error) {
    if (error.payload?.account) {
      updateAccountAndMemory(error.payload.account, error.payload.memory);
    }

    assistantMessage.isTyping = false;
    assistantMessage.content = error.message || 'ForgeAI could not generate a response.';
    assistantMessage.provider = 'error';
    assistantMessage.error = true;
    assistantMessage.webUsed = false;
    assistantMessage.sources = [];
    assistantMessage.prompt = trimmed;

    conversation.updatedAt = new Date().toISOString();
    persistAccountState();
    setStatus('Answer failed. See the latest message.');
    if (options.fromVoiceCall) {
      state.voice.aiCaption = assistantMessage.content;
      setVoiceStatus('Error', assistantMessage.content);
    }
    renderAll();
    showToast('Request failed', error.message || 'Something went wrong.', 'error');
  } finally {
    setSending(false);
  }
}

async function regenerateMessage(messageId) {
  const conversation = getActiveConversation();
  if (!conversation) return;

  const index = conversation.messages.findIndex((message) => message.id === messageId && message.role === 'assistant');
  if (index <= 0) {
    showToast('Regenerate unavailable', 'There is no user prompt tied to that answer.', 'error');
    return;
  }

  const assistantMessage = conversation.messages[index];
  const linkedPrompt = assistantMessage.prompt || conversation.messages[index - 1]?.content || '';
  if (!linkedPrompt) {
    showToast('Regenerate unavailable', 'That answer does not have enough context.', 'error');
    return;
  }

  const history = buildConversationHistory(conversation, index - 1);
  await sendMessage(linkedPrompt, {
    regenerateMessageId: messageId,
    history,
  });
}

function bindEvents() {
  els.authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = els.authName.value.trim();
    const email = els.authEmail.value.trim().toLowerCase();

    if (!name || !email) {
      showToast('Missing details', 'Enter both your name and email.', 'error');
      return;
    }

    try {
      await signInAccount(createLocalAccount(name, email));
    } catch (error) {
      showToast('Sign in failed', error.message, 'error');
    }
  });

  els.authGuest.addEventListener('click', async () => {
    try {
      await signInAccount(createGuestAccount());
    } catch (error) {
      showToast('Guest mode failed', error.message, 'error');
    }
  });

  els.chatSearch.addEventListener('input', () => {
    state.searchQuery = els.chatSearch.value;
    renderChatList();
  });

  els.newChatButtons.forEach((button) => {
    button.addEventListener('click', createNewChat);
  });

  els.clearChatsButton.addEventListener('click', clearAllChats);

  els.chatList.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-chat-id]');
    const deleteButton = event.target.closest('[data-delete-chat]');
    if (deleteButton) {
      deleteChat(deleteButton.dataset.deleteChat);
      return;
    }
    if (openButton) {
      setActiveConversation(openButton.dataset.chatId);
    }
  });

  els.composer.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = els.input.value;
    els.input.value = '';
    resizeComposer();
    await sendMessage(message);
  });

  els.input.addEventListener('input', resizeComposer);
  els.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      els.composer.requestSubmit();
    }
  });

  els.thread.addEventListener('click', async (event) => {
    const startChat = event.target.closest('[data-start-chat]');
    const openSettingsInline = event.target.closest('[data-open-settings-inline]');
    const openVoiceCallInline = event.target.closest('[data-open-voice-call-inline]');
    const modeCard = event.target.closest('[data-assistant-mode-card]');
    const copyButton = event.target.closest('[data-copy-message]');
    const regenerateButton = event.target.closest('[data-regenerate-message]');

    if (startChat) {
      focusComposer();
      return;
    }

    if (openSettingsInline) {
      openSettings('ai');
      return;
    }

    if (openVoiceCallInline) {
      openVoiceCall();
      return;
    }

    if (modeCard) {
      state.settings.assistantMode = normalizeAssistantMode(modeCard.dataset.assistantModeCard);
      persistAccountState();
      renderControls();
      focusComposer();
      showToast('Mode updated', `${ASSISTANT_MODE_LABELS[state.settings.assistantMode]} is active.`);
      return;
    }

    if (copyButton) {
      const conversation = getActiveConversation();
      const message = conversation?.messages.find((item) => item.id === copyButton.dataset.copyMessage);
      if (!message) return;
      try {
        await copyText(message.content);
        showToast('Copied', 'Answer copied to your clipboard.');
      } catch {
        showToast('Copy failed', 'Clipboard access was blocked.', 'error');
      }
      return;
    }

    if (regenerateButton) {
      await regenerateMessage(regenerateButton.dataset.regenerateMessage);
      return;
    }

  });

  els.openSidebarButtons.forEach((button) => {
    button.addEventListener('click', openSidebar);
  });

  els.closeSidebarButtons.forEach((button) => {
    button.addEventListener('click', closeSidebar);
  });
  els.sidebarBackdrop.addEventListener('click', closeSidebar);

  els.openSettingsButtons.forEach((button) => {
    button.addEventListener('click', () => openSettings('account'));
  });
  els.closeSettingsButton.addEventListener('click', closeSettings);

  els.settingsTabs.forEach((button) => {
    button.addEventListener('click', () => {
      state.activeSettingsTab = button.dataset.settingsTab;
      renderSettingsTabs();
    });
  });

  els.switchAccountButtons.forEach((button) => {
    button.addEventListener('click', () => {
      closeSettings();
      setAuthLocked(true);
      els.authName.focus();
    });
  });

  els.signOutButton.addEventListener('click', signOutAccount);

  els.providerMode.addEventListener('change', () => {
    state.settings.providerMode = els.providerMode.value;
    persistAccountState();
    renderControls();
    showToast('Provider updated', 'AI provider mode changed.');
  });

  els.modelPreference?.addEventListener('change', () => {
    state.settings.localModelPreference = normalizeLocalModelPreference(els.modelPreference.value);
    persistAccountState();
    renderControls();
    showToast('Model updated', `Selected ${els.modelPreference.options[els.modelPreference.selectedIndex].text}.`);
  });

  els.modelPreferenceToolbar?.addEventListener('change', () => {
    state.settings.localModelPreference = normalizeLocalModelPreference(els.modelPreferenceToolbar.value);
    persistAccountState();
    renderControls();
    showToast('Model updated', `Selected ${els.modelPreferenceToolbar.options[els.modelPreferenceToolbar.selectedIndex].text}.`);
  });

  els.assistantMode?.addEventListener('change', () => {
    state.settings.assistantMode = normalizeAssistantMode(els.assistantMode.value);
    persistAccountState();
    renderControls();
    showToast('Assistant mode updated', `${ASSISTANT_MODE_LABELS[state.settings.assistantMode]} is active.`);
  });

  els.modelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.settings.modelMode = button.dataset.modelMode;
      persistAccountState();
      renderControls();
      showToast('Mode updated', 'Nova intelligence level changed.');
    });
  });

  els.voiceStyle?.addEventListener('change', () => {
    state.settings.voiceStyle = normalizeVoiceStyle(els.voiceStyle.value);
    persistAccountState();
    renderControls();
    showToast('Voice updated', `${VOICE_STYLE_LABELS[state.settings.voiceStyle]} voice selected.`);
  });

  els.voiceStyleToolbar?.addEventListener('change', () => {
    state.settings.voiceStyle = normalizeVoiceStyle(els.voiceStyleToolbar.value);
    persistAccountState();
    renderControls();
    showToast('Voice updated', `${VOICE_STYLE_LABELS[state.settings.voiceStyle]} voice selected.`);
  });

  els.createApiKeyButton.addEventListener('click', async () => {
    try {
      await createApiKey();
    } catch (error) {
      showToast('API key failed', error.message, 'error');
    }
  });

  els.openSupportTabButton?.addEventListener('click', () => {
    openSettings('donations');
  });

  els.checkModelsButton?.addEventListener('click', async () => {
    await refreshModelInventory();
    showToast('Models refreshed', 'Local model status has been updated.');
  });

  els.modelsGrid?.addEventListener('click', async (event) => {
    const copyCommandButton = event.target.closest('[data-copy-command]');
    const modelActionButton = event.target.closest('[data-model-action]');

    if (copyCommandButton) {
      try {
        await copyText(copyCommandButton.dataset.copyCommand || '');
        showToast('Command copied', 'PowerShell command copied to your clipboard.');
      } catch {
        showToast('Copy failed', 'Clipboard access was blocked.', 'error');
      }
      return;
    }

    if (modelActionButton) {
      await handleModelAction(modelActionButton.dataset.modelAction);
    }
  });

  els.micToggleButton?.addEventListener('click', () => {
    startVoiceCapture('composer');
  });

  els.openVoiceCallButtons.forEach((button) => {
    button.addEventListener('click', () => {
      openVoiceCall();
    });
  });

  els.closeVoiceCallButton?.addEventListener('click', () => {
    stopRecognition();
    closeVoiceCall();
    setVoiceStatus('Ready', 'Voice call closed.');
  });

  els.voiceListenButton?.addEventListener('click', () => {
    startVoiceCapture('call');
  });

  els.voiceMuteButton?.addEventListener('click', () => {
    state.voice.micMuted = !state.voice.micMuted;
    if (state.voice.micMuted) {
      stopRecognition();
      setVoiceStatus('Ready', 'Microphone muted for the current call.');
    } else {
      setVoiceStatus('Ready', 'Microphone unmuted. Start listening when ready.');
    }
    renderControls();
  });

  els.voiceStopButton?.addEventListener('click', () => {
    stopRecognition();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    closeVoiceCall();
    setVoiceStatus('Ready', 'Voice call ended.');
    renderControls();
  });

  els.memoryProfileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await saveProfileMemory();
    } catch (error) {
      showToast('Memory failed', error.message, 'error');
    }
  });

  els.memoryNoteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await saveMemoryNote();
    } catch (error) {
      showToast('Memory failed', error.message, 'error');
    }
  });

  els.memoryList.addEventListener('click', async (event) => {
    const removeButton = event.target.closest('[data-remove-memory]');
    if (!removeButton) return;
    try {
      await removeMemoryNote(removeButton.dataset.removeMemory);
    } catch (error) {
      showToast('Delete failed', error.message, 'error');
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      stopRecognition();
      closeSidebar();
      closeSettings();
      closeVoiceCall();
    }
  });
}

async function init() {
  setSending(true);
  setAuthLocked(true);
  bindEvents();
  resizeComposer();

  await refreshHealth();

  const existingAccount = getCurrentAccount();
  if (existingAccount) {
    setCurrentAccount(existingAccount);
    loadAccountWorkspace();
    try {
      await refreshAccountFromServer();
      await Promise.all([refreshMemory(), refreshApiKeys()]);
      await refreshModelInventory();
      setAuthLocked(false);
      setStatus('Welcome back.');
    } catch (error) {
      showToast('Session refresh failed', error.message, 'error');
      signOutAccount();
      return;
    }
  } else {
    state.apiKeys = [];
    state.memory = normalizeMemory({});
    state.conversations = [];
    state.activeConversationId = null;
    setStatus('Sign in to start chatting.');
  }

  renderAll();
  setSending(false);

  if (state.account) {
    focusComposer();
  } else {
    els.authName.focus();
  }
}

init();
