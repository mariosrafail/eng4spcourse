// Modules sidebar behavior: click to open module, only click activates panels (no hover)
(function(){
  const modulesSidebar = document.querySelector('.modules-sidebar');
  if(!modulesSidebar) return;

  const moduleButtons = Array.from(modulesSidebar.querySelectorAll('.module-btn'));
  const sidebar = document.querySelector('.sidebar');
  const activeModuleTitle = document.querySelector('#activeModuleTitle');
  const mainContent = document.querySelector('main.content');
  const modulePanels = Array.from(document.querySelectorAll('.module-panel'));
  const _cache = Object.create(null);
  const EXPAND_PROXIMITY_PX = 72;
  const COLLAPSE_DISTANCE_PX = 140;
  const COLLAPSE_FADE_MS = 220;
  let collapseTimer = null;

  function getActiveModulePanel(){
    return modulePanels.find((p) => p.classList.contains('is-active'));
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
      btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
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
      const res = await fetch(`modules/module-${id}.html`, { cache: 'no-cache' });
      if(!res.ok) throw new Error('fetch failed');
      const html = await res.text();
      
      // Parse the HTML to separate menu (nav) and content (tab-panels)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      const navElement = tempDiv.querySelector('nav');
      const tabPanels = Array.from(tempDiv.querySelectorAll('section.tab-panel'));
      
      const menuHTML = navElement ? navElement.outerHTML : '';
      const contentHTML = tabPanels.map(p => p.outerHTML).join('');
      
      // Cache both parts
      _cache[id] = { menu: menuHTML, content: contentHTML };
      
      // Inject into DOM
      panel.innerHTML = menuHTML;
      mainContent.innerHTML = contentHTML;
      
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
    }
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
    if(activeModuleTitle) activeModuleTitle.textContent = `Module ${id}`;
    // Keep modules sidebar open on click; collapse only after cursor moves far away.
    if(collapseTimer){
      clearTimeout(collapseTimer);
      collapseTimer = null;
    }
    modulesSidebar.classList.remove('is-collapsing');
    modulesSidebar.classList.remove('is-collapsed');
    loadModule(id, { forceFirstTab: true, focusActiveTab: true });
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

})();
