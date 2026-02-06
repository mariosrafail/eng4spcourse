// Basic UI hardening (deterrent only, not real security).
(() => {
  if (window.__uiHardeningBound) return;
  window.__uiHardeningBound = true;

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  document.addEventListener('keydown', (e) => {
    const key = (e.key || '').toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    const blocked =
      key === 'f11' ||
      key === 'f12' ||
      (ctrl && key === 's') ||
      (ctrl && key === 'u') ||
      (ctrl && key === 'p') ||
      (ctrl && shift && (key === 'i' || key === 'j' || key === 'c' || key === 'k')) ||
      (shift && key === 'f10');

    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
})();

// Wrap everything in a function that can be called multiple times (for dynamic module loading)
window.initializeApp = function initializeApp() {
  // Tabs (scoped to active module only)
  const activeModulePanel = document.querySelector('.module-panel.is-active');
  const tabButtons = activeModulePanel ? Array.from(activeModulePanel.querySelectorAll('.tab-btn')) : [];
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

    // Show target panel without animation
    const target = panels.find((p) => p.dataset.panel === key);
    if (target){
      target.hidden = false;
    }

    // Scroll to top of content when switching tabs
    try{
      document.querySelector('.content')?.scrollTo?.({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }catch(_e){}
  }

  if (tabButtons.length){
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
    });

    // Initial state
    const initiallyActive =
      tabButtons.find((b) => b.classList.contains('is-active'))?.dataset.tab ||
      tabButtons[0]?.dataset.tab ||
      'info';
    setActiveTab(initiallyActive);
  }

  // Hover highlight position for buttons and tabs
  function updateRadialVars(el, clientX, clientY){
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * 100;
    const y = Math.max(0, Math.min(1, (clientY - r.top) / r.height)) * 100;
    el.style.setProperty('--rx', x.toFixed(2) + '%');
    el.style.setProperty('--ry', y.toFixed(2) + '%');
  }

  const hotspotSel = '.btn, .tab-btn, .kw-reveal, .dd-token, .dd-dropzone, .tiny-btn';
  document.addEventListener('pointermove', (e) => {
    const el = e.target?.closest?.(hotspotSel);
    if (!el) return;
    updateRadialVars(el, e.clientX, e.clientY);
  }, { passive: true });

  // Audio (bind multiple players safely)
  function bindAudioPlayer(cfg){
    const audio = document.getElementById(cfg.audioId);
    const playBtn = document.getElementById(cfg.playId);
    const pauseBtn = document.getElementById(cfg.pauseId);
    const restartBtn = document.getElementById(cfg.restartId);
    const audioStatus = document.getElementById(cfg.statusId);
    const progressBar = document.getElementById(cfg.progressId);

    function setStatus(text){
      if (audioStatus) audioStatus.textContent = text;
    }

    function updateProgress(){
      if (!audio || !progressBar) return;
      if (!audio.duration || Number.isNaN(audio.duration)){
        progressBar.style.width = '0%';
        return;
      }
      const pct = Math.max(0, Math.min(1, audio.currentTime / audio.duration)) * 100;
      progressBar.style.width = pct.toFixed(2) + '%';
    }

    function safePlay(){
      if (!audio) return;
      audio.play()
        .then(() => setStatus('Playing'))
        .catch(() => setStatus('Click Play to start'));
    }

    playBtn?.addEventListener('click', safePlay);
    pauseBtn?.addEventListener('click', () => {
      if (!audio) return;
      audio.pause();
      setStatus('Paused');
    });
    restartBtn?.addEventListener('click', () => {
      if (!audio) return;
      audio.currentTime = 0;
      audio.pause();
      setStatus('Ready');
      updateProgress();
    });

    audio?.addEventListener('timeupdate', updateProgress);
    audio?.addEventListener('ended', () => {
      setStatus('Ended');
      updateProgress();
      if (typeof cfg.onEnded === 'function') cfg.onEnded();
    });

    // Init
    updateProgress();
    setStatus('Ready');

    return { audio, setStatus, updateProgress };
  }

  const exPlayer = bindAudioPlayer({
    audioId: 'dialogueAudio',
    playId: 'playBtn',
    pauseId: 'pauseBtn',
    restartId: 'restartBtn',
    statusId: 'audioStatus',
    progressId: 'progressBar'
  });

  const liPlayer = bindAudioPlayer({
    audioId: 'listeningAudio',
    playId: 'liPlayBtn',
    pauseId: 'liPauseBtn',
    restartId: 'liRestartBtn',
    statusId: 'liAudioStatus',
    progressId: 'liProgressBar'
  });

	const h2liPlayer = bindAudioPlayer({
	  audioId: 'h2ListeningAudio',
	  playId: 'h2liPlayBtn',
	  pauseId: 'h2liPauseBtn',
	  restartId: 'h2liRestartBtn',
	  statusId: 'h2liAudioStatus',
	  progressId: 'h2liProgressBar'
	});

// Quiz (bind multiple quizzes with scoped marking)
  async function checkQuizOnServer(quizId, answers){
    const res = await fetch('/api/check-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId, answers })
    });

    if (!res.ok){
      throw new Error(`Quiz check failed with status ${res.status}`);
    }

    return res.json();
  }

  async function checkDndOnServer(exerciseId, answers){
    const res = await fetch('/api/check-dnd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseId, answers })
    });

    if (!res.ok){
      throw new Error(`DnD check failed with status ${res.status}`);
    }

    return res.json();
  }

  function bindQuiz(cfg){
    const form = document.getElementById(cfg.formId);
    const feedback = document.getElementById(cfg.feedbackId);
    const resetBtn = document.getElementById(cfg.resetId);
    const questionIds = Array.isArray(cfg.questionIds) ? cfg.questionIds : [];

    function clearMarks(){
      if (!form) return;
      form.querySelectorAll('.q').forEach((q) => q.classList.remove('is-wrong', 'is-right'));
      if (feedback){
        feedback.className = 'feedback';
        feedback.textContent = '';
      }
      if (cfg.onClear) cfg.onClear();
    }

    function readValue(name){
      if (!form) return null;
      const checked = form.querySelector(`input[name="${name}"]:checked`);
      return checked ? checked.value : null;
    }

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMarks();

      let wrongCount = 0;
      const submittedAnswers = {};

      questionIds.forEach((key) => {
        const val = readValue(key);
        const qEl = form.querySelector(`.q[data-q="${key}"]`);
        if (!qEl) return;

        if (!val){
          submittedAnswers[key] = null;
          wrongCount += 1;
          qEl.classList.add('is-wrong');
          return;
        }

        submittedAnswers[key] = val;
      });

      if (!feedback) return;

      if (wrongCount === 0){
        try{
          const result = await checkQuizOnServer(cfg.serverQuizId, submittedAnswers);
          questionIds.forEach((key) => {
            const qEl = form.querySelector(`.q[data-q="${key}"]`);
            if (!qEl) return;
            const ok = !!result?.correctByQuestion?.[key];
            qEl.classList.add(ok ? 'is-right' : 'is-wrong');
            if (!ok) wrongCount += 1;
          });
        }catch(_err){
          feedback.className = 'feedback is-bad';
          feedback.textContent = 'Cannot validate answers now. Try again in a moment.';
          if (cfg.onNotAllCorrect) cfg.onNotAllCorrect();
          return;
        }
      }

      if (wrongCount === 0){
        feedback.className = 'feedback is-good';
        feedback.textContent = cfg.goodText || 'All answers are correct. Well done.';
        if (cfg.onAllCorrect) cfg.onAllCorrect();
      }else{
        feedback.className = 'feedback is-bad';
        feedback.textContent = cfg.badText || 'Incorrect. Listen again and try again.';
        if (cfg.onNotAllCorrect) cfg.onNotAllCorrect();
      }
    });

    resetBtn?.addEventListener('click', () => {
      clearMarks();
      form?.reset();
      if (cfg.onReset) cfg.onReset();
    });

    return { form, clearMarks };
  }

  // I. Useful Language
  bindQuiz({
    formId: 'quizForm',
    feedbackId: 'feedback',
    resetId: 'resetBtn',
    serverQuizId: 'module2_useful_language',
    questionIds: ['q1', 'q2', 'q3'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Incorrect. Listen again and try again.',
    onReset: () => {
      const a = exPlayer?.audio;
      if (a){
        a.pause();
        a.currentTime = 0;
        exPlayer.setStatus('Ready');
        exPlayer.updateProgress();
      }
    }
  });

  // III. Listening
  const liShowAnswersBtn = document.getElementById('liShowAnswers');
  const liAnswersBox = document.getElementById('liAnswersBox');

	// Second Hour - III. Listening
	const h2liShowAnswersBtn = document.getElementById('h2liShowAnswers');
	const h2liAnswersBox = document.getElementById('h2liAnswersBox');

  bindQuiz({
    formId: 'listeningForm',
    feedbackId: 'liFeedback',
    resetId: 'liResetBtn',
    serverQuizId: 'module2_listening',
    questionIds: ['lq1', 'lq2', 'lq3'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Incorrect. Listen again and try again.',
    onClear: () => {
      liShowAnswersBtn?.setAttribute('disabled','disabled');
      if (liAnswersBox) liAnswersBox.hidden = true;
    },
    onAllCorrect: () => {
      liShowAnswersBtn?.removeAttribute('disabled');
    },
    onNotAllCorrect: () => {
      liShowAnswersBtn?.setAttribute('disabled','disabled');
      if (liAnswersBox) liAnswersBox.hidden = true;
    },
    onReset: () => {
      const a = liPlayer?.audio;
      if (a){
        a.pause();
        a.currentTime = 0;
        liPlayer.setStatus('Ready');
        liPlayer.updateProgress();
      }
    }
  });

	bindQuiz({
	  formId: 'h2ListeningForm',
	  feedbackId: 'h2liFeedback',
	  resetId: 'h2liResetBtn',
	  serverQuizId: 'module2_h2_listening',
	  questionIds: ['h2lq1', 'h2lq2', 'h2lq3'],
	  goodText: 'All answers are correct. Well done.',
	  badText: 'Incorrect. Listen again and try again.',
	  onClear: () => {
	    h2liShowAnswersBtn?.setAttribute('disabled','disabled');
	    if (h2liAnswersBox) h2liAnswersBox.hidden = true;
	  },
	  onAllCorrect: () => {
	    h2liShowAnswersBtn?.removeAttribute('disabled');
	  },
	  onNotAllCorrect: () => {
	    h2liShowAnswersBtn?.setAttribute('disabled','disabled');
	    if (h2liAnswersBox) h2liAnswersBox.hidden = true;
	  },
	  onReset: () => {
	    const a = h2liPlayer?.audio;
	    if (a){
	      a.pause();
	      a.currentTime = 0;
	      h2liPlayer.setStatus('Ready');
	      h2liPlayer.updateProgress();
	    }
	  }
	});

  // VI. Reading
  bindQuiz({
    formId: 'readingForm',
    feedbackId: 'readingFeedback',
    resetId: 'readingReset',
    serverQuizId: 'module2_reading',
    questionIds: ['r1', 'r2', 'r3'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Some answers are incorrect. Check the highlighted question(s) and try again.'
  });

// Second Hour: IV. Reading
bindQuiz({
  formId: 'h2ReadingForm',
  feedbackId: 'h2ReadingFeedback',
  resetId: 'h2ReadingReset',
  serverQuizId: 'module2_h2_reading',
  questionIds: ['h2r1', 'h2r2', 'h2r3'],
  goodText: 'All answers are correct. Well done.',
  badText: 'Some answers are incorrect. Check the highlighted question(s) and try again.'
});

  liShowAnswersBtn?.addEventListener('click', () => {
    if (liShowAnswersBtn.hasAttribute('disabled')) return;
    if (liAnswersBox) liAnswersBox.hidden = !liAnswersBox.hidden;
  });

	h2liShowAnswersBtn?.addEventListener('click', () => {
	  if (h2liShowAnswersBtn.hasAttribute('disabled')) return;
	  if (h2liAnswersBox) h2liAnswersBox.hidden = !h2liAnswersBox.hidden;
	});

// Key Words: reveal per word
  const kwRows = Array.from(document.querySelectorAll('.kw-row'));
  const revealAllBtn = document.getElementById('revealAllBtn');
  const hideAllBtn = document.getElementById('hideAllBtn');

  function setKwRow(row, reveal){
    if (!row) return;
    const meaning = row.querySelector('.kw-meaning');
    const btn = row.querySelector('.kw-reveal');
    row.classList.toggle('is-revealed', !!reveal);
    if (meaning) meaning.hidden = !reveal;
    if (btn){
      btn.textContent = reveal ? 'Hide' : 'Reveal';
      btn.setAttribute('aria-expanded', reveal ? 'true' : 'false');
    }
  }

  kwRows.forEach((row) => {
    const btn = row.querySelector('.kw-reveal');
    btn?.addEventListener('click', () => {
      const nextState = !row.classList.contains('is-revealed');
      setKwRow(row, nextState);
    });
  });

  revealAllBtn?.addEventListener('click', () => {
    kwRows.forEach((row) => setKwRow(row, true));
  });

  hideAllBtn?.addEventListener('click', () => {
    kwRows.forEach((row) => setKwRow(row, false));
  });

  // Pronunciation buttons (KEY WORDS speakers)
  function setupPronunciation(){
    const buttons = Array.from(document.querySelectorAll('.speak-btn[data-word]'));
    if(!buttons.length) return;

    function speak(word){
      try{
        if(!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(word);
        u.lang = 'en-US';
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
      }catch(e){}
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => speak(btn.dataset.word || ''));
      btn.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          speak(btn.dataset.word || '');
        }
      });
    });
  }

// Practice (Tab V) drag and drop
  function setupPracticeDnD(){
    const root = document.querySelector('#tabPractice');
    if(!root) return;

    const bank = root.querySelector('.practice-bank');
    const tokens = Array.from(root.querySelectorAll('.token'));
    const blanks = Array.from(root.querySelectorAll('.blank'));
    const checkBtn = root.querySelector('#practiceCheck');
    const resetBtn = root.querySelector('#practiceReset');
    const feedback = root.querySelector('#practiceFeedback');

    let selectedToken = null;

    function clearMarks(){
      blanks.forEach(b => {
        b.classList.remove('is-correct','is-wrong','is-over');
      });
    }

    function setFeedback(msg){
      if(feedback) feedback.textContent = msg || '';
    }

    function moveTokenToBank(token){
      if(!token) return;
      token.classList.remove('is-selected');
      bank.appendChild(token);
    }

    function getTokenInBlank(blank){
      return blank.querySelector('.token');
    }

    function placeToken(blank, token){
      if(!blank || !token) return;
      const existing = getTokenInBlank(blank);
      if(existing && existing !== token){
        moveTokenToBank(existing);
      }
      blank.appendChild(token);
      token.classList.remove('is-selected');
      selectedToken = null;
      clearMarks();
      setFeedback('');
    }

    function onTokenClick(token){
      if(selectedToken === token){
        token.classList.remove('is-selected');
        selectedToken = null;
        return;
      }
      tokens.forEach(t => t.classList.remove('is-selected'));
      token.classList.add('is-selected');
      selectedToken = token;
    }

    tokens.forEach((t, idx) => {
      if(!t.id) t.id = `tok_${idx}_${Math.random().toString(16).slice(2)}`;

      t.addEventListener('click', () => onTokenClick(t));

      t.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          onTokenClick(t);
        }
      });

      t.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        window.requestAnimationFrame(() => t.classList.add('is-dragging'));
      });

      t.addEventListener('dragend', () => {
        t.classList.remove('is-dragging');
        blanks.forEach(b => b.classList.remove('is-over'));
      });
    });

    blanks.forEach((b) => {
      b.addEventListener('click', () => {
        if(selectedToken) placeToken(b, selectedToken);
      });

      b.addEventListener('keydown', (e) => {
        if((e.key === 'Enter' || e.key === ' ') && selectedToken){
          e.preventDefault();
          placeToken(b, selectedToken);
        }
      });

      b.addEventListener('dragover', (e) => {
        e.preventDefault();
        b.classList.add('is-over');
        e.dataTransfer.dropEffect = 'move';
      });

      b.addEventListener('dragleave', () => b.classList.remove('is-over'));

      b.addEventListener('drop', (e) => {
        e.preventDefault();
        b.classList.remove('is-over');
        const id = e.dataTransfer.getData('text/plain');
        const token = root.querySelector(`#${CSS.escape(id)}`);
        if(token) placeToken(b, token);
      });
    });

    bank.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    bank.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      const token = root.querySelector(`#${CSS.escape(id)}`);
      if(token) moveTokenToBank(token);
      clearMarks();
      setFeedback('');
    });

    checkBtn?.addEventListener('click', async () => {
      clearMarks();
      let allFilled = true;
      const answers = [];

      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        const got = t ? (t.dataset.word || t.textContent || '').trim() : '';
        answers.push(got);
        if(!t) allFilled = false;
      });

      if(!allFilled){
        setFeedback('Fill all blanks first.');
        return;
      }

      try{
        const result = await checkDndOnServer('module2_practice', answers);
        let correct = 0;
        blanks.forEach((b, i) => {
          const isCorrect = !!result?.correctByIndex?.[i];
          b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          if(isCorrect) correct += 1;
        });
        if(correct === blanks.length){
          setFeedback('Correct. Well done.');
        }else{
          setFeedback('Some answers are incorrect. Try again.');
        }
      }catch(_e){
        setFeedback('Cannot validate answers now. Try again in a moment.');
      }
    });

    resetBtn?.addEventListener('click', () => {
      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        if(t) moveTokenToBank(t);
      });
      tokens.forEach(t => t.classList.remove('is-selected'));
      selectedToken = null;
      clearMarks();
      setFeedback('');
    });
  }

  // Speaking (Tab VII) matching drag and drop
  function setupSpeakingMatchDnD(){
    const root = document.querySelector('#tabSpeaking');
    if(!root) return;

    const bank = root.querySelector('.practice-bank');
    const tokens = Array.from(root.querySelectorAll('.token'));
    const blanks = Array.from(root.querySelectorAll('.blank'));
    const checkBtn = root.querySelector('#speakingCheck');
    const resetBtn = root.querySelector('#speakingReset');
    const feedback = root.querySelector('#speakingFeedback');

    let selectedToken = null;

    function clearMarks(){
      blanks.forEach(b => {
        b.classList.remove('is-correct','is-wrong','is-over');
      });
    }

    function setFeedback(msg){
      if(!feedback) return;
      feedback.textContent = msg;
    }

    function getTokenInBlank(blank){
      return blank.querySelector('.token');
    }

    function returnTokenToBank(token){
      if(!token || !bank) return;
      token.classList.remove('is-placed');
      bank.appendChild(token);
    }

    function placeToken(blank, token){
      if(!blank || !token) return;

      // If blank already has a token, return it to bank
      const existing = getTokenInBlank(blank);
      if(existing && existing !== token){
        returnTokenToBank(existing);
      }

      token.classList.add('is-placed');
      blank.textContent = '';
      blank.appendChild(token);
      selectedToken = null;

      tokens.forEach(t => t.classList.remove('is-selected'));
      clearMarks();
      setFeedback('');
    }

    function onTokenClick(token){
      tokens.forEach(t => t.classList.remove('is-selected'));
      token.classList.add('is-selected');
      selectedToken = token;
    }

    tokens.forEach((t, idx) => {
      if(!t.id) t.id = `sptok_${idx}_${Math.random().toString(16).slice(2)}`;
      t.addEventListener('click', () => onTokenClick(t));

      t.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          onTokenClick(t);
        }
      });

      t.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        window.requestAnimationFrame(() => t.classList.add('is-dragging'));
      });

      t.addEventListener('dragend', () => {
        t.classList.remove('is-dragging');
        blanks.forEach(b => b.classList.remove('is-over'));
      });
    });

    blanks.forEach((b) => {
      b.addEventListener('click', () => {
        if(selectedToken) placeToken(b, selectedToken);
      });

      b.addEventListener('keydown', (e) => {
        if((e.key === 'Enter' || e.key === ' ') && selectedToken){
          e.preventDefault();
          placeToken(b, selectedToken);
        }
      });

      b.addEventListener('dragover', (e) => {
        e.preventDefault();
        b.classList.add('is-over');
      });

      b.addEventListener('dragleave', () => {
        b.classList.remove('is-over');
      });

      b.addEventListener('drop', (e) => {
        e.preventDefault();
        b.classList.remove('is-over');
        const id = e.dataTransfer.getData('text/plain');
        const token = root.querySelector('#' + CSS.escape(id));
        if(token) placeToken(b, token);
      });
    });

    function reset(){
      clearMarks();
      setFeedback('');
      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        if(t) returnTokenToBank(t);
        b.textContent = '';
      });
      tokens.forEach(t => t.classList.remove('is-selected'));
      selectedToken = null;
    }

    async function check(){
      clearMarks();

      let allFilled = true;
      const answers = [];

      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        const got = t ? (t.dataset.word || t.textContent || '').trim() : '';
        answers.push(got);
        if(!t) allFilled = false;
      });

      if(!allFilled){
        setFeedback('Fill all blanks first.');
        return;
      }

      try{
        const result = await checkDndOnServer('module2_speaking', answers);
        let correct = 0;
        blanks.forEach((b, i) => {
          const isCorrect = !!result?.correctByIndex?.[i];
          b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          if(isCorrect) correct += 1;
        });
        if(correct === blanks.length){
          setFeedback('All correct. Well done.');
        }else{
          setFeedback('Some answers are wrong. Try again.');
        }
      }catch(_e){
        setFeedback('Cannot validate answers now. Try again in a moment.');
      }
    }

    checkBtn?.addEventListener('click', check);
    resetBtn?.addEventListener('click', reset);

    reset();
  }

  // Hour 2 (Tab II) Key Words matching drag and drop
  function setupHour2KeywordsMatchDnD(){
    const root = document.querySelector('#tabHour2Keywords');
    if(!root) return;

    const bank = root.querySelector('.practice-bank');
    const tokens = Array.from(root.querySelectorAll('.token'));
    const blanks = Array.from(root.querySelectorAll('.blank'));
    const checkBtn = root.querySelector('#h2kwCheck');
    const resetBtn = root.querySelector('#h2kwReset');
    const feedback = root.querySelector('#h2kwFeedback');

    let selectedToken = null;

    function clearMarks(){
      blanks.forEach(b => {
        b.classList.remove('is-correct','is-wrong','is-over');
      });
    }

    function setFeedback(msg){
      if(!feedback) return;
      feedback.textContent = msg;
    }

    function getTokenInBlank(blank){
      return blank.querySelector('.token');
    }

    function returnTokenToBank(token){
      if(!token || !bank) return;
      token.classList.remove('is-placed');
      bank.appendChild(token);
    }

    function placeToken(blank, token){
      if(!blank || !token) return;

      // If blank already has a token, return it to bank
      const existing = getTokenInBlank(blank);
      if(existing && existing !== token){
        returnTokenToBank(existing);
      }

      token.classList.add('is-placed');
      blank.textContent = '';
      blank.appendChild(token);
      selectedToken = null;

      tokens.forEach(t => t.classList.remove('is-selected'));
      clearMarks();
      setFeedback('');
    }

    function onTokenClick(token){
      tokens.forEach(t => t.classList.remove('is-selected'));
      token.classList.add('is-selected');
      selectedToken = token;
    }

    tokens.forEach((t, idx) => {
      if(!t.id) t.id = `sptok_${idx}_${Math.random().toString(16).slice(2)}`;

      t.addEventListener('click', () => onTokenClick(t));

      t.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          onTokenClick(t);
        }
      });

      t.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        window.requestAnimationFrame(() => t.classList.add('is-dragging'));
      });

      t.addEventListener('dragend', () => {
        t.classList.remove('is-dragging');
        blanks.forEach(b => b.classList.remove('is-over'));
      });
    });

    blanks.forEach((b) => {
      b.addEventListener('click', () => {
        if(selectedToken) placeToken(b, selectedToken);
      });

      b.addEventListener('keydown', (e) => {
        if((e.key === 'Enter' || e.key === ' ') && selectedToken){
          e.preventDefault();
          placeToken(b, selectedToken);
        }
      });

      b.addEventListener('dragover', (e) => {
        e.preventDefault();
        b.classList.add('is-over');
      });

      b.addEventListener('dragleave', () => {
        b.classList.remove('is-over');
      });

      b.addEventListener('drop', (e) => {
        e.preventDefault();
        b.classList.remove('is-over');
        const id = e.dataTransfer.getData('text/plain');
        const token = root.querySelector('#' + CSS.escape(id));
        if(token) placeToken(b, token);
      });
    });

    function reset(){
      clearMarks();
      setFeedback('');
      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        if(t) returnTokenToBank(t);
        b.textContent = '';
      });
      tokens.forEach(t => t.classList.remove('is-selected'));
      selectedToken = null;
    }

    async function check(){
      clearMarks();

      let allFilled = true;
      const answers = [];

      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        const got = t ? (t.dataset.word || t.textContent || '').trim() : '';
        answers.push(got);
        if(!t) allFilled = false;
      });

      if(!allFilled){
        setFeedback('Fill all blanks first.');
        return;
      }

      try{
        const result = await checkDndOnServer('module2_h2_keywords', answers);
        let correct = 0;
        blanks.forEach((b, i) => {
          const isCorrect = !!result?.correctByIndex?.[i];
          b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          if(isCorrect) correct += 1;
        });
        if(correct === blanks.length){
          setFeedback('All correct. Well done.');
        }else{
          setFeedback('Some answers are wrong. Try again.');
        }
      }catch(_e){
        setFeedback('Cannot validate answers now. Try again in a moment.');
      }
    }

    checkBtn?.addEventListener('click', check);
    resetBtn?.addEventListener('click', reset);

    reset();
  }

  // Enable pronunciation buttons
  setupPronunciation();

  // Enable Practice interactions
  setupPracticeDnD();

  // Enable Speaking matching
  setupSpeakingMatchDnD();

  // Enable Hour 2, II. Key Words matching
  setupHour2KeywordsMatchDnD();
};

// Call on page load
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', window.initializeApp);
} else {
  window.initializeApp();
}
