(() => {
  // Second Hour - V. Writing
  // Task 1: drag & drop gap fill
  function setupWritingTaskOne(){
    const root = document.querySelector('#tabHour2Writing, #tab3Hour2Writing, #tab4Hour2Writing');
    if(!root) return;

    const bank = root.querySelector('#h2wBank');
    const tokens = Array.from(root.querySelectorAll('#h2wBank .token'));
    const blanks = Array.from(root.querySelectorAll('.writing-gap-text .blank'));
    const checkBtn = root.querySelector('#h2wCheck');
    const resetBtn = root.querySelector('#h2wReset');
    const feedback = root.querySelector('#h2wFeedback');
    const writingExerciseId =
      root.dataset.writingExerciseId ||
      (
        root.id === 'tab4Hour2Writing'
          ? 'module4_h2_writing_task1'
          : (root.id === 'tab3Hour2Writing' ? 'module3_h2_writing_task1' : 'module2_h2_writing_task1')
      );

    let selectedToken = null;

    function clearDragHints(){
      root.classList.remove('drag-from-bank', 'drag-from-blank');
    }

    async function checkDndOnServer(exerciseId, answers){
      const res = await fetch('/api/check-dnd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseId, answers })
      });
      if(!res.ok) throw new Error(`DnD check failed with status ${res.status}`);
      return res.json();
    }

    function setFeedback(msg){
      if(feedback) feedback.textContent = msg || '';
    }

    function clearMarks(){
      blanks.forEach(b => b.classList.remove('is-correct','is-wrong','is-over'));
      tokens.forEach(t => t.classList.remove('is-correct','is-wrong'));
    }

    function tokenText(token){
      return (token?.dataset.word || token?.textContent || '').trim();
    }

    function getTokenInBlank(blank){
      return blank.querySelector('.token');
    }

    function moveTokenToBank(token){
      if(!token || !bank) return;
      token.classList.remove('is-selected');
      bank.appendChild(token);
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

    // Token wiring
    tokens.forEach((t, idx) => {
      if(!t.id) t.id = `h2w_tok_${idx}_${Math.random().toString(16).slice(2)}`;

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

    // Blank wiring
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

    bank?.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    bank?.addEventListener('drop', (e) => {
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
        const got = tokenText(t);
        answers.push(got);
      });

      try{
        const result = await checkDndOnServer(writingExerciseId, answers);
        let correct = 0;
        blanks.forEach((b, i) => {
          const t = getTokenInBlank(b);
          const ok = !!result?.correctByIndex?.[i];
          b.classList.add(ok ? 'is-correct' : 'is-wrong');
          if(t) t.classList.add(ok ? 'is-correct' : 'is-wrong');
          if(ok) correct += 1;
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

  // Task 2: writing checker (offline heuristic)
  function setupWritingTaskTwo(){
    const root = document.querySelector('#tabHour2Writing, #tab3Hour2Writing, #tab4Hour2Writing');
    if(!root) return;

    const writingTaskTwoType = root.dataset.writingTaskTwoType || 'hotel_request';
    const textarea = root.querySelector('#h2EmailText');
    const countEl = root.querySelector('#h2EmailCount');
    const checkBtn = root.querySelector('#h2EmailCheck');
    const resetBtn = root.querySelector('#h2EmailReset');
    const scoreEl = root.querySelector('#h2EmailScore');
    const fbEl = root.querySelector('#h2EmailFeedback');

    if(!textarea || !countEl || !checkBtn || !resetBtn || !scoreEl || !fbEl) return;

    function words(text){
      return (text || '')
        .replace(/\s+/g,' ')
        .trim()
        .split(' ')
        .filter(Boolean);
    }

    function setCount(n){
      countEl.textContent = `Words: ${n}/50`;
    }

    function setScore(text){
      scoreEl.textContent = text || '';
    }

    function setFeedback(html){
      fbEl.innerHTML = html || '';
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

    textarea.addEventListener('input', enforceMaxWords);
    enforceMaxWords();

    function hasAny(text, list){
      const t = (text || '').toLowerCase();
      return list.some(s => t.includes(s.toLowerCase()));
    }

    function hasDateLike(text){
      const t = text || '';
      const month = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)/i;
      const dmy = /\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/;
      const dayMonth = new RegExp(`\\b\\d{1,2}\\s+${month.source}\\b`, 'i');
      const monthDay = new RegExp(`\\b${month.source}\\s+\\d{1,2}\\b`, 'i');
      const fromTo = /\bfrom\b[\s\S]{0,40}\bto\b/i;
      return dmy.test(t) || dayMonth.test(t) || monthDay.test(t) || fromTo.test(t);
    }

    function hasDaysCount(text){
      const t = text || '';
      return /\b\d+\s*(day|days|night|nights)\b/i.test(t);
    }

    function basicGrammarFlags(text, opts = {}){
      const requireGreeting = opts.requireGreeting !== false;
      const requireThanks = opts.requireThanks !== false;
      const requireClosing = opts.requireClosing !== false;
      const issues = [];
      const t = (text || '').trim();
      if(!t) return issues;

      if(!/[.!?]$/.test(t)) issues.push('Add a full stop at the end.');
      if(/\bi\b/.test(t) && !/\bI\b/.test(t)) issues.push('Use capital "I".');
      if(/\s{2,}/.test(t)) issues.push('Remove extra spaces.');
      if(requireGreeting && !/\b(dear|hello|hi)\b/i.test(t)) issues.push('Add a greeting (e.g., Dear Sir/Madam).');
      if(requireThanks && !/\b(thank|thanks)\b/i.test(t)) issues.push('Add a closing thanks.');
      if(requireClosing && !/\b(sincerely|kind regards|regards)\b/i.test(t)) issues.push('Add a polite closing (Kind regards, ...).');
      return issues;
    }

    function scoreWritingTaskText(text){
      const w = words(text);
      const wc = w.length;
      let score = 0;
      const notes = [];
      let issues = [];
      let minGoodWords = 35;
      let firstStepMsg = 'Write your email first.';

      if(writingTaskTwoType === 'memo_kitchen'){
        const req = {
          kitchenStaff: hasAny(text, ['kitchen staff','kitchen team','kitchen','staff','colleague']),
          specialRequest: hasAny(text, ['special request','customer asks','customer request','customer']),
          glutenFree: hasAny(text, ['gluten-free meal','gluten free meal','gluten-free','gluten free']),
          extraKetchup: hasAny(text, ['extra ketchup','ketchup']),
          lemonade: hasAny(text, ['lemonade']),
          action: hasAny(text, ['please','prepare','include','inform','tell','pass on'])
        };

        minGoodWords = 20;
        firstStepMsg = 'Write your memo first.';

        if(req.kitchenStaff){ score += 1; } else { notes.push('Mention: kitchen staff / colleague.'); }
        if(req.specialRequest){ score += 1; } else { notes.push('Mention: this is a customer special request.'); }
        if(req.glutenFree){ score += 1; } else { notes.push('Include: gluten-free meal.'); }
        if(req.extraKetchup){ score += 1; } else { notes.push('Include: extra ketchup.'); }
        if(req.lemonade){ score += 1; } else { notes.push('Include: lemonade.'); }
        if(req.action){ score += 1; } else { notes.push('Use a clear action phrase (e.g., please prepare/include).'); }

        issues = basicGrammarFlags(text, { requireGreeting: false, requireThanks: false, requireClosing: false });
      }else if(writingTaskTwoType === 'incident_notice'){
        const req = {
          room312: hasAny(text, ['room 312','312']),
          wetFloor: hasAny(text, ['wet floor','wet','slippery']),
          apology: hasAny(text, ['apolog','sorry']),
          handled: hasAny(text, ['taken care','cleaned','mopped','dried','handled','fixed']),
          safety: hasAny(text, ['safe','caution','careful','warning','sign'])
        };

        minGoodWords = 20;
        firstStepMsg = 'Write your note first.';

        if(req.room312){ score += 1; } else { notes.push('Mention: Room 312.'); }
        if(req.wetFloor){ score += 1; } else { notes.push('Mention: wet floor.'); }
        if(req.apology){ score += 1; } else { notes.push('Include an apology (e.g., We apologise for...).'); }
        if(req.handled){ score += 1; } else { notes.push('Say: it has been taken care of / cleaned.'); }
        if(req.safety){ score += 1; } else { notes.push('Add a safety line (e.g., Please be careful).'); }
        if(hasAny(text, ['please','we have','we will','we are','our team'])){ score += 1; } else { notes.push('Use a polite, professional tone (e.g., Please...).'); }

        issues = basicGrammarFlags(text, { requireGreeting: true, requireThanks: false, requireClosing: true });
      }else if(writingTaskTwoType === 'itinerary_confirmation'){
        const req = {
          crete: hasAny(text, ['crete']),
          itinerary: hasAny(text, ['itinerary']),
          threeDay: hasAny(text, ['3-day','3 day','three-day','three day']),
          days: hasAny(text, ['day 1','day1','day 2','day2','day 3','day3']),
          confirm: hasAny(text, ['confirm','confirmation','please confirm','final confirmation'])
        };

        minGoodWords = 30;
        firstStepMsg = 'Write your email first.';

        if(req.crete){ score += 1; } else { notes.push('Mention: Crete.'); }
        if(req.itinerary){ score += 1; } else { notes.push('Mention: itinerary.'); }
        if(req.threeDay){ score += 1; } else { notes.push('Mention: 3-day.'); }
        if(req.days){ score += 1; } else { notes.push('Include: Day 1 / Day 2 / Day 3.'); }
        if(req.confirm){ score += 1; } else { notes.push('Ask for: final confirmation.'); }
        if(hasAny(text, ['would like','could you','please','i would like'])){ score += 1; } else { notes.push('Use a polite request phrase (e.g., "Could you please confirm...").'); }

        issues = basicGrammarFlags(text, { requireGreeting: true, requireThanks: true, requireClosing: true });
      }else{
        const req = {
          rethymno: hasAny(text, ['rethymno']),
          crete: hasAny(text, ['crete']),
          familyRoom: hasAny(text, ['family room','family-room','family accommodation','family']),
          breakfastRates: hasAny(text, ['breakfast rates','breakfast','rates','price','prices']),
          dates: hasDateLike(text),
          days: hasDaysCount(text)
        };

        if(req.rethymno && req.crete){ score += 1; } else { notes.push('Mention: Rethymno, Crete.'); }
        if(req.familyRoom){ score += 1; } else { notes.push('Mention: family room.'); }
        if(req.breakfastRates){ score += 1; } else { notes.push('Ask for: breakfast rates.'); }
        if(req.dates){ score += 1; } else { notes.push('Include: dates (from ... to ...).'); }
        if(req.days){ score += 1; } else { notes.push('Include: number of days or nights.'); }
        if(hasAny(text, ['would like','could you','please','i would like'])){ score += 1; } else { notes.push('Use a polite request phrase (e.g., "Could you please...").'); }

        issues = basicGrammarFlags(text, { requireGreeting: true, requireThanks: true, requireClosing: true });
      }

      if(wc === 0){
        notes.push(firstStepMsg);
      }else if(wc <= 50 && wc >= minGoodWords){
        score += 2;
      }else if(wc <= 50){
        score += 1;
        notes.push(`Try to write a bit more (aim for ~${minGoodWords}-50 words).`);
      }else{
        notes.push('Over 50 words (trim your email).');
      }

      if(issues.length === 0){
        score += 2;
      }else if(issues.length <= 2){
        score += 1;
      }

      return { score, wc, notes, issues };
    }

    checkBtn.addEventListener('click', () => {
      const text = textarea.value || '';
      enforceMaxWords();
      const r = scoreWritingTaskText(text);

      setScore(`Score: ${r.score}/10`);

      const list = (title, items) => {
        if(!items || items.length === 0) return '';
        const li = items.map(i => `<li>${i}</li>`).join('');
        return `<div class="wf-block"><div class="wf-title">${title}</div><ul>${li}</ul></div>`;
      };

      const okMsg = (r.score >= 8)
        ? '<div class="wf-ok">Strong answer. Minor tweaks only.</div>'
        : (r.score >= 5)
          ? '<div class="wf-mid">Good start. Improve the missing points below.</div>'
          : '<div class="wf-bad">Needs work. Follow the checklist below.</div>';

      setFeedback(
        `${okMsg}` +
        `<div class="wf-small">Words: ${r.wc}/50</div>` +
        list('Missing or improve', r.notes) +
        list('Writing checks', r.issues)
      );
    });

    resetBtn.addEventListener('click', () => {
      textarea.value = '';
      setCount(0);
      setScore('');
      setFeedback('');
    });
  }
  function init(){
    const root = document.querySelector('#tabHour2Writing, #tab3Hour2Writing, #tab4Hour2Writing');
    if(!root) return;
    if(root.dataset.h2wInitialized === '1') return;
    root.dataset.h2wInitialized = '1';

    setupWritingTaskOne();
    setupWritingTaskTwo();
  }

  // Expose re-init for dynamically injected module content
  window.initializeH2Writing = init;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
