// Modules sidebar behavior: click to open module, only click activates panels (no hover)
(function(){
  const modulesSidebar = document.querySelector('.modules-sidebar');
  if(!modulesSidebar) return;

  const moduleButtons = Array.from(modulesSidebar.querySelectorAll('.module-btn[data-module]'));
  const sidebar = document.querySelector('.sidebar');
  const modulesMenuToggle = document.querySelector('#modulesMenuToggle');
  const courseMenuToggle = document.querySelector('#courseMenuToggle');
  const mobileDrawerBackdrop = document.querySelector('#mobileDrawerBackdrop');
  const activeModuleTitle = document.querySelector('#activeModuleTitle');
  const mainContent = document.querySelector('main.content');
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

  function getModuleTitle(id){
    const key = String(id);
    const fromMap = MODULE_TITLES[key];
    if(fromMap) return fromMap;
    const btn = moduleButtons.find((b) => b.dataset.module === key);
    const fromButton = btn?.textContent?.trim();
    return fromButton || `Module ${id}`;
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
    tempDiv.innerHTML = html;

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
    tabButtons = freshTabButtons;
    freshTabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        setActiveTab(btn.dataset.tab);
        if(isMobileViewport()){
          closeMobileDrawers();
        }
      });
    });

    // Set initial active tab
    const initiallyActive =
      (forceFirstTab ? freshTabButtons[0]?.dataset.tab : null) ||
      freshTabButtons.find((b) => b.classList.contains('is-active'))?.dataset.tab ||
      freshTabButtons[0]?.dataset.tab ||
      'info';
    setActiveTab(initiallyActive);
    if(focusActiveTab){
      const activeBtn = freshTabButtons.find((b) => b.classList.contains('is-active'));
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

  const miniMockBtn = moduleButtons.find((b) => b.dataset.module === '9');
  if(miniMockBtn) miniMockBtn.textContent = getModuleTitle(9);


  const moduleFromQuery = Number(new URLSearchParams(window.location.search).get('module'));
  if(Number.isInteger(moduleFromQuery) && moduleFromQuery >= 1 && moduleFromQuery <= 9){
    setActive(moduleFromQuery);
  }

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

})();
