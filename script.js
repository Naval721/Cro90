const mainZone = "10362431";
const sdkMethod = `show_${mainZone}`;
const adButton = document.getElementById("showAdBtn");
const preloadButton = document.getElementById("preloadBtn");
const themeToggle = document.getElementById("themeToggle");
const statusEl = document.getElementById("adStatus");
const monetagScript = document.getElementById("monetag-sdk");

let userId = "guest";
let adReady = false;
let sdkReady = false;
let sdkReadyPromiseResolve;
let sdkReadyPromiseReject;
let preloadInFlight = false;
let sdkPollInterval;

const sdkReadyPromise = new Promise((resolve, reject) => {
  sdkReadyPromiseResolve = resolve;
  sdkReadyPromiseReject = reject;
});

function rewardUser() {
  // TODO: replace with your reward logic (e.g., credit coins, unlock feature)
  alert("You have seen an ad!");
}

function updateStatus(text) {
  statusEl.textContent = `Ad status: ${text}`;
}

function hydrateTelegram() {
  if (window.Telegram && window.Telegram.WebApp) {
    try {
      window.Telegram.WebApp.ready();
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      if (tgUser?.id) {
        userId = `${tgUser.id}`;
      }
    } catch (err) {
      console.warn("Telegram SDK init failed", err);
    }
  }
}

function getAdHandler() {
  const handler = window[sdkMethod];
  if (!handler) {
    updateStatus("SDK not loaded. Check Monetag script tag.");
    console.warn("Monetag SDK handler missing for", sdkMethod);
    throw new Error("Monetag SDK handler missing");
  }
  return handler;
}

function preloadAd() {
  if (preloadInFlight) return Promise.resolve();
  try {
    const handler = getAdHandler();
    preloadInFlight = true;
    updateStatus("preloading…");
    return handler({ type: "preload", ymid: userId, requestVar: "main-preload" })
      .then(() => {
        adReady = true;
        preloadInFlight = false;
        updateStatus("ready (preloaded)");
      })
      .catch((err) => {
        adReady = false;
        preloadInFlight = false;
        console.warn("Preload failed", err);
        updateStatus("preload failed — tap Preload again");
      });
  } catch (err) {
    console.error(err);
    preloadInFlight = false;
    return Promise.resolve();
  }
}

function showAd() {
  try {
    // Proceed if handler is present; otherwise surface a clear message
    if (!sdkReady && !window[sdkMethod]) {
      updateStatus("SDK still loading…");
      console.warn("Ad show attempted before SDK ready");
      return Promise.resolve();
    }
    const handler = getAdHandler();
    updateStatus(adReady ? "showing preloaded ad…" : "loading ad…");
    const opts = { ymid: userId, requestVar: "main-show" };
    return handler(opts)
      .then(() => {
        updateStatus("completed — reward granted");
        adReady = false;
        alert("You have seen an ad!");
        // Auto-preload next ad
        preloadAd();
      })
      .catch((err) => {
        console.warn("Ad failed or was skipped", err);
        const msg = err?.message || err?.code || "no message";
        updateStatus(`failed — fallback invoked (${msg})`);
        showFallbackAd();
      });
  } catch (err) {
    console.error("SDK handler missing", err);
    updateStatus("SDK handler missing");
    return Promise.resolve();
  }
}

function showFallbackAd() {
  // Placeholder for backup monetization (e.g., another provider or cross-promo)
  console.info("Fallback ad placeholder executed");
}

function setupButtons() {
  preloadButton?.addEventListener("click", preloadAd);
  adButton?.addEventListener("click", showAd);
  themeToggle?.addEventListener("click", toggleTheme);
  document.querySelectorAll("[data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      updateStatus(`Opened ${btn.dataset.tool}`);
    });
  });
}

function toggleTheme() {
  document.body.classList.toggle("light");
}

hydrateTelegram();
setupButtons();

// Wait for Monetag SDK to signal load
if (monetagScript) {
  monetagScript.addEventListener("load", () => {
    sdkReady = true;
    sdkReadyPromiseResolve();
    updateStatus("SDK loaded — tap Preload");
  });
  monetagScript.addEventListener("error", (err) => {
    sdkReady = false;
    sdkReadyPromiseReject(err);
    updateStatus("SDK failed to load. Check script src/zone.");
    console.error("Monetag SDK failed to load", err);
  });
} else {
  console.warn("Monetag script tag not found");
  updateStatus("Monetag script tag missing");
  sdkReadyPromiseReject(new Error("Monetag script tag missing"));
}

// Fallback polling in case the load event is blocked but the handler becomes available
sdkPollInterval = setInterval(() => {
  if (window[sdkMethod]) {
    sdkReady = true;
    updateStatus("SDK loaded — tap Preload");
    sdkReadyPromiseResolve();
    clearInterval(sdkPollInterval);
  }
}, 500);

sdkReadyPromise
  .then(() => preloadAd())
  .catch(() => {
    // Status already set in error handler
  });

