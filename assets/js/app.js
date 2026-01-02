const els = {
  tabs: document.getElementById("lessonTabs"),
  metaDone: document.getElementById("metaDone"),
  metaTotal: document.getElementById("metaTotal"),
  meterFill: document.getElementById("meterFill"),
  crumbLesson: document.getElementById("crumbLesson"),
  lessonTitle: document.getElementById("lessonTitle"),
  lessonSubtitle: document.getElementById("lessonSubtitle"),
  lessonBody: document.getElementById("lessonBody"),
  statusChip: document.getElementById("statusChip"),
  completeBtn: document.getElementById("completeBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  resetBtn: document.getElementById("resetBtn"),
  hintBtn: document.getElementById("hintBtn"),
  bubbleText: document.getElementById("bubbleText"),
  questionText: document.getElementById("questionText"),
  choices: document.getElementById("choices"),
  feedback: document.getElementById("feedback"),
  continueBtn: document.getElementById("continueBtn")
};

let data = null;
let state = DemoState.load();
let qaStepIndex = 0;

async function init(){
  data = await fetch("assets/data/course.json").then(r => r.json());
  els.metaTotal.textContent = String(data.lessons.length);

  renderTabs();
  loadLesson(state.currentLesson);
  wire();
  renderProgress();
}

function wire(){
  els.completeBtn.addEventListener("click", () => completeCurrent());
  els.prevBtn.addEventListener("click", () => goRelative(-1));
  els.nextBtn.addEventListener("click", () => goRelative(1));
  els.resetBtn.addEventListener("click", () => {
    state = DemoState.reset();
    qaStepIndex = 0;
    DemoState.save(state);
    renderTabs();
    loadLesson(1);
    renderProgress();
    setFeedback("");
  });
  els.hintBtn.addEventListener("click", () => {
    const lesson = data.lessons[state.currentLesson - 1];
    setBubble(lesson.tutor.hint);
    setFeedback("");
  });
  els.continueBtn.addEventListener("click", () => qaAdvance());
}

function renderTabs(){
  els.tabs.innerHTML = "";
  data.lessons.forEach((lesson, idx) => {
    const num = idx + 1;
    const isUnlocked = num <= state.unlocked;
    const isDone = state.completed[idx] === true;
    const isCurrent = num === state.currentLesson;

    const tab = document.createElement("div");
    tab.className = "tab";
    tab.setAttribute("role", "button");
    tab.setAttribute("tabindex", "0");
    tab.setAttribute("aria-disabled", String(!isUnlocked));

    tab.addEventListener("click", () => {
      if(!isUnlocked) return;
      loadLesson(num);
    });
    tab.addEventListener("keydown", (e) => {
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        if(!isUnlocked) return;
        loadLesson(num);
      }
    });

    tab.innerHTML = `
      <div class="tab-left">
        <div class="badge">${num}</div>
        <div>
          <div class="tab-title">${lesson.navTitle}</div>
          <div class="tab-sub">${lesson.navSub}</div>
        </div>
      </div>
      <div class="tab-right">
        <div class="pip ${isDone ? "done" : (isCurrent ? "current" : "")}"></div>
      </div>
    `;

    els.tabs.appendChild(tab);
  });
}

function loadLesson(num){
  state.currentLesson = num;
  DemoState.save(state);

  const lesson = data.lessons[num - 1];
  els.crumbLesson.textContent = `Lesson ${num}`;
  els.lessonTitle.textContent = lesson.title;
  els.lessonSubtitle.textContent = lesson.subtitle;

  els.lessonBody.innerHTML = `
    <h3>${lesson.block.title}</h3>
    <p>${lesson.block.text}</p>
    <div class="callout">
      <div><strong>Task</strong></div>
      <ul>
        ${lesson.block.bullets.map(b => `<li>${b}</li>`).join("")}
      </ul>
    </div>
  `;

  const done = state.completed[num - 1] === true;
  els.statusChip.textContent = done ? "Completed" : "In progress";

  qaStepIndex = 0;
  setBubble(lesson.tutor.opening);
  setQuestion(lesson.tutor.qa[0].q);
  renderChoices(lesson.tutor.qa[0]);
  setFeedback("");

  renderTabs();
  renderProgress();
  updateNavButtons();
}

function updateNavButtons(){
  els.prevBtn.disabled = state.currentLesson === 1;
  els.nextBtn.disabled = state.currentLesson === 10 || (state.currentLesson + 1) > state.unlocked;
}

function goRelative(delta){
  const next = state.currentLesson + delta;
  if(next < 1 || next > 10) return;
  if(next > state.unlocked) return;
  loadLesson(next);
}

function completeCurrent(){
  const idx = state.currentLesson - 1;
  state.completed[idx] = true;

  if(state.unlocked < 10 && state.currentLesson === state.unlocked){
    state.unlocked = Math.min(10, state.unlocked + 1);
  }

  DemoState.save(state);
  els.statusChip.textContent = "Completed";
  renderTabs();
  renderProgress();
  updateNavButtons();
  setBubble("Nice. You unlocked the next lesson.");
}

function renderProgress(){
  const doneCount = state.completed.filter(Boolean).length;
  els.metaDone.textContent = String(doneCount);
  const pct = Math.round((doneCount / data.lessons.length) * 100);
  els.meterFill.style.width = `${pct}%`;
  const meter = document.querySelector(".meter");
  meter.setAttribute("aria-valuenow", String(doneCount));
}

function qaAdvance(){
  const lesson = data.lessons[state.currentLesson - 1];
  const qa = lesson.tutor.qa;

  if(qaStepIndex < qa.length - 1){
    qaStepIndex++;
    setBubble(qa[qaStepIndex].prompt);
    setQuestion(qa[qaStepIndex].q);
    renderChoices(qa[qaStepIndex]);
    setFeedback("");
  }else{
    setBubble(lesson.tutor.end);
    setQuestion("Done.");
    els.choices.innerHTML = "";
    setFeedback("");
  }
}

function renderChoices(step){
  els.choices.innerHTML = "";
  step.options.forEach((opt, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "choice";
    el.textContent = opt.text;

    el.addEventListener("click", () => {
      const buttons = Array.from(els.choices.querySelectorAll(".choice"));
      buttons.forEach(b => b.classList.remove("correct","wrong"));

      if(opt.correct){
        el.classList.add("correct");
        setFeedback(step.feedbackCorrect);
        setBubble(step.bubbleCorrect);
      }else{
        el.classList.add("wrong");
        setFeedback(step.feedbackWrong);
        setBubble(step.bubbleWrong);
      }
    });

    els.choices.appendChild(el);
  });
}

function setBubble(text){
  els.bubbleText.textContent = text;
}

function setQuestion(text){
  els.questionText.textContent = text;
}

function setFeedback(text){
  els.feedback.textContent = text;
}

init();
