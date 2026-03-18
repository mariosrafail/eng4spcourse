(() => {
  const TOKEN_KEY = 'e4sp_auth_token';
  const DEFAULT_DURATION_MS = 10 * 60 * 1000;
  const TICK_MS = 1000;
  const PERSIST_DEBOUNCE_MS = 4000;
  const TAB_TIMER_OVERRIDES_MINUTES = Object.freeze({
    m1_info: 4,
    m1_exercise: 10,
    m1_keywords: 6,
    m1_listening: 12,
    m1_revision: 8,
    m1_practice: 8,
    m1_reading: 11,
    m1_speaking: 7,
    m1_h2_exercise: 10,
    m1_h2_keywords: 6,
    m1_h2_listening: 12,
    m1_h2_reading: 11,
    m1_h2_writing: 14,
    m1_h2_recall: 5,
    info: 4,
    exercise: 10,
    keywords: 6,
    listening: 12,
    revision: 8,
    practice: 8,
    reading: 11,
    speaking: 7,
    h2_exercise: 10,
    h2_keywords: 6,
    h2_listening: 12,
    h2_reading: 11,
    h2_reading2: 10,
    h2_writing: 14,
    h2_recall: 5,
    '5:h2_exercise': 12,
    '6:h2_reading': 6,
    '6:h2_reading2': 11,
    '8:exercise': 7,
    '8:keywords': 7,
    '8:speaking': 6,
    '8:h2_listening': 13,
    '8:h2_reading': 14,
    '8:h2_writing': 16,
    mock_listening_1: 12,
    mock_listening_2: 12,
    mock_reading: 14,
    mock_reading_b: 12,
    mock_writing: 16,
    a1: 8,
    a2: 8,
    b1: 9,
    b2: 9,
    travel_1: 8,
    purpose_1: 6,
    purpose_2: 6,
    purpose_3: 6,
    purpose_4: 6,
    purpose_5: 6,
    quick_ref: 5
  });
  const FRIENDLY_TAB_LABELS = Object.freeze({
    m1_info: 'Module Focus',
    info: 'Module Focus',
    m1_exercise: 'I. Exercise',
    exercise: 'I. Exercise',
    m1_keywords: 'II. Key Words',
    keywords: 'II. Key Words',
    m1_listening: 'III. Listening',
    listening: 'III. Listening',
    m1_revision: 'IV. Useful Language',
    revision: 'IV. Useful Language',
    m1_practice: 'V. Practice',
    practice: 'V. Practice',
    m1_reading: 'VI. Reading',
    reading: 'VI. Reading',
    m1_speaking: 'VII. Speaking',
    speaking: 'VII. Speaking',
    m1_h2_exercise: 'Hour 2 Exercise',
    h2_exercise: 'Hour 2 Exercise',
    m1_h2_keywords: 'Hour 2 Key Words',
    h2_keywords: 'Hour 2 Key Words',
    m1_h2_listening: 'Hour 2 Listening',
    h2_listening: 'Hour 2 Listening',
    m1_h2_reading: 'Hour 2 Reading',
    h2_reading: 'Hour 2 Reading',
    h2_reading2: 'Hour 2 Reading Part 2',
    m1_h2_writing: 'Hour 2 Writing',
    h2_writing: 'Hour 2 Writing',
    m1_h2_recall: 'Hour 2 Recall',
    h2_recall: 'Hour 2 Recall',
    mock_listening_1: 'Mock Listening 1',
    mock_listening_2: 'Mock Listening 2',
    mock_reading: 'Mock Reading A',
    mock_reading_b: 'Mock Reading B',
    mock_writing: 'Mock Writing',
    a1: 'Appendix A1',
    a2: 'Appendix A2',
    b1: 'Appendix B1',
    b2: 'Appendix B2',
    travel_1: 'Travel 1',
    purpose_1: 'Purpose 1',
    purpose_2: 'Purpose 2',
    purpose_3: 'Purpose 3',
    purpose_4: 'Purpose 4',
    purpose_5: 'Purpose 5',
    quick_ref: 'Quick Reference'
  });
  const KNOWN_TAB_KEYS = Array.from(new Set([
    ...Object.keys(TAB_TIMER_OVERRIDES_MINUTES).filter((key) => !key.includes(':')),
    'h2_reading2'
  ])).sort((left, right) => prettifyTabKey(left).localeCompare(prettifyTabKey(right), undefined, { numeric: true }));
  const FALLBACK_MODULE_IDS = Array.from({ length: 10 }, (_, index) => String(index + 1));
  const TIMER_DISABLED_TAB_KEYS = new Set(['m1_info', 'info']);
  const TIMER_HIDDEN_TAB_KEYS = new Set(['m1_info', 'info']);
  const MODULE_TAB_KEYS = Object.freeze({
    '1': ['m1_info', 'm1_exercise', 'm1_keywords', 'm1_listening', 'm1_revision', 'm1_practice', 'm1_reading', 'm1_speaking', 'm1_h2_exercise', 'm1_h2_keywords', 'm1_h2_listening', 'm1_h2_reading', 'm1_h2_writing', 'm1_h2_recall'],
    '2': ['info', 'exercise', 'keywords', 'listening', 'revision', 'practice', 'reading', 'speaking', 'h2_exercise', 'h2_keywords', 'h2_listening', 'h2_reading', 'h2_writing', 'h2_recall'],
    '3': ['info', 'exercise', 'keywords', 'revision', 'practice', 'reading', 'speaking', 'h2_exercise', 'h2_keywords', 'h2_listening', 'h2_reading', 'h2_writing', 'h2_recall'],
    '4': ['info', 'exercise', 'keywords', 'listening', 'revision', 'practice', 'reading', 'speaking', 'h2_exercise', 'h2_keywords', 'h2_listening', 'h2_reading', 'h2_writing', 'h2_recall'],
    '5': ['info', 'exercise', 'keywords', 'listening', 'revision', 'practice', 'h2_exercise', 'h2_keywords', 'h2_reading', 'h2_writing', 'h2_recall'],
    '6': ['info', 'exercise', 'keywords', 'listening', 'revision', 'practice', 'reading', 'h2_exercise', 'h2_keywords', 'h2_listening', 'h2_reading', 'h2_reading2', 'h2_writing', 'h2_recall'],
    '7': ['info', 'exercise', 'keywords', 'listening', 'revision', 'practice', 'reading', 'speaking', 'h2_exercise', 'h2_keywords', 'h2_listening', 'h2_reading', 'h2_writing', 'h2_recall'],
    '8': ['info', 'exercise', 'keywords', 'speaking', 'h2_listening', 'h2_reading', 'h2_writing'],
    '9': ['mock_listening_1', 'mock_listening_2', 'mock_reading', 'mock_reading_b', 'mock_writing'],
    '10': ['a1', 'a2', 'b1', 'b2', 'travel_1', 'purpose_1', 'purpose_2', 'purpose_3', 'purpose_4', 'purpose_5', 'quick_ref']
  });

  let isAuthenticated = document.body.classList.contains('is-authenticated');
  let activeTab = null;
  let timerId = null;
  let lastTickAt = 0;
  let globalOverrides = {};
  let progressStore = {};
  let progressReady = !isAuthenticated;
  let loadedProgressUserKey = '';
  let progressLoadRequestId = 0;
  let pendingPersistMap = new Map();
  let persistTimerId = 0;
  let persistInFlight = false;

  function prettifyTabKey(tabKey){
    const raw = String(tabKey || '').trim();
    if(!raw) return '';
    if(FRIENDLY_TAB_LABELS[raw]) return FRIENDLY_TAB_LABELS[raw];

    return raw
      .replace(/^m\d+_/, '')
      .replace(/^h2_/, 'hour 2 ')
      .replace(/^mock_/, 'mock ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getTabDisplayLabel(tabKey){
    const key = String(tabKey || '').trim();
    const friendly = prettifyTabKey(key);
    return friendly || key;
  }

  function getModuleLabel(moduleId){
    const id = String(moduleId || '').trim();
    if(!id) return 'All modules';
    const button = document.querySelector(`.module-btn[data-module="${CSS.escape(id)}"]`);
    return String(button?.textContent || '').trim() || `Module ${id}`;
  }

  function getToken(){
    try{
      return localStorage.getItem(TOKEN_KEY) || '';
    }catch(_e){
      return '';
    }
  }

  async function api(path, options = {}){
    const token = getToken();
    const headers = { ...(options.headers || {}) };
    if(options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if(token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(path, {
      ...options,
      headers
    });

    let payload = {};
    try{
      payload = await response.json();
    }catch(_e){}

    if(!response.ok){
      throw new Error(payload?.error || `Request failed (${response.status})`);
    }

    return payload;
  }

  function getAllTimerOverrides(){
    return {
      ...TAB_TIMER_OVERRIDES_MINUTES,
      ...globalOverrides
    };
  }

  function getUserKey(){
    const fromWindow = typeof window.getCurrentCourseUserKey === 'function'
      ? String(window.getCurrentCourseUserKey() || '').trim().toLowerCase()
      : '';
    if(fromWindow) return fromWindow;

    const token = getToken();
    return token ? `token:${token}` : 'guest';
  }

  function getEntryKey(moduleId, tabKey){
    return `${String(moduleId || '')}:${String(tabKey || '')}`;
  }

  function isTimerDisabledForTab(_moduleId, tabKey){
    return TIMER_DISABLED_TAB_KEYS.has(String(tabKey || '').trim());
  }

  function readStore(){
    return progressStore;
  }

  function writeStore(nextStore){
    progressStore = nextStore && typeof nextStore === 'object' ? nextStore : {};
  }

  function normalizeServerEntries(entries){
    const normalized = {};
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const moduleId = String(entry?.moduleId || '').trim();
      const tabKey = String(entry?.tabKey || '').trim();
      if(!moduleId || !tabKey) return;

      const entryKey = getEntryKey(moduleId, tabKey);
      const durationMs = Math.max(0, Math.round(Number(entry?.durationMs) || 0));
      const remainingMs = Math.max(0, Math.round(Number(entry?.remainingMs) || 0));
      const completed = !!entry?.completed || remainingMs <= 0;
      normalized[entryKey] = {
        durationMs,
        remainingMs: completed ? 0 : remainingMs,
        completed,
        completedAt: Number(entry?.completedAt) || 0,
        updatedAt: Number(entry?.updatedAt) || Date.now()
      };
    });
    return normalized;
  }

  async function loadGlobalOverrides(){
    try{
      const data = await api('/api/timer-config/get', { method: 'GET' });
      globalOverrides = data?.overrides && typeof data.overrides === 'object' ? data.overrides : {};
    }catch(_e){
      globalOverrides = {};
    } finally {
      populateSettingsSelectOptions();
      refreshActiveTimerState();
      updateSettingsSummary();
    }
  }

  async function loadProgressStore(){
    if(!isAuthenticated){
      progressLoadRequestId += 1;
      loadedProgressUserKey = '';
      progressReady = true;
      writeStore({});
      clearPendingPersist();
      render();
      return;
    }

    const userKey = getUserKey();
    if(progressReady && loadedProgressUserKey === userKey) return;

    const requestId = ++progressLoadRequestId;
    progressReady = false;
    render();

    try{
      const data = await api('/api/timer-progress/get', { method: 'GET' });
      if(requestId !== progressLoadRequestId) return;
      loadedProgressUserKey = userKey;
      progressReady = true;
      writeStore(normalizeServerEntries(data?.entries));
      refreshActiveTimerState();
    }catch(_e){
      if(requestId !== progressLoadRequestId) return;
      loadedProgressUserKey = userKey;
      progressReady = true;
      writeStore({});
      refreshActiveTimerState();
    }
  }

  function clearPendingPersist(){
    pendingPersistMap = new Map();
    if(persistTimerId){
      window.clearTimeout(persistTimerId);
      persistTimerId = 0;
    }
  }

  function schedulePersistEntry(moduleId, tabKey, entry, options = {}){
    if(!isAuthenticated || !progressReady || isTimerDisabledForTab(moduleId, tabKey) || !entry) return;

    const entryKey = getEntryKey(moduleId, tabKey);
    pendingPersistMap.set(entryKey, {
      moduleId: String(moduleId || ''),
      tabKey: String(tabKey || ''),
      durationMs: Math.max(0, Math.round(Number(entry.durationMs) || 0)),
      remainingMs: Math.max(0, Math.round(Number(entry.remainingMs) || 0)),
      completed: !!entry.completed,
      completedAt: Number(entry.completedAt) || 0
    });

    if(options.immediate){
      flushPersistQueue({ keepalive: !!options.keepalive });
      return;
    }

    if(persistTimerId) return;
    persistTimerId = window.setTimeout(() => {
      persistTimerId = 0;
      flushPersistQueue();
    }, PERSIST_DEBOUNCE_MS);
  }

  async function flushPersistQueue(options = {}){
    if(persistInFlight || !pendingPersistMap.size || !isAuthenticated || !progressReady) return;

    if(persistTimerId){
      window.clearTimeout(persistTimerId);
      persistTimerId = 0;
    }

    const entries = Array.from(pendingPersistMap.values());
    pendingPersistMap.clear();
    persistInFlight = true;

    try{
      await api('/api/timer-progress/set', {
        method: 'POST',
        body: JSON.stringify({ entries }),
        keepalive: !!options.keepalive
      });
    }catch(_e){
      entries.forEach((entry) => {
        pendingPersistMap.set(getEntryKey(entry.moduleId, entry.tabKey), entry);
      });
    } finally {
      persistInFlight = false;
      if(pendingPersistMap.size && !persistTimerId){
        persistTimerId = window.setTimeout(() => {
          persistTimerId = 0;
          flushPersistQueue();
        }, PERSIST_DEBOUNCE_MS);
      }
    }
  }

  function buildOverrideKey(moduleId, tabKey){
    const cleanModuleId = String(moduleId || '').trim();
    const cleanTabKey = String(tabKey || '').trim();
    if(!cleanTabKey) return '';
    return cleanModuleId ? `${cleanModuleId}:${cleanTabKey}` : cleanTabKey;
  }

  function resolveDurationMs(moduleId, tabKey){
    if(isTimerDisabledForTab(moduleId, tabKey)) return 0;

    const exactKey = `${String(moduleId || '')}:${String(tabKey || '')}`;
    const overrides = getAllTimerOverrides();
    const overrideMinutes = overrides[exactKey] ?? overrides[String(tabKey || '')];
    if(Number.isFinite(overrideMinutes) && overrideMinutes > 0){
      return Math.round(overrideMinutes * 60 * 1000);
    }

    const activeButton = document.querySelector('.module-panel.is-active .tab-btn.is-active');
    const fromTimerMs = Number(activeButton?.dataset?.timerMs || '');
    if(Number.isFinite(fromTimerMs) && fromTimerMs > 0) return fromTimerMs;

    const fromTimerMinutes = Number(activeButton?.dataset?.timerMinutes || '');
    if(Number.isFinite(fromTimerMinutes) && fromTimerMinutes > 0) return Math.round(fromTimerMinutes * 60 * 1000);

    const activePanel = document.querySelector(`main.content .tab-panel[data-panel="${CSS.escape(String(tabKey || ''))}"]`);
    const panelTimerMs = Number(activePanel?.dataset?.timerMs || '');
    if(Number.isFinite(panelTimerMs) && panelTimerMs > 0) return panelTimerMs;

    const panelTimerMinutes = Number(activePanel?.dataset?.timerMinutes || '');
    if(Number.isFinite(panelTimerMinutes) && panelTimerMinutes > 0) return Math.round(panelTimerMinutes * 60 * 1000);

    return DEFAULT_DURATION_MS;
  }

  function ensureEntry(moduleId, tabKey){
    const store = readStore();
    const entryKey = getEntryKey(moduleId, tabKey);
    const durationMs = resolveDurationMs(moduleId, tabKey);
    const existing = store[entryKey];

    if(isTimerDisabledForTab(moduleId, tabKey)){
      const disabledEntry = {
        durationMs: 0,
        remainingMs: 0,
        completed: true,
        completedAt: existing?.completedAt || Date.now(),
        updatedAt: Date.now()
      };
      writeStore({ ...store, [entryKey]: disabledEntry });
      return { ...disabledEntry, entryKey };
    }

    if(existing && typeof existing === 'object'){
      let changed = false;
      const next = { ...existing };

      if(!Number.isFinite(next.durationMs) || next.durationMs <= 0){
        next.durationMs = durationMs;
        changed = true;
      }else if(next.durationMs !== durationMs){
        const previousDurationMs = Math.max(1, Number(next.durationMs) || durationMs);
        const previousRemainingMs = Math.max(0, Number(next.remainingMs) || 0);
        const elapsedMs = Math.max(0, previousDurationMs - previousRemainingMs);
        next.durationMs = durationMs;
        next.remainingMs = next.completed ? 0 : Math.max(0, durationMs - elapsedMs);
        next.completed = next.remainingMs <= 0;
        changed = true;
      }
      if(!Number.isFinite(next.remainingMs) || next.remainingMs < 0){
        next.remainingMs = next.completed ? 0 : next.durationMs;
        changed = true;
      }
      if(next.completed && next.remainingMs !== 0){
        next.remainingMs = 0;
        changed = true;
      }

      if(changed){
        next.updatedAt = Date.now();
        writeStore({ ...store, [entryKey]: next });
        schedulePersistEntry(moduleId, tabKey, next);
      }

      return { ...next, entryKey };
    }

    const created = {
      durationMs,
      remainingMs: durationMs,
      completed: false,
      completedAt: 0,
      updatedAt: Date.now()
    };
    writeStore({ ...store, [entryKey]: created });
    schedulePersistEntry(moduleId, tabKey, created);
    return { ...created, entryKey };
  }

  function getEntry(moduleId, tabKey){
    const store = readStore();
    const entryKey = getEntryKey(moduleId, tabKey);
    const entry = store[entryKey];
    if(!entry || typeof entry !== 'object') return ensureEntry(moduleId, tabKey);
    return { ...entry, entryKey };
  }

  function saveEntry(moduleId, tabKey, patch, options = {}){
    const store = readStore();
    const entryKey = getEntryKey(moduleId, tabKey);
    const prev = store[entryKey] && typeof store[entryKey] === 'object'
      ? store[entryKey]
      : ensureEntry(moduleId, tabKey);
    const next = {
      ...prev,
      ...patch,
      updatedAt: Date.now()
    };
    if(next.completed) next.remainingMs = 0;
    writeStore({ ...store, [entryKey]: next });
    schedulePersistEntry(moduleId, tabKey, next, options);
    return { ...next, entryKey };
  }

  function formatMs(ms){
    const totalSeconds = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function ensureUi(){
    let shell = document.getElementById('tabTimerShell');
    if(shell) return shell;

    shell = document.createElement('aside');
    shell.id = 'tabTimerShell';
    shell.className = 'tab-timer-shell';
    shell.hidden = true;
    shell.innerHTML = `
      <div class="tab-timer-card" aria-live="polite" aria-atomic="true">
        <div class="tab-timer-card__eyebrow">Tab timer</div>
        <div class="tab-timer-card__label"></div>
        <div class="tab-timer-card__clock"></div>
        <div class="tab-timer-card__meta"></div>
        <div class="tab-timer-card__bar"><span></span></div>
      </div>
    `;
    document.body.appendChild(shell);
    return shell;
  }

  function render(){
    const shell = ensureUi();
    const card = shell.querySelector('.tab-timer-card');
    const label = shell.querySelector('.tab-timer-card__label');
    const clock = shell.querySelector('.tab-timer-card__clock');
    const meta = shell.querySelector('.tab-timer-card__meta');
    const bar = shell.querySelector('.tab-timer-card__bar span');

    if(!isAuthenticated || !activeTab?.moduleId || !activeTab?.tabKey || isTimerDisabledForTab(activeTab.moduleId, activeTab.tabKey)){
      shell.hidden = true;
      return;
    }

    shell.hidden = false;
    label.textContent = activeTab.tabLabel || prettifyTabKey(activeTab.tabKey) || `Module ${activeTab.moduleId}`;

    if(!progressReady){
      card.classList.remove('is-complete');
      clock.textContent = '...';
      meta.textContent = 'Loading your saved timer';
      bar.style.width = '0%';
      updateSettingsSummary();
      return;
    }

    const entry = getEntry(activeTab.moduleId, activeTab.tabKey);
    const durationMs = Math.max(1, Number(entry.durationMs) || DEFAULT_DURATION_MS);
    const remainingMs = Math.max(0, Number(entry.remainingMs) || 0);
    const pct = Math.max(0, Math.min(1, 1 - (remainingMs / durationMs)));

    card.classList.toggle('is-complete', !!entry.completed);
    clock.textContent = entry.completed ? 'Ready' : formatMs(remainingMs);
    meta.textContent = entry.completed
      ? 'You can continue to the next step.'
      : 'Time remaining on this tab';
    bar.style.width = `${(pct * 100).toFixed(2)}%`;
    updateSettingsSummary();
  }

  function dispatchTimerComplete(moduleId, tabKey){
    document.dispatchEvent(new CustomEvent('course:tab-timer-complete', {
      detail: { moduleId: String(moduleId || ''), tabKey: String(tabKey || '') }
    }));
  }

  function syncActiveTabCompletion(){
    if(!progressReady || !activeTab?.moduleId || !activeTab?.tabKey) return;
    const entry = getEntry(activeTab.moduleId, activeTab.tabKey);
    if(entry.completed){
      dispatchTimerComplete(activeTab.moduleId, activeTab.tabKey);
    }
  }

  function refreshActiveTimerState(){
    if(!activeTab?.moduleId || !activeTab?.tabKey) {
      render();
      return;
    }
    if(progressReady) ensureEntry(activeTab.moduleId, activeTab.tabKey);
    render();
    syncActiveTabCompletion();
  }

  function tick(){
    if(!isAuthenticated || !progressReady || document.visibilityState !== 'visible' || !activeTab?.moduleId || !activeTab?.tabKey || isTimerDisabledForTab(activeTab.moduleId, activeTab.tabKey)){
      lastTickAt = Date.now();
      return;
    }

    const now = Date.now();
    if(!lastTickAt) lastTickAt = now;
    const delta = Math.max(0, now - lastTickAt);
    lastTickAt = now;

    const entry = getEntry(activeTab.moduleId, activeTab.tabKey);
    if(entry.completed){
      render();
      return;
    }

    const nextRemaining = Math.max(0, (Number(entry.remainingMs) || 0) - delta);
    const completed = nextRemaining <= 0;
    saveEntry(activeTab.moduleId, activeTab.tabKey, {
      durationMs: entry.durationMs,
      remainingMs: nextRemaining,
      completed,
      completedAt: completed ? (entry.completedAt || now) : 0
    }, { immediate: completed });
    render();

    if(completed){
      dispatchTimerComplete(activeTab.moduleId, activeTab.tabKey);
    }
  }

  function ensureRunning(){
    if(timerId) return;
    lastTickAt = Date.now();
    timerId = window.setInterval(tick, TICK_MS);
  }

  function handleActiveTabChange(detail = {}){
    if(String(detail.view || '') !== 'module' || !detail.moduleId || !detail.tabKey){
      activeTab = null;
      render();
      return;
    }

    activeTab = {
      moduleId: String(detail.moduleId || ''),
      tabKey: String(detail.tabKey || ''),
      tabLabel: String(detail.tabLabel || '').trim(),
      timerDurationMs: Number(detail.timerDurationMs) || 0
    };
    lastTickAt = Date.now();
    refreshActiveTimerState();
  }

  function prettifyOverrideKey(key){
    const raw = String(key || '').trim();
    if(!raw) return '';
    if(raw.includes(':')){
      const [moduleId, tabKey] = raw.split(':');
      return `${getModuleLabel(moduleId)} / ${prettifyTabKey(tabKey)}`;
    }
    return prettifyTabKey(raw);
  }

  function getKnownModules(){
    const seen = new Map();

    document.querySelectorAll('.module-btn[data-module]').forEach((button) => {
      const id = String(button.dataset.module || '').trim();
      if(!id) return;
      seen.set(id, String(button.textContent || '').trim() || `Module ${id}`);
    });

    Object.keys(getAllTimerOverrides()).forEach((key) => {
      if(!key.includes(':')) return;
      const [moduleId] = key.split(':');
      const id = String(moduleId || '').trim();
      if(!id || seen.has(id)) return;
      seen.set(id, `Module ${id}`);
    });

    FALLBACK_MODULE_IDS.forEach((id) => {
      if(!seen.has(id)) seen.set(id, `Module ${id}`);
    });

    return Array.from(seen.entries())
      .sort((left, right) => Number(left[0]) - Number(right[0]))
      .map(([id, label]) => ({ id, label }));
  }

  function getAvailableTabKeys(moduleId){
    const cleanModuleId = String(moduleId || '').trim();
    if(cleanModuleId && Array.isArray(MODULE_TAB_KEYS[cleanModuleId])){
      return MODULE_TAB_KEYS[cleanModuleId].filter((key) => !TIMER_HIDDEN_TAB_KEYS.has(key));
    }

    return KNOWN_TAB_KEYS.filter((key) => !key.startsWith('m1_') && !TIMER_HIDDEN_TAB_KEYS.has(key));
  }

  function getSettingsFormState(){
    const modal = ensureSettingsUi();
    return {
      moduleId: String(modal.querySelector('#tabTimerModuleSelect')?.value || '').trim(),
      tabKey: String(modal.querySelector('#tabTimerTabKeySelect')?.value || '').trim()
    };
  }

  function setSettingsFormState(moduleId, tabKey){
    const modal = ensureSettingsUi();
    const moduleSelect = modal.querySelector('#tabTimerModuleSelect');
    const tabSelect = modal.querySelector('#tabTimerTabKeySelect');
    if(moduleSelect) moduleSelect.value = String(moduleId || '').trim();
    if(tabSelect) tabSelect.value = String(tabKey || '').trim();
  }

  function populateSettingsSelectOptions(){
    const modal = document.getElementById('tabTimerSettingsModal');
    if(!modal) return;

    const moduleSelect = modal.querySelector('#tabTimerModuleSelect');
    const tabSelect = modal.querySelector('#tabTimerTabKeySelect');
    const current = getSettingsFormState();

    if(moduleSelect){
      moduleSelect.innerHTML = '<option value="">All modules with this tab</option>';
      getKnownModules().forEach(({ id, label }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = label;
        moduleSelect.appendChild(option);
      });
      moduleSelect.value = current.moduleId;
    }

    if(tabSelect){
      const availableTabKeys = getAvailableTabKeys(current.moduleId);
      tabSelect.innerHTML = '<option value="">Select a tab</option>';
      availableTabKeys.forEach((key) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = getTabDisplayLabel(key);
        tabSelect.appendChild(option);
      });
      tabSelect.value = availableTabKeys.includes(current.tabKey) ? current.tabKey : '';
    }
  }

  function renderCustomOverridesTable(){
    const modal = document.getElementById('tabTimerSettingsModal');
    if(!modal) return;

    const tableWrap = modal.querySelector('#tabTimerOverridesTableWrap');
    const body = modal.querySelector('#tabTimerOverridesTableBody');
    const empty = modal.querySelector('#tabTimerOverridesEmpty');
    if(!tableWrap || !body || !empty) return;

    const entries = Object.entries(globalOverrides)
      .sort((left, right) => left[0].localeCompare(right[0], undefined, { numeric: true }));

    body.innerHTML = '';

    if(!entries.length){
      tableWrap.hidden = true;
      empty.hidden = false;
      return;
    }

    tableWrap.hidden = false;
    empty.hidden = true;

    entries.forEach(([key, minutes]) => {
      const row = document.createElement('tr');
      const [moduleId, rawTabKey] = key.includes(':') ? key.split(':') : ['', key];

      row.innerHTML = `
        <td>${moduleId ? getModuleLabel(moduleId) : 'All modules'}</td>
        <td>
          <div class="tab-timer-settings__table-main">${prettifyTabKey(rawTabKey)}</div>
          <div class="tab-timer-settings__table-sub">${rawTabKey}</div>
        </td>
        <td>${minutes}</td>
        <td>
          <div class="tab-timer-settings__table-actions">
            <button class="btn" type="button" data-load-override="${key}">Load</button>
            <button class="btn" type="button" data-delete-override="${key}">Delete</button>
          </div>
        </td>
      `;
      body.appendChild(row);
    });
  }

  function ensureSettingsUi(){
    let modal = document.getElementById('tabTimerSettingsModal');
    if(modal) return modal;

    modal = document.createElement('div');
    modal.id = 'tabTimerSettingsModal';
    modal.className = 'tab-timer-settings';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="tab-timer-settings__backdrop" data-close="true"></div>
      <div class="tab-timer-settings__dialog" role="dialog" aria-modal="true" aria-labelledby="tabTimerSettingsTitle">
        <div class="tab-timer-settings__head">
          <div>
            <div class="tab-timer-settings__eyebrow">Shared settings</div>
            <h2 class="tab-timer-settings__title" id="tabTimerSettingsTitle">Tab Timer Settings</h2>
          </div>
          <button class="tab-timer-settings__close" type="button" data-close="true" aria-label="Close timer settings">×</button>
        </div>
        <p class="tab-timer-settings__help">These durations apply to everyone. Only each user's remaining time is stored separately.</p>
        <div class="tab-timer-settings__grid">
          <label class="tab-timer-settings__field">
            <span>Module</span>
            <select class="tab-timer-settings__input" id="tabTimerModuleSelect"></select>
          </label>
          <label class="tab-timer-settings__field">
            <span>Tab</span>
            <select class="tab-timer-settings__input" id="tabTimerTabKeySelect"></select>
          </label>
          <label class="tab-timer-settings__field">
            <span>Minutes</span>
            <input class="tab-timer-settings__input" id="tabTimerMinutesInput" type="number" min="1" step="1" placeholder="10">
          </label>
        </div>
        <div class="tab-timer-settings__summary" id="tabTimerSettingsSummary"></div>
        <div class="tab-timer-settings__actions">
          <button class="btn" id="tabTimerUseCurrentBtn" type="button">Use current tab</button>
          <button class="btn primary" id="tabTimerSaveBtn" type="button">Save shared override</button>
          <button class="btn" id="tabTimerResetBtn" type="button">Reset this override</button>
          <button class="btn" id="tabTimerResetAllBtn" type="button">Reset all shared overrides</button>
        </div>
        <div class="tab-timer-settings__list">
          <div class="tab-timer-settings__list-head">
            <h3>Shared overrides</h3>
            <span>Every signed-in learner will get the same durations from this list.</span>
          </div>
          <p class="tab-timer-settings__empty" id="tabTimerOverridesEmpty">No shared overrides saved yet.</p>
          <div class="tab-timer-settings__table-wrap" id="tabTimerOverridesTableWrap" hidden>
            <table class="tab-timer-settings__table">
              <thead>
                <tr>
                  <th scope="col">Scope</th>
                  <th scope="col">Tab</th>
                  <th scope="col">Minutes</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody id="tabTimerOverridesTableBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    populateSettingsSelectOptions();

    modal.addEventListener('click', (event) => {
      const closeTrigger = event.target.closest('[data-close="true"]');
      if(closeTrigger){
        modal.hidden = true;
        return;
      }

      const loadOverride = event.target.closest('[data-load-override]');
      if(loadOverride){
        const key = String(loadOverride.getAttribute('data-load-override') || '').trim();
        const [moduleId, tabKey] = key.includes(':') ? key.split(':') : ['', key];
        setSettingsFormState(moduleId, tabKey);
        populateMinutesForInputs();
        return;
      }

      const deleteOverride = event.target.closest('[data-delete-override]');
      if(deleteOverride){
        const key = String(deleteOverride.getAttribute('data-delete-override') || '').trim();
        deleteSharedOverride(key);
      }
    });

    modal.querySelector('#tabTimerUseCurrentBtn')?.addEventListener('click', () => {
      setSettingsFormState(activeTab?.moduleId || '', activeTab?.tabKey || '');
      populateMinutesForInputs();
    });

    modal.querySelector('#tabTimerSaveBtn')?.addEventListener('click', async () => {
      const minutesInput = modal.querySelector('#tabTimerMinutesInput');
      const { moduleId, tabKey } = getSettingsFormState();
      const minutes = Number(minutesInput?.value || '');
      if(!tabKey || !Number.isFinite(minutes) || minutes <= 0) return;

      const overrideKey = buildOverrideKey(moduleId, tabKey);
      await saveSharedOverride(overrideKey, Math.round(minutes));
      populateMinutesForInputs();
    });

    modal.querySelector('#tabTimerResetBtn')?.addEventListener('click', async () => {
      const { moduleId, tabKey } = getSettingsFormState();
      if(!tabKey) return;
      await deleteSharedOverride(buildOverrideKey(moduleId, tabKey));
      populateMinutesForInputs();
    });

    modal.querySelector('#tabTimerResetAllBtn')?.addEventListener('click', async () => {
      await resetAllSharedOverrides();
      populateMinutesForInputs();
    });

    modal.querySelector('#tabTimerModuleSelect')?.addEventListener('change', () => {
      populateSettingsSelectOptions();
      populateMinutesForInputs();
    });
    modal.querySelector('#tabTimerTabKeySelect')?.addEventListener('change', populateMinutesForInputs);

    return modal;
  }

  async function saveSharedOverride(overrideKey, minutes){
    try{
      await api('/api/timer-config/set', {
        method: 'POST',
        body: JSON.stringify({ overrideKey, minutes })
      });
      globalOverrides = { ...globalOverrides, [overrideKey]: minutes };
      populateSettingsSelectOptions();
      refreshActiveTimerState();
      updateSettingsSummary();
    }catch(_e){}
  }

  async function deleteSharedOverride(overrideKey){
    if(!overrideKey) return;
    try{
      await api('/api/timer-config/reset', {
        method: 'POST',
        body: JSON.stringify({ overrideKey })
      });
      const next = { ...globalOverrides };
      delete next[overrideKey];
      globalOverrides = next;
      refreshActiveTimerState();
      updateSettingsSummary();
    }catch(_e){}
  }

  async function resetAllSharedOverrides(){
    try{
      await api('/api/timer-config/reset', {
        method: 'POST',
        body: JSON.stringify({ resetAll: true })
      });
      globalOverrides = {};
      refreshActiveTimerState();
      updateSettingsSummary();
    }catch(_e){}
  }

  function getOverrideMinutesForInputs(){
    const { moduleId, tabKey } = getSettingsFormState();
    if(!tabKey) return null;

    const key = buildOverrideKey(moduleId, tabKey);
    const all = getAllTimerOverrides();
    const value = all[key];
    return Number.isFinite(value) ? value : null;
  }

  function populateMinutesForInputs(){
    const modal = ensureSettingsUi();
    const minutesInput = modal.querySelector('#tabTimerMinutesInput');
    const minutes = getOverrideMinutesForInputs();
    if(minutesInput){
      minutesInput.value = Number.isFinite(minutes) ? String(minutes) : '10';
    }
  }

  function updateSettingsSummary(){
    const modal = document.getElementById('tabTimerSettingsModal');
    if(!modal) return;
    const summary = modal.querySelector('#tabTimerSettingsSummary');
    if(!summary) return;

    const customKeys = Object.keys(globalOverrides).sort();
    const activeLabel = activeTab?.tabLabel || prettifyTabKey(activeTab?.tabKey || '');
    const activeText = activeTab?.moduleId && activeTab?.tabKey
      ? `Current tab: ${getModuleLabel(activeTab.moduleId)} / ${activeLabel}`
      : 'Current tab: none';

    if(!customKeys.length){
      summary.textContent = `${activeText}. No shared overrides saved.`;
      renderCustomOverridesTable();
      return;
    }

    summary.textContent = `${activeText}. Shared overrides: ${customKeys.map((key) => prettifyOverrideKey(key)).join(', ')}`;
    renderCustomOverridesTable();
  }

  function ensureSettingsButton(){
    const host = document.getElementById('authUserBox');
    const anchor = document.getElementById('changeProgressBtn');
    if(!host || !anchor) return;
    if(document.getElementById('tabTimerSettingsBtn')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'tabTimerSettingsBtn';
    button.className = 'auth-test-progress';
    button.textContent = 'Tab timer settings';
    button.addEventListener('click', () => {
      const modal = ensureSettingsUi();
      populateSettingsSelectOptions();
      modal.hidden = false;
      populateMinutesForInputs();
      updateSettingsSummary();
    });
    anchor.insertAdjacentElement('afterend', button);
  }

  window.isTabTimerComplete = function isTabTimerComplete(moduleId, tabKey){
    if(isTimerDisabledForTab(moduleId, tabKey)) return true;
    if(!progressReady) return false;
    const entry = getEntry(moduleId, tabKey);
    return !!entry.completed;
  };

  document.addEventListener('course:active-tab-change', (event) => {
    handleActiveTabChange(event?.detail || {});
  });

  document.addEventListener('auth:statechange', (event) => {
    isAuthenticated = !!event?.detail?.authenticated;
    lastTickAt = Date.now();
    if(isAuthenticated){
      ensureRunning();
      loadProgressStore();
      render();
      return;
    }
    activeTab = null;
    progressReady = true;
    loadedProgressUserKey = '';
    writeStore({});
    clearPendingPersist();
    render();
  });

  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden'){
      flushPersistQueue({ keepalive: true });
    }
    lastTickAt = Date.now();
    render();
  });

  window.addEventListener('pagehide', () => {
    flushPersistQueue({ keepalive: true });
  });

  ensureUi();
  ensureSettingsUi();
  ensureSettingsButton();
  updateSettingsSummary();
  ensureRunning();
  loadGlobalOverrides();
  if(isAuthenticated){
    loadProgressStore();
  }
})();