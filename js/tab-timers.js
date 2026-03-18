(() => {
  const STORAGE_PREFIX = 'e4sp_tab_timers_v1';
  const DEFAULT_DURATION_MS = 10 * 60 * 1000;
  const TICK_MS = 1000;
  const TAB_TIMER_OVERRIDES_MINUTES = Object.freeze({});

  let isAuthenticated = document.body.classList.contains('is-authenticated');
  let activeTab = null;
  let timerId = null;
  let lastTickAt = 0;

  function getUserKey(){
    const fromWindow = typeof window.getCurrentCourseUserKey === 'function'
      ? String(window.getCurrentCourseUserKey() || '').trim().toLowerCase()
      : '';
    if(fromWindow) return fromWindow;

    try{
      const token = localStorage.getItem('e4sp_auth_token') || '';
      return token ? `token:${token}` : 'guest';
    }catch(_e){
      return 'guest';
    }
  }

  function getStorageKey(){
    return `${STORAGE_PREFIX}:${getUserKey()}`;
  }

  function readStore(){
    try{
      const raw = localStorage.getItem(getStorageKey());
      const parsed = JSON.parse(raw || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    }catch(_e){
      return {};
    }
  }

  function writeStore(store){
    try{
      localStorage.setItem(getStorageKey(), JSON.stringify(store));
    }catch(_e){}
  }

  function getEntryKey(moduleId, tabKey){
    return `${String(moduleId || '')}:${String(tabKey || '')}`;
  }

  function resolveDurationMs(moduleId, tabKey){
    const exactKey = `${String(moduleId || '')}:${String(tabKey || '')}`;
    const overrideMinutes = TAB_TIMER_OVERRIDES_MINUTES[exactKey] ?? TAB_TIMER_OVERRIDES_MINUTES[String(tabKey || '')];
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

    if(existing && typeof existing === 'object'){
      if(!Number.isFinite(existing.durationMs) || existing.durationMs <= 0){
        existing.durationMs = durationMs;
      }
      if(!Number.isFinite(existing.remainingMs) || existing.remainingMs < 0){
        existing.remainingMs = existing.completed ? 0 : existing.durationMs;
      }
      if(existing.completed) existing.remainingMs = 0;
      store[entryKey] = existing;
      writeStore(store);
      return { ...existing, entryKey };
    }

    const created = {
      durationMs,
      remainingMs: durationMs,
      completed: false,
      completedAt: 0,
      updatedAt: Date.now()
    };
    store[entryKey] = created;
    writeStore(store);
    return { ...created, entryKey };
  }

  function getEntry(moduleId, tabKey){
    const store = readStore();
    const entryKey = getEntryKey(moduleId, tabKey);
    const entry = store[entryKey];
    if(!entry || typeof entry !== 'object') return ensureEntry(moduleId, tabKey);
    return { ...entry, entryKey };
  }

  function saveEntry(moduleId, tabKey, patch){
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
    store[entryKey] = next;
    writeStore(store);
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

    if(!isAuthenticated || !activeTab?.moduleId || !activeTab?.tabKey){
      shell.hidden = true;
      return;
    }

    const entry = getEntry(activeTab.moduleId, activeTab.tabKey);
    const durationMs = Math.max(1, Number(entry.durationMs) || DEFAULT_DURATION_MS);
    const remainingMs = Math.max(0, Number(entry.remainingMs) || 0);
    const pct = Math.max(0, Math.min(1, 1 - (remainingMs / durationMs)));

    shell.hidden = false;
    card.classList.toggle('is-complete', !!entry.completed);
    label.textContent = activeTab.tabLabel || `Module ${activeTab.moduleId}`;
    clock.textContent = entry.completed ? 'Ready' : formatMs(remainingMs);
    meta.textContent = entry.completed
      ? 'You can continue to the next step.'
      : 'Time remaining on this tab';
    bar.style.width = `${(pct * 100).toFixed(2)}%`;
  }

  function dispatchTimerComplete(moduleId, tabKey){
    document.dispatchEvent(new CustomEvent('course:tab-timer-complete', {
      detail: { moduleId: String(moduleId || ''), tabKey: String(tabKey || '') }
    }));
  }

  function syncActiveTabCompletion(){
    if(!activeTab?.moduleId || !activeTab?.tabKey) return;
    const entry = getEntry(activeTab.moduleId, activeTab.tabKey);
    if(entry.completed){
      dispatchTimerComplete(activeTab.moduleId, activeTab.tabKey);
    }
  }

  function tick(){
    if(!isAuthenticated || document.visibilityState !== 'visible' || !activeTab?.moduleId || !activeTab?.tabKey){
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
    });
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

  function stopRunning(){
    if(!timerId) return;
    window.clearInterval(timerId);
    timerId = null;
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
    ensureEntry(activeTab.moduleId, activeTab.tabKey);
    lastTickAt = Date.now();
    render();
    syncActiveTabCompletion();
  }

  window.isTabTimerComplete = function isTabTimerComplete(moduleId, tabKey){
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
      render();
      syncActiveTabCompletion();
      return;
    }
    activeTab = null;
    render();
  });

  document.addEventListener('visibilitychange', () => {
    lastTickAt = Date.now();
    render();
  });

  ensureUi();
  ensureRunning();
})();