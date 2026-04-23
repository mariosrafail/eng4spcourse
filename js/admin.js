(() => {
  const TOKEN_KEY = "e4sp_admin_token";
  const TOTAL_HOURS_KEY = "e4sp_admin_total_hours";

  const loginCard = document.getElementById("adminLoginCard");
  const dashboard = document.getElementById("adminDashboard");
  const loginForm = document.getElementById("adminLoginForm");
  const feedback = document.getElementById("adminFeedback");
  const signedInText = document.getElementById("adminSignedIn");
  const logoutBtn = document.getElementById("adminLogoutBtn");
  const refreshBtn = document.getElementById("adminRefreshBtn");
  const totalHoursInput = document.getElementById("totalTestHoursInput");
  const candidatesBody = document.getElementById("adminCandidatesBody");
  const emptyState = document.getElementById("adminEmpty");

  if (
    !loginCard ||
    !dashboard ||
    !loginForm ||
    !feedback ||
    !signedInText ||
    !logoutBtn ||
    !refreshBtn ||
    !totalHoursInput ||
    !candidatesBody ||
    !emptyState
  ) {
    return;
  }

  let candidates = [];
  let refreshTimer = null;

  function finishBoot() {
    document.body.classList.remove("auth-loading");
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(token) {
    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    localStorage.setItem(TOKEN_KEY, token);
  }

  function setFeedback(message, type = "") {
    feedback.textContent = message || "";
    feedback.classList.remove("is-error", "is-ok");
    if (type) feedback.classList.add(type);
  }

  async function api(path, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, {
      ...options,
      headers
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch (_error) {}

    if (!response.ok) {
      throw new Error(payload?.error || `Request failed (${response.status})`);
    }

    return payload;
  }

  function parseTotalHours() {
    const value = Number(totalHoursInput.value);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value;
  }

  function formatHours(hours) {
    const safe = Number.isFinite(hours) ? Math.max(0, hours) : 0;
    return safe.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  function renderCandidates() {
    const totalHours = parseTotalHours();
    candidatesBody.textContent = "";

    if (!candidates.length) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    for (const candidate of candidates) {
      const tr = document.createElement("tr");
      const progress = Math.max(0, Math.min(100, Number(candidate.progress) || 0));
      const completedHours = totalHours > 0 ? (totalHours * progress) / 100 : 0;
      const label = `${formatHours(completedHours)} hours out of ${formatHours(totalHours)} completed`;

      const nameTd = document.createElement("td");
      nameTd.textContent = candidate.username || candidate.email || `User #${candidate.id}`;

      const progressTd = document.createElement("td");
      progressTd.textContent = `${progress.toFixed(2)}%`;

      const timeTd = document.createElement("td");
      timeTd.textContent = label;

      tr.append(nameTd, progressTd, timeTd);
      candidatesBody.appendChild(tr);
    }
  }

  async function refreshCandidates() {
    const data = await api("/api/admin/candidates", { method: "GET" });
    candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    renderCandidates();
  }

  function showDashboard(user) {
    loginCard.hidden = true;
    dashboard.hidden = false;
    signedInText.textContent = `Signed in as ${user?.username || "admin"}`;
  }

  function showLogin() {
    dashboard.hidden = true;
    loginCard.hidden = false;
    candidates = [];
    candidatesBody.textContent = "";
    emptyState.hidden = true;
  }

  function clearRefreshTimer() {
    if (!refreshTimer) return;
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function startRefreshTimer() {
    clearRefreshTimer();
    refreshTimer = window.setInterval(() => {
      if (dashboard.hidden) return;
      refreshCandidates().catch(() => {});
    }, 15000);
  }

  async function refreshSession() {
    const token = getToken();
    if (!token) {
      showLogin();
      finishBoot();
      return;
    }

    try {
      const data = await api("/api/admin/me", { method: "GET" });
      showDashboard(data.user);
      await refreshCandidates();
      setFeedback("");
      startRefreshTimer();
    } catch (_error) {
      setToken("");
      showLogin();
    } finally {
      finishBoot();
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = String(loginForm.username.value || "").trim();
    const password = String(loginForm.password.value || "");
    setFeedback("");

    try {
      const data = await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      setToken(data.token);
      showDashboard(data.user);
      await refreshCandidates();
      startRefreshTimer();
      setFeedback("Admin login successful.", "is-ok");
      loginForm.reset();
    } catch (error) {
      setFeedback(error.message, "is-error");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await api("/api/admin/logout", { method: "POST" });
    } catch (_error) {}
    clearRefreshTimer();
    setToken("");
    showLogin();
    setFeedback("Logged out.", "is-ok");
  });

  refreshBtn.addEventListener("click", async () => {
    try {
      await refreshCandidates();
    } catch (error) {
      setFeedback(error.message, "is-error");
    }
  });

  totalHoursInput.addEventListener("input", () => {
    const value = parseTotalHours();
    if (value > 0) {
      localStorage.setItem(TOTAL_HOURS_KEY, String(value));
    }
    renderCandidates();
  });

  const savedTotalHours = Number(localStorage.getItem(TOTAL_HOURS_KEY) || "");
  if (Number.isFinite(savedTotalHours) && savedTotalHours > 0) {
    totalHoursInput.value = String(savedTotalHours);
  }

  refreshSession();
})();
