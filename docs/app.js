const CURRENT_ACCOUNT_KEY = 'forgeai.currentAccount.v2';
const DEVICE_ID_KEY = 'forgeai.deviceId.v1';
const STATIC_EXPORT = Boolean(window.FORGEAI_STATIC_EXPORT);
const PROVIDER_BADGES = {
  standby: { label: 'Waiting', className: '' },
  groq: { label: 'Groq', className: 'groq' },
  ollama: { label: 'Ollama Local', className: 'ollama' },
  error: { label: 'Error', className: 'error' },
};

const state = {
  health: null,
  account: null,
  memory: {
    profile: { name: '', job: '', location: '' },
    notes: [],
  },
  settings: {
    providerMode: 'auto',
    modelMode: 'smart',
    webMode: false,
  },
  conversations: [],
  activeConversationId: null,
  apiKeys: [],
  tokenPacks: [],
  searchQuery: '',
  status: 'Ready when you are.',
  isSending: false,
  settingsOpen: false,
  activeSettingsTab: 'account',
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
  modelButtons: document.querySelectorAll('[data-model-mode]'),
  webToggle: document.querySelector('[data-web-toggle]'),
  settingsName: document.querySelector('[data-settings-name]'),
  settingsEmail: document.querySelector('[data-settings-email]'),
  settingsPlan: document.querySelector('[data-settings-plan]'),
  settingsUsage: document.querySelector('[data-settings-usage]'),
  healthGroq: document.querySelector('[data-health-groq]'),
  healthOllama: document.querySelector('[data-health-ollama]'),
  healthTavily: document.querySelector('[data-health-tavily]'),
  createApiKeyButton: document.querySelector('[data-create-api-key]'),
  apiKeyOutput: document.querySelector('[data-api-key-output]'),
  apiKeyList: document.querySelector('[data-api-key-list]'),
  memoryProfileForm: document.querySelector('[data-memory-profile-form]'),
  memoryName: document.querySelector('[data-memory-name]'),
  memoryJob: document.querySelector('[data-memory-job]'),
  memoryLocation: document.querySelector('[data-memory-location]'),
  memoryNoteForm: document.querySelector('[data-memory-note-form]'),
  memoryNote: document.querySelector('[data-memory-note]'),
  memoryList: document.querySelector('[data-memory-list]'),
  packGrid: document.querySelector('[data-pack-grid]'),
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

function getPlanLabel(plan) {
  const normalized = normalizePlan(plan);
  if (normalized === 'owner') return 'Owner';
  if (normalized === 'pro') return 'AI Pro';
  return 'Free';
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

  return {
    id: String(account.id || '').trim(),
    kind: ['local', 'guest', 'google'].includes(account.kind) ? account.kind : 'local',
    name: String(account.name || 'ForgeAI User').trim(),
    email: String(account.email || 'user@example.com').trim(),
    plan: normalizePlan(account.plan),
    role: account.role === 'owner' ? 'owner' : 'member',
    isUnlimited: account.isUnlimited === true,
    tokenLimit: Number.isFinite(account.tokenLimit) ? account.tokenLimit : 200,
    tokensUsed: Number.isFinite(account.tokensUsed) ? account.tokensUsed : 0,
    tokensRemaining: Number.isFinite(account.tokensRemaining)
      ? account.tokensRemaining
      : Math.max(0, (Number(account.tokenLimit) || 200) - (Number(account.tokensUsed) || 0)),
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
    webMode: Boolean(savedSettings.webMode),
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
  const webCost = state.settings.webMode ? 4 : 0;
  return Math.max(10, Math.min(30, base + lengthCost + historyCost + providerCost + modeCost + webCost));
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
      tavilyConfigured: false,
      ollamaModel: 'Backend required',
    };
    state.tokenPacks = [
      { code: 'pack_200', tokens: 200, amountUsd: 5, paypalUrl: 'https://paypal.me/AlexanderBatti/5' },
      { code: 'pack_400', tokens: 400, amountUsd: 10, paypalUrl: 'https://paypal.me/AlexanderBatti/10' },
      { code: 'pack_800', tokens: 800, amountUsd: 15, paypalUrl: 'https://paypal.me/AlexanderBatti/15' },
      { code: 'pack_1200', tokens: 1200, amountUsd: 20, paypalUrl: 'https://paypal.me/AlexanderBatti/20' },
      { code: 'pack_200000', tokens: 200000, amountUsd: 2000, paypalUrl: 'https://paypal.me/AlexanderBatti/2000' },
    ];
    return;
  }

  try {
    const data = await fetchJSON('/api/health');
    state.health = data;
    state.tokenPacks = Array.isArray(data.tokenPacks) ? data.tokenPacks : [];
  } catch {
    state.health = null;
    state.tokenPacks = [];
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
    els.usageText.textContent = '200 / 200 tokens';
    els.usageFill.style.width = '0%';
    els.usageCaption.textContent = 'Free plan renews every 2 days.';
    els.settingsName.textContent = 'Not signed in';
    els.settingsEmail.textContent = 'Not signed in';
    els.settingsPlan.textContent = 'Free';
    els.settingsUsage.textContent = '200 / 200 tokens';
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

  const usageText = state.account.isUnlimited
    ? 'Unlimited tokens'
    : `${state.account.tokensRemaining} / ${state.account.tokenLimit} tokens`;
  els.usageText.textContent = usageText;
  els.settingsName.textContent = state.account.name;
  els.settingsEmail.textContent = state.account.email;
  els.settingsPlan.textContent = getPlanLabel(state.account.plan);
  els.settingsUsage.textContent = usageText;
  els.usageCaption.textContent = formatRenewal(state.account);

  const usedRatio = state.account.isUnlimited
    ? 0
    : state.account.tokenLimit > 0
      ? Math.max(0, Math.min(1, state.account.tokensUsed / state.account.tokenLimit))
      : 0;
  els.usageFill.style.width = `${usedRatio * 100}%`;
}

function renderHealth() {
  els.healthGroq.textContent = state.health?.groqConfigured ? 'Connected' : 'Missing key';
  els.healthOllama.textContent = state.health?.ollamaModel ? state.health.ollamaModel : 'Unavailable';
  els.healthTavily.textContent = state.health?.tavilyConfigured ? 'Live search ready' : 'Not configured';
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
  els.apiKeyList.innerHTML = state.apiKeys
    .map((key) => {
      return `
        <div class="list-item">
          <strong>${escapeHTML(key.label || 'API key')}</strong>
          <p>Created ${escapeHTML(formatShortDate(key.createdAt))}</p>
          <p>${key.lastUsedAt ? `Last used ${escapeHTML(formatShortDate(key.lastUsedAt))}` : 'Not used yet'}</p>
        </div>
      `;
    })
    .join('');
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
  els.packGrid.innerHTML = state.tokenPacks
    .map((pack) => {
      return `
        <div class="pack-card">
          <strong>$${pack.amountUsd}</strong>
          <span>${pack.tokens} tokens</span>
          <a class="secondary-button compact" href="${escapeHTML(pack.paypalUrl)}" target="_blank" rel="noreferrer">
            Buy token pack
          </a>
        </div>
      `;
    })
    .join('');
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
  return `
    <div class="intro-screen">
      <div class="intro-mark">
        <span class="logo-mark" aria-hidden="true">
          <img src="assets/forgeai-logo.png" alt="" />
        </span>
        ForgeAI Nova
      </div>
      <h2>Your AI assistant for writing, coding, learning, and real-time answers.</h2>
      <p>
        Nova uses Groq first, falls back to Ollama when needed, keeps chats separated per account on this device,
        and can remember details like your name, role, or preferences inside your own workspace.
      </p>
      <div class="intro-actions">
        <button class="primary-button compact" type="button" data-start-chat>Start chatting</button>
        <button class="secondary-button compact" type="button" data-open-settings-inline>Open settings</button>
      </div>
      <div class="quick-grid">
        <div class="quick-card">
          <strong>Chat</strong>
          <p>Clean conversation view, copy, regenerate, chat history, and auto-save.</p>
        </div>
        <div class="quick-card">
          <strong>AI modes</strong>
          <p>Use low, balanced, or high intelligence levels with Groq, Ollama, or auto fallback.</p>
        </div>
        <div class="quick-card">
          <strong>Memory</strong>
          <p>Save facts per account so Nova remembers names, jobs, locations, and preferences.</p>
        </div>
        <div class="quick-card">
          <strong>Developer access</strong>
          <p>Create API keys and manage billing from one settings area instead of hunting through the UI.</p>
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
              ${message.webUsed ? ' · Live web context used' : ''}
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
  els.webToggle.checked = state.settings.webMode;
  els.modelButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.modelMode === state.settings.modelMode);
  });
}

function renderAll() {
  renderAccount();
  renderHealth();
  renderChatList();
  renderThread();
  renderControls();
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
  await refreshAccountFromServer();
  await Promise.all([refreshMemory(), refreshApiKeys()]);
  setAuthLocked(false);
  setSending(false);
  setStatus('Signed in and ready.');
  renderAll();
  focusComposer();
}

function signOutAccount() {
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

async function sendToBackend(message, history) {
  if (STATIC_EXPORT) {
    return {
      reply:
        'This GitHub Pages build is a static preview of ForgeAI Nova. Run the full Node backend locally or deploy the server to use Groq, Ollama fallback, memory sync, and live AI chat.',
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
      webMode: state.settings.webMode,
      account: state.account,
    }),
  });
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
  setStatus(`Nova is thinking... about ${estimatedCost} tokens`);

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

  els.modelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.settings.modelMode = button.dataset.modelMode;
      persistAccountState();
      renderControls();
      showToast('Mode updated', 'Nova intelligence level changed.');
    });
  });

  els.webToggle.addEventListener('change', () => {
    state.settings.webMode = els.webToggle.checked;
    persistAccountState();
    renderControls();
    showToast('Web mode updated', state.settings.webMode ? 'Live web search is on.' : 'Live web search is off.');
  });

  els.createApiKeyButton.addEventListener('click', async () => {
    try {
      await createApiKey();
    } catch (error) {
      showToast('API key failed', error.message, 'error');
    }
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
      closeSidebar();
      closeSettings();
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
