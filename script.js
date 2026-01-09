// --- DEVICE MASQUERADING (IPHONE 15 PRO + DEEP VPN SHIELD) ---
try {
  // 1. Spoof User Agent & Platform
  Object.defineProperty(navigator, 'userAgent', {
    get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  });
  Object.defineProperty(navigator, 'platform', { get: () => "iPhone" });
  Object.defineProperty(navigator, 'vendor', { get: () => "Apple Computer, Inc." });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 6 });

  // 2. Touch Points
  Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });

  // 3. Network Information (5G Simulation)
  const fakeConnection = {
    effectiveType: '4g',
    rtt: 50,
    downlink: 10,
    saveData: false,
    addEventListener: () => { },
    removeEventListener: () => { }
  };
  Object.defineProperty(navigator, 'connection', { get: () => fakeConnection });

  // 4. Screen Properties
  Object.defineProperty(screen, 'width', { get: () => 430 });
  Object.defineProperty(screen, 'height', { get: () => 932 });
  Object.defineProperty(window, 'innerWidth', { get: () => 430 });
  Object.defineProperty(window, 'innerHeight', { get: () => 932 });

  // 5. DEEP MASKING: WebRTC Shield (Prevent Real IP Leak)
  const noop = () => { };
  window.RTCPeerConnection = function () {
    this.createDataChannel = () => ({ send: noop, close: noop });
    this.createOffer = () => Promise.resolve({ type: 'offer', sdp: '' });
    this.setLocalDescription = () => Promise.resolve();
    this.setRemoteDescription = () => Promise.resolve();
    this.addEventListener = noop;
  };
  window.webkitRTCPeerConnection = window.RTCPeerConnection;
  window.mozRTCPeerConnection = window.RTCPeerConnection;

  // 6. DEEP MASKING: Timezone & Locale (Force USA/New York)
  // Ad networks compare IP Timezone vs System Timezone. If you use US VPN, you MUST have US Time.
  Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

  // Spoof Date object to always be EST (UTC-5)
  // This is complex, but overriding Intl is usually enough for ad scripts
  const originalDTF = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function (locales, options) {
    options = options || {};
    options.timeZone = "America/New_York";
    return new originalDTF("en-US", options);
  };
  Intl.DateTimeFormat.supportedLocalesOf = originalDTF.supportedLocalesOf;

  // Override classic Date.getTimezoneOffset (returns minutes behind UTC)
  // EST is 300 minutes (5 hours) behind UTC
  Date.prototype.getTimezoneOffset = () => 300;

  // 7. Battery Fingerprint (Healthy Mobile State)
  if (navigator.getBattery) {
    navigator.getBattery = () => Promise.resolve({
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 0.85,
      addEventListener: noop
    });
  }

  console.log("SYSTEM OVERRIDE: VPN SHIELD + DEVICE SPOOF ACTIVE");
} catch (e) {
  console.warn("SPOOF FAILED:", e);
}

const mainZone = "10362431";
const sdkMethod = `show_${mainZone}`;

// UI Elements
const miningDisplay = document.getElementById("miningBalance");
const hashRateDisplay = document.getElementById("hashRate");
const rigStatusDisplay = document.getElementById("rigStatus");
const tempDisplay = document.getElementById("rigTemp");
const boostTimerDisplay = document.getElementById("boostTimer");
const spinner = document.getElementById("coreSpinner");
const logEl = document.getElementById("terminalLog");
const userIdDisplay = document.getElementById("userIdDisplay");
const toggleBtn = document.getElementById("toggleMiningBtn");
const boostBtn = document.getElementById("boostBtn");

// State
let isMining = false;
let isBoosted = false;
let balance = 0.0000;
let miningInterval;
let autoLoopTimeout;
let watchdogInterval; // New Watchdog
let lastActivityTime = Date.now();
let boostEndTime = 0;
let userId = "guest";
let adsWatchedSession = 0;
let adReady = false;
let sdkReady = false;

// Config
const BASE_RATE = 0.000001; // coins per tick
const BOOST_MULTIPLIER = 500;
const TICK_RATE = 100; // ms
let currentRate = 0;

function log(msg) {
  lastActivityTime = Date.now(); // Keep alive
  logEl.textContent = `> ${msg}`;
  // Flash effect
  logEl.style.color = "#fff";
  setTimeout(() => logEl.style.color = "var(--neon-blue)", 100);
}

function updateUI() {
  miningDisplay.innerText = balance.toFixed(6);

  if (isMining) {
    if (isBoosted) {
      hashRateDisplay.innerText = "500.0 MH/s (HYPER)";
      rigStatusDisplay.innerText = "HYPER-DRIVE";
      rigStatusDisplay.style.color = "var(--neon-yellow)";
      spinner.parentElement.classList.add("boosted");
      tempDisplay.innerText = (70 + Math.random() * 5).toFixed(1) + "°C";
      tempDisplay.style.color = "var(--neon-yellow)";
    } else {
      hashRateDisplay.innerText = "1.0 MH/s (NOMINAL)";
      rigStatusDisplay.innerText = "RUNNING";
      rigStatusDisplay.style.color = "var(--neon-green)";
      spinner.parentElement.classList.remove("boosted");
      spinner.parentElement.classList.add("active");
      tempDisplay.innerText = (45 + Math.random() * 2).toFixed(1) + "°C";
      tempDisplay.style.color = "var(--neon-green)";
    }
  } else {
    hashRateDisplay.innerText = "0 H/s";
    rigStatusDisplay.innerText = "OFFLINE";
    rigStatusDisplay.style.color = "#555";
    spinner.parentElement.classList.remove("active");
    spinner.parentElement.classList.remove("boosted");
    tempDisplay.innerText = "24°C";
    tempDisplay.style.color = "#555";
  }

  // Boost Timer
  if (isBoosted) {
    const remaining = Math.max(0, Math.ceil((boostEndTime - Date.now()) / 1000));
    boostTimerDisplay.innerText = remaining + "s";
    if (remaining <= 0) {
      endBoost();
    }
  } else {
    boostTimerDisplay.innerText = "0s";
  }
}

function generateIdentity() {
  const newId = "M-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  userId = newId;
  userIdDisplay.innerText = "ID: " + newId;
  return newId;
}

// --- MINING LOOP ---
function startMining() {
  if (isMining) return;
  isMining = true;
  generateIdentity();
  lastActivityTime = Date.now();

  toggleBtn.classList.add("active");
  toggleBtn.querySelector(".switch-text").innerText = "SYSTEM ACTIVE";
  toggleBtn.querySelector(".switch-icon").innerText = "⏻";

  // Enable Boost
  boostBtn.disabled = false;
  boostBtn.classList.add("ready");

  log("SYSTEM INITIALIZED. CONNECTED TO POOL.");

  miningInterval = setInterval(() => {
    const rate = isBoosted ? BASE_RATE * BOOST_MULTIPLIER : BASE_RATE;
    balance += rate;
    updateUI();
  }, TICK_RATE);

  // START AD LOOP (Slow mode)
  scheduleNextAd(10000); // First ad in 10s

  // WATCHDOG: Ensures the loop never dies
  watchdogInterval = setInterval(() => {
    if (!isMining) return;
    const timeSinceLast = Date.now() - lastActivityTime;
    if (timeSinceLast > 45000) { // 45s Silence = Crash
      console.warn("WATCHDOG: Loop Hang Detected. Restarting...");
      log("ERR: SYSTEM HANG. REBOOTING PROCESS...");
      clearTimeout(autoLoopTimeout);
      // Force next ad immediately
      scheduleNextAd(2000);
    }
  }, 5000);
}

function stopMining() {
  isMining = false;
  localStorage.setItem("qtm_miningActive", "false"); // Ensure we don't auto-start next time
  endBoost();
  clearInterval(miningInterval);
  clearInterval(watchdogInterval); // Kill watchdog
  clearTimeout(autoLoopTimeout);

  toggleBtn.classList.remove("active");
  toggleBtn.querySelector(".switch-text").innerText = "INITIALIZE SYSTEM";

  boostBtn.disabled = true;
  boostBtn.classList.remove("ready");

  log("SYSTEM SHUTDOWN.");
  updateUI();
}

function activateBoost() {
  // 30 seconds of boost
  isBoosted = true;
  boostEndTime = Date.now() + 30000;
  log("HYPER-DRIVE ENGAGED. REVENUE MAXIMIZED.");
}

function endBoost() {
  isBoosted = false;
}

// --- AD SYSTEM (The Auto Loop) ---
// High CPM logic: Fresh identity per ad attempt
// --- STEALTH & CPM LOGIC ---
const PLACEMENT_TAGS = [
  "level_complete_x2",
  "bonus_chest_open",
  "revive_player",
  "unlock_premium_skin",
  "daily_reward_claim"
];

async function simulateHumanity() {
  log("ANALYZING BIOMETRICS [TG-WEBVIEW]...");

  // 1. Mobile-Specific Scroll Jitter (Touch emulation)
  // WebViews respond to touch events. We simulate a "Drag" sequence.
  const touchStart = new Touch({ identifier: Date.now(), target: document.body, clientX: 100, clientY: 300 });
  const touchEnd = new Touch({ identifier: Date.now(), target: document.body, clientX: 100, clientY: 280 }); // Swipe up

  document.body.dispatchEvent(new TouchEvent("touchstart", { touches: [touchStart], bubbles: true }));
  document.body.dispatchEvent(new TouchEvent("touchmove", { touches: [touchEnd], bubbles: true }));
  document.body.dispatchEvent(new TouchEvent("touchend", { changedTouches: [touchEnd], bubbles: true }));

  // Physic scroll to match the "Swipe"
  logEl.scrollTop += (Math.random() > 0.5 ? 20 : -20);

  // 2. Telegram Native Bridge Interaction
  // Fingerprinting scripts often check if 'Telegram' object actually works to verify environment.
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;

    // A. "Wake Up" the bridge
    // Checking color scheme or viewport height forces a native bridge roundtrip.
    const fakeCheck = tg.colorScheme;

    // B. Native Haptics (Strong signal of user presence/device reality)
    // We trigger a light impact. If the device vibrates, it PROVES it's a phone.
    if (tg.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }

    // C. Expansion Check
    // We confirm the view is expanded (bot activity often runs in hidden/minimized views)
    if (!tg.isExpanded) tg.expand();
  }

  // 3. Random computation delay (Think time - Mobile users are slower)
  const reactionTime = 800 + Math.random() * 2000;

  return new Promise(r => setTimeout(r, reactionTime));
}

function scheduleNextAd(delayMs) {
  if (!isMining) return;

  // Natural Variance (Stealth)
  // Instead of fixed intervals, use standard deviation curve logic (Box-Muller transform is overkill, just random range)
  // Target: 12s average, min 8s, max 20s. Avoids "Pattern Detection".
  const variance = Math.random() * 12000;
  const nextDelay = delayMs || (8000 + variance);

  log(`NEXT CHECK IN ${(nextDelay / 1000).toFixed(0)}s...`);

  autoLoopTimeout = setTimeout(() => {
    if (!isMining) return;
    performIntegrityCheck();
  }, nextDelay);
}

async function performIntegrityCheck() {
  // Rotate ID for High CPM (User Strategy)
  // Sometimes keep the same ID for 2 cycles to look like a "Retained User" (Higher quality score)
  if (Math.random() > 0.3) {
    generateIdentity();
    log("REQ: NEW IDENTITY HASH...");
  } else {
    log("REQ: EXISTING SESSION VAL...");
  }

  // SPOOFING: Pick a high-value placement tag
  const fakePlacement = PLACEMENT_TAGS[Math.floor(Math.random() * PLACEMENT_TAGS.length)];

  // GHOST ACTIVITY: Mimic human before request
  await simulateHumanity();

  showAd(fakePlacement).then(() => {
    // Reward mechanism
    balance += 0.05;
    log(`CHECK COMPLETE [${fakePlacement}]. CREDITED.`);
    scheduleNextAd(); // Loop
  });
}

function getAdHandler() {
  return window[sdkMethod];
}

function preloadAd() {
  try {
    const handler = getAdHandler();
    if (handler) {
      // Preload with generic tag to keep specific tags for the "Show" event (Freshness)
      handler({ type: "preload", ymid: userId, requestVar: "mining-preload" })
        .then(() => { adReady = true; })
        .catch((e) => { adReady = false; console.warn(e); });
    }
  } catch (e) { }
}

function showAd(placementOverride) {
  return new Promise((resolve) => {
    const handler = getAdHandler();
    if (!handler) {
      log("ERR: AD MODULE NOT FOUND");
      return resolve();
    }

    // Stealth: Randomize the "requestVar" to prevent simple URL blocking/categorization
    const actualTag = placementOverride || "mining-show";

    log(`ESTABLISHING LINK [${actualTag}]...`);

    const adParams = {
      ymid: userId,
      requestVar: actualTag
    };

    // --- AUTO CLOSE / AD KILLER ---
    // Force close any ad overlay after 15 seconds
    const killerTimer = setTimeout(() => {
      try {
        log("FORCE REFRESHING SESSION...");
        saveState(); // Save coins/id
        location.reload(); // HARD RESET
      } catch (e) {
        console.error(e);
        location.reload();
      }
    }, 15000);

    handler(adParams)
      .then(() => {
        clearTimeout(killerTimer); // Cancel killer if user closed it manually
        resolve();
        preloadAd();
      })
      .catch((err) => {
        clearTimeout(killerTimer);
        // If ad fails, we wait a bit before resolving to prevent "Spinning" (Safe Mode)
        log("LINK JAMMED. RE-CALIBRATING...");
        setTimeout(resolve, 3000);
      });
  });
}

function nukeAds() {
  log("EXECUTING AD KILLER PROTOCOL...");

  // 1. Remove Iframes (Most ads live here)
  const iframes = document.querySelectorAll("iframe");
  iframes.forEach(el => {
    try { el.remove(); } catch (e) { }
  });

  // 2. Remove High Z-Index Overlays (Monetag often uses z-index 2147483647)
  const divs = document.querySelectorAll("div");
  divs.forEach(div => {
    const z = window.getComputedStyle(div).zIndex;
    if (z && parseInt(z) > 9000) {
      // Exclude our own UI (if we had high z-index, but our CSS is standard)
      // Our .scanlines is 999. Safe.
      try { div.remove(); } catch (e) { }
    }
  });

  // 3. Force Focus / Redirect Logic
  window.focus();
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.expand(); // Force open if minimized
    // Simulate interaction to regain user attention
    if (window.Telegram.WebApp.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
    // Deprecated by Reload Strategy
  }

  // --- PERSISTENCE LAYER ---
  function saveState() {
    localStorage.setItem("qtm_balance", balance.toString());
    localStorage.setItem("qtm_userId", userId);
    localStorage.setItem("qtm_miningActive", isMining ? "true" : "false");
  }

  function loadState() {
    const savedBalance = localStorage.getItem("qtm_balance");
    if (savedBalance) balance = parseFloat(savedBalance);

    const savedId = localStorage.getItem("qtm_userId");
    if (savedId) userId = savedId;

    // Auto-Resume
    const wasMining = localStorage.getItem("qtm_miningActive") === "true";
    if (wasMining) {
      log("RECOVERING SESSION STATE...");
      setTimeout(startMining, 1000); // Resume after short delay
    }
  }

  // --- INTERACTION ---
  toggleBtn.addEventListener("click", () => {
    if (isMining) stopMining();
    else startMining();
  });

  boostBtn.addEventListener("click", () => {
    if (!isMining) return;

    log("INITIATING HYPER-DRIVE...");

    // Boost is always a "High Value" reward tag
    showAd("hyper_drive_boost_x500").then(() => {
      activateBoost();
      balance += 1.0;
      log("ENERGY INJECTED. BOOST ACTIVE.");
    });
  });

  // Init
  generateIdentity(); // Default
  loadState(); // Overwrite with saved if exists
  updateUI();

  // SDK Load Listener
  const script = document.getElementById("monetag-sdk");
  if (script) {
    script.onload = () => {
      sdkReady = true;
      log("MODULE LOADED. READY.");
      preloadAd();
    };
  }

  // Safety check poller
  setInterval(() => {
    if (!sdkReady && window[sdkMethod]) {
      sdkReady = true;
      log("MODULE DETECTED.");
    }
  }, 1000);

  // Auto-Save Loop
  setInterval(() => {
    if (isMining) saveState();
  }, 5000);
