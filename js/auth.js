(() => {
  const TOKEN_KEY = "e4sp_auth_token";

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const registerConfirmWrap = document.getElementById("registerConfirmWrap");
  const registerConfirmPasswordInput = document.getElementById("registerConfirmPassword");
  const registerCaptchaWrap = document.getElementById("registerCaptchaWrap");
  const registerCaptchaPrompt = document.getElementById("registerCaptchaPrompt");
  const registerCaptchaAnswerInput = document.getElementById("registerCaptchaAnswer");
  const registerCaptchaRefreshBtn = document.getElementById("registerCaptchaRefreshBtn");
  const registerVerifyWrap = document.getElementById("registerVerifyWrap");
  const registerSubmitBtn = document.getElementById("registerSubmitBtn");
  const registerCodeInput = document.getElementById("registerCode");
  const authSwitch = document.getElementById("authSwitch");
  const authProgressBig = document.getElementById("authProgressBig");
  const showLoginBtn = document.getElementById("showLoginBtn");
  const showRegisterBtn = document.getElementById("showRegisterBtn");
  const feedback = document.getElementById("authFeedback");
  const userBox = document.getElementById("authUserBox");
  const userText = document.getElementById("authUserText");
  const changeProgressBtn = document.getElementById("changeProgressBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  let registerStage = "request";
  let registerCaptchaId = "";

  if (
    !loginForm ||
    !registerForm ||
    !registerConfirmWrap ||
    !registerConfirmPasswordInput ||
    !registerCaptchaWrap ||
    !registerCaptchaPrompt ||
    !registerCaptchaAnswerInput ||
    !registerCaptchaRefreshBtn ||
    !registerVerifyWrap ||
    !registerSubmitBtn ||
    !registerCodeInput ||
    !authSwitch ||
    !authProgressBig ||
    !showLoginBtn ||
    !showRegisterBtn ||
    !feedback ||
    !userBox ||
    !userText ||
    !changeProgressBtn ||
    !logoutBtn
  ) {
    return;
  }

  function setAuthState(isAuthenticated, progress = 0) {
    const safeProgress = Number.isFinite(Number(progress)) ? Math.max(0, Math.min(100, Number(Number(progress).toFixed(4)))) : 0;
    document.body.classList.toggle("is-authenticated", !!isAuthenticated);
    document.dispatchEvent(new CustomEvent("auth:statechange", { detail: { authenticated: !!isAuthenticated, progress: safeProgress } }));
  }

  function formatProgressPercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "0.00%";
    return `${Math.max(0, Math.min(100, numeric)).toFixed(2)}%`;
  }

  function finishBoot() {
    document.body.classList.remove("auth-loading");
  }

  function setFeedback(message, type = "") {
    feedback.textContent = message || "";
    feedback.classList.remove("is-error", "is-ok");
    if (type) feedback.classList.add(type);
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
    } catch (_e) {}

    if (!response.ok) {
      throw new Error(payload?.error || `Request failed (${response.status})`);
    }

    return payload;
  }

  async function loadCaptchaChallenge() {
    try {
      const data = await api("/api/auth/captcha-challenge", { method: "GET" });
      registerCaptchaId = String(data?.challengeId || "");
      registerCaptchaPrompt.textContent = String(data?.prompt || "Solve the captcha.");
      registerCaptchaAnswerInput.value = "";
      return !!registerCaptchaId;
    } catch (_error) {
      registerCaptchaId = "";
      registerCaptchaPrompt.textContent = "Captcha unavailable. Press Refresh.";
      return false;
    }
  }

  function showMode(mode) {
    const loginMode = mode === "login";
    loginForm.hidden = !loginMode;
    registerForm.hidden = loginMode;
    showLoginBtn.classList.toggle("is-active", loginMode);
    showRegisterBtn.classList.toggle("is-active", !loginMode);
    showLoginBtn.setAttribute("aria-selected", loginMode ? "true" : "false");
    showRegisterBtn.setAttribute("aria-selected", loginMode ? "false" : "true");
    setFeedback("");
    if (!loginMode) setRegisterStage("request");
  }

  function setRegisterStage(stage) {
    registerStage = stage === "verify" ? "verify" : "request";
    const verify = registerStage === "verify";
    registerVerifyWrap.hidden = !verify;
    registerCodeInput.required = verify;
    registerConfirmWrap.hidden = verify;
    registerCaptchaWrap.hidden = verify;
    registerConfirmPasswordInput.required = !verify;
    registerCaptchaAnswerInput.required = !verify;
    registerSubmitBtn.textContent = verify ? "Verify And Create Account" : "Send Verification Code (Check Spam)";
    if (verify) {
      registerCodeInput.value = "";
      return;
    }
    registerCodeInput.value = "";
    void loadCaptchaChallenge();
  }

  function showUser(user) {
    const progress = Number.isFinite(Number(user?.progress)) ? Math.max(0, Math.min(100, Number(Number(user.progress).toFixed(4)))) : 0;
    setAuthState(true, progress);
    userBox.hidden = false;
    loginForm.hidden = true;
    registerForm.hidden = true;
    authSwitch.hidden = true;
    userText.textContent = `Signed in as ${user.email}`;
    authProgressBig.textContent = formatProgressPercent(progress);
  }

  function showAuthForms(defaultMode = "login") {
    setAuthState(false, 0);
    userBox.hidden = true;
    authSwitch.hidden = false;
    showMode(defaultMode);
    setRegisterStage("request");
  }

  async function refreshSession() {
    const token = getToken();
    if (!token) {
      showAuthForms("login");
      finishBoot();
      return;
    }

    try {
      const data = await api("/api/auth/me", { method: "GET" });
      showUser(data.user);
      setFeedback("Session active.", "is-ok");
    } catch (_error) {
      setToken("");
      showAuthForms("login");
    } finally {
      finishBoot();
    }
  }

  showLoginBtn.addEventListener("click", () => showMode("login"));
  showRegisterBtn.addEventListener("click", () => showMode("register"));

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(registerForm.email.value || "").trim();
    const password = String(registerForm.password.value || "");
    const confirmPassword = String(registerConfirmPasswordInput.value || "");
    const captchaAnswer = String(registerCaptchaAnswerInput.value || "").trim();
    const code = String(registerCodeInput.value || "").trim();

    setFeedback("");
    try {
      if (registerStage === "request") {
        if (password !== confirmPassword) {
          setFeedback("Password and confirm password must match.", "is-error");
          return;
        }
        if (!registerCaptchaId) {
          const ready = await loadCaptchaChallenge();
          if (!ready) {
            setFeedback("Captcha is unavailable. Press Refresh and try again.", "is-error");
            return;
          }
        }
        const data = await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, captchaId: registerCaptchaId, captchaAnswer })
        });
        setRegisterStage("verify");
        setFeedback(`Verification code sent to ${data.email}. Check spam.`, "is-ok");
        return;
      }

      const data = await api("/api/auth/register-verify", {
        method: "POST",
        body: JSON.stringify({ email, code })
      });
      setToken(data.token);
      showUser(data.user);
      setFeedback("Account verified and created.", "is-ok");
      registerForm.reset();
      setRegisterStage("request");
    } catch (error) {
      if (registerStage === "request") {
        await loadCaptchaChallenge();
      }
      setFeedback(error.message, "is-error");
    }
  });

  registerCaptchaRefreshBtn.addEventListener("click", async () => {
    const ready = await loadCaptchaChallenge();
    if (!ready) {
      setFeedback("Captcha is unavailable right now. Try again.", "is-error");
      return;
    }
    setFeedback("Captcha refreshed.", "is-ok");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(loginForm.email.value || "").trim();
    const password = String(loginForm.password.value || "");

    setFeedback("");
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setToken(data.token);
      showUser(data.user);
      setFeedback("Logged in successfully.", "is-ok");
      loginForm.reset();
    } catch (error) {
      setFeedback(error.message, "is-error");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch (_error) {}
    setToken("");
    window.location.assign(window.location.pathname);
  });

  changeProgressBtn.addEventListener("click", async () => {
    const current = Number.parseFloat(String(authProgressBig.textContent || "0").replace("%", "")) || 0;
    const raw = window.prompt("Set completion percentage (0-100):", current.toFixed(2));
    if (raw === null) return;

    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setFeedback("Please enter a number between 0 and 100.", "is-error");
      return;
    }

    try {
      const data = await api("/api/progress-set", {
        method: "POST",
        body: JSON.stringify({ progress: value })
      });
      const next = Number.isFinite(Number(data?.progress)) ? Number(Number(data.progress).toFixed(4)) : Number(Number(value).toFixed(4));
      authProgressBig.textContent = formatProgressPercent(next);
      setAuthState(true, next);
      setFeedback("Progress updated (testing).", "is-ok");
    } catch (error) {
      setFeedback(error.message, "is-error");
    }
  });

  document.addEventListener("progress:updated", (event) => {
    const next = Number.isFinite(Number(event?.detail?.progress)) ? Math.max(0, Math.min(100, Number(Number(event.detail.progress).toFixed(4)))) : 0;
    authProgressBig.textContent = formatProgressPercent(next);
  });

  refreshSession();
})();
