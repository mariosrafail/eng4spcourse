// Modules sidebar behavior: click to open module, only click activates panels (no hover)
(function(){
  const modulesSidebar = document.querySelector('.modules-sidebar');
  if(!modulesSidebar) return;

  const moduleButtons = Array.from(modulesSidebar.querySelectorAll('.module-btn[data-module]'));
  const homeBtn = document.querySelector('#homeBtn');
  const sidebar = document.querySelector('.sidebar');
  const modulesMenuToggle = document.querySelector('#modulesMenuToggle');
  const courseMenuToggle = document.querySelector('#courseMenuToggle');
  const mobileDrawerBackdrop = document.querySelector('#mobileDrawerBackdrop');
  const activeModuleTitle = document.querySelector('#activeModuleTitle');
  const mainContent = document.querySelector('main.content');
  const homeIntroSection = document.querySelector('#homeIntro');
  const modulePanels = Array.from(document.querySelectorAll('.module-panel'));
  const _cache = Object.create(null);
  const _inflight = Object.create(null);
  const EXPAND_PROXIMITY_PX = 72;
  const COLLAPSE_DISTANCE_PX = 140;
  const COLLAPSE_FADE_MS = 220;
  let collapseTimer = null;
  let loadIndicatorTimer = null;
  const MOBILE_BREAKPOINT_QUERY = '(max-width: 980px)';
  const MODULE_TITLES = {
    '9': 'Mini Mock Test'
  };
  const MODULE_SEQUENCE = ['1', '2', '3', '4', '9', '5', '6', '7', '8'];
  const PARTS_PER_MODULE = Object.freeze({
    '1': 13,
    '2': 13,
    '3': 12,
    '4': 13,
    '5': 10,
    '6': 13,
    '7': 13,
    '8': 6,
    '9': 5
  });
  const TOTAL_PARTS = MODULE_SEQUENCE.reduce((sum, id) => sum + (PARTS_PER_MODULE[id] || 0), 0);
  const TOKEN_KEY = 'e4sp_auth_token';
  const FINAL_APPENDIX_MODULE_ID = '10';
  const PROGRESS_BY_PART = Array.from({ length: TOTAL_PARTS + 1 }, (_v, parts) => {
    if(parts >= TOTAL_PARTS) return 100;
    return Math.round((parts * 100) / TOTAL_PARTS);
  });
  const MODULE_START_UNITS = (() => {
    const out = {};
    let cursor = 0;
    MODULE_SEQUENCE.forEach((id) => {
      out[id] = cursor;
      cursor += PARTS_PER_MODULE[id] || 0;
    });
    return out;
  })();
  let currentProgress = 0;
  let currentCompletedParts = 0;
  let unlockNextInFlight = false;
  const unlockNextButton = ensureGlobalUnlockNextButton();

  function getModuleTitle(id){
    const key = String(id);
    const fromMap = MODULE_TITLES[key];
    if(fromMap) return fromMap;
    const btn = moduleButtons.find((b) => b.dataset.module === key);
    const fromButton = btn?.textContent?.trim();
    return fromButton || `Module ${id}`;
  }

  function normalizeProgress(value){
    const numeric = Number(value);
    if(!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  function getCompletedParts(progress = currentProgress){
    const normalized = normalizeProgress(progress);
    if(normalized >= 100) return TOTAL_PARTS;

    let low = 0;
    let high = TOTAL_PARTS;
    while(low < high){
      const mid = Math.floor((low + high + 1) / 2);
      if(PROGRESS_BY_PART[mid] <= normalized){
        low = mid;
      }else{
        high = mid - 1;
      }
    }
    return low;
  }

  function getModuleStartUnit(moduleId){
    return MODULE_START_UNITS[String(moduleId)] ?? 0;
  }

  function getModulePartCount(moduleId){
    return PARTS_PER_MODULE[String(moduleId)] ?? 0;
  }

  function getModuleUnlockUnit(moduleId){
    const id = String(moduleId);
    if(id === FINAL_APPENDIX_MODULE_ID) return TOTAL_PARTS;

    const moduleStart = getModuleStartUnit(id);
    if(id === '9'){
      return moduleStart + 1;
    }
    return moduleStart;
  }

  function getTabUnlockUnit(moduleId, tabIndex){
    const id = String(moduleId);
    if(id === FINAL_APPENDIX_MODULE_ID) return TOTAL_PARTS;

    const partCount = getModulePartCount(id);
    const moduleStart = getModuleStartUnit(id);
    if(partCount <= 0) return moduleStart;

    if(id === '9'){
      return moduleStart + Math.min(tabIndex + 1, partCount);
    }

    if(tabIndex === 0) return moduleStart;
    return moduleStart + Math.min(tabIndex, partCount);
  }

  function getProgressForUnit(unitIndex){
    const safeUnit = Math.max(0, Math.min(TOTAL_PARTS, unitIndex));
    return PROGRESS_BY_PART[safeUnit];
  }

  function syncProgressState(nextProgress){
    currentProgress = normalizeProgress(nextProgress);
    currentCompletedParts = getCompletedParts(currentProgress);
  }

  function isModuleUnlockedByProgress(moduleId, progress){
    const requiredUnit = getModuleUnlockUnit(moduleId);
    return getCompletedParts(progress) >= requiredUnit;
  }

  function isTabUnlockedByProgress(moduleId, tabIndex, progress){
    const id = String(moduleId);
    const completedParts = getCompletedParts(progress);
    const requiredUnit = getTabUnlockUnit(id, tabIndex);
    return completedParts >= requiredUnit;
  }

  function applyChapterLocks(moduleId, tabButtons){
    const id = String(moduleId);
    tabButtons.forEach((btn, index) => {
      const unlocked = isTabUnlockedByProgress(id, index, currentProgress);
      btn.disabled = !unlocked;
      btn.classList.toggle('is-locked', !unlocked);
      btn.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      if(!unlocked){
        const requiredUnit = getTabUnlockUnit(id, index);
        btn.title = `Locked until ${getProgressForUnit(requiredUnit)}%`;
      }else{
        btn.removeAttribute('title');
      }
    });
  }

  function pausePlayableMedia(root){
    const scope = root || mainContent || document;
    const media = Array.from(scope.querySelectorAll('audio, video'));
    media.forEach((el) => {
      try{
        if(!el.paused){
          el.pause();
        }
      }catch(_e){}
    });
  }

  async function setProgressOnServer(nextProgress){
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if(!token) throw new Error('Missing session token.');

    const res = await fetch('/api/progress/set', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ progress: nextProgress })
    });

    let payload = {};
    try{
      payload = await res.json();
    }catch(_e){}

    if(!res.ok){
      throw new Error(payload?.error || `Progress update failed (${res.status})`);
    }

    return payload;
  }

  function updateUnlockNextButtonsState(){
    const isAuth = isAuthenticated();
    const wrap = unlockNextButton?.closest('.unlock-next-wrap');
    if(wrap){
      wrap.hidden = !isAuth;
    }
    if(!isAuth || !unlockNextButton) return;

    const done = currentCompletedParts >= TOTAL_PARTS;
    unlockNextButton.disabled = done || unlockNextInFlight;
    unlockNextButton.textContent = done ? 'All Unlocked (testing)' : (unlockNextInFlight ? 'Updating... (testing)' : 'Unlock Next (testing)');
  }

  async function unlockNextPart(){
    if(unlockNextInFlight) return;
    if(!isAuthenticated()) return;
    if(currentCompletedParts >= TOTAL_PARTS){
      updateUnlockNextButtonsState();
      return;
    }

    unlockNextInFlight = true;
    updateUnlockNextButtonsState();

    try{
      const targetProgress = getProgressForUnit(currentCompletedParts + 1);
      const result = await setProgressOnServer(targetProgress);
      syncProgressState(result?.progress ?? targetProgress);

      const safeProgress = normalizeProgress(currentProgress);
      document.dispatchEvent(new CustomEvent('progress:updated', { detail: { progress: safeProgress } }));
      document.dispatchEvent(new CustomEvent('auth:statechange', { detail: { authenticated: true, progress: safeProgress } }));
    }catch(_e){
      // no-op: auth panel feedback handles explicit controls, this is a quick unlock helper
    }finally{
      unlockNextInFlight = false;
      updateUnlockNextButtonsState();
    }
  }

  function ensureGlobalUnlockNextButton(){
    let wrap = document.querySelector('body > .unlock-next-wrap.unlock-next-global');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.className = 'unlock-next-wrap unlock-next-global';
      wrap.hidden = true;
      document.body.appendChild(wrap);
    }

    let button = wrap.querySelector('.unlock-next-btn');
    if(!button){
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn unlock-next-btn';
      button.textContent = 'Unlock Next (testing)';
      button.addEventListener('click', unlockNextPart);
      wrap.appendChild(button);
    }

    return button;
  }

  function isMobileViewport(){
    return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
  }

  function syncMobileToggleState(){
    const modulesOpen = document.body.classList.contains('mobile-modules-open');
    const courseOpen = document.body.classList.contains('mobile-course-open');
    modulesMenuToggle?.setAttribute('aria-expanded', modulesOpen ? 'true' : 'false');
    courseMenuToggle?.setAttribute('aria-expanded', courseOpen ? 'true' : 'false');
  }

  function closeMobileDrawers(){
    document.body.classList.remove('mobile-modules-open', 'mobile-course-open');
    syncMobileToggleState();
  }

  function toggleMobileDrawer(which){
    if(!isMobileViewport()) return;
    const modulesClass = 'mobile-modules-open';
    const courseClass = 'mobile-course-open';
    if(which === 'modules'){
      const willOpen = !document.body.classList.contains(modulesClass);
      document.body.classList.toggle(modulesClass, willOpen);
      document.body.classList.toggle(courseClass, false);
    }else if(which === 'course'){
      const willOpen = !document.body.classList.contains(courseClass);
      document.body.classList.toggle(courseClass, willOpen);
      document.body.classList.toggle(modulesClass, false);
    }
    syncMobileToggleState();
  }

  function getActiveModulePanel(){
    return modulePanels.find((p) => p.classList.contains('is-active'));
  }

  function showModuleLoading(){
    if(!mainContent) return;
    if(mainContent.querySelector('.module-loading')) return;
    mainContent.innerHTML = `
      <section class="module-loading" aria-live="polite" role="status">
        <div class="module-loading-spinner" aria-hidden="true"></div>
        <div class="module-loading-text">Loading module...</div>
      </section>
    `;
  }

  function hideModuleLoading(){
    if(loadIndicatorTimer){
      clearTimeout(loadIndicatorTimer);
      loadIndicatorTimer = null;
    }
    const loadingEl = mainContent?.querySelector('.module-loading');
    if(loadingEl) loadingEl.remove();
  }

  function scheduleModuleLoading(){
    hideModuleLoading();
    loadIndicatorTimer = setTimeout(showModuleLoading, 140);
  }

  function parseModuleHTML(html){
    const tempDiv = document.createElement('div');
    const normalizedHtml = window.rewriteCourseAssetPathsInHTML
      ? window.rewriteCourseAssetPathsInHTML(html)
      : html;
    tempDiv.innerHTML = normalizedHtml;

    const navElement = tempDiv.querySelector('nav');
    const tabPanels = Array.from(tempDiv.querySelectorAll('section.tab-panel'));

    return {
      menu: navElement ? navElement.outerHTML : '',
      content: tabPanels.map((p) => p.outerHTML).join('')
    };
  }

  async function fetchAndCacheModule(id){
    if(_cache[id]) return _cache[id];
    if(_inflight[id]) return _inflight[id];

    _inflight[id] = (async () => {
      const res = await fetch(`modules/module-${id}.html`, { cache: 'no-store' });
      if(!res.ok) throw new Error('fetch failed');
      const html = await res.text();
      const parsed = parseModuleHTML(html);
      _cache[id] = parsed;
      return parsed;
    })();

    try{
      return await _inflight[id];
    }finally{
      delete _inflight[id];
    }
  }

  // Initialize tab switching for dynamically loaded content
  function initTabs(options = {}){
    const { forceFirstTab = false, focusActiveTab = false } = options;
    const activeModulePanel = getActiveModulePanel();
    if(!activeModulePanel) return;

    let tabButtons = Array.from(activeModulePanel.querySelectorAll('.tab-btn'));
    const panels = Array.from(document.querySelectorAll('main.content .tab-panel'));

    function setActiveTab(key){
      const prevActive = tabButtons.find((b) => b.classList.contains('is-active'))?.dataset.tab || '';
      const tabChanged = prevActive !== key;
      if(tabChanged){
        pausePlayableMedia(mainContent);
      }

      tabButtons.forEach((b) => {
        const isActive = b.dataset.tab === key;
        b.classList.toggle('is-active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      // Hide all panels first
      panels.forEach((p) => {
        p.classList.remove('is-visible');
        p.hidden = true;
      });

      // Show target panel
      const target = panels.find((p) => p.dataset.panel === key);
      if (target){
        target.hidden = false;
        requestAnimationFrame(() => target.classList.add('is-visible'));
      }
      window.updateAmbientThemeForTab?.(key);

      // Scroll to top
      try{
        mainContent?.scrollTo?.({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }catch(_e){}
    }

    // Remove old listeners and add new ones
    tabButtons.forEach((btn) => {
      btn.replaceWith(btn.cloneNode(true));
    });
    
    // Get fresh references after cloning
    const freshTabButtons = Array.from(activeModulePanel.querySelectorAll('.tab-btn'));
    const moduleId = String(activeModulePanel.dataset.module || '');
    applyChapterLocks(moduleId, freshTabButtons);
    tabButtons = freshTabButtons;
    freshTabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if(btn.disabled) return;
        setActiveTab(btn.dataset.tab);
        if(isMobileViewport()){
          closeMobileDrawers();
        }
      });
    });

    // Set initial active tab
    const initiallyActive =
      (forceFirstTab ? freshTabButtons.find((b) => !b.disabled)?.dataset.tab : null) ||
      freshTabButtons.find((b) => b.classList.contains('is-active') && !b.disabled)?.dataset.tab ||
      freshTabButtons.find((b) => !b.disabled)?.dataset.tab ||
      'info';
    setActiveTab(initiallyActive);
    if(focusActiveTab){
      const activeBtn = freshTabButtons.find((b) => b.classList.contains('is-active') && !b.disabled);
      activeBtn?.focus({ preventScroll: true });
    }
  }

  async function loadModule(id, options = {}){
    const { forceFirstTab = false, focusActiveTab = false } = options;
    const panel = modulePanels.find(p => p.dataset.module === String(id));
    if(!panel || !mainContent) return;
    
    // Check if already cached
    if(_cache[id]){ 
      panel.innerHTML = _cache[id].menu; 
      mainContent.innerHTML = _cache[id].content;
      initTabs({ forceFirstTab, focusActiveTab });
      // Also reinitialize all app functionality
      if (window.initializeApp) {
        window.initializeApp();
      }
      if (window.initializeH2Writing) {
        window.initializeH2Writing();
      }
      return; 
    }
    
    try{
      scheduleModuleLoading();
      const parsed = await fetchAndCacheModule(id);
      
      // Inject into DOM
      panel.innerHTML = parsed.menu;
      mainContent.innerHTML = parsed.content;
      
      // Initialize tabs after injection
      initTabs({ forceFirstTab, focusActiveTab });
      
      // Also reinitialize all app functionality (audio, quizzes, drag-drop, etc.)
      if (window.initializeApp) {
        window.initializeApp();
      }
      if (window.initializeH2Writing) {
        window.initializeH2Writing();
      }
    }catch(e){
      panel.innerHTML = '<!-- failed to load module -->';
      mainContent.innerHTML = '<!-- failed to load module content -->';
    }finally{
      hideModuleLoading();
    }
  }

  function prefetchModules(exceptId){
    moduleButtons.forEach((btn) => {
      const id = btn.dataset.module;
      if(!id || id === String(exceptId)) return;
      if(_cache[id] || _inflight[id]) return;
      fetchAndCacheModule(id).catch(() => {});
    });
  }

  function setActive(id){
    if(!document.body.classList.contains('is-authenticated')) return;
    const moduleButton = moduleButtons.find((b) => b.dataset.module === String(id));
    if(!moduleButton || moduleButton.disabled) return;
    moduleButtons.forEach(b => b.classList.toggle('is-active', b.dataset.module === String(id)));
    modulePanels.forEach(p => {
      const match = p.dataset.module === String(id);
      p.classList.toggle('is-active', match);
      p.hidden = !match;
    });
    // Show the sidebar when a module is activated
    if(sidebar) sidebar.style.display = 'flex';
    if(activeModuleTitle){
      activeModuleTitle.textContent = getModuleTitle(id);
    }
    pausePlayableMedia(mainContent);
    // Keep modules sidebar open on click; collapse only after cursor moves far away.
    if(collapseTimer){
      clearTimeout(collapseTimer);
      collapseTimer = null;
    }
    modulesSidebar.classList.remove('is-collapsing');
    modulesSidebar.classList.remove('is-collapsed');
    if(isMobileViewport()){
      document.body.classList.remove('mobile-modules-open');
      document.body.classList.add('mobile-course-open');
      syncMobileToggleState();
    }
    loadModule(id, { forceFirstTab: true, focusActiveTab: true });
    setTimeout(() => prefetchModules(id), 220);
  }

  function showHome(){
    if(!document.body.classList.contains('is-authenticated')) return;
    pausePlayableMedia(mainContent);

    moduleButtons.forEach((b) => b.classList.remove('is-active'));
    modulePanels.forEach((p) => {
      p.classList.remove('is-active');
      p.hidden = true;
    });

    if(sidebar) sidebar.style.display = 'none';
    if(activeModuleTitle) activeModuleTitle.textContent = '';

    if(mainContent && homeIntroSection){
      mainContent.innerHTML = '';
      mainContent.appendChild(homeIntroSection);
    }

    if(isMobileViewport()){
      closeMobileDrawers();
    }

    // Reset ambient/nav theme to the default Home purple.
    if(typeof window.updateAmbientThemeForTab === 'function'){
      window.updateAmbientThemeForTab('info');
    }else{
      document.documentElement?.style.setProperty('--ambient-rgb', '122,103,201');
      document.documentElement?.style.setProperty('--nav-accent-rgb', '122,103,201');
    }
  }

  function applyModuleLocks(){
    moduleButtons.forEach((btn) => {
      const id = String(btn.dataset.module || '');
      const unlocked = isModuleUnlockedByProgress(id, currentProgress);
      btn.disabled = !unlocked;
      btn.classList.toggle('is-locked', !unlocked);
      btn.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      if(!unlocked){
        const requiredUnit = getModuleUnlockUnit(id);
        btn.title = `Locked until ${getProgressForUnit(requiredUnit)}%`;
      }else{
        btn.removeAttribute('title');
      }
    });

    const activeButton = moduleButtons.find((btn) => btn.classList.contains('is-active'));
    if(activeButton?.disabled){
      showHome();
    }
    updateUnlockNextButtonsState();
  }

  moduleButtons.forEach(btn => {
    // Only click activates the module
    btn.addEventListener('click', () => {
      const id = btn.dataset.module;
      setActive(id);
    });
    btn.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); btn.click(); }
    });
  });

  function hasActiveModule(){
    return moduleButtons.some((b) => b.classList.contains('is-active'));
  }

  function isAuthenticated(){
    return document.body.classList.contains('is-authenticated');
  }

  function distanceFromRect(x, y, rect){
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    return Math.hypot(dx, dy);
  }

  function handlePointerProximity(x, y){
    if(isMobileViewport()) return;
    if(!hasActiveModule()) return;
    const rect = modulesSidebar.getBoundingClientRect();
    const distance = distanceFromRect(x, y, rect);

    if(modulesSidebar.classList.contains('is-collapsed')){
      if(distance <= EXPAND_PROXIMITY_PX){
        if(collapseTimer){
          clearTimeout(collapseTimer);
          collapseTimer = null;
        }
        modulesSidebar.classList.remove('is-collapsing');
        modulesSidebar.classList.remove('is-collapsed');
      }
      return;
    }

    if(distance >= COLLAPSE_DISTANCE_PX){
      if(modulesSidebar.classList.contains('is-collapsing') || collapseTimer) return;
      modulesSidebar.classList.add('is-collapsing');
      collapseTimer = setTimeout(() => {
        modulesSidebar.classList.add('is-collapsed');
        modulesSidebar.classList.remove('is-collapsing');
        collapseTimer = null;
      }, COLLAPSE_FADE_MS);
      return;
    }

    if(modulesSidebar.classList.contains('is-collapsing')){
      if(collapseTimer){
        clearTimeout(collapseTimer);
        collapseTimer = null;
      }
      modulesSidebar.classList.remove('is-collapsing');
    }
  }

  document.addEventListener('mousemove', (e) => {
    handlePointerProximity(e.clientX, e.clientY);
  });

  homeBtn?.addEventListener('click', showHome);
  homeBtn?.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      showHome();
    }
  });

  const miniMockBtn = moduleButtons.find((b) => b.dataset.module === '9');
  if(miniMockBtn) miniMockBtn.textContent = getModuleTitle(9);


  const moduleFromQuery = Number(new URLSearchParams(window.location.search).get('module'));
  if(isAuthenticated() && Number.isInteger(moduleFromQuery) && moduleFromQuery >= 1 && moduleFromQuery <= 10){
    setActive(moduleFromQuery);
  }

  document.addEventListener('auth:statechange', (event) => {
    const isAuth = !!event?.detail?.authenticated;
    syncProgressState(isAuth ? event?.detail?.progress : 0);
    if(!isAuth){
      updateUnlockNextButtonsState();
      return;
    }

    applyModuleLocks();

    if(hasActiveModule()){
      initTabs({ forceFirstTab: false, focusActiveTab: false });
      return;
    }

    if(Number.isInteger(moduleFromQuery) && moduleFromQuery >= 1 && moduleFromQuery <= 10){
      setActive(moduleFromQuery);
    }
  });

  modulesMenuToggle?.addEventListener('click', () => toggleMobileDrawer('modules'));
  courseMenuToggle?.addEventListener('click', () => toggleMobileDrawer('course'));
  mobileDrawerBackdrop?.addEventListener('click', closeMobileDrawers);
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') closeMobileDrawers();
  });
  window.addEventListener('resize', () => {
    if(!isMobileViewport()) closeMobileDrawers();
  });
  syncMobileToggleState();
  updateUnlockNextButtonsState();

})();
