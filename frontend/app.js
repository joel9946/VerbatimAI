/**
 * Verbatim AI — Ultra-Premium Neural RAG Copilot
 * Features:
 * - Multi-session local storage & session search
 * - DeepSeek / Claude-style multi-stage reasoning animation
 * - PostgreSQL server logs synchronization
 * - Markdown parser with syntax code copying
 * - System health monitoring & dynamic theme switching
 */

const BACKEND_URL = '';

const STORAGE_KEYS = {
  SESSIONS: 'verbatim_ai_sessions_v2',
  CURRENT_ID: 'verbatim_ai_current_session_v2',
  THEME: 'verbatim_ai_theme'
};

// Application State
let sessions = [];
let currentSessionId = null;
let isGenerating = false;
let searchQuery = '';

// DOM Elements
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatSearchInput = document.getElementById('chatSearchInput');
const tabLocalHistory = document.getElementById('tabLocalHistory');
const tabDbHistory = document.getElementById('tabDbHistory');
const localHistoryContainer = document.getElementById('localHistoryContainer');
const dbHistoryContainer = document.getElementById('dbHistoryContainer');
const chatList = document.getElementById('chatList');
const dbLogList = document.getElementById('dbLogList');
const refreshDbBtn = document.getElementById('refreshDbBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

const welcomeScreen = document.getElementById('welcomeScreen');
const messagesContainer = document.getElementById('messagesContainer');
const chatViewport = document.getElementById('chatViewport');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const statusDot = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');
const statusStats = document.getElementById('statusStats');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const promptCards = document.querySelectorAll('.prompt-card');

// --- Initialization ---
function init() {
  loadTheme();
  loadSessions();
  setupEventListeners();
  checkBackendStatus();
  setInterval(checkBackendStatus, 12000); // Check server health
}

// --- Session & Storage Management ---
function loadSessions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    sessions = saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Error loading sessions:', e);
    sessions = [];
  }

  currentSessionId = localStorage.getItem(STORAGE_KEYS.CURRENT_ID);

  if (!sessions.length || !sessions.find(s => s.id === currentSessionId)) {
    createNewSession();
  } else {
    renderSidebarSessions();
    renderActiveSessionMessages();
  }
}

function saveSessions() {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    localStorage.setItem(STORAGE_KEYS.CURRENT_ID, currentSessionId);
  } catch (e) {
    console.error('Error saving sessions:', e);
  }
}

function createNewSession() {
  const newSession = {
    id: 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    messages: []
  };
  sessions.unshift(newSession);
  currentSessionId = newSession.id;
  saveSessions();
  renderSidebarSessions();
  renderActiveSessionMessages();
  messageInput.focus();
}

function getCurrentSession() {
  return sessions.find(s => s.id === currentSessionId) || sessions[0];
}

function selectSession(sessionId) {
  if (currentSessionId === sessionId) return;
  currentSessionId = sessionId;
  saveSessions();
  renderSidebarSessions();
  renderActiveSessionMessages();
}

function deleteSession(sessionId, event) {
  if (event) event.stopPropagation();
  sessions = sessions.filter(s => s.id !== sessionId);
  if (!sessions.length) {
    createNewSession();
  } else {
    if (currentSessionId === sessionId) {
      currentSessionId = sessions[0].id;
    }
    saveSessions();
    renderSidebarSessions();
    renderActiveSessionMessages();
  }
}

function clearAllSessions() {
  if (!confirm('Are you sure you want to clear all conversation history?')) return;
  sessions = [];
  createNewSession();
}

// --- Sidebar Rendering & Search ---
function renderSidebarSessions() {
  chatList.innerHTML = '';
  
  const filtered = sessions.filter(s => 
    !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!filtered.length) {
    chatList.innerHTML = `<div class="empty-state">${searchQuery ? 'No matching conversations' : 'No past conversations'}</div>`;
    return;
  }

  filtered.forEach(session => {
    const item = document.createElement('div');
    item.className = `chat-item ${session.id === currentSessionId ? 'active' : ''}`;
    item.onclick = () => selectSession(session.id);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'chat-item-title';
    titleSpan.textContent = session.title;
    titleSpan.title = session.title;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'chat-item-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'item-action-btn';
    deleteBtn.title = 'Delete chat';
    deleteBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    deleteBtn.onclick = (e) => deleteSession(session.id, e);

    actionsDiv.appendChild(deleteBtn);
    item.appendChild(titleSpan);
    item.appendChild(actionsDiv);
    chatList.appendChild(item);
  });
}

// --- Server DB History Sync ---
async function fetchDbHistory() {
  dbLogList.innerHTML = '<div class="empty-state">Syncing server database logs...</div>';
  try {
    const res = await fetch(`${BACKEND_URL}/history?limit=35`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const logs = await res.json();

    dbLogList.innerHTML = '';
    if (!logs || !logs.length) {
      dbLogList.innerHTML = '<div class="empty-state">No database records found</div>';
      return;
    }

    logs.forEach(log => {
      const card = document.createElement('div');
      card.className = 'db-log-item';
      
      const timeStr = log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const scorePct = log.top_score ? Math.round(log.top_score * 100) + '%' : '0%';

      card.innerHTML = `
        <div class="db-log-question" title="${escapeHtml(log.question)}">${escapeHtml(log.question)}</div>
        <div class="db-log-meta">
          <span>${escapeHtml(log.top_source || 'Knowledge Base')}</span>
          <span>${scorePct} • ${log.latency_ms || 0}ms</span>
          <span>${timeStr}</span>
        </div>
      `;

      card.onclick = () => {
        messageInput.value = log.question;
        updateSendButtonState();
        autoResizeInput();
        tabLocalHistory.click();
        sendMessage();
      };

      dbLogList.appendChild(card);
    });
  } catch (err) {
    dbLogList.innerHTML = `<div class="empty-state">Unable to load database logs: ${err.message}</div>`;
  }
}

// --- Messages & UI Rendering ---
function renderActiveSessionMessages() {
  const session = getCurrentSession();
  messagesContainer.innerHTML = '';

  if (!session || !session.messages.length) {
    welcomeScreen.classList.remove('hidden');
  } else {
    welcomeScreen.classList.add('hidden');
    session.messages.forEach(msg => {
      appendMessageToDOM(msg, false);
    });
    scrollToBottom();
  }
}

function appendMessageToDOM(msg, shouldScroll = true) {
  const row = document.createElement('div');
  row.className = `message-row ${msg.role}`;

  if (msg.role === 'assistant') {
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '✦';
    row.appendChild(avatar);

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = renderMarkdown(msg.content);

    // Citations & Meta card
    if (msg.top_source || msg.top_score !== undefined) {
      const meta = document.createElement('div');
      meta.className = 'rag-meta-card';
      
      const scoreVal = typeof msg.top_score === 'number' ? (msg.top_score * 100).toFixed(0) : '0';
      const sourceName = msg.top_source || 'Verified Source';

      meta.innerHTML = `
        <div class="meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span class="meta-source-tag">${escapeHtml(sourceName)}</span>
        </div>
        <div class="meta-item">
          <span>Confidence:</span>
          <span class="meta-score">${scoreVal}% match</span>
        </div>
        ${msg.latency_ms ? `
        <div class="meta-item meta-latency">
          <span>⚡ ${msg.latency_ms}ms</span>
        </div>` : ''}
        <button class="copy-answer-btn" title="Copy answer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      `;

      meta.querySelector('.copy-answer-btn').addEventListener('click', function() {
        navigator.clipboard.writeText(msg.content);
        const span = this.querySelector('span');
        span.textContent = 'Copied!';
        setTimeout(() => { span.textContent = 'Copy'; }, 2000);
      });

      bubble.appendChild(meta);
    }

    row.appendChild(bubble);
  } else {
    // User message
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = msg.content;
    row.appendChild(bubble);
  }

  messagesContainer.appendChild(row);
  attachCodeCopyListeners(row);

  if (shouldScroll) {
    scrollToBottom();
  }
}

// --- Animated Thinking & Reasoning Indicator ---
function createThinkingIndicator() {
  const row = document.createElement('div');
  row.className = 'message-row assistant thinking-row';
  row.id = 'thinkingIndicator';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = '✦';
  row.appendChild(avatar);

  const card = document.createElement('div');
  card.className = 'thinking-card';
  card.innerHTML = `
    <div class="thinking-header">
      <div class="thinking-neural-orb">
        <div class="neural-orb-center"></div>
        <div class="neural-orb-wave"></div>
      </div>
      <div class="thinking-stage-text" id="thinkingStageText">Embedding query with all-MiniLM-L6-v2...</div>
      <div class="thinking-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
    <div class="thinking-bar-track">
      <div class="thinking-bar-shimmer"></div>
    </div>
  `;

  row.appendChild(card);
  messagesContainer.appendChild(row);
  scrollToBottom();

  // Multi-phase RAG Reasoning steps
  const reasoningSteps = [
    'Scanning Qdrant vector space (Cosine Similarity)...',
    'Filtering & ranking top document chunks...',
    'Validating relevance threshold...',
    'Synthesizing verbatim answer (Groq LLM)...'
  ];

  let stepIdx = 0;
  const stageTimer = setInterval(() => {
    if (stepIdx < reasoningSteps.length) {
      const stageText = document.getElementById('thinkingStageText');
      if (stageText) {
        stageText.textContent = reasoningSteps[stepIdx];
      }
      stepIdx++;
    }
  }, 850);

  return () => {
    clearInterval(stageTimer);
    const elem = document.getElementById('thinkingIndicator');
    if (elem) elem.remove();
  };
}

// --- Send Message & API Call ---
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || isGenerating) return;

  const session = getCurrentSession();
  welcomeScreen.classList.add('hidden');

  // Set session title from first question
  if (session.messages.length === 0) {
    session.title = text.length > 36 ? text.substring(0, 36) + '...' : text;
    renderSidebarSessions();
  }

  // Add user message
  const userMsg = { role: 'user', content: text };
  session.messages.push(userMsg);
  appendMessageToDOM(userMsg, true);
  saveSessions();

  // Reset input
  messageInput.value = '';
  autoResizeInput();
  updateSendButtonState();

  // Trigger thinking animation
  isGenerating = true;
  sendBtn.disabled = true;
  const removeThinking = createThinkingIndicator();

  try {
    const res = await fetch(`${BACKEND_URL}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Server returned status ${res.status}: ${err}`);
    }

    const data = await res.json();
    removeThinking();

    const assistantMsg = {
      role: 'assistant',
      content: data.answer || "I don't have enough information to answer that.",
      top_source: data.top_source,
      top_score: data.top_score,
      latency_ms: data.latency_ms
    };

    session.messages.push(assistantMsg);
    saveSessions();
    appendMessageToDOM(assistantMsg, true);
  } catch (err) {
    console.error('API Error:', err);
    removeThinking();

    const errorMsg = {
      role: 'assistant',
      content: `⚠️ **Connection Error**: Unable to reach the Verbatim AI engine at \`${BACKEND_URL || 'localhost:8000'}\`.\n\n*Details: ${err.message}*`,
      top_source: null,
      top_score: 0.0,
      latency_ms: 0
    };
    session.messages.push(errorMsg);
    saveSessions();
    appendMessageToDOM(errorMsg, true);
  } finally {
    isGenerating = false;
    updateSendButtonState();
    messageInput.focus();
  }
}

// --- Markdown Rendering ---
function renderMarkdown(md) {
  if (!md) return '';
  let html = escapeHtml(md);

  // Fenced Code Blocks ```lang code ```
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const label = lang.trim() || 'code';
    return `
      <div class="code-block-wrapper">
        <div class="code-header">
          <span>${label}</span>
          <button class="copy-code-btn" data-code="${encodeURIComponent(code)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
        </div>
        <pre><code>${code}</code></pre>
      </div>
    `;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Lists
  html = html.replace(/(?:^|\n)[-*] (.*)/g, '\n<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/(?:^|\n)\d+\. (.*)/g, '\n<li>$1</li>');

  // Paragraphs
  const blocks = html.split('\n\n');
  return blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    if (block.startsWith('<h') || block.startsWith('<ul') || block.startsWith('<ol') || block.startsWith('<div class="code-block')) {
      return block;
    }
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

function attachCodeCopyListeners(container) {
  container.querySelectorAll('.copy-code-btn').forEach(btn => {
    btn.onclick = function() {
      const code = decodeURIComponent(this.getAttribute('data-code'));
      navigator.clipboard.writeText(code);
      this.textContent = 'Copied!';
      setTimeout(() => {
        this.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        `;
      }, 2000);
    };
  });
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// --- Health Status Checking ---
async function checkBackendStatus() {
  try {
    const res = await fetch(`${BACKEND_URL}/status`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error();
    const data = await res.json();

    statusDot.className = 'status-dot-core';
    statusLabel.textContent = 'Verbatim Engine Active';

    const count = data.total_questions || 0;
    const avgLatency = data.avg_latency_ms ? Math.round(data.avg_latency_ms) : 0;
    statusStats.textContent = `${count} queries logged • ${avgLatency}ms avg`;
  } catch (err) {
    statusDot.className = 'status-dot-core offline';
    statusLabel.textContent = 'Engine Offline / Reconnecting';
    statusStats.textContent = 'Check localhost:8000';
  }
}

// --- UI Helpers & Event Listeners ---
function autoResizeInput() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + 'px';
}

function updateSendButtonState() {
  sendBtn.disabled = !messageInput.value.trim() || isGenerating;
}

function scrollToBottom() {
  chatViewport.scrollTop = chatViewport.scrollHeight;
}

function toggleSidebar() {
  sidebar.classList.toggle('collapsed');
}

function loadTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  document.body.setAttribute('data-theme', saved);
  updateThemeIcons(saved);
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEYS.THEME, next);
  updateThemeIcons(next);
}

function updateThemeIcons(theme) {
  const sunIcon = themeToggleBtn.querySelector('.sun-icon');
  const moonIcon = themeToggleBtn.querySelector('.moon-icon');
  if (theme === 'light') {
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
  } else {
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  }
}

function setupEventListeners() {
  // Sidebar actions
  newChatBtn.addEventListener('click', createNewSession);
  openSidebarBtn.addEventListener('click', toggleSidebar);
  closeSidebarBtn.addEventListener('click', toggleSidebar);
  clearAllBtn.addEventListener('click', clearAllSessions);

  // Search input
  chatSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderSidebarSessions();
  });

  // History tabs
  tabLocalHistory.addEventListener('click', () => {
    tabLocalHistory.classList.add('active');
    tabDbHistory.classList.remove('active');
    localHistoryContainer.classList.remove('hidden');
    dbHistoryContainer.classList.add('hidden');
  });

  tabDbHistory.addEventListener('click', () => {
    tabDbHistory.classList.add('active');
    tabLocalHistory.classList.remove('active');
    dbHistoryContainer.classList.remove('hidden');
    localHistoryContainer.classList.add('hidden');
    fetchDbHistory();
  });

  refreshDbBtn.addEventListener('click', fetchDbHistory);

  // Theme toggle
  themeToggleBtn.addEventListener('click', toggleTheme);

  // Input handling
  messageInput.addEventListener('input', () => {
    autoResizeInput();
    updateSendButtonState();
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  // Keyboard shortcut Ctrl+K
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      createNewSession();
    }
  });

  // Prompt suggestion cards
  promptCards.forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      messageInput.value = prompt;
      autoResizeInput();
      updateSendButtonState();
      sendMessage();
    });
  });
}

// Boot application
document.addEventListener('DOMContentLoaded', init);
