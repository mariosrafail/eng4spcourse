(() => {
  const IMG_DAV_BASE = "https://nextcloud.stinis.ddns.net/public.php/dav/files/4jqtp8mSzbeKsLM";
  const SOUND_DAV_BASE = "https://nextcloud.stinis.ddns.net/public.php/dav/files/zr9Z7nnBx3Beb8M";
  const STARTUP_MAX_WAIT_MS = 12000;
  const ITEM_TIMEOUT_MS = 8000;
  const IMAGE_CONCURRENCY = 8;
  const AUDIO_CONCURRENCY = 3;
  const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac)$/i;
  const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif|ico)$/i;
  const PRELOAD_AUDIO_STORE = [];

  function isExternalUrl(value) {
    const raw = String(value || "").trim().toLowerCase();
    return (
      !raw ||
      raw.startsWith("http://") ||
      raw.startsWith("https://") ||
      raw.startsWith("//") ||
      raw.startsWith("data:") ||
      raw.startsWith("blob:") ||
      raw.startsWith("mailto:") ||
      raw.startsWith("tel:") ||
      raw.startsWith("#")
    );
  }

  function normalizeRelativeAssetPath(value) {
    const raw = String(value || "").trim();
    if (!raw || isExternalUrl(raw)) return "";
    const noQuery = raw.split("#")[0].split("?")[0].trim();
    const noDot = noQuery.replace(/^\.\/+/, "");
    if (noDot.startsWith("/img/")) return `img/${noDot.slice(5)}`;
    if (noDot.startsWith("/sound/")) return `sound/${noDot.slice(7)}`;
    return noDot;
  }

  function makeNextcloudDavUrl(base, filename) {
    return `${base}/${encodeURIComponent(filename)}`;
  }

  function resolveCourseAssetPath(value) {
    if (typeof value !== "string") return value;
    const normalized = normalizeRelativeAssetPath(value);
    if (!normalized) return value;
    if (normalized.startsWith("img/")) {
      return makeNextcloudDavUrl(IMG_DAV_BASE, normalized.slice(4));
    }
    if (normalized.startsWith("sound/")) {
      return makeNextcloudDavUrl(SOUND_DAV_BASE, normalized.slice(6));
    }
    return value;
  }

  function rewriteElementAttributes(el) {
    if (!el || el.nodeType !== 1) return;
    ["src", "href", "poster"].forEach((attr) => {
      if (!el.hasAttribute(attr)) return;
      const current = el.getAttribute(attr) || "";
      const next = resolveCourseAssetPath(current);
      if (typeof next === "string" && next && next !== current) {
        el.setAttribute(attr, next);
      }
    });
  }

  function rewriteCourseAssetUrls(root = document) {
    if (!root) return;
    if (root.nodeType === 1) {
      rewriteElementAttributes(root);
      root.querySelectorAll("[src],[href],[poster]").forEach(rewriteElementAttributes);
      return;
    }
    if (root.nodeType === 9) {
      root.querySelectorAll("[src],[href],[poster]").forEach(rewriteElementAttributes);
    }
  }

  function rewriteCourseAssetPathsInHTML(html) {
    return String(html || "").replace(
      /((?:src|href|poster)\s*=\s*["'])([^"']+)(["'])/gi,
      (_m, prefix, rawValue, suffix) => {
        const next = resolveCourseAssetPath(rawValue);
        return `${prefix}${next}${suffix}`;
      }
    );
  }

  function registerRelativeAssetFromValue(value, bucket) {
    const normalized = normalizeRelativeAssetPath(value);
    if (!normalized) return;

    let type = "";
    if (normalized.startsWith("img/")) type = "image";
    else if (normalized.startsWith("sound/")) type = "audio";
    else return;

    const url = resolveCourseAssetPath(normalized);
    if (!url) return;
    if (!bucket.has(url)) {
      bucket.set(url, type);
    }
  }

  function collectAssetsFromHtmlString(html, bucket) {
    const source = String(html || "");
    const attrRe = /\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi;
    let match = null;
    while ((match = attrRe.exec(source)) !== null) {
      registerRelativeAssetFromValue(match[1], bucket);
    }
  }

  function collectAssetsFromCurrentDOM(bucket) {
    document.querySelectorAll("[src],[href],[poster]").forEach((el) => {
      ["src", "href", "poster"].forEach((attr) => {
        if (!el.hasAttribute(attr)) return;
        registerRelativeAssetFromValue(el.getAttribute(attr), bucket);
      });
    });
  }

  async function fetchModuleHtml(moduleId) {
    const res = await fetch(`modules/module-${moduleId}.html`, { cache: "force-cache" });
    if (!res.ok) throw new Error(`module-${moduleId} fetch failed`);
    return res.text();
  }

  async function collectAllKnownAssets() {
    const bucket = new Map();
    collectAssetsFromCurrentDOM(bucket);

    const moduleIds = Array.from(document.querySelectorAll(".module-panel[data-module]"))
      .map((el) => String(el.dataset.module || "").trim())
      .filter(Boolean);

    await Promise.all(
      moduleIds.map(async (moduleId) => {
        try {
          const html = await fetchModuleHtml(moduleId);
          collectAssetsFromHtmlString(html, bucket);
        } catch (_e) {}
      })
    );

    return bucket;
  }

  function withTimeout(promise, timeoutMs) {
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve();
      }, timeoutMs);

      Promise.resolve(promise)
        .catch(() => {})
        .finally(() => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve();
        });
    });
  }

  function preloadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const timer = setTimeout(finish, ITEM_TIMEOUT_MS);
      img.onload = () => {
        clearTimeout(timer);
        finish();
      };
      img.onerror = () => {
        clearTimeout(timer);
        finish();
      };
      img.src = url;
    });
  }

  function preloadAudioMetadata(url) {
    return new Promise((resolve) => {
      const audio = document.createElement("audio");
      PRELOAD_AUDIO_STORE.push(audio);

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        audio.removeEventListener("loadedmetadata", onDone);
        audio.removeEventListener("canplaythrough", onDone);
        audio.removeEventListener("error", onDone);
        resolve();
      };
      const onDone = () => finish();
      const timer = setTimeout(finish, ITEM_TIMEOUT_MS);
      audio.preload = "metadata";
      audio.src = url;
      audio.addEventListener("loadedmetadata", () => {
        clearTimeout(timer);
        onDone();
      });
      audio.addEventListener("canplaythrough", () => {
        clearTimeout(timer);
        onDone();
      });
      audio.addEventListener("error", () => {
        clearTimeout(timer);
        onDone();
      });
      audio.load();
    });
  }

  async function runWithConcurrency(items, limit, worker) {
    if (!items.length) return;
    const queue = [...items];
    const runners = Array.from({ length: Math.max(1, Math.min(limit, queue.length)) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) continue;
        await worker(item);
      }
    });
    await Promise.all(runners);
  }

  async function preloadKnownAssets(assetMap) {
    const imageUrls = [];
    const audioUrls = [];

    assetMap.forEach((type, url) => {
      if (type === "image" || IMAGE_EXT_RE.test(url)) {
        imageUrls.push(url);
        return;
      }
      if (type === "audio" || AUDIO_EXT_RE.test(url)) {
        audioUrls.push(url);
      }
    });

    await Promise.all([
      runWithConcurrency(imageUrls, IMAGE_CONCURRENCY, preloadImage),
      runWithConcurrency(audioUrls, AUDIO_CONCURRENCY, preloadAudioMetadata)
    ]);
  }

  function observeDynamicNodes() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            rewriteCourseAssetUrls(node);
          });
          return;
        }
        if (mutation.type === "attributes") {
          rewriteElementAttributes(mutation.target);
        }
      });
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["src", "href", "poster"]
    });
  }

  function exposeHelpers() {
    window.resolveCourseAssetPath = resolveCourseAssetPath;
    window.rewriteCourseAssetUrls = rewriteCourseAssetUrls;
    window.rewriteCourseAssetPathsInHTML = rewriteCourseAssetPathsInHTML;
  }

  async function bootstrapAssets() {
    exposeHelpers();
    document.body.classList.add("assets-loading");
    rewriteCourseAssetUrls(document);
    observeDynamicNodes();

    try {
      const assetMap = await collectAllKnownAssets();
      await withTimeout(preloadKnownAssets(assetMap), STARTUP_MAX_WAIT_MS);
    } finally {
      document.body.classList.remove("assets-loading");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapAssets, { once: true });
  } else {
    bootstrapAssets();
  }
})();
