

// Ambient background tint by tab theme (kept intentionally subtle).
window.updateAmbientThemeForTab = function updateAmbientThemeForTab(tabKey){
  const key = String(tabKey || '').toLowerCase();
  const root = document.documentElement;
  const body = document.body;
  if(!root || !body) return;

  let rgb = '122,103,201'; // purple default
  // Order matters: specific groups first, then broad pattern groups.
  if(key === 'exercise' && document.getElementById('tab8Exercise')){
    // Module 8: Activity 1 should be green-themed.
    rgb = '47,107,87'; // green
  }else if(key === 'keywords' && document.getElementById('tab8Keywords')){
    // Module 8: Activity 2 should be green-themed.
    rgb = '47,107,87'; // green
  }else if(key === 'h2_reading' && document.getElementById('tab6Hour2Reading')){
    // Module 6: this tab key is used for a Key Words (blue) activity.
    rgb = '111,143,203'; // blue
  }else if(key === 'h2_exercise' && document.getElementById('tab5Hour2Exercise')){
    // Module 5: Hour 2 "I. Listening" uses the h2_exercise tab key, but should be listening-colored.
    rgb = '140,91,150'; // soft violet (listening)
  }else if(key === 'practice' && document.getElementById('tab5Practice')){
    // Module 5: Hour 1 "V. Speaking" uses the Practice tab key, but should be green.
    rgb = '47,107,87'; // green
  }else if(key.includes('mock')){
    rgb = '85,107,63'; // olive
  }else if(key === 'h2_recall' || key === 'm1_h2_recall'){
    rgb = '183,52,73'; // soft red
  }else if(key.includes('keywords')){
    rgb = '111,143,203'; // blue
  }else if(key.includes('reading')){
    rgb = '123,59,82'; // burgundy
  }else if(key.includes('practice')){
    rgb = '126,78,58'; // brown
  }else if(
    key.includes('revision') ||
    key.includes('speaking') ||
    key.includes('writing')
  ){
    rgb = '47,107,87'; // green
  }else if(key.includes('listening')){
    rgb = '140,91,150'; // soft violet
  }

  root.style.setProperty('--ambient-rgb', rgb);
  root.style.setProperty('--nav-accent-rgb', rgb);
  body.classList.add('theme-shift');
  window.clearTimeout(window.__themeShiftTimer);
  window.__themeShiftTimer = window.setTimeout(() => body.classList.remove('theme-shift'), 520);
};

// Wrap everything in a function that can be called multiple times (for dynamic module loading)
window.initializeApp = function initializeApp() {
  function normalizeInstructionLabels(){
    const fixed = 'INSTRUCTIONS:';

    document.querySelectorAll('.practice-instr-title, .writing-instr-title, .kw-instr-title')
      .forEach((el) => {
        el.textContent = fixed;
      });

    document.querySelectorAll('.sticky-card .card-title')
      .forEach((el) => {
        const t = (el.textContent || '').trim();
        if(/^instructions:?$/i.test(t)){
          el.textContent = fixed;
        }
      });

    document.querySelectorAll('.reading-instr-inline strong')
      .forEach((el) => {
        const t = (el.textContent || '').trim();
        if(/^instructions:?$/i.test(t)){
          el.textContent = fixed;
        }
      });
  }

  // Tabs (scoped to active module only)
  const activeModulePanel = document.querySelector('.module-panel.is-active');
  const tabButtons = activeModulePanel ? Array.from(activeModulePanel.querySelectorAll('.tab-btn')) : [];
  const panels = Array.from(document.querySelectorAll('main.content .tab-panel'));

  function pausePlayableMedia(root){
    const scope = root || document.querySelector('main.content') || document;
    const media = Array.from(scope.querySelectorAll('audio, video'));
    media.forEach((el) => {
      try{
        if(!el.paused){
          el.pause();
        }
      }catch(_e){}
    });
  }

  function setActiveTab(key){
    const prevActive = tabButtons.find((b) => b.classList.contains('is-active'))?.dataset.tab || '';
    if(prevActive !== key){
      pausePlayableMedia(document.querySelector('main.content'));
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

    // Show target panel without animation
    const target = panels.find((p) => p.dataset.panel === key);
    if (target){
      target.hidden = false;
    }
    window.updateAmbientThemeForTab?.(key);

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

  normalizeInstructionLabels();

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

  const m3a2Player = bindAudioPlayer({
    audioId: 'm3a2Audio',
    playId: 'm3a2PlayBtn',
    pauseId: 'm3a2PauseBtn',
    restartId: 'm3a2RestartBtn',
    statusId: 'm3a2AudioStatus',
    progressId: 'm3a2ProgressBar'
  });

  const m3a1Player = bindAudioPlayer({
    audioId: 'm3a1Audio',
    playId: 'm3a1PlayBtn',
    pauseId: 'm3a1PauseBtn',
    restartId: 'm3a1RestartBtn',
    statusId: 'm3a1AudioStatus',
    progressId: 'm3a1ProgressBar'
  });

  const m3KwPlayer = bindAudioPlayer({
    audioId: 'm3KwAudio',
    playId: 'm3KwPlayBtn',
    pauseId: 'm3KwPauseBtn',
    restartId: 'm3KwRestartBtn',
    statusId: 'm3KwAudioStatus',
    progressId: 'm3KwProgressBar'
  });

  const m1h2UlPlayer = bindAudioPlayer({
    audioId: 'm1h2UlAudio',
    playId: 'm1h2PlayBtn',
    pauseId: 'm1h2PauseBtn',
    restartId: 'm1h2RestartBtn',
    statusId: 'm1h2AudioStatus',
    progressId: 'm1h2ProgressBar'
  });

  const m2h2UlPlayer = bindAudioPlayer({
    audioId: 'm2h2UlAudio',
    playId: 'm2h2UlPlayBtn',
    pauseId: 'm2h2UlPauseBtn',
    restartId: 'm2h2UlRestartBtn',
    statusId: 'm2h2UlAudioStatus',
    progressId: 'm2h2UlProgressBar'
  });

  const m3h2UlPlayer = bindAudioPlayer({
    audioId: 'm3h2UlAudio',
    playId: 'm3h2UlPlayBtn',
    pauseId: 'm3h2UlPauseBtn',
    restartId: 'm3h2UlRestartBtn',
    statusId: 'm3h2UlAudioStatus',
    progressId: 'm3h2UlProgressBar'
  });

  const m4h2UlPlayer = bindAudioPlayer({
    audioId: 'm4h2UlAudio',
    playId: 'm4h2UlPlayBtn',
    pauseId: 'm4h2UlPauseBtn',
    restartId: 'm4h2UlRestartBtn',
    statusId: 'm4h2UlAudioStatus',
    progressId: 'm4h2UlProgressBar'
  });

  const m4UlPlayer = bindAudioPlayer({
    audioId: 'm4ulAudio',
    playId: 'm4ulPlayBtn',
    pauseId: 'm4ulPauseBtn',
    restartId: 'm4ulRestartBtn',
    statusId: 'm4ulAudioStatus',
    progressId: 'm4ulProgressBar'
  });

  const m5UlPlayer = bindAudioPlayer({
    audioId: 'm5ulAudio',
    playId: 'm5ulPlayBtn',
    pauseId: 'm5ulPauseBtn',
    restartId: 'm5ulRestartBtn',
    statusId: 'm5ulAudioStatus',
    progressId: 'm5ulProgressBar'
  });

  const m6UlPlayer = bindAudioPlayer({
    audioId: 'm6ulAudio',
    playId: 'm6ulPlayBtn',
    pauseId: 'm6ulPauseBtn',
    restartId: 'm6ulRestartBtn',
    statusId: 'm6ulAudioStatus',
    progressId: 'm6ulProgressBar'
  });

  const m6h2UlPlayer = bindAudioPlayer({
    audioId: 'm6h2UlAudio',
    playId: 'm6h2UlPlayBtn',
    pauseId: 'm6h2UlPauseBtn',
    restartId: 'm6h2UlRestartBtn',
    statusId: 'm6h2UlAudioStatus',
    progressId: 'm6h2UlProgressBar'
  });

  const m7h2UlPlayer = bindAudioPlayer({
    audioId: 'm7h2UlAudio',
    playId: 'm7h2UlPlayBtn',
    pauseId: 'm7h2UlPauseBtn',
    restartId: 'm7h2UlRestartBtn',
    statusId: 'm7h2UlAudioStatus',
    progressId: 'm7h2UlProgressBar'
  });

  const m7UlPlayer = bindAudioPlayer({
    audioId: 'm7ulAudio',
    playId: 'm7ulPlayBtn',
    pauseId: 'm7ulPauseBtn',
    restartId: 'm7ulRestartBtn',
    statusId: 'm7ulAudioStatus',
    progressId: 'm7ulProgressBar'
  });

  const liPlayer = bindAudioPlayer({
    audioId: 'listeningAudio',
    playId: 'liPlayBtn',
    pauseId: 'liPauseBtn',
    restartId: 'liRestartBtn',
    statusId: 'liAudioStatus',
    progressId: 'liProgressBar'
  });

  const m4liPlayer = bindAudioPlayer({
    audioId: 'm4ListeningAudio',
    playId: 'm4liPlayBtn',
    pauseId: 'm4liPauseBtn',
    restartId: 'm4liRestartBtn',
    statusId: 'm4liAudioStatus',
    progressId: 'm4liProgressBar'
  });

  const m5liPlayer = bindAudioPlayer({
    audioId: 'm5ListeningAudio',
    playId: 'm5liPlayBtn',
    pauseId: 'm5liPauseBtn',
    restartId: 'm5liRestartBtn',
    statusId: 'm5liAudioStatus',
    progressId: 'm5liProgressBar'
  });

  const m6liPlayer = bindAudioPlayer({
    audioId: 'm6ListeningAudio',
    playId: 'm6liPlayBtn',
    pauseId: 'm6liPauseBtn',
    restartId: 'm6liRestartBtn',
    statusId: 'm6liAudioStatus',
    progressId: 'm6liProgressBar'
  });

  const m7liPlayer = bindAudioPlayer({
    audioId: 'm7ListeningAudio',
    playId: 'm7liPlayBtn',
    pauseId: 'm7liPauseBtn',
    restartId: 'm7liRestartBtn',
    statusId: 'm7liAudioStatus',
    progressId: 'm7liProgressBar'
  });

  const m5h2liPlayer = bindAudioPlayer({
    audioId: 'm5h2ListeningAudio',
    playId: 'm5h2liPlayBtn',
    pauseId: 'm5h2liPauseBtn',
    restartId: 'm5h2liRestartBtn',
    statusId: 'm5h2liAudioStatus',
    progressId: 'm5h2liProgressBar'
  });

  const m6h2liPlayer = bindAudioPlayer({
    audioId: 'm6h2ListeningAudio',
    playId: 'm6h2liPlayBtn',
    pauseId: 'm6h2liPauseBtn',
    restartId: 'm6h2liRestartBtn',
    statusId: 'm6h2liAudioStatus',
    progressId: 'm6h2liProgressBar'
  });

  const m7h2liPlayer = bindAudioPlayer({
    audioId: 'm7h2ListeningAudio',
    playId: 'm7h2liPlayBtn',
    pauseId: 'm7h2liPauseBtn',
    restartId: 'm7h2liRestartBtn',
    statusId: 'm7h2liAudioStatus',
    progressId: 'm7h2liProgressBar'
  });

  const m8h2liPlayer = bindAudioPlayer({
    audioId: 'm8h2ListeningAudio',
    playId: 'm8h2liPlayBtn',
    pauseId: 'm8h2liPauseBtn',
    restartId: 'm8h2liRestartBtn',
    statusId: 'm8h2liAudioStatus',
    progressId: 'm8h2liProgressBar'
  });

  const m4h2liPlayer = bindAudioPlayer({
    audioId: 'm4h2ListeningAudio',
    playId: 'm4h2liPlayBtn',
    pauseId: 'm4h2liPauseBtn',
    restartId: 'm4h2liRestartBtn',
    statusId: 'm4h2liAudioStatus',
    progressId: 'm4h2liProgressBar'
  });

  const mockPlayer = bindAudioPlayer({
    audioId: 'mockListeningAudio',
    playId: 'mockPlayBtn',
    pauseId: 'mockPauseBtn',
    restartId: 'mockRestartBtn',
    statusId: 'mockAudioStatus',
    progressId: 'mockProgressBar'
  });
  const mockPlayer2 = bindAudioPlayer({
    audioId: 'mock2ListeningAudio',
    playId: 'mock2PlayBtn',
    pauseId: 'mock2PauseBtn',
    restartId: 'mock2RestartBtn',
    statusId: 'mock2AudioStatus',
    progressId: 'mock2ProgressBar'
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
      form.querySelectorAll('.q').forEach((q) => q.classList.remove('is-wrong', 'is-right', 'is-unanswered'));
      form.querySelectorAll('.opt').forEach((opt) => opt.classList.remove('is-right', 'is-wrong', 'is-unanswered'));
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

      const submittedAnswers = {};

      questionIds.forEach((key) => {
        const val = readValue(key);
        submittedAnswers[key] = val || null;
      });

      if (!feedback) return;

      let result;
      try{
        result = await checkQuizOnServer(cfg.serverQuizId, submittedAnswers);
      }catch(_err){
        feedback.className = 'feedback is-bad';
        feedback.textContent = 'Cannot validate answers now. Try again in a moment.';
        if (cfg.onNotAllCorrect) cfg.onNotAllCorrect();
        return;
      }

      let wrongCount = 0;
      questionIds.forEach((key) => {
        const qEl = form.querySelector(`.q[data-q="${key}"]`);
        if (!qEl) return;

        const answeredValue = submittedAnswers[key];
        const checkedInput = qEl.querySelector(`input[name="${key}"]:checked`);
        const checkedOpt = checkedInput ? checkedInput.closest('.opt') : null;

        if (!answeredValue){
          wrongCount += 1;
          qEl.classList.add('is-wrong', 'is-unanswered');
          qEl.querySelectorAll('.opt').forEach((opt) => opt.classList.add('is-unanswered'));
          return;
        }

        const ok = !!result?.correctByQuestion?.[key];
        if (ok){
          qEl.classList.add('is-right');
          checkedOpt?.classList.add('is-right');
        }else{
          wrongCount += 1;
          qEl.classList.add('is-wrong');
          checkedOpt?.classList.add('is-wrong');
        }
      });

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
    formId: 'm1QuizForm',
    feedbackId: 'm1Feedback',
    resetId: 'm1ResetBtn',
    serverQuizId: 'module1_useful_language',
    questionIds: ['m1q1', 'm1q2', 'm1q3', 'm1q4', 'm1q5'],
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

  // Mini Mock Test - Listening Dialogue 1
  bindQuiz({
    formId: 'mockListening1Form',
    feedbackId: 'mock1Feedback',
    resetId: 'mock1ResetBtn',
    serverQuizId: 'mini_mock_listening_1a',
    questionIds: ['mq1', 'mq2'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Incorrect. Listen again and try again.',
    onReset: () => {
      const a1 = mockPlayer?.audio;
      if (a1){
        a1.pause();
        a1.currentTime = 0;
        mockPlayer.setStatus('Ready');
        mockPlayer.updateProgress();
      }
    }
  });

  // Mini Mock Test - Listening Dialogue 2
  bindQuiz({
    formId: 'mockListening2Form',
    feedbackId: 'mock2Feedback',
    resetId: 'mock2ResetBtn',
    serverQuizId: 'mini_mock_listening_1b',
    questionIds: ['mq3', 'mq4', 'mq5'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Incorrect. Listen again and try again.',
    onReset: () => {
      const a2 = mockPlayer2?.audio;
      if (a2){
        a2.pause();
        a2.currentTime = 0;
        mockPlayer2.setStatus('Ready');
        mockPlayer2.updateProgress();
      }
    }
  });

  // Mini Mock Test - Reading
  bindQuiz({
    formId: 'mockReadingForm',
    feedbackId: 'mockReadingFeedback',
    resetId: 'mockReadingReset',
    serverQuizId: 'mini_mock_reading_1',
    questionIds: ['mqr1', 'mqr2', 'mqr3', 'mqr4'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Some answers are incorrect. Check the highlighted question(s) and try again.'
  });

  // Mini Mock Test - Reading Exercise B
  bindQuiz({
    formId: 'mockReadingBForm',
    feedbackId: 'mockReadingBFeedback',
    resetId: 'mockReadingBReset',
    serverQuizId: 'mini_mock_reading_2',
    questionIds: ['mqrb5', 'mqrb6', 'mqrb7', 'mqrb8'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Some answers are incorrect. Check the highlighted question(s) and try again.'
  });

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

  // Module 4 - I. Useful Language
  bindQuiz({
    formId: 'm4UlForm',
    feedbackId: 'm4UlFeedback',
    resetId: 'm4UlResetBtn',
    serverQuizId: 'module4_useful_language',
    questionIds: ['m4ul1', 'm4ul2', 'm4ul3', 'm4ul4', 'm4ul5'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Some answers are incorrect. Try again.',
    onReset: () => {
      const a = m4UlPlayer?.audio;
      if (a){
        a.pause();
        a.currentTime = 0;
        m4UlPlayer.setStatus('Ready');
        m4UlPlayer.updateProgress();
      }
    }
  });

  // Module 5 - V. Speaking (MCQ)
  bindQuiz({
    formId: 'm5SpeakingForm',
    feedbackId: 'm5spFeedback',
    resetId: 'm5spResetBtn',
    serverQuizId: document.getElementById('m5SpeakingForm')?.dataset?.serverQuizId || 'module5_speaking',
    questionIds: ['m5sp1', 'm5sp2'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Some answers are incorrect. Try again.'
  });

  // III. Listening
  const listeningQuizId =
    document.getElementById('listeningForm')?.dataset?.serverQuizId ||
    'module2_listening';

  const liShowAnswersBtn = document.getElementById('liShowAnswers');
  const liAnswersBox = document.getElementById('liAnswersBox');

	// Second Hour - III. Listening
	const h2ListeningQuizId =
	  document.getElementById('h2ListeningForm')?.dataset?.serverQuizId ||
	  'module2_h2_listening';

	const h2liShowAnswersBtn = document.getElementById('h2liShowAnswers');
	const h2liAnswersBox = document.getElementById('h2liAnswersBox');

  bindQuiz({
    formId: 'listeningForm',
    feedbackId: 'liFeedback',
    resetId: 'liResetBtn',
    serverQuizId: listeningQuizId,
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

  // Module 4 - III. Listening
  bindQuiz({
    formId: 'm4ListeningForm',
    feedbackId: 'm4liFeedback',
    resetId: 'm4liResetBtn',
    serverQuizId: document.getElementById('m4ListeningForm')?.dataset?.serverQuizId || 'module4_listening',
    questionIds: ['m4lq1', 'm4lq2', 'm4lq3'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Incorrect. Listen again and try again.',
    onReset: () => {
      const a = m4liPlayer?.audio;
      if (a){
        a.pause();
        a.currentTime = 0;
        m4liPlayer.setStatus('Ready');
        m4liPlayer.updateProgress();
      }
    }
  });

  // Module 4 - Second Hour - III. Listening
  bindQuiz({
    formId: 'm4h2ListeningForm',
    feedbackId: 'm4h2liFeedback',
    resetId: 'm4h2liResetBtn',
    serverQuizId: document.getElementById('m4h2ListeningForm')?.dataset?.serverQuizId || 'module4_h2_listening',
    questionIds: ['m4h2lq1', 'm4h2lq2', 'm4h2lq3'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Incorrect. Listen again and try again.',
    onReset: () => {
      const a = m4h2liPlayer?.audio;
      if (a){
        a.pause();
        a.currentTime = 0;
        m4h2liPlayer.setStatus('Ready');
        m4h2liPlayer.updateProgress();
      }
    }
  });

  // Module 5 - III. Listening
  bindQuiz({
    formId: 'm5ListeningForm',
    feedbackId: 'm5liFeedback',
    resetId: 'm5liResetBtn',
    serverQuizId: document.getElementById('m5ListeningForm')?.dataset?.serverQuizId || 'module5_listening',
    questionIds: ['m5lq1', 'm5lq2', 'm5lq3', 'm5lq4'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Incorrect. Listen again and try again.',
    onReset: () => {
      const a = m5liPlayer?.audio;
      if (a){
        a.pause();
        a.currentTime = 0;
        m5liPlayer.setStatus('Ready');
        m5liPlayer.updateProgress();
      }
    }
  });

  // Module 6 - III. Listening
  bindQuiz({
    formId: 'm6ListeningForm',
    feedbackId: 'm6liFeedback',
    resetId: 'm6liResetBtn',
    serverQuizId: document.getElementById('m6ListeningForm')?.dataset?.serverQuizId || 'module6_listening',
    questionIds: ['m6lq1', 'm6lq2', 'm6lq3'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Incorrect. Listen again and try again.',
    onReset: () => {
      const a = m6liPlayer?.audio;
      if (a){
        a.pause();
        a.currentTime = 0;
        m6liPlayer.setStatus('Ready');
        m6liPlayer.updateProgress();
      }
    }
  });

  // Module 5 - Second Hour - I. Listening
  bindQuiz({
    formId: 'm5h2ListeningForm',
    feedbackId: 'm5h2liFeedback',
    resetId: 'm5h2liResetBtn',
    serverQuizId: document.getElementById('m5h2ListeningForm')?.dataset?.serverQuizId || 'module5_h2_listening',
    questionIds: ['m5h2lq1', 'm5h2lq2', 'm5h2lq3', 'm5h2lq4'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Incorrect. Listen again and try again.',
    onReset: () => {
      const a = m5h2liPlayer?.audio;
      if (a){
        a.pause();
        a.currentTime = 0;
        m5h2liPlayer.setStatus('Ready');
        m5h2liPlayer.updateProgress();
      }
    }
  });

  // Module 6 - Second Hour - III. Listening
  bindQuiz({
    formId: 'm6h2ListeningForm',
    feedbackId: 'm6h2liFeedback',
    resetId: 'm6h2liResetBtn',
    serverQuizId: document.getElementById('m6h2ListeningForm')?.dataset?.serverQuizId || 'module6_h2_listening',
    questionIds: ['m6h2lq1', 'm6h2lq2', 'm6h2lq3', 'm6h2lq4'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Incorrect. Listen again and try again.',
    onReset: () => {
      const a = m6h2liPlayer?.audio;
      if (a){
        a.pause();
        a.currentTime = 0;
        m6h2liPlayer.setStatus('Ready');
        m6h2liPlayer.updateProgress();
      }
    }
  });

  // Module 8 - Second Hour - I. Listening (Mock Test)
  const m8h2MockListeningQuizId =
    document.getElementById('m8h2MockListeningForm')?.dataset?.serverQuizId ||
    'module8_h2_mock_listening';

  bindQuiz({
    formId: 'm8h2MockListeningForm',
    feedbackId: 'm8h2liFeedback',
    resetId: 'm8h2liResetBtn',
    serverQuizId: m8h2MockListeningQuizId,
    questionIds: ['m8h2lq1', 'm8h2lq2', 'm8h2lq3', 'm8h2lq4', 'm8h2lq5', 'm8h2lq6', 'm8h2lq7', 'm8h2lq8'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Incorrect. Listen again and try again.',
    onReset: () => {
      const a = m8h2liPlayer?.audio;
      if (a){
        a.pause();
        a.currentTime = 0;
        m8h2liPlayer.setStatus('Ready');
        m8h2liPlayer.updateProgress();
      }
    }
  });

  // Module 8 - Second Hour - II. Reading (Mock Test)
  bindQuiz({
    formId: 'm8h2ReadingAForm',
    feedbackId: 'm8h2ReadingAFeedback',
    resetId: 'm8h2ReadingAReset',
    serverQuizId: document.getElementById('m8h2ReadingAForm')?.dataset?.serverQuizId || 'module8_h2_mock_reading_a',
    questionIds: ['m8h2ra1', 'm8h2ra2', 'm8h2ra3', 'm8h2ra4'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Some answers are incorrect. Check the highlighted statement(s) and try again.'
  });

  bindQuiz({
    formId: 'm8h2ReadingBForm',
    feedbackId: 'm8h2ReadingBFeedback',
    resetId: 'm8h2ReadingBReset',
    serverQuizId: document.getElementById('m8h2ReadingBForm')?.dataset?.serverQuizId || 'module8_h2_mock_reading_b',
    questionIds: ['m8h2rb5', 'm8h2rb6', 'm8h2rb7', 'm8h2rb8'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Some answers are incorrect. Check the highlighted question(s) and try again.'
  });

  bindQuiz({
    formId: 'h2ListeningForm',
    feedbackId: 'h2liFeedback',
    resetId: 'h2liResetBtn',
    serverQuizId: h2ListeningQuizId,
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

  // Module 3 - Key Words & Listening
  bindQuiz({
    formId: 'm3KwListeningForm',
    feedbackId: 'm3KwFeedback',
    resetId: 'm3KwResetBtn',
    serverQuizId: 'module3_keywords_listening',
    questionIds: ['m3kq1', 'm3kq2', 'm3kq3'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Incorrect. Listen again and try again.',
    onReset: () => {
      const a = m3KwPlayer?.audio;
      if (a){
        a.pause();
        a.currentTime = 0;
        m3KwPlayer.setStatus('Ready');
        m3KwPlayer.updateProgress();
      }
    }
  });

  (function setupModule3KeywordsHighlights(){
    const panel = document.getElementById('tab3Keywords');
    if(!panel) return;

    const script = panel.querySelector('.m3kw-script');
    const onBtn = panel.querySelector('#m3KwHighlightBtn');
    const offBtn = panel.querySelector('#m3KwClearHighlightBtn');

    onBtn?.addEventListener('click', () => {
      script?.classList.add('is-highlight');
    });

    offBtn?.addEventListener('click', () => {
      script?.classList.remove('is-highlight');
    });
  })();

  // VI. Reading
  const readingQuizId =
    document.getElementById('readingForm')?.dataset?.serverQuizId ||
    'module2_reading';

  bindQuiz({
    formId: 'readingForm',
    feedbackId: 'readingFeedback',
    resetId: 'readingReset',
    serverQuizId: readingQuizId,
    questionIds: ['r1', 'r2', 'r3'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Some answers are incorrect. Check the highlighted question(s) and try again.'
  });

  // Module 4 - VI. Reading
  const m4ReadingQuizId =
    document.getElementById('m4ReadingForm')?.dataset?.serverQuizId ||
    'module4_reading';

  bindQuiz({
    formId: 'm4ReadingForm',
    feedbackId: 'm4ReadingFeedback',
    resetId: 'm4ReadingReset',
    serverQuizId: m4ReadingQuizId,
    questionIds: ['m4r1', 'm4r2', 'm4r3'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Some answers are incorrect. Check the highlighted question(s) and try again.'
  });

  // Module 6 - VI. Reading
  const m6ReadingQuizId =
    document.getElementById('m6ReadingForm')?.dataset?.serverQuizId ||
    'module6_reading';

  bindQuiz({
    formId: 'm6ReadingForm',
    feedbackId: 'm6ReadingFeedback',
    resetId: 'm6ReadingReset',
    serverQuizId: m6ReadingQuizId,
    questionIds: ['m6r1', 'm6r2', 'm6r3'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Some answers are incorrect. Check the highlighted question(s) and try again.'
  });

 // Second Hour: IV. Reading
 const h2ReadingQuizId =
   document.getElementById('h2ReadingForm')?.dataset?.serverQuizId ||
   'module2_h2_reading';

 bindQuiz({
   formId: 'h2ReadingForm',
   feedbackId: 'h2ReadingFeedback',
   resetId: 'h2ReadingReset',
   serverQuizId: h2ReadingQuizId,
   questionIds: ['h2r1', 'h2r2', 'h2r3'],
   goodText: 'All answers are correct. Well done.',
   badText: 'Some answers are incorrect. Check the highlighted question(s) and try again.'
 });

  // Module 4 - Second Hour: IV. Reading
  const m4h2ReadingQuizId =
    document.getElementById('m4h2ReadingForm')?.dataset?.serverQuizId ||
    'module4_h2_reading';

  bindQuiz({
    formId: 'm4h2ReadingForm',
    feedbackId: 'm4h2ReadingFeedback',
    resetId: 'm4h2ReadingReset',
    serverQuizId: m4h2ReadingQuizId,
    questionIds: ['m4h2r1', 'm4h2r2', 'm4h2r3', 'm4h2r4'],
    goodText: 'All answers are correct. Well done.',
    badText: 'Some answers are incorrect. Check the highlighted question(s) and try again.'
  });

  // Module 5 - Second Hour: IV. Reading
  const m5h2ReadingQuizId =
    document.getElementById('m5h2ReadingForm')?.dataset?.serverQuizId ||
    'module5_h2_reading';

  bindQuiz({
    formId: 'm5h2ReadingForm',
    feedbackId: 'm5h2ReadingFeedback',
    resetId: 'm5h2ReadingReset',
    serverQuizId: m5h2ReadingQuizId,
    questionIds: ['m5h2r1', 'm5h2r2'],
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

  function getScopedKwRows(btn){
    const scope =
      btn?.closest('.kw-dialogue') ||
      btn?.closest('.kw-card') ||
      btn?.closest('.tab-panel') ||
      document;
    return Array.from(scope.querySelectorAll('.kw-row'));
  }

  document.querySelectorAll('[data-kw-action="reveal-all"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      getScopedKwRows(btn).forEach((row) => setKwRow(row, true));
    });
  });

  document.querySelectorAll('[data-kw-action="hide-all"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      getScopedKwRows(btn).forEach((row) => setKwRow(row, false));
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
    const roots = Array.from(document.querySelectorAll('#tabPractice, #tab3Practice, #tab4Practice, #tab5Keywords, #tab6Practice, #tab7Exercise, #tab7Keywords, #tab7Practice, #tab7Reading, #tab8Exercise, #tab6Hour2Reading2'));
    if(!roots.length) return;

    roots.forEach((root) => {
      const bank = root.querySelector('.practice-bank');
      const tokens = Array.from(root.querySelectorAll('.token'));
      const blanks = Array.from(root.querySelectorAll('.blank'));
      const checkBtn = root.querySelector('[data-practice-check]') || root.querySelector('#practiceCheck');
      const resetBtn = root.querySelector('[data-practice-reset]') || root.querySelector('#practiceReset');
      const feedback = root.querySelector('[data-practice-feedback]') || root.querySelector('#practiceFeedback');
      const dndExerciseId = root.querySelector('.practice-card')?.dataset?.exerciseId
        || (root.id === 'tab3Practice' ? 'module3_practice' : (root.id === 'tab4Practice' ? 'module4_practice' : 'module2_practice'));

      if(!bank || !tokens.length || !blanks.length) return;

      let selectedToken = null;

      function clearMarks(){
        blanks.forEach(b => {
          b.classList.remove('is-correct','is-wrong','is-over');
        });
        tokens.forEach(t => t.classList.remove('is-correct','is-wrong'));
      }

      function setFeedback(msg){
        if(feedback) feedback.textContent = msg || '';
      }

      function moveTokenToBank(token){
        if(!token) return;
        token.classList.remove('is-selected');
        bank.appendChild(token);
      }

      function clearDragHints(){
        root.classList.remove('drag-from-bank', 'drag-from-blank');
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

        t.addEventListener('dblclick', () => {
          if (t.parentElement?.classList?.contains('blank')){
            moveTokenToBank(t);
            clearMarks();
            setFeedback('');
            clearDragHints();
          }
        });

        t.addEventListener('keydown', (e) => {
          if(e.key === 'Enter' || e.key === ' '){
            e.preventDefault();
            onTokenClick(t);
          }
        });

        t.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', t.id);
          e.dataTransfer.effectAllowed = 'move';
          const fromBank = t.parentElement === bank;
          root.classList.toggle('drag-from-bank', !!fromBank);
          root.classList.toggle('drag-from-blank', !fromBank);
          window.requestAnimationFrame(() => t.classList.add('is-dragging'));
        });

        t.addEventListener('dragend', () => {
          t.classList.remove('is-dragging');
          blanks.forEach(b => b.classList.remove('is-over'));
          clearDragHints();
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
        clearDragHints();
      });

      checkBtn?.addEventListener('click', async () => {
        clearMarks();
        const answers = [];

        blanks.forEach((b) => {
          const t = getTokenInBlank(b);
          const got = t ? (t.dataset.word || t.textContent || '').trim() : '';
          answers.push(got);
        });

        try{
          const result = await checkDndOnServer(dndExerciseId, answers);
          let correct = 0;
          blanks.forEach((b, i) => {
            const t = getTokenInBlank(b);
            const isCorrect = !!result?.correctByIndex?.[i];
            b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
            if(t) t.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
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
        clearDragHints();
      });
    });
  }

  function setupModule3Activity2DnD(){
    const root = document.querySelector('#tab3Exercise');
    if(!root) return;

    const card = root.querySelector('.m3a2-card');
    if(!card) return;

    const bank = card.querySelector('#m3a2Bank');
    const tokens = Array.from(card.querySelectorAll('.token'));
    const blanks = Array.from(card.querySelectorAll('.blank'));
    const checkBtn = card.querySelector('#m3a2Check');
    const resetBtn = card.querySelector('#m3a2Reset');
    const feedback = card.querySelector('#m3a2Feedback');
    const dndExerciseId = card.dataset.exerciseId || 'module3_activity2';

    let selectedToken = null;

    function clearMarks(){
      blanks.forEach((b) => b.classList.remove('is-correct','is-wrong','is-over'));
      tokens.forEach((t) => t.classList.remove('is-correct','is-wrong'));
    }

    function setFeedback(msg){
      if(feedback) feedback.textContent = msg || '';
    }

    function moveTokenToBank(token){
      if(!token) return;
      token.classList.remove('is-selected');
      bank.appendChild(token);
    }

    function clearDragHints(){
      root.classList.remove('drag-from-bank', 'drag-from-blank');
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
      tokens.forEach((t) => t.classList.remove('is-selected'));
      token.classList.add('is-selected');
      selectedToken = token;
    }

    tokens.forEach((t, idx) => {
      if(!t.id) t.id = `m3a2tok_${idx}_${Math.random().toString(16).slice(2)}`;

      t.addEventListener('click', () => onTokenClick(t));

      t.addEventListener('dblclick', () => {
        if (t.parentElement?.classList?.contains('blank')){
          moveTokenToBank(t);
          clearMarks();
          setFeedback('');
          clearDragHints();
        }
      });

      t.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          onTokenClick(t);
        }
      });

      t.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        const fromBank = t.parentElement === bank;
        root.classList.toggle('drag-from-bank', !!fromBank);
        root.classList.toggle('drag-from-blank', !fromBank);
        window.requestAnimationFrame(() => t.classList.add('is-dragging'));
      });

      t.addEventListener('dragend', () => {
        t.classList.remove('is-dragging');
        blanks.forEach((b) => b.classList.remove('is-over'));
        clearDragHints();
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
        const token = card.querySelector(`#${CSS.escape(id)}`);
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
      const token = card.querySelector(`#${CSS.escape(id)}`);
      if(token) moveTokenToBank(token);
      clearMarks();
      setFeedback('');
      clearDragHints();
    });

    checkBtn?.addEventListener('click', async () => {
      clearMarks();
      const answers = [];

      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        const got = t ? (t.dataset.word || t.textContent || '').trim() : '';
        answers.push(got);
      });

      try{
        const result = await checkDndOnServer(dndExerciseId, answers);
        let correct = 0;
        blanks.forEach((b, i) => {
          const t = getTokenInBlank(b);
          const isCorrect = !!result?.correctByIndex?.[i];
          b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          if(t) t.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
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
    });

    resetBtn?.addEventListener('click', () => {
      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        if(t) moveTokenToBank(t);
      });
      tokens.forEach((t) => t.classList.remove('is-selected'));
      selectedToken = null;
      clearMarks();
      setFeedback('');
      clearDragHints();
    });
  }

  function setupModule8Activity2PartBDnD(){
    const root = document.querySelector('#tab8Keywords');
    if(!root) return;

    const card = root.querySelector('.m8a2b-card');
    if(!card) return;

    const bank = card.querySelector('#m8a2bBank');
    const tokens = Array.from(card.querySelectorAll('.token'));
    const blanks = Array.from(card.querySelectorAll('.blank'));
    const checkBtn = card.querySelector('#m8a2bCheck');
    const resetBtn = card.querySelector('#m8a2bReset');
    const feedback = card.querySelector('#m8a2bFeedback');
    const dndExerciseId = card.dataset.exerciseId || 'module8_h1_activity2_partb';

    if(!bank || !tokens.length || !blanks.length) return;

    let selectedToken = null;

    function clearMarks(){
      blanks.forEach((b) => b.classList.remove('is-correct','is-wrong','is-over'));
      tokens.forEach((t) => t.classList.remove('is-correct','is-wrong'));
    }

    function setFeedback(msg){
      if(feedback) feedback.textContent = msg || '';
    }

    function moveTokenToBank(token){
      if(!token) return;
      token.classList.remove('is-selected');
      bank.appendChild(token);
    }

    function clearDragHints(){
      root.classList.remove('drag-from-bank', 'drag-from-blank');
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
      tokens.forEach((t) => t.classList.remove('is-selected'));
      token.classList.add('is-selected');
      selectedToken = token;
    }

    tokens.forEach((t, idx) => {
      if(!t.id) t.id = `m8a2b_tok_${idx}_${Math.random().toString(16).slice(2)}`;

      t.addEventListener('click', () => onTokenClick(t));

      t.addEventListener('dblclick', () => {
        if (t.parentElement?.classList?.contains('blank')){
          moveTokenToBank(t);
          clearMarks();
          setFeedback('');
          clearDragHints();
        }
      });

      t.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          onTokenClick(t);
        }
      });

      t.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        const fromBank = t.parentElement === bank;
        root.classList.toggle('drag-from-bank', !!fromBank);
        root.classList.toggle('drag-from-blank', !fromBank);
        window.requestAnimationFrame(() => t.classList.add('is-dragging'));
      });

      t.addEventListener('dragend', () => {
        t.classList.remove('is-dragging');
        blanks.forEach((b) => b.classList.remove('is-over'));
        clearDragHints();
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
        const token = card.querySelector(`#${CSS.escape(id)}`);
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
      const token = card.querySelector(`#${CSS.escape(id)}`);
      if(token) moveTokenToBank(token);
      clearMarks();
      setFeedback('');
      clearDragHints();
    });

    checkBtn?.addEventListener('click', async () => {
      clearMarks();
      const answers = [];

      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        const got = t ? (t.dataset.word || t.textContent || '').trim() : '';
        answers.push(got);
      });

      try{
        const result = await checkDndOnServer(dndExerciseId, answers);
        let correct = 0;
        blanks.forEach((b, i) => {
          const t = getTokenInBlank(b);
          const isCorrect = !!result?.correctByIndex?.[i];
          b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          if(t) t.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
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
    });

    resetBtn?.addEventListener('click', () => {
      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        if(t) moveTokenToBank(t);
      });
      tokens.forEach((t) => t.classList.remove('is-selected'));
      selectedToken = null;
      clearMarks();
      setFeedback('');
      clearDragHints();
    });
  }

  function setupModule8Activity2PartCDnD(){
    const root = document.querySelector('#tab8Keywords');
    if(!root) return;

    const card = root.querySelector('.m8a2c-card');
    if(!card) return;

    const getBank = card.querySelector('#m8a2cGetBank');
    const takeBank = card.querySelector('#m8a2cTakeBank');
    const banks = [getBank, takeBank].filter(Boolean);
    const tokens = Array.from(card.querySelectorAll('.token'));
    const blanks = Array.from(card.querySelectorAll('.blank'));
    const checkBtn = card.querySelector('#m8a2cCheck');
    const resetBtn = card.querySelector('#m8a2cReset');
    const feedback = card.querySelector('#m8a2cFeedback');
    const dndExerciseId = card.dataset.exerciseId || 'module8_h1_activity2_partc';

    if(banks.length < 2 || !tokens.length || !blanks.length) return;

    let selectedToken = null;

    function clearMarks(){
      blanks.forEach((b) => b.classList.remove('is-correct','is-wrong','is-over'));
      tokens.forEach((t) => t.classList.remove('is-correct','is-wrong'));
    }

    function setFeedback(msg){
      if(feedback) feedback.textContent = msg || '';
    }

    function preferredBankForToken(token){
      const word = String(token?.dataset?.word || '').trim().toLowerCase();
      if(word.startsWith('take ')) return takeBank;
      if(word.startsWith('get ')) return getBank;
      return getBank || banks[0] || null;
    }

    function moveTokenToBank(token, targetBank){
      if(!token) return;
      token.classList.remove('is-selected');
      const dest = targetBank || preferredBankForToken(token);
      if(dest) dest.appendChild(token);
    }

    function clearDragHints(){
      root.classList.remove('drag-from-bank', 'drag-from-blank');
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
      tokens.forEach((t) => t.classList.remove('is-selected'));
      token.classList.add('is-selected');
      selectedToken = token;
    }

    tokens.forEach((t, idx) => {
      if(!t.id) t.id = `m8a2c_tok_${idx}_${Math.random().toString(16).slice(2)}`;

      t.addEventListener('click', () => onTokenClick(t));

      t.addEventListener('dblclick', () => {
        if (t.parentElement?.classList?.contains('blank')){
          moveTokenToBank(t);
          clearMarks();
          setFeedback('');
          clearDragHints();
        }
      });

      t.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          onTokenClick(t);
        }
      });

      t.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        const fromBank = banks.includes(t.parentElement);
        root.classList.toggle('drag-from-bank', !!fromBank);
        root.classList.toggle('drag-from-blank', !fromBank);
        window.requestAnimationFrame(() => t.classList.add('is-dragging'));
      });

      t.addEventListener('dragend', () => {
        t.classList.remove('is-dragging');
        blanks.forEach((b) => b.classList.remove('is-over'));
        clearDragHints();
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
        const token = card.querySelector(`#${CSS.escape(id)}`);
        if(token) placeToken(b, token);
      });
    });

    banks.forEach((bankEl) => {
      bankEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      bankEl.addEventListener('drop', (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const token = card.querySelector(`#${CSS.escape(id)}`);
        if(token) moveTokenToBank(token, bankEl);
        clearMarks();
        setFeedback('');
        clearDragHints();
      });
    });

    checkBtn?.addEventListener('click', async () => {
      clearMarks();
      const answers = [];

      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        const got = t ? (t.dataset.word || t.textContent || '').trim() : '';
        answers.push(got);
      });

      try{
        const result = await checkDndOnServer(dndExerciseId, answers);
        let correct = 0;
        blanks.forEach((b, i) => {
          const t = getTokenInBlank(b);
          const isCorrect = !!result?.correctByIndex?.[i];
          b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          if(t) t.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
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
    });

    resetBtn?.addEventListener('click', () => {
      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        if(t) moveTokenToBank(t);
      });
      tokens.forEach((t) => t.classList.remove('is-selected'));
      selectedToken = null;
      clearMarks();
      setFeedback('');
      clearDragHints();
    });
  }

  // Module 3 - Second Hour - VI. Learning Recall & Feedback (drag and drop)
  function setupModule3Hour2RecallDnD(){
    const root = document.querySelector('#tab3Hour2Recall');
    if(!root) return;

    const card = root.querySelector('.practice-card');
    if(!card) return;

    const bank = card.querySelector('.practice-bank');
    const tokens = Array.from(card.querySelectorAll('.token'));
    const blanks = Array.from(card.querySelectorAll('.blank'));
    const checkBtn = card.querySelector('#m3h2RecallCheck');
    const resetBtn = card.querySelector('#m3h2RecallReset');
    const feedback = card.querySelector('#m3h2RecallFeedback');
    const dndExerciseId = card.dataset.exerciseId || 'module3_h2_recall';

    let selectedToken = null;

    function clearMarks(){
      blanks.forEach(b => b.classList.remove('is-correct','is-wrong','is-over'));
      tokens.forEach(t => t.classList.remove('is-correct','is-wrong'));
    }

    function setFeedback(msg){
      if(feedback) feedback.textContent = msg || '';
    }

    function moveTokenToBank(token){
      if(!token || !bank) return;
      token.classList.remove('is-selected');
      bank.appendChild(token);
    }

    function clearDragHints(){
      root.classList.remove('drag-from-bank', 'drag-from-blank');
    }

    function getTokenInBlank(blank){
      return blank.querySelector('.token');
    }

    function placeToken(blank, token){
      if(!blank || !token) return;
      const existing = getTokenInBlank(blank);
      if(existing && existing !== token) moveTokenToBank(existing);
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
      if(!t.id) t.id = `m3h2rec_tok_${idx}_${Math.random().toString(16).slice(2)}`;

      t.addEventListener('click', () => onTokenClick(t));

      t.addEventListener('dblclick', () => {
        if(t.parentElement?.classList?.contains('blank')){
          moveTokenToBank(t);
          clearMarks();
          setFeedback('');
          clearDragHints();
        }
      });

      t.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          onTokenClick(t);
        }
      });

      t.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        const fromBank = t.parentElement === bank;
        root.classList.toggle('drag-from-bank', !!fromBank);
        root.classList.toggle('drag-from-blank', !fromBank);
        window.requestAnimationFrame(() => t.classList.add('is-dragging'));
      });

      t.addEventListener('dragend', () => {
        t.classList.remove('is-dragging');
        blanks.forEach(b => b.classList.remove('is-over'));
        clearDragHints();
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
        const token = card.querySelector(`#${CSS.escape(id)}`);
        if(token) placeToken(b, token);
      });
    });

    bank?.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    bank?.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      const token = card.querySelector(`#${CSS.escape(id)}`);
      if(token) moveTokenToBank(token);
      clearMarks();
      setFeedback('');
      clearDragHints();
    });

    checkBtn?.addEventListener('click', async () => {
      clearMarks();
      const answers = [];

      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        const got = t ? (t.dataset.word || t.textContent || '').trim() : '';
        answers.push(got);
      });

      try{
        const result = await checkDndOnServer(dndExerciseId, answers);
        let correct = 0;
        blanks.forEach((b, i) => {
          const t = getTokenInBlank(b);
          const isCorrect = !!result?.correctByIndex?.[i];
          b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          if(t) t.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
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
      clearDragHints();
    });
  }

  function setupModule4Activity2DnD(){
    const root = document.querySelector('#tab4Exercise');
    if(!root) return;

    const card = root.querySelector('.m4ul-a2-card');
    if(!card) return;

    const bank = card.querySelector('#m4a2Bank');
    const tokens = Array.from(card.querySelectorAll('.token'));
    const blanks = Array.from(card.querySelectorAll('.blank'));
    const checkBtn = card.querySelector('#m4a2Check');
    const resetBtn = card.querySelector('#m4a2Reset');
    const feedback = card.querySelector('#m4a2Feedback');
    const dndExerciseId = card.dataset.exerciseId || 'module4_activity2';

    let selectedToken = null;

    function clearMarks(){
      blanks.forEach((b) => b.classList.remove('is-correct','is-wrong','is-over'));
      tokens.forEach((t) => t.classList.remove('is-correct','is-wrong'));
    }

    function setFeedback(msg){
      if(feedback) feedback.textContent = msg || '';
    }

    function moveTokenToBank(token){
      if(!token) return;
      token.classList.remove('is-selected');
      bank.appendChild(token);
    }

    function clearDragHints(){
      root.classList.remove('drag-from-bank', 'drag-from-blank');
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
      tokens.forEach((t) => t.classList.remove('is-selected'));
      token.classList.add('is-selected');
      selectedToken = token;
    }

    tokens.forEach((t, idx) => {
      if(!t.id) t.id = `m4a2tok_${idx}_${Math.random().toString(16).slice(2)}`;

      t.addEventListener('click', () => onTokenClick(t));

      t.addEventListener('dblclick', () => {
        if (t.parentElement?.classList?.contains('blank')){
          moveTokenToBank(t);
          clearMarks();
          setFeedback('');
          clearDragHints();
        }
      });

      t.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          onTokenClick(t);
        }
      });

      t.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        const fromBank = t.parentElement === bank;
        root.classList.toggle('drag-from-bank', !!fromBank);
        root.classList.toggle('drag-from-blank', !fromBank);
        window.requestAnimationFrame(() => t.classList.add('is-dragging'));
      });

      t.addEventListener('dragend', () => {
        t.classList.remove('is-dragging');
        blanks.forEach(b => b.classList.remove('is-over'));
        clearDragHints();
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
      clearDragHints();
    });

    checkBtn?.addEventListener('click', async () => {
      clearMarks();
      const answers = [];

      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        const got = t ? (t.dataset.word || t.textContent || '').trim() : '';
        answers.push(got);
      });

      try{
        const result = await checkDndOnServer(dndExerciseId, answers);
        let correct = 0;
        blanks.forEach((b, i) => {
          const t = getTokenInBlank(b);
          const isCorrect = !!result?.correctByIndex?.[i];
          b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          if(t) t.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
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
      clearDragHints();
    });
  }

  // Mini Mock - Writing drag and drop
  function setupMockWritingDnD(){
    const root = document.querySelector('#tabMockWriting');
    if(!root) return;

    const bank = root.querySelector('#mockwBank');
    const tokens = Array.from(root.querySelectorAll('.token'));
    const blanks = Array.from(root.querySelectorAll('.writing-gap-text .blank'));
    const checkBtn = root.querySelector('#mockwCheck');
    const resetBtn = root.querySelector('#mockwReset');
    const feedback = root.querySelector('#mockwFeedback');
    const dndExerciseId = root.querySelector('.practice-card')?.dataset?.exerciseId || 'mini_mock_writing_1';

    let selectedToken = null;

    function clearMarks(){
      blanks.forEach((b) => b.classList.remove('is-correct','is-wrong','is-over'));
      tokens.forEach((t) => t.classList.remove('is-correct','is-wrong'));
    }

    function setFeedback(msg){
      if(feedback) feedback.textContent = msg || '';
    }

    function moveTokenToBank(token){
      if(!token) return;
      token.classList.remove('is-selected');
      bank.appendChild(token);
    }

    function clearDragHints(){
      root.classList.remove('drag-from-bank', 'drag-from-blank');
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
      tokens.forEach((t) => t.classList.remove('is-selected'));
      token.classList.add('is-selected');
      selectedToken = token;
    }

    tokens.forEach((t, idx) => {
      if(!t.id) t.id = `mockw_tok_${idx}_${Math.random().toString(16).slice(2)}`;

      t.addEventListener('click', () => onTokenClick(t));

      t.addEventListener('dblclick', () => {
        if (t.parentElement?.classList?.contains('blank')){
          moveTokenToBank(t);
          clearMarks();
          setFeedback('');
          clearDragHints();
        }
      });

      t.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          onTokenClick(t);
        }
      });

      t.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        const fromBank = t.parentElement === bank;
        root.classList.toggle('drag-from-bank', !!fromBank);
        root.classList.toggle('drag-from-blank', !fromBank);
        window.requestAnimationFrame(() => t.classList.add('is-dragging'));
      });

      t.addEventListener('dragend', () => {
        t.classList.remove('is-dragging');
        blanks.forEach((b) => b.classList.remove('is-over'));
        clearDragHints();
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
      clearDragHints();
    });

    checkBtn?.addEventListener('click', async () => {
      clearMarks();
      const answers = [];

      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        const got = t ? (t.dataset.word || t.textContent || '').trim() : '';
        answers.push(got);
      });

      try{
        const result = await checkDndOnServer(dndExerciseId, answers);
        let correct = 0;
        blanks.forEach((b, i) => {
          const t = getTokenInBlank(b);
          const isCorrect = !!result?.correctByIndex?.[i];
          b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          if(t) t.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
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
      tokens.forEach((t) => t.classList.remove('is-selected'));
      selectedToken = null;
      clearMarks();
      setFeedback('');
      clearDragHints();
    });
  }

  function setupMockWritingTaskTwo(){
    const root = document.querySelector('#tabMockWriting');
    if(!root) return;

    const textarea = root.querySelector('#mockEmailText');
    const countEl = root.querySelector('#mockEmailCount');
    const checkBtn = root.querySelector('#mockEmailCheck');
    const resetBtn = root.querySelector('#mockEmailReset');
    const scoreEl = root.querySelector('#mockEmailScore');
    const fbEl = root.querySelector('#mockEmailFeedback');
    if(!textarea || !countEl || !checkBtn || !resetBtn || !scoreEl || !fbEl) return;

    function words(text){
      return (text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
    }

    function setCount(n){
      countEl.textContent = `Words: ${n}/50`;
    }

    function enforceMaxWords(){
      const w = words(textarea.value);
      if(w.length > 50){
        textarea.value = w.slice(0, 50).join(' ');
        setCount(50);
      }else{
        setCount(w.length);
      }
    }

    function hasAny(text, list){
      const t = (text || '').toLowerCase();
      return list.some((s) => t.includes(s.toLowerCase()));
    }

    textarea.addEventListener('input', enforceMaxWords);
    enforceMaxWords();

    checkBtn.addEventListener('click', () => {
      const text = textarea.value || '';
      const wc = words(text).length;
      const issues = [];
      let score = 0;

      const hasDates = hasAny(text, ['date', 'dates', 'from', 'to', 'arrive', 'arrival', 'departure', 'check-in', 'check-out']);
      const hasDiet = hasAny(text, ['dietary', 'gluten', 'allergy', 'meal request', 'special request', 'food request']);
      const hasBeach = hasAny(text, ['private beach', 'beach access', 'beach privileges', 'private shore']);
      const hasReassure = hasAny(text, ['we confirm', 'confirmed', 'please be assured', 'rest assured', 'we will', 'we are happy to']);

      if(hasDates){ score += 1; } else { issues.push('Mention expected arrival/departure dates.'); }
      if(hasDiet){ score += 1; } else { issues.push('Reassure her about dietary requests.'); }
      if(hasBeach){ score += 1; } else { issues.push('Confirm private beach privileges/access.'); }
      if(hasReassure){ score += 1; } else { issues.push('Use a confirmation/reassurance phrase.'); }

      if(wc >= 45 && wc <= 50){
        score += 1;
      }else{
        issues.push('Target length is close to 50 words (recommended 45-50).');
      }

      scoreEl.textContent = `Score: ${score}/5`;
      if(issues.length === 0){
        fbEl.innerHTML = '<div class="wf-ok">Great. Your e-mail includes all required points.</div>';
      }else if(score >= 3){
        fbEl.innerHTML = `<div class="wf-mid">Good attempt. Improve these points:</div><ul>${issues.map((i) => `<li>${i}</li>`).join('')}</ul>`;
      }else{
        fbEl.innerHTML = `<div class="wf-bad">Needs revision. Please include:</div><ul>${issues.map((i) => `<li>${i}</li>`).join('')}</ul>`;
      }
    });

    resetBtn.addEventListener('click', () => {
      textarea.value = '';
      setCount(0);
      scoreEl.textContent = '';
      fbEl.innerHTML = '';
      textarea.focus();
    });
  }

  // Speaking (Tab VII) matching drag and drop
  function setupSpeakingMatchDnD(){
    const root = document.querySelector('#tabSpeaking, #tab3Speaking, #tab7Speaking');
    if(!root) return;

    const bank = root.querySelector('.practice-bank');
    const tokens = Array.from(root.querySelectorAll('.token'));
    const blanks = Array.from(root.querySelectorAll('.blank'));
    const checkBtn = root.querySelector('#speakingCheck');
    const resetBtn = root.querySelector('#speakingReset');
    const feedback = root.querySelector('#speakingFeedback');
    const speakingExerciseId = root.querySelector('.practice-card')?.dataset?.exerciseId
      || (root.id === 'tab7Speaking' ? 'module7_speaking' : (root.id === 'tab3Speaking' ? 'module3_speaking' : 'module2_speaking'));

    let selectedToken = null;

    function clearMarks(){
      blanks.forEach(b => {
        b.classList.remove('is-correct','is-wrong','is-over');
      });
      tokens.forEach(t => t.classList.remove('is-correct','is-wrong'));
    }

    function setFeedback(msg){
      if(!feedback) return;
      feedback.textContent = msg;
    }

    function clearDragHints(){
      root.classList.remove('drag-from-bank', 'drag-from-blank');
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

      t.addEventListener('dblclick', () => {
        if (t.parentElement?.classList?.contains('blank')){
          returnTokenToBank(t);
          clearMarks();
          setFeedback('');
          clearDragHints();
        }
      });

      t.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          onTokenClick(t);
        }
      });

      t.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        const fromBank = t.parentElement === bank;
        root.classList.toggle('drag-from-bank', !!fromBank);
        root.classList.toggle('drag-from-blank', !fromBank);
        window.requestAnimationFrame(() => t.classList.add('is-dragging'));
      });

      t.addEventListener('dragend', () => {
        t.classList.remove('is-dragging');
        blanks.forEach(b => b.classList.remove('is-over'));
        clearDragHints();
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

    bank.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    bank.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      const token = root.querySelector('#' + CSS.escape(id));
      if(token) returnTokenToBank(token);
      clearMarks();
      setFeedback('');
      clearDragHints();
    });

    function reset(){
      clearMarks();
      setFeedback('');
      clearDragHints();
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
      const answers = [];

      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        const got = t ? (t.dataset.word || t.textContent || '').trim() : '';
        answers.push(got);
      });

      try{
        const result = await checkDndOnServer(speakingExerciseId, answers);
        let correct = 0;
        blanks.forEach((b, i) => {
          const t = getTokenInBlank(b);
          const isCorrect = !!result?.correctByIndex?.[i];
          b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          if(t) t.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
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
    const roots = Array.from(document.querySelectorAll('#tabHour2Keywords, #tab3Hour2Keywords, #tab4Hour2Keywords, #tab5Hour2Keywords, #tab6Hour2Reading'));
    if(!roots.length) return;

    roots.forEach((root) => {
      const bank = root.querySelector('.practice-bank');
      const tokens = Array.from(root.querySelectorAll('.token'));
      const blanks = Array.from(root.querySelectorAll('.blank'));
      const checkBtn = root.querySelector('#h2kwCheck');
      const resetBtn = root.querySelector('#h2kwReset');
      const feedback = root.querySelector('#h2kwFeedback');
      const h2kwExerciseId =
        root.querySelector('.practice-card')?.dataset?.exerciseId
        || (
          root.id === 'tab4Hour2Keywords'
            ? 'module4_h2_keywords'
            : (
              root.id === 'tab5Hour2Keywords'
                ? 'module5_h2_keywords'
                : (root.id === 'tab3Hour2Keywords' ? 'module3_h2_keywords' : 'module2_h2_keywords')
            )
        );

      if(!bank || !blanks.length || !tokens.length) return;

      let selectedToken = null;

      function clearMarks(){
        blanks.forEach(b => {
          b.classList.remove('is-correct','is-wrong','is-over');
        });
        tokens.forEach(t => t.classList.remove('is-correct','is-wrong'));
      }

      function setFeedback(msg){
        if(!feedback) return;
        feedback.textContent = msg;
      }

      function clearDragHints(){
        root.classList.remove('drag-from-bank', 'drag-from-blank');
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

        t.addEventListener('dblclick', () => {
          if (t.parentElement?.classList?.contains('blank')){
            returnTokenToBank(t);
            clearMarks();
            setFeedback('');
            clearDragHints();
          }
        });

        t.addEventListener('keydown', (e) => {
          if(e.key === 'Enter' || e.key === ' '){
            e.preventDefault();
            onTokenClick(t);
          }
        });

        t.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', t.id);
          e.dataTransfer.effectAllowed = 'move';
          const fromBank = t.parentElement === bank;
          root.classList.toggle('drag-from-bank', !!fromBank);
          root.classList.toggle('drag-from-blank', !fromBank);
          window.requestAnimationFrame(() => t.classList.add('is-dragging'));
        });

        t.addEventListener('dragend', () => {
          t.classList.remove('is-dragging');
          blanks.forEach(b => b.classList.remove('is-over'));
          clearDragHints();
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

      bank.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      bank.addEventListener('drop', (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        const token = root.querySelector('#' + CSS.escape(id));
        if(token) returnTokenToBank(token);
        clearMarks();
        setFeedback('');
      });

      function reset(){
        clearMarks();
        setFeedback('');
        clearDragHints();
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
        const answers = [];

        blanks.forEach((b) => {
          const t = getTokenInBlank(b);
          const got = t ? (t.dataset.word || t.textContent || '').trim() : '';
          answers.push(got);
        });

        try{
          const result = await checkDndOnServer(h2kwExerciseId, answers);
          let correct = 0;
          blanks.forEach((b, i) => {
            const t = getTokenInBlank(b);
            const isCorrect = !!result?.correctByIndex?.[i];
            b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
            if(t) t.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
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
    });
  }

  // Module 5 - IV. Language Revision matching drag and drop (letters A-D)
  function setupModule5RevisionDnD(){
    const root = document.querySelector('#tab5Revision');
    if(!root) return;

    const card = root.querySelector('.m5rev-match');
    if(!card) return;

    const bank = card.querySelector('.practice-bank');
    const tokens = Array.from(card.querySelectorAll('.token'));
    const blanks = Array.from(card.querySelectorAll('.blank'));
    const checkBtn = card.querySelector('#m5revCheck');
    const resetBtn = card.querySelector('#m5revReset');
    const feedback = card.querySelector('#m5revFeedback');
    const exerciseId = card.dataset.exerciseId || 'module5_h1_revision';

    if(!bank || !tokens.length || !blanks.length) return;

    let selectedToken = null;

    function clearMarks(){
      blanks.forEach(b => b.classList.remove('is-correct','is-wrong','is-over'));
      tokens.forEach(t => t.classList.remove('is-correct','is-wrong','is-selected'));
    }

    function setFeedback(msg){
      if(feedback) feedback.textContent = msg || '';
    }

    function clearDragHints(){
      root.classList.remove('drag-from-bank', 'drag-from-blank');
    }

    function getTokenInBlank(blank){
      return blank.querySelector('.token');
    }

    function returnTokenToBank(token){
      if(!token) return;
      token.classList.remove('is-selected');
      bank.appendChild(token);
    }

    function placeToken(blank, token){
      if(!blank || !token) return;
      const existing = getTokenInBlank(blank);
      if(existing && existing !== token){
        returnTokenToBank(existing);
      }
      blank.textContent = '';
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
      if(!t.id) t.id = `m5revtok_${idx}_${Math.random().toString(16).slice(2)}`;

      t.addEventListener('click', () => onTokenClick(t));

      t.addEventListener('dblclick', () => {
        if (t.parentElement?.classList?.contains('blank')){
          returnTokenToBank(t);
          clearMarks();
          setFeedback('');
          clearDragHints();
        }
      });

      t.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          onTokenClick(t);
        }
      });

      t.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        const fromBank = t.parentElement === bank;
        root.classList.toggle('drag-from-bank', !!fromBank);
        root.classList.toggle('drag-from-blank', !fromBank);
        window.requestAnimationFrame(() => t.classList.add('is-dragging'));
      });

      t.addEventListener('dragend', () => {
        t.classList.remove('is-dragging');
        blanks.forEach(b => b.classList.remove('is-over'));
        clearDragHints();
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

      b.addEventListener('dragleave', () => b.classList.remove('is-over'));

      b.addEventListener('drop', (e) => {
        e.preventDefault();
        b.classList.remove('is-over');
        const id = e.dataTransfer.getData('text/plain');
        const token = card.querySelector('#' + CSS.escape(id));
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
      const token = card.querySelector('#' + CSS.escape(id));
      if(token) returnTokenToBank(token);
      clearMarks();
      setFeedback('');
      clearDragHints();
    });

    function reset(){
      clearMarks();
      setFeedback('');
      clearDragHints();
      blanks.forEach((b) => {
        const t = getTokenInBlank(b);
        if(t) returnTokenToBank(t);
        b.textContent = '';
      });
      selectedToken = null;
    }

    async function check(){
      clearMarks();
      const answers = blanks.map((b) => {
        const t = getTokenInBlank(b);
        return t ? (t.dataset.word || t.textContent || '').trim() : '';
      });

      try{
        const result = await checkDndOnServer(exerciseId, answers);
        let correct = 0;
        blanks.forEach((b, i) => {
          const t = getTokenInBlank(b);
          const isCorrect = !!result?.correctByIndex?.[i];
          b.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
          if(t) t.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
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
  setupModule3Activity2DnD();
  // Module 7 Activity 2 uses the generic `setupPracticeDnD` now.
  setupModule4Activity2DnD();
  setupModule3Hour2RecallDnD();
  setupModule8Activity2PartBDnD();
  setupModule8Activity2PartCDnD();

  // Enable Mini Mock writing interactions
  setupMockWritingDnD();
  setupMockWritingTaskTwo();

  // Enable Speaking matching
  setupSpeakingMatchDnD();

  // Enable Hour 2, II. Key Words matching
  setupHour2KeywordsMatchDnD();

  // Enable Module 5 - IV. Language Revision matching
  setupModule5RevisionDnD();
};

// Call on page load
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', window.initializeApp);
} else {
  window.initializeApp();
}
