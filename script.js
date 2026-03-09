/**
 * NexusAI — script.js
 * Full rewrite: manual feature + model selection, all OpenAI capabilities
 */

'use strict';

// ══════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════
const API = 'https://api.openai.com/v1';

// All models grouped
const MODEL_CATALOG = [
  { id:'gpt-5-mini',              label:'GPT-5 Mini',            tag:'Latest',    features:['chat','vision','translate','summarize','code','rag'] },
  { id:'gpt-5-nano',              label:'GPT-5 Nano',            tag:'Fast',      features:['chat','vision','translate','summarize','code','rag'] },
  { id:'gpt-4.1-nano',            label:'GPT-4.1 Nano',          tag:'Efficient', features:['chat','vision','translate','summarize','code','rag'] },
  { id:'gpt-4o-mini',             label:'GPT-4o Mini',           tag:'Balanced',  features:['chat','vision','translate','summarize','code','rag'] },
  { id:'o4-mini',                 label:'O4 Mini',               tag:'Reasoning', features:['chat','translate','summarize','code'] },
  { id:'gpt-realtime-mini',       label:'GPT Realtime Mini',     tag:'Realtime',  features:['chat'] },
  { id:'gpt-audio-mini',          label:'GPT Audio Mini',        tag:'Audio',     features:['chat'] },
  { id:'davinci-002',             label:'Davinci 002',           tag:'Classic',   features:['chat','summarize'] },
  { id:'babbage-002',             label:'Babbage 002',           tag:'Classic',   features:['chat'] },
  { id:'dall-e-3',                 label:'DALL-E 3',              tag:'Image',     features:['image_gen'] },
  { id:'dall-e-2',                 label:'DALL-E 2',              tag:'Image',     features:['image_gen'] },
  { id:'gpt-image-1',              label:'GPT Image 1',           tag:'Image',     features:['image_gen'] },
  { id:'tts-1',                   label:'TTS-1',                 tag:'Speech',    features:['tts'] },
  { id:'whisper-1',               label:'Whisper-1',             tag:'Transcribe',features:['stt'] },
  { id:'text-embedding-3-small',  label:'Embedding 3 Small',     tag:'Embed',     features:['embed'] },
  { id:'text-embedding-ada-002',  label:'Embedding Ada 002',     tag:'Embed',     features:['embed'] },
];

// Feature definitions
const FEATURES = {
  rag:       { icon:'📚', label:'RAG Docs',     color:'#4a7fd4', inputHint:'Ask a question about your uploaded documents…' },
  chat:      { icon:'💬', label:'Chat',         color:'#7c6af7', inputHint:'Ask me anything…' },
  image_gen: { icon:'🎨', label:'Image Gen',    color:'#ffaa00', inputHint:'Describe the image you want…' },
  vision:    { icon:'👁', label:'Vision',       color:'#3ecfcf', inputHint:'Ask about the attached image…' },
  tts:       { icon:'🔊', label:'Text→Speech',  color:'#78c850', inputHint:'Type text to convert to speech…' },
  stt:       { icon:'🎤', label:'Transcribe',   color:'#f96b6b', inputHint:'Attach an audio file to transcribe…' },
  translate: { icon:'🌍', label:'Translate',    color:'#f5c842', inputHint:'Type text to translate…' },
  summarize: { icon:'📝', label:'Summarize',    color:'#ff9f43', inputHint:'Paste text or describe what to summarize…' },
  code:      { icon:'💻', label:'Code',         color:'#4ef0b0', inputHint:'Describe what code you need…' },
};

// Default model per feature
const DEFAULT_MODELS = {
  rag:'gpt-5-mini', chat:'gpt-5-mini', image_gen:'dall-e-3', vision:'gpt-5-mini',
  tts:'tts-1', stt:'whisper-1', translate:'gpt-5-mini',
  summarize:'gpt-5-mini', code:'gpt-5-mini',
};

// TTS voice options
const TTS_VOICES = ['alloy','echo','fable','onyx','nova','shimmer'];

// Image sizes
const IMAGE_SIZES = ['1024x1024','1792x1024','1024x1792'];

// Translate languages
const LANGUAGES = ['Arabic','English','French','Spanish','German','Italian','Portuguese','Chinese','Japanese','Korean','Russian','Turkish','Hindi'];

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
const state = {
  apiKey: '',
  activeFeature: 'chat',
  selectedModels: { ...DEFAULT_MODELS },
  chats: {},
  activeChatId: null,
  pendingFiles: [],
  isLoading: false,
  ttsVoice: 'alloy',
  imgSize: '1024x1024',
  imgStyle: 'vivid',
  translateTo: 'Arabic',
  codeLanguage: 'Python',
  ragDocs: [],       // { name, type, content, chunks[] }
  ragActive: false,  // is RAG mode on with loaded docs
};

// ══════════════════════════════════════════════
// DOM
// ══════════════════════════════════════════════
const $ = id => document.getElementById(id);
const dom = {
  sidebar:        $('sidebar'),
  overlay:        $('overlay'),
  burgerBtn:      $('burgerBtn'),
  newChatBtn:     $('newChatBtn'),
  apiKeyInput:    $('apiKeyInput'),
  saveApiKey:     $('saveApiKey'),
  apiStatus:      $('apiStatus'),
  featureGrid:    $('featureGrid'),
  modelList:      $('modelList'),
  chatHistory:    $('chatHistory'),
  chatTitle:      $('chatTitle'),
  activePill:     $('activePill'),
  pillIcon:       $('pillIcon'),
  pillLabel:      $('pillLabel'),
  modelPill:      $('modelPill'),
  mpillDot:       $('mpillDot'),
  mpillName:      $('mpillName'),
  messagesWrap:   $('messagesWrap'),
  welcome:        $('welcome'),
  messages:       $('messages'),
  featureControls:$('featureControls'),
  fileStrip:      $('fileStrip'),
  attachBtn:      $('attachBtn'),
  fileInput:      $('fileInput'),
  msgInput:       $('msgInput'),
  sendBtn:        $('sendBtn'),
  toasts:         $('toasts'),
};

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
function init() {
  loadStorage();
  renderModelList();
  renderFeatureControls();
  renderChatHistory();
  attachEvents();
  updateTopbar();
  // Show RAG panel if that feature was active
  const ragSection = $('ragSection');
  if (ragSection && state.activeFeature === 'rag') ragSection.style.display = 'block';
  renderRagDocsList();
  if (state.activeChatId) loadChat(state.activeChatId);
}

// ══════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════
function loadStorage() {
  state.apiKey = localStorage.getItem('nai_key') || '';
  if (state.apiKey) { dom.apiKeyInput.value = state.apiKey; setApiStatus('Key loaded ✓', false); }

  const savedModels = localStorage.getItem('nai_models');
  if (savedModels) Object.assign(state.selectedModels, JSON.parse(savedModels));

  const feat = localStorage.getItem('nai_feature');
  if (feat && FEATURES[feat]) {
    state.activeFeature = feat;
    dom.featureGrid.querySelectorAll('.feature-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.feature === feat);
    });
  }

  state.chats = JSON.parse(localStorage.getItem('nai_chats') || '{}');
  state.activeChatId = localStorage.getItem('nai_active') || null;
  if (state.activeChatId && !state.chats[state.activeChatId]) state.activeChatId = null;
}

function saveChats()  { localStorage.setItem('nai_chats', JSON.stringify(state.chats)); }
function saveModels() { localStorage.setItem('nai_models', JSON.stringify(state.selectedModels)); }
function saveActive() { localStorage.setItem('nai_active', state.activeChatId || ''); }

// ══════════════════════════════════════════════
// MODEL LIST RENDER
// ══════════════════════════════════════════════
function renderModelList() {
  const feat = state.activeFeature;
  const compatible = MODEL_CATALOG.filter(m => m.features.includes(feat));
  const current = state.selectedModels[feat];

  dom.modelList.innerHTML = compatible.map(m => `
    <div class="model-item ${m.id === current ? 'active' : ''}" data-model="${m.id}">
      <span class="model-dot-sm"></span>
      <div class="model-info">
        <div class="model-id">${m.id}</div>
        <div class="model-tag">${m.tag}</div>
      </div>
      <span class="model-check">✓</span>
    </div>
  `).join('') || `<div class="no-hist" style="padding:10px">No models for this feature.</div>`;

  dom.modelList.querySelectorAll('.model-item').forEach(el => {
    el.addEventListener('click', () => {
      const modelId = el.dataset.model;
      state.selectedModels[feat] = modelId;
      saveModels();
      renderModelList();
      updateTopbar();
      toast(`Model → ${modelId}`, 'ok');
    });
  });
}

// ══════════════════════════════════════════════
// FEATURE CONTROLS (below topbar in input area)
// ══════════════════════════════════════════════
function renderFeatureControls() {
  const feat = state.activeFeature;
  let html = '';

  if (feat === 'tts') {
    html = `
      <span class="fc-label">Voice:</span>
      <select class="fc-select" id="fcVoice">
        ${TTS_VOICES.map(v => `<option value="${v}" ${v===state.ttsVoice?'selected':''}>${v}</option>`).join('')}
      </select>`;
  }
  if (feat === 'image_gen') {
    html = `
      <span class="fc-label">Size:</span>
      <select class="fc-select" id="fcSize">
        ${IMAGE_SIZES.map(s => `<option value="${s}" ${s===state.imgSize?'selected':''}>${s}</option>`).join('')}
      </select>`;
  }
  if (feat === 'translate') {
    html = `
      <span class="fc-label">Translate to:</span>
      <select class="fc-select" id="fcLang">
        ${LANGUAGES.map(l => `<option value="${l}" ${l===state.translateTo?'selected':''}>${l}</option>`).join('')}
      </select>`;
  }
  if (feat === 'code') {
    const langs = ['Python','JavaScript','TypeScript','Go','Rust','C++','Java','SQL','Bash','HTML/CSS'];
    html = `
      <span class="fc-label">Language:</span>
      <select class="fc-select" id="fcCodeLang">
        ${langs.map(l => `<option value="${l}" ${l===state.codeLanguage?'selected':''}>${l}</option>`).join('')}
      </select>`;
  }
  if (feat === 'stt') {
    html = `<span class="fc-badge">🎤 Attach an audio file (mp3/wav/m4a) then send</span>`;
  }
  if (feat === 'vision') {
    html = `<span class="fc-badge">👁 Attach an image, then ask your question</span>`;
  }
  if (feat === 'rag') {
    html = `<span class="fc-badge">📚 ${state.ragDocs.length} doc(s) loaded · Ask questions about your files</span>`;
  }

  dom.featureControls.innerHTML = html;

  // Wire controls
  const fcVoice = $('fcVoice');
  if (fcVoice) fcVoice.addEventListener('change', () => { state.ttsVoice = fcVoice.value; });

  const fcSize = $('fcSize');
  if (fcSize) fcSize.addEventListener('change', () => { state.imgSize = fcSize.value; });

  const fcStyle = $('fcStyle');
  if (fcStyle) fcStyle.addEventListener('change', () => { state.imgStyle = fcStyle.value; });

  const fcLang = $('fcLang');
  if (fcLang) fcLang.addEventListener('change', () => { state.translateTo = fcLang.value; });

  const fcCodeLang = $('fcCodeLang');
  if (fcCodeLang) fcCodeLang.addEventListener('change', () => { state.codeLanguage = fcCodeLang.value; });

  // Update placeholder
  const hint = FEATURES[feat]?.inputHint || 'Message NexusAI…';
  dom.msgInput.placeholder = hint;

  // Show/hide attach button
  dom.attachBtn.style.display = (feat === 'vision' || feat === 'stt' || feat === 'rag') ? 'flex' : 'none';
  if (!['vision','stt','rag'].includes(feat)) { state.pendingFiles = []; dom.fileStrip.innerHTML = ''; }
}

// ══════════════════════════════════════════════
// TOPBAR UPDATE
// ══════════════════════════════════════════════
function updateTopbar() {
  const feat = state.activeFeature;
  const info = FEATURES[feat];
  const model = state.selectedModels[feat];

  // Feature pill
  dom.pillIcon.textContent = info.icon;
  dom.pillLabel.textContent = info.label;
  dom.activePill.className = `active-pill feat-${feat}`;

  // Model pill
  dom.mpillName.textContent = model;
  dom.mpillDot.style.background = info.color;
  dom.mpillDot.style.boxShadow = `0 0 7px ${info.color}99`;

  // Pop animation
  dom.modelPill.classList.remove('pill-pop');
  void dom.modelPill.offsetWidth;
  dom.modelPill.classList.add('pill-pop');
}

// ══════════════════════════════════════════════
// CHAT MANAGEMENT
// ══════════════════════════════════════════════
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function createNewChat() {
  const id = uid();
  state.chats[id] = { id, title:'New Conversation', feature: state.activeFeature, messages:[] };
  state.activeChatId = id;
  saveChats(); saveActive();
  dom.messages.innerHTML = '';
  dom.welcome.style.display = 'block';
  dom.chatTitle.textContent = 'New Conversation';
  renderChatHistory();
  dom.msgInput.focus();
}

function loadChat(id) {
  const chat = state.chats[id];
  if (!chat) return;
  state.activeChatId = id;
  saveActive();
  dom.chatTitle.textContent = chat.title;
  dom.welcome.style.display = 'none';
  dom.messages.innerHTML = '';
  chat.messages.forEach(m => renderMsg(m.role, m.content, m.meta || {}));
  scrollDown();
  renderChatHistory();
}

function deleteChat(id) {
  delete state.chats[id];
  if (state.activeChatId === id) {
    state.activeChatId = null;
    saveActive();
    dom.messages.innerHTML = '';
    dom.welcome.style.display = 'block';
    dom.chatTitle.textContent = 'New Conversation';
  }
  saveChats();
  renderChatHistory();
}

function addToHistory(role, content, meta={}) {
  if (!state.activeChatId) return;
  const chat = state.chats[state.activeChatId];
  chat.messages.push({ role, content, meta });
  if (role === 'user' && chat.title === 'New Conversation') {
    const txt = typeof content === 'string' ? content : (content?.[0]?.text || 'Chat');
    chat.title = txt.slice(0,42) + (txt.length > 42 ? '…' : '');
    dom.chatTitle.textContent = chat.title;
    renderChatHistory();
  }
  saveChats();
}

function renderChatHistory() {
  const ids = Object.keys(state.chats).reverse();
  if (!ids.length) { dom.chatHistory.innerHTML = '<div class="no-hist">No chats yet.</div>'; return; }
  dom.chatHistory.innerHTML = ids.map(id => {
    const c = state.chats[id];
    const feat = c.feature || 'chat';
    const icon = FEATURES[feat]?.icon || '💬';
    return `<div class="hist-item ${id===state.activeChatId?'active':''}" data-id="${id}">
      <span class="hist-icon">${icon}</span>
      <span class="hist-title">${esc(c.title)}</span>
      <button class="hist-del" data-id="${id}" title="Delete">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`;
  }).join('');
  dom.chatHistory.querySelectorAll('.hist-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.hist-del')) return;
      loadChat(el.dataset.id);
      if(window.innerWidth<=768) closeSidebar();
    });
  });
  dom.chatHistory.querySelectorAll('.hist-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if(confirm('Delete this chat?')) deleteChat(btn.dataset.id);
    });
  });
}

// ══════════════════════════════════════════════
// RENDER MESSAGES
// ══════════════════════════════════════════════
function renderMsg(role, content, meta={}) {
  dom.welcome.style.display = 'none';

  const row = document.createElement('div');
  row.className = `msg-row ${role === 'user' ? 'user' : role === 'error' ? 'err ai' : 'ai'}`;

  const avatar = role === 'user' ? '👤' : '⬡';
  const sender = role === 'user' ? 'You' : 'NexusAI';

  let inner = '';

  if (meta.imageUrl)
    inner += `<img src="${meta.imageUrl}" class="msg-img" alt="img" onclick="window.open('${meta.imageUrl}','_blank')" />`;

  if (meta.audioUrl) {
    const aid = 'a'+uid();
    inner += `<div class="audio-wrap">
      <button class="play-btn" onclick="toggleAudio(this,'${meta.audioUrl}','${aid}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>
      </button>
      <span class="audio-label">${meta.audioLabel||'Audio'}</span>
      <audio id="${aid}" src="${meta.audioUrl}" preload="none"></audio>
    </div>`;
  }

  if (meta.fileName)
    inner += `<div class="file-chip">📎 ${esc(meta.fileName)}</div>`;

  if (typeof content === 'string' && content)
    inner += role === 'error' ? `<p>⚠️ ${esc(content)}</p>` : mdToHtml(content);

  // TTS speak button for AI text messages
  let ttsBtn = '';
  if (role === 'ai' && typeof content === 'string' && content && !meta.audioUrl)
    ttsBtn = `<button class="tts-btn" onclick="speakText(this,${JSON.stringify(content)})">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
      Speak
    </button>`;

  row.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-wrap">
      <span class="msg-sender">${sender}</span>
      <div class="msg-bubble">${inner}</div>
      ${ttsBtn}
    </div>`;
  dom.messages.appendChild(row);
  scrollDown();
  return row;
}

function showLoading() {
  const row = document.createElement('div');
  row.className = 'loading-row'; row.id = 'loadingRow';
  row.innerHTML = `<div class="loading-avatar">⬡</div>
    <div class="loading-bubble"><div class="ld"></div><div class="ld"></div><div class="ld"></div></div>`;
  dom.welcome.style.display = 'none';
  dom.messages.appendChild(row);
  scrollDown();
}
function hideLoading() { const r=$('loadingRow'); if(r) r.remove(); }
function scrollDown() { dom.messagesWrap.scrollTo({ top:dom.messagesWrap.scrollHeight, behavior:'smooth' }); }

// ══════════════════════════════════════════════
// MARKDOWN RENDERER (simple)
// ══════════════════════════════════════════════
function mdToHtml(text) {
  let h = esc(text);
  h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, (_,l,c) => `<pre><code>${c.trim()}</code></pre>`);
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  h = h.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm,'<h1>$1</h1>');
  h = h.replace(/^[\-\*] (.+)$/gm,'<li>$1</li>');
  h = h.replace(/^\d+\. (.+)$/gm,'<li>$1</li>');
  h = h.replace(/\n\n+/g,'</p><p>').replace(/\n/g,'<br/>');
  h = `<p>${h}</p>`;
  h = h.replace(/<p><\/p>/g,'').replace(/<p>(<pre>)/g,'$1').replace(/(<\/pre>)<\/p>/g,'$1');
  return h;
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ══════════════════════════════════════════════
// FILE HANDLING
// ══════════════════════════════════════════════
function addFiles(files) {
  Array.from(files).forEach(f => {
    // Skip if file already added
    if (state.pendingFiles.some(existing => existing.name === f.name && existing.size === f.size)) {
      toast(`"${f.name}" already added`, 'err');
      return;
    }
    state.pendingFiles.push(f);
    const item = document.createElement('div');
    item.className = 'fp-item'; item.dataset.name = f.name;
    const rmBtn = `<button class="fp-rm" onclick="removeFile('${esc(f.name)}')">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>`;
    if (f.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = e => { item.innerHTML = `<img src="${e.target.result}" /><span class="fp-name">${esc(f.name)}</span>${rmBtn}`; };
      r.readAsDataURL(f);
    } else {
      const icon = f.type.startsWith('audio/') ? '🎵' : '📄';
      item.innerHTML = `<span>${icon}</span><span class="fp-name">${esc(f.name)}</span>${rmBtn}`;
    }
    dom.fileStrip.appendChild(item);
  });
  updateSendBtn();
}

window.removeFile = name => {
  state.pendingFiles = state.pendingFiles.filter(f => f.name !== name);
  dom.fileStrip.querySelectorAll('.fp-item').forEach(el => { if(el.dataset.name===name) el.remove(); });
  // Reset input so same file can be re-selected after removal
  dom.fileInput.value = '';
  updateSendBtn();
};

function clearFiles() { state.pendingFiles=[]; dom.fileStrip.innerHTML=''; dom.fileInput.value=''; }

function fileToB64(file) {
  return new Promise((res,rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ══════════════════════════════════════════════
// SEND
// ══════════════════════════════════════════════
async function send() {
  if (state.isLoading) return;
  const prompt = dom.msgInput.value.trim();
  const files  = [...state.pendingFiles];
  const feat   = state.activeFeature;

  if (!prompt && files.length === 0 && feat !== 'stt') {
    toast('Type a message or attach a file.','err'); return;
  }
  if (!state.apiKey) { toast('Enter your OpenAI API key in the sidebar.','err'); return; }

  if (!state.activeChatId) createNewChat();

  setLoading(true);
  dom.msgInput.value = '';
  autoResize();
  clearFiles();

  const displayText = prompt || (files.length ? `[${files.map(f=>f.name).join(', ')}]` : '');
  renderMsg('user', displayText, files.length ? { fileName: files.map(f=>f.name).join(', ') } : {});
  addToHistory('user', displayText);
  showLoading();

  try {
    switch(feat) {
      case 'rag':       await doRAG(prompt, files); break;
      case 'chat':      await doChat(prompt, files); break;
      case 'image_gen': await doImageGen(prompt); break;
      case 'vision':    await doVision(prompt, files); break;
      case 'tts':       await doTTS(prompt); break;
      case 'stt':       await doSTT(files); break;
      case 'translate': await doTranslate(prompt); break;
      case 'summarize': await doSummarize(prompt, files); break;
      case 'code':      await doCode(prompt); break;
      default:          await doChat(prompt, files);
    }
  } catch(e) {
    hideLoading();
    const msg = e.message || 'Something went wrong.';
    renderMsg('error', msg);
    addToHistory('error', msg);
    toast(msg,'err');
  }

  setLoading(false);
}

function setLoading(v) {
  state.isLoading = v;
  dom.sendBtn.disabled = v;
  dom.msgInput.disabled = v;
}
function updateSendBtn() {
  dom.sendBtn.disabled = state.isLoading || (dom.msgInput.value.trim()==='' && state.pendingFiles.length===0);
}

// ══════════════════════════════════════════════
// API HELPERS
// ══════════════════════════════════════════════
async function apiPost(endpoint, body, isForm=false) {
  const headers = { 'Authorization': `Bearer ${state.apiKey}` };
  if (!isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${endpoint}`, {
    method:'POST',
    headers,
    body: isForm ? body : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `API error ${res.status}`);
  return data;
}

async function apiPostBlob(endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${state.apiKey}`, 'Content-Type':'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const d=await res.json().catch(()=>{}); throw new Error(d?.error?.message||`Error ${res.status}`); }
  return await res.blob();
}

function extractText(data) {
  // /v1/responses format
  if (data.output && Array.isArray(data.output)) {
    const txt = data.output
      .filter(x=>x.type==='message')
      .flatMap(x=>x.content||[])
      .filter(c=>c.type==='output_text'||c.type==='text')
      .map(c=>c.text).join('');
    if (txt) return txt;
  }
  // /v1/chat/completions format
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  return 'No response.';
}

// Build conversation for /v1/responses
function buildConversation(newPrompt) {
  const chat = state.chats[state.activeChatId];
  const recent = (chat?.messages || []).slice(-18).filter(m=>m.role==='user'||m.role==='assistant');
  const msgs = recent.map(m => ({ role: m.role==='ai'?'assistant':m.role, content: m.content }));
  if (!msgs.length || msgs[msgs.length-1].content !== newPrompt)
    msgs.push({ role:'user', content: newPrompt });
  return msgs;
}

// ══════════════════════════════════════════════
// FEATURE HANDLERS
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
// RAG — DOCUMENT Q&A
// ══════════════════════════════════════════════

/**
 * Parse file to plain text depending on type
 */
async function parseFileToText(file) {
  const name = file.name.toLowerCase();
  const type = file.type;

  // Plain text / markdown / code files
  if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md') ||
      name.endsWith('.csv') || name.endsWith('.json') || name.endsWith('.xml') ||
      name.endsWith('.html') || name.endsWith('.js') || name.endsWith('.py')) {
    return await file.text();
  }

  // PDF — extract text via PDF.js (loaded from CDN)
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return await extractPdfText(file);
  }

  // CSV fallback
  if (name.endsWith('.csv')) {
    return await file.text();
  }

  // Try reading as text for anything else
  try { return await file.text(); } catch { return ''; }
}

/**
 * Extract text from PDF using PDF.js loaded dynamically
 */
async function extractPdfText(file) {
  // Dynamically load PDF.js if not already loaded
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += `
[Page ${i}]
${pageText}
`;
  }

  return fullText.trim();
}

/**
 * Split text into overlapping chunks for context window management
 */
function chunkText(text, chunkSize = 1200, overlap = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
}

/**
 * Simple keyword-based retrieval (no embeddings API needed)
 * Scores chunks by how many query words they contain
 */
function retrieveRelevantChunks(query, chunks, topK = 5) {
  const queryWords = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const scored = chunks.map((chunk, idx) => {
    const lower = chunk.toLowerCase();
    let score = 0;
    queryWords.forEach(word => {
      // Count occurrences
      const matches = (lower.match(new RegExp(word, 'g')) || []).length;
      score += matches;
      // Bonus for exact phrase proximity
      if (lower.includes(query.toLowerCase().slice(0, 30))) score += 5;
    });
    return { chunk, score, idx };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .sort((a, b) => a.idx - b.idx) // restore original order
    .map(s => s.chunk);
}

/**
 * Upload documents into RAG state
 */
async function ingestDocuments(files) {
  if (!files.length) return;

  const panel = $('ragDocsPanel');
  if (panel) panel.innerHTML = '<div class="rag-loading">⏳ Processing documents…</div>';

  for (const file of files) {
    try {
      const text = await parseFileToText(file);
      if (!text || text.trim().length < 10) {
        toast(`⚠️ Could not extract text from ${file.name}`, 'err');
        continue;
      }
      const chunks = chunkText(text);
      // Remove existing doc with same name
      state.ragDocs = state.ragDocs.filter(d => d.name !== file.name);
      state.ragDocs.push({
        name: file.name,
        type: file.type || 'text/plain',
        size: file.size,
        charCount: text.length,
        chunks,
      });
      toast(`📚 Loaded: ${file.name} (${chunks.length} chunks)`, 'ok');
    } catch (e) {
      toast(`Failed to parse ${file.name}: ${e.message}`, 'err');
    }
  }

  state.ragActive = state.ragDocs.length > 0;
  renderRagDocsList();
}

/**
 * Render loaded docs in sidebar RAG panel
 */
function renderRagDocsList() {
  const panel = $('ragDocsPanel');
  if (!panel) return;

  if (!state.ragDocs.length) {
    panel.innerHTML = '<div class="rag-empty">No documents loaded yet.<br/>Upload PDF, TXT, CSV, JSON…</div>';
    return;
  }

  panel.innerHTML = state.ragDocs.map(doc => `
    <div class="rag-doc-item">
      <span class="rag-doc-icon">${ragDocIcon(doc.name)}</span>
      <div class="rag-doc-info">
        <div class="rag-doc-name">${esc(doc.name)}</div>
        <div class="rag-doc-meta">${doc.chunks.length} chunks · ${(doc.charCount/1000).toFixed(1)}k chars</div>
      </div>
      <button class="rag-doc-del" onclick="removeRagDoc('${esc(doc.name)}')" title="Remove">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  `).join('');
}

function ragDocIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = { pdf:'📕', txt:'📄', csv:'📊', json:'📋', md:'📝', html:'🌐', py:'🐍', js:'⚡' };
  return icons[ext] || '📎';
}

window.removeRagDoc = (name) => {
  state.ragDocs = state.ragDocs.filter(d => d.name !== name);
  state.ragActive = state.ragDocs.length > 0;
  renderRagDocsList();
  toast(`Removed: ${name}`, 'ok');
};

/**
 * Main RAG Q&A handler
 */
async function doRAG(prompt, files) {
  // If new files attached, ingest them first
  if (files.length) {
    await ingestDocuments(files);
  }

  if (!prompt) {
    hideLoading();
    renderMsg('ai', '📚 Documents loaded! Now ask me anything about them.');
    return;
  }

  if (!state.ragDocs.length) {
    hideLoading();
    renderMsg('ai', '⚠️ No documents loaded yet. Please attach a PDF, TXT, CSV, or other text file first.');
    return;
  }

  // Retrieve relevant chunks from ALL docs
  const model = state.selectedModels.rag;
  let allChunks = [];
  state.ragDocs.forEach(doc => {
    const relevant = retrieveRelevantChunks(prompt, doc.chunks, 3);
    relevant.forEach(chunk => {
      allChunks.push(`[From: ${doc.name}]
${chunk}`);
    });
  });

  // If no relevant chunks found, still send top chunks
  if (allChunks.length === 0) {
    state.ragDocs.forEach(doc => {
      allChunks.push(`[From: ${doc.name}]
${doc.chunks[0] || ''}`);
    });
  }

  // Build context (cap at ~6000 chars to stay within token limits)
let context = allChunks.join('\n\n---\n\n');

if (context.length > 6000) {
  context = context.slice(0, 6000) + '\n\n[Context truncated…]';
}

const systemPrompt = `You are a precise document Q&A assistant. 
You ONLY answer questions based on the provided document context below.

Rules:
- If the answer EXISTS in the context, answer clearly and cite which document it came from.
- If the answer does NOT exist in the context, say exactly: "❌ I couldn't find information about this in the uploaded documents."
- Never make up information outside the context.
- Be concise and accurate.
- If relevant, quote the exact text from the document.

=== DOCUMENT CONTEXT ===
${context}`;
 
  const data = await apiPost('/chat/completions', {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: prompt },
    ],
    max_completion_tokens: 1024,
  });

  hideLoading();
  const reply = data.choices?.[0]?.message?.content || 'No answer generated.';
  renderMsg('ai', reply);
  addToHistory('assistant', reply);
}

// 1. CHAT
async function doChat(prompt, files) {
  const model = state.selectedModels.chat;

  // If there's an image file attached, route to vision automatically
  if (files.some(f=>f.type.startsWith('image/'))) {
    return doVision(prompt, files);
  }

  const data = await apiPost('/responses', {
    model,
    input: buildConversation(prompt),
  });
  hideLoading();
  const reply = extractText(data);
  renderMsg('ai', reply);
  addToHistory('assistant', reply);
}

// 2. IMAGE GENERATION
async function doImageGen(prompt) {
  const model = state.selectedModels.image_gen;
  if (!prompt) throw new Error('Please describe the image you want to generate.');

  // Build request body — gpt-image-1 uses b64_json, dall-e models use url
  const isGptImage = model.startsWith('gpt-image');
  const reqBody = {
    model,
    prompt,
    n: 1,
    size: state.imgSize,
  };
  if (!isGptImage) {
    reqBody.response_format = 'url'; // dall-e-2 / dall-e-3 support url
  }

  const data = await apiPost('/images/generations', reqBody);
  hideLoading();

  const b64  = data.data?.[0]?.b64_json;
  const url  = data.data?.[0]?.url;
  const imgUrl = b64 ? `data:image/png;base64,${b64}` : url;
  if (!imgUrl) throw new Error('No image returned from API.');

  const caption = `Generated: "${prompt.slice(0,80)}${prompt.length>80?'…':''}"`;
  renderMsg('ai', caption, { imageUrl: imgUrl });
  addToHistory('assistant', `[Image: ${prompt.slice(0,60)}]`);
}

// 3. VISION
async function doVision(prompt, files) {
  const model = state.selectedModels.vision;
  const imageFile = files.find(f=>f.type.startsWith('image/'));
  if (!imageFile) throw new Error('Attach an image file first.');

  const b64 = await fileToB64(imageFile);
  const content = [
    { type:'text', text: prompt || 'Describe this image in detail.' },
    { type:'image_url', image_url:{ url:`data:${imageFile.type};base64,${b64}` } },
  ];
  const data = await apiPost('/chat/completions', {
    model,
    messages:[{ role:'user', content }],
    max_completion_tokens:1200,
  });
  hideLoading();
  const reply = data.choices?.[0]?.message?.content || 'No description.';
  renderMsg('ai', reply);
  addToHistory('assistant', reply);
}

// 4. TEXT TO SPEECH
async function doTTS(prompt) {
  if (!prompt) throw new Error('Type the text you want to convert to speech.');
  const model = state.selectedModels.tts;
  const blob = await apiPostBlob('/audio/speech', {
    model, input: prompt.slice(0,4096), voice: state.ttsVoice, response_format:'mp3',
  });
  hideLoading();
  const url = URL.createObjectURL(blob);
  renderMsg('ai', `Speech generated for: "${prompt.slice(0,70)}${prompt.length>70?'…':''}"`,
    { audioUrl:url, audioLabel:`${state.ttsVoice} • TTS-1` });
  addToHistory('assistant','[TTS Audio]');
}

// 5. SPEECH TO TEXT
async function doSTT(files) {
  const audio = files.find(f=>f.type.startsWith('audio/')||/\.(mp3|wav|m4a|ogg|webm)$/i.test(f.name));
  if (!audio) throw new Error('Attach an audio file (mp3, wav, m4a…).');
  const model = state.selectedModels.stt;
  const form = new FormData();
  form.append('file', audio, audio.name);
  form.append('model', model);
  form.append('response_format','json');
  const res = await fetch(`${API}/audio/transcriptions`, {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${state.apiKey}` },
    body:form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message||`Transcription error ${res.status}`);
  hideLoading();
  const transcript = data.text || 'No transcription.';
  renderMsg('ai', `**Transcription:**\n\n${transcript}`);
  addToHistory('assistant', transcript);
}

// 6. TRANSLATE
async function doTranslate(prompt) {
  if (!prompt) throw new Error('Type the text to translate.');
  const model = state.selectedModels.translate;
  const sysPrompt = `You are a professional translator. Translate the following text to ${state.translateTo}. Return only the translation, nothing else.`;
  const data = await apiPost('/chat/completions', {
    model,
    messages:[
      { role:'system', content: sysPrompt },
      { role:'user', content: prompt },
    ],
    max_completion_tokens:2048,
  });
  hideLoading();
  const reply = data.choices?.[0]?.message?.content || 'Translation failed.';
  renderMsg('ai', `🌍 **${state.translateTo} translation:**\n\n${reply}`);
  addToHistory('assistant', reply);
}

// 7. SUMMARIZE
async function doSummarize(prompt, files) {
  let textToSummarize = prompt;

  // If a text file is attached, read it
  if (!textToSummarize && files.length) {
    const textFile = files.find(f=>f.type==='text/plain'||f.name.endsWith('.txt'));
    if (textFile) {
      textToSummarize = await new Promise((res,rej) => {
        const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsText(textFile);
      });
    }
  }
  if (!textToSummarize) throw new Error('Provide text or attach a .txt file to summarize.');

  const model = state.selectedModels.summarize;
  const data = await apiPost('/chat/completions', {
    model,
    messages:[
      { role:'system', content:'You are an expert summarizer. Create a clear, concise summary with key points. Use bullet points for key takeaways.' },
      { role:'user', content: `Summarize this:\n\n${textToSummarize.slice(0,12000)}` },
    ],
    max_completion_tokens:1024,
  });
  hideLoading();
  const reply = data.choices?.[0]?.message?.content || 'Summary failed.';
  renderMsg('ai', reply);
  addToHistory('assistant', reply);
}

// 8. CODE
async function doCode(prompt) {
  if (!prompt) throw new Error('Describe what code you need.');
  const model = state.selectedModels.code;
  const data = await apiPost('/chat/completions', {
    model,
    messages:[
      { role:'system', content:`You are an expert ${state.codeLanguage} developer. Write clean, well-commented, production-quality code. Always wrap code in proper markdown code blocks with the language specified.` },
      { role:'user', content: prompt },
    ],
    max_completion_tokens:2048,
  });
  hideLoading();
  const reply = data.choices?.[0]?.message?.content || 'Code generation failed.';
  renderMsg('ai', reply);
  addToHistory('assistant', reply);
}

// ══════════════════════════════════════════════
// TTS ON EXISTING MESSAGE
// ══════════════════════════════════════════════
window.speakText = async (btn, text) => {
  if (!state.apiKey) { toast('API key required.','err'); return; }
  btn.disabled=true; btn.textContent='⏳…';
  try {
    const blob = await apiPostBlob('/audio/speech', {
      model:'tts-1', input:text.slice(0,4096), voice:'alloy', response_format:'mp3',
    });
    const audio = new Audio(URL.createObjectURL(blob));
    audio.play();
    btn.textContent='🔊 Playing…';
    audio.onended = () => { btn.innerHTML=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14"/></svg> Speak`; btn.disabled=false; };
  } catch {
    btn.textContent='Speak'; btn.disabled=false; toast('TTS failed.','err');
  }
};

// ══════════════════════════════════════════════
// AUDIO TOGGLE
// ══════════════════════════════════════════════
window.toggleAudio = (btn, src, id) => {
  const audio = $(id) || new Audio(src);
  if (audio.paused) {
    audio.play();
    btn.innerHTML=`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    audio.onended=()=>{ btn.innerHTML=`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>`; };
  } else {
    audio.pause();
    btn.innerHTML=`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>`;
  }
};

// ══════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════
function toast(msg, type='') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  dom.toasts.appendChild(el);
  setTimeout(() => { el.style.animation='t-out .22s ease forwards'; setTimeout(()=>el.remove(),220); }, 3200);
}

// ══════════════════════════════════════════════
// API KEY
// ══════════════════════════════════════════════
function saveApiKey() {
  const k = dom.apiKeyInput.value.trim();
  if (!k) { setApiStatus('Enter a key','err'); return; }
  state.apiKey = k;
  localStorage.setItem('nai_key', k);
  setApiStatus('Key saved ✓', false);
  toast('API key saved!','ok');
}
function setApiStatus(msg,err) {
  dom.apiStatus.textContent=msg; dom.apiStatus.className='api-status'+(err?' err':'');
}

// ══════════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════════
function toggleSidebar() {
  if (window.innerWidth<=768) {
    dom.sidebar.classList.toggle('mobile-open');
    dom.overlay.classList.toggle('show');
  } else {
    dom.sidebar.classList.toggle('hidden');
  }
}
function closeSidebar() { dom.sidebar.classList.remove('mobile-open'); dom.overlay.classList.remove('show'); }

// ══════════════════════════════════════════════
// TEXTAREA
// ══════════════════════════════════════════════
function autoResize() {
  dom.msgInput.style.height='auto';
  dom.msgInput.style.height = Math.min(dom.msgInput.scrollHeight,180)+'px';
}

// ══════════════════════════════════════════════
// EVENTS
// ══════════════════════════════════════════════
function attachEvents() {
  dom.burgerBtn.addEventListener('click', toggleSidebar);
  dom.overlay.addEventListener('click', closeSidebar);
  dom.newChatBtn.addEventListener('click', createNewChat);
  dom.saveApiKey.addEventListener('click', saveApiKey);
  dom.apiKeyInput.addEventListener('keydown', e=>{ if(e.key==='Enter') saveApiKey(); });

  // Feature buttons
  dom.featureGrid.querySelectorAll('.feature-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      dom.featureGrid.querySelectorAll('.feature-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFeature = btn.dataset.feature;
      localStorage.setItem('nai_feature', state.activeFeature);
      renderModelList();
      renderFeatureControls();
      updateTopbar();
      // Show/hide RAG docs panel
      const ragSection = $('ragSection');
      if (ragSection) ragSection.style.display = state.activeFeature === 'rag' ? 'block' : 'none';
      toast(`${FEATURES[state.activeFeature].icon} ${FEATURES[state.activeFeature].label} mode`,'ok');
    });
  });

  // RAG clear button
  const ragClearBtn = $('ragClearBtn');
  if (ragClearBtn) {
    ragClearBtn.addEventListener('click', () => {
      if (state.ragDocs.length === 0) { toast('No documents to clear.', 'err'); return; }
      if (confirm('Clear all loaded documents?')) {
        state.ragDocs = [];
        state.ragActive = false;
        renderRagDocsList();
        renderFeatureControls();
        toast('All documents cleared.', 'ok');
      }
    });
  }

  // Send
  dom.sendBtn.addEventListener('click', send);
  dom.msgInput.addEventListener('keydown', e=>{
    if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); }
  });
  dom.msgInput.addEventListener('input', ()=>{ autoResize(); updateSendBtn(); });

  // File
  dom.attachBtn.addEventListener('click', ()=>dom.fileInput.click());
  dom.fileInput.addEventListener('change', e=>{ if(e.target.files.length) addFiles(e.target.files); });

  // Drag & drop
  dom.msgInput.addEventListener('dragover', e=>e.preventDefault());
  dom.msgInput.addEventListener('drop', e=>{ e.preventDefault(); if(e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  // Paste image
  document.addEventListener('paste', e=>{
    const imgs = Array.from(e.clipboardData?.items||[]).filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);
    if(imgs.length) addFiles(imgs);
  });
}

// ══════════════════════════════════════════════
// START
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);