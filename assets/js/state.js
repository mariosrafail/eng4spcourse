const DemoState = (() => {
  const KEY = "course_demo_v2_state";

  const defaultState = () => ({
    currentLesson: 1,
    unlocked: 1,
    completed: Array.from({length:10}, () => false)
  });

  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return defaultState();
      const s = JSON.parse(raw);
      if(!s || !Array.isArray(s.completed) || s.completed.length !== 10) return defaultState();
      s.currentLesson = clampInt(s.currentLesson, 1, 10);
      s.unlocked = clampInt(s.unlocked, 1, 10);
      return s;
    }catch(e){
      return defaultState();
    }
  }

  function save(state){
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function reset(){
    localStorage.removeItem(KEY);
    return defaultState();
  }

  function clampInt(v, min, max){
    const n = parseInt(v, 10);
    if(Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  return { load, save, reset };
})(); 
