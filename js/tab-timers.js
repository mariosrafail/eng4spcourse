(() => {
  const STORAGE_PREFIX = 'e4sp_tab_timers_v1';
  const OVERRIDE_STORAGE_KEY = 'e4sp_tab_timer_overrides_minutes_v1';
  const DEFAULT_DURATION_MS = 10 * 60 * 1000;
  const TICK_MS = 1000;
  const TAB_TIMER_OVERRIDES_MINUTES = Object.freeze({
    // Module 1 uses prefixed tab keys.
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

    // Shared tab keys across the main modules.
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

    // Special cases where the tab type is atypical for the key.
    '5:h2_exercise': 12,
    '6:h2_reading': 6,
    '6:h2_reading2': 11,
    '8:exercise': 7,
    '8:keywords': 7,
    '8:speaking': 6,
    '8:h2_listening': 13,
    '8:h2_reading': 14,
    '8:h2_writing': 16,

    // Mini mock test.
    mock_listening_1: 12,
    mock_listening_2: 12,
    mock_reading: 14,
    mock_reading_b: 12,
    mock_writing: 16,

    // Final appendix.
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
  const KNOWN_TAB_KEYS = Array.from(new Set([
    ...Object.keys(TAB_TIMER_OVERRIDES_MINUTES)
      .filter((key) => !key.includes(':')),
    'h2_reading2'
  ])).sort();
  const FALLBACK_MODULE_IDS = Array.from({ length: 10 }, (_, index) => String(index + 1));

  let isAuthenticated = document.body.classList.contains('is-authenticated');
  let activeTab = null;
  let timerId = null;
  let lastTickAt = 0;

  function readCustomOverrides(){
    try{
      const raw = localStorage.getItem(OVERRIDE_STORAGE_KEY);
      const parsed = JSON.parse(raw || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    }catch(_e){
      return {};
    }
  }

  function writeCustomOverrides(overrides){
    try{
      localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(overrides || {}));
    }catch(_e){}
  }

  function getAllTimerOverrides(){
    return {
      ...TAB_TIMER_OVERRIDES_MINUTES,
      ...readCustomOverrides()
    };
  }

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

    if(existing && typeof existing === 'object'){
      if(!Number.isFinite(existing.durationMs) || existing.durationMs <= 0){
        existing.durationMs = durationMs;
      }else if(existing.durationMs !== durationMs){
        const previousDurationMs = Math.max(1, Number(existing.durationMs) || durationMs);
        const previousRemainingMs = Math.max(0, Number(existing.remainingMs) || 0);
        const elapsedMs = Math.max(0, previousDurationMs - previousRemainingMs);
        existing.durationMs = durationMs;
        existing.remainingMs = existing.completed ? 0 : Math.max(0, durationMs - elapsedMs);
        existing.completed = existing.remainingMs <= 0;
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
    updateSettingsSummary();
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

  function refreshActiveTimerState(){
    if(!activeTab?.moduleId || !activeTab?.tabKey) {
      render();
      return;
    }
    ensureEntry(activeTab.moduleId, activeTab.tabKey);
    render();
    syncActiveTabCompletion();
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

  function prettifyOverrideKey(key){
    const raw = String(key || '').trim();
    if(!raw) return '';
    if(raw.includes(':')){
      const [moduleId, tabKey] = raw.split(':');
      return `Module ${moduleId} / ${tabKey}`;
    }
    return raw;
  }

  function getKnownModules(){
    const seen = new Map();

    document.querySelectorAll('.module-btn[data-module]').forEach((button) => {
      const id = String(button.dataset.module || '').trim();
      if(!id) return;
      const label = String(button.textContent || '').trim() || `Module ${id}`;
      seen.set(id, label);
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

  function buildOverrideKey(moduleId, tabKey){
    const cleanModuleId = String(moduleId || '').trim();
    const cleanTabKey = String(tabKey || '').trim();
    if(!cleanTabKey) return '';
    return cleanModuleId ? `${cleanModuleId}:${cleanTabKey}` : cleanTabKey;
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
    const modal = ensureSettingsUi();
    const moduleSelect = modal.querySelector('#tabTimerModuleSelect');
    const tabSelect = modal.querySelector('#tabTimerTabKeySelect');
    const current = getSettingsFormState();

    if(moduleSelect){
      moduleSelect.innerHTML = '<option value="">All modules with this tab key</option>';
      getKnownModules().forEach(({ id, label }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = label;
        moduleSelect.appendChild(option);
      });
      moduleSelect.value = current.moduleId;
    }

    if(tabSelect){
      tabSelect.innerHTML = '<option value="">Select a tab key</option>';
      KNOWN_TAB_KEYS.forEach((key) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key;
        tabSelect.appendChild(option);
      });
      tabSelect.value = current.tabKey;
    }
  }

  function renderCustomOverridesTable(){
    const modal = document.getElementById('tabTimerSettingsModal');
    if(!modal) return;

    const tableWrap = modal.querySelector('#tabTimerOverridesTableWrap');
    const body = modal.querySelector('#tabTimerOverridesTableBody');
    const empty = modal.querySelector('#tabTimerOverridesEmpty');
    if(!tableWrap || !body || !empty) return;

    const entries = Object.entries(readCustomOverrides())
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
      const [moduleId, rawTabKey] = key.includes(':')
        ? key.split(':')
        : ['', key];

      row.innerHTML = `
        <td>${moduleId ? `Module ${moduleId}` : 'All modules'}</td>
        <td>${rawTabKey}</td>
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
            <div class="tab-timer-settings__eyebrow">Testing</div>
            <h2 class="tab-timer-settings__title" id="tabTimerSettingsTitle">Tab Timer Settings</h2>
          </div>
          <button class="tab-timer-settings__close" type="button" data-close="true" aria-label="Close timer settings">×</button>
        </div>
        <p class="tab-timer-settings__help">Choose a tab key, then optionally choose a module if you want the override to apply only there.</p>
        <div class="tab-timer-settings__grid">
          <label class="tab-timer-settings__field">
            <span>Module</span>
            <select class="tab-timer-settings__input" id="tabTimerModuleSelect"></select>
          </label>
          <label class="tab-timer-settings__field">
            <span>Tab key</span>
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
          <button class="btn primary" id="tabTimerSaveBtn" type="button">Save override</button>
          <button class="btn" id="tabTimerResetBtn" type="button">Reset this override</button>
          <button class="btn" id="tabTimerResetAllBtn" type="button">Reset all custom</button>
        </div>
        <div class="tab-timer-settings__list">
          <div class="tab-timer-settings__list-head">
            <h3>Custom overrides</h3>
            <span>Only the overrides you saved in this browser are listed here.</span>
          </div>
          <p class="tab-timer-settings__empty" id="tabTimerOverridesEmpty">No custom overrides saved yet.</p>
          <div class="tab-timer-settings__table-wrap" id="tabTimerOverridesTableWrap" hidden>
            <table class="tab-timer-settings__table">
              <thead>
                <tr>
                  <th scope="col">Scope</th>
                  <th scope="col">Tab key</th>
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
        const overrides = readCustomOverrides();
        delete overrides[key];
        writeCustomOverrides(overrides);
        refreshActiveTimerState();
        updateSettingsSummary();
        populateMinutesForInputs();
      }
    });

    modal.querySelector('#tabTimerUseCurrentBtn')?.addEventListener('click', () => {
      setSettingsFormState(activeTab?.moduleId || '', activeTab?.tabKey || '');
      populateMinutesForInputs();
    });

    modal.querySelector('#tabTimerSaveBtn')?.addEventListener('click', () => {
      const minutesInput = modal.querySelector('#tabTimerMinutesInput');
      const { moduleId, tabKey } = getSettingsFormState();
      const minutes = Number(minutesInput?.value || '');
      if(!tabKey || !Number.isFinite(minutes) || minutes <= 0) return;

      const overrideKey = buildOverrideKey(moduleId, tabKey);
      const overrides = readCustomOverrides();
      overrides[overrideKey] = Math.round(minutes);
      writeCustomOverrides(overrides);
      refreshActiveTimerState();
      updateSettingsSummary();
      populateMinutesForInputs();
    });

    modal.querySelector('#tabTimerResetBtn')?.addEventListener('click', () => {
      const { moduleId, tabKey } = getSettingsFormState();
      if(!tabKey) return;

      const overrideKey = buildOverrideKey(moduleId, tabKey);
      const overrides = readCustomOverrides();
      delete overrides[overrideKey];
      writeCustomOverrides(overrides);
      refreshActiveTimerState();
      updateSettingsSummary();
      populateMinutesForInputs();
    });

    modal.querySelector('#tabTimerResetAllBtn')?.addEventListener('click', () => {
      writeCustomOverrides({});
      refreshActiveTimerState();
      updateSettingsSummary();
      populateMinutesForInputs();
    });

    modal.querySelector('#tabTimerModuleSelect')?.addEventListener('change', populateMinutesForInputs);
    modal.querySelector('#tabTimerTabKeySelect')?.addEventListener('change', populateMinutesForInputs);

    return modal;
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

    const customKeys = Object.keys(readCustomOverrides()).sort();
    const activeText = activeTab?.moduleId && activeTab?.tabKey
      ? `Current tab: Module ${activeTab.moduleId} / ${activeTab.tabKey}`
      : 'Current tab: none';

    if(!customKeys.length){
      summary.textContent = `${activeText}. No custom overrides saved.`;
      renderCustomOverridesTable();
      return;
    }

    summary.textContent = `${activeText}. Custom overrides: ${customKeys.map((key) => prettifyOverrideKey(key)).join(', ')}`;
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
    button.textContent = 'Tab timer settings (testing)';
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
  ensureSettingsUi();
  ensureSettingsButton();
  updateSettingsSummary();
  ensureRunning();
})();