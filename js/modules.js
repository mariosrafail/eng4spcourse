// Modules sidebar behavior: click to open module, only click activates panels (no hover)
(function(){
  const modulesSidebar = document.querySelector('.modules-sidebar');
  if(!modulesSidebar) return;

  const moduleButtons = Array.from(modulesSidebar.querySelectorAll('.module-btn'));
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('main.content');
  const modulePanels = Array.from(document.querySelectorAll('.module-panel'));
  const _cache = Object.create(null);

  // Initialize tab switching for dynamically loaded content
  function initTabs(){
    const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
    const panels = Array.from(document.querySelectorAll('.tab-panel'));

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
    const freshTabButtons = Array.from(document.querySelectorAll('.tab-btn'));
    freshTabButtons.forEach((btn) => {
      btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
    });

    // Set initial active tab
    const initiallyActive = freshTabButtons.find((b) => b.classList.contains('is-active'))?.dataset.tab || 'info';
    setActiveTab(initiallyActive);
  }

  async function loadModule(id){
    const panel = modulePanels.find(p => p.dataset.module === String(id));
    if(!panel || !mainContent) return;
    
    // Check if already cached
    if(_cache[id]){ 
      panel.innerHTML = _cache[id].menu; 
      mainContent.innerHTML = _cache[id].content;
      initTabs();
      // Also reinitialize all app functionality
      if (window.initializeApp) {
        window.initializeApp();
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
      initTabs();
      
      // Also reinitialize all app functionality (audio, quizzes, drag-drop, etc.)
      if (window.initializeApp) {
        window.initializeApp();
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
    loadModule(id);
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

})();
