const canvas = document.getElementById("gameCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

const scoreValue = document.getElementById("scoreValue");
const speedValue = document.getElementById("speedValue");
const bestValue = document.getElementById("bestValue");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySubtitle = document.getElementById("overlaySubtitle");
const actionBtn = document.getElementById("actionBtn");

const GROUND_Y = canvas ? canvas.height - 54 : 326;
const BASE_SPEED = 350;
const MAX_SPEED = 820;
const BEST_SCORE_KEY = "skylineDashBestScore";
const SOUND_PREF_KEY = "skylineDashSoundEnabled";

function loadBestScore() {
  try {
    const saved = Number(localStorage.getItem(BEST_SCORE_KEY) || 0);
    return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch {
    // স্টোরেজ সীমাবদ্ধ থাকলে উপেক্ষা করা হবে
  }
}

function loadSoundPref() {
  try {
    const saved = localStorage.getItem(SOUND_PREF_KEY);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

function saveSoundPref(enabled) {
  try {
    localStorage.setItem(SOUND_PREF_KEY, String(enabled));
  } catch {
    // উপেক্ষা করা হবে
  }
}

let bestScore = loadBestScore();
if (bestValue) {
  bestValue.textContent = String(bestScore);
}

let soundEnabled = loadSoundPref();

// --- Web Audio API সাউন্ড সিস্টেম ---
const audioCtx =
  typeof window !== "undefined"
    ? new (window.AudioContext || window.webkitAudioContext)()
    : null;

let bgmInterval = null;
let bgmStep = 0;

// হালকা লুপ সুরের নোট (Hz)
const bgmNotes = [261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 440.0, 349.23];

function unlockAudio() {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

function playJumpSound() {
  if (!soundEnabled || !audioCtx) return;
  unlockAudio();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.exponentialRampToValueAtTime(620, now + 0.14);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.16, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.17);
}

function playGameOverSound() {
  if (!soundEnabled || !audioCtx) return;
  unlockAudio();

  const now = audioCtx.currentTime;
  const notes = [392.0, 349.23, 293.66, 220.0];

  notes.forEach((freq, idx) => {
    const start = now + idx * 0.11;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.85, start + 0.1);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(start);
    osc.stop(start + 0.12);
  });
}

function playBgStep() {
  if (!soundEnabled || !audioCtx || gameState !== "playing") return;
  if (audioCtx.state !== "running") return;

  const now = audioCtx.currentTime;
  const freq = bgmNotes[bgmStep % bgmNotes.length];
  bgmStep += 1;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  // খুব হালকা ও নরম ব্যাকগ্রাউন্ড থিম
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.032, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

function startBgTheme() {
  stopBgTheme();
  if (!soundEnabled) return;
  bgmStep = 0;
  bgmInterval = setInterval(playBgStep, 260);
}

function stopBgTheme() {
  if (bgmInterval !== null) {
    clearInterval(bgmInterval);
    bgmInterval = null;
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  saveSoundPref(soundEnabled);
  updateSoundButtonText();

  if (soundEnabled) {
    unlockAudio();
    if (gameState === "playing") {
      startBgTheme();
    }
  } else {
    stopBgTheme();
  }
}

// কন্ট্রোল বারে বাটন যোগ করে সাউন্ড অন/অফ করার সুবিধা
const controlsBar = document.querySelector(".controls-bar");
let soundBtn = null;

function updateSoundButtonText() {
  if (!soundBtn) return;
  soundBtn.textContent = soundEnabled ? "🔊 Sound: On" : "🔇 Sound: Off";
}

if (controlsBar) {
  soundBtn = document.createElement("button");
  soundBtn.type = "button";
  soundBtn.id = "soundToggleBtn";
  soundBtn.style.cssText =
    "background: rgba(56, 189, 248, 0.15); color: #e0f2fe; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 8px; padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer;";
  updateSoundButtonText();
  soundBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSound();
  });
  controlsBar.appendChild(soundBtn);
}

// --- গেম স্টেট ও ভেরিয়েবল ---
let gameState = "menu"; // "menu" | "playing" | "gameover"
let distanceScore = 0;
let bonusScore = 0;
let score = 0;
let speed = BASE_SPEED;
let spawnTimer = 1.0;
let lastTime = performance.now();

const player = {
  x: 96,
  y: GROUND_Y - 46,
  width: 38,
  height: 46,
  vy: 0,
  gravity: 1900,
  jumpVelocity: -690,
  grounded: true,
  runCycle: 0,
  scaleX: 1,
  scaleY: 1
};

const obstacles = [];
const particles = [];

const farBuildings = createBuildings(9, 55, 115, 70, 165, "#172554");
const nearBuildings = createBuildings(11, 45, 95, 45, 115, "#1e293b");

function createBuildings(count, minW, maxW, minH, maxH, color) {
  const list = [];
  let cursorX = 0;
  for (let i = 0; i < count; i++) {
    const w = minW + Math.random() * (maxW - minW);
    const h = minH + Math.random() * (maxH - minH);
    list.push({
      x: cursorX,
      w,
      h,
      minH,
      maxH,
      color,
      hasRoofLight: Math.random() > 0.55
    });
    cursorX += w + 12 + Math.random() * 22;
  }
  return list;
}

function drawRoundedRect(x, y, w, h, r) {
  if (!ctx) return;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }

  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function syncScore() {
  score = Math.floor(distanceScore) + bonusScore;
  if (scoreValue) {
    scoreValue.textContent = String(score);
  }
  if (score > bestScore) {
    bestScore = score;
    if (bestValue) {
      bestValue.textContent = String(bestScore);
    }
    saveBestScore(bestScore);
  }
}

function resetPlayer() {
  player.y = GROUND_Y - player.height;
  player.vy = 0;
  player.grounded = true;
  player.runCycle = 0;
  player.scaleX = 1;
  player.scaleY = 1;
}

function startGame() {
  unlockAudio();
  obstacles.length = 0;
  particles.length = 0;
  resetPlayer();
  distanceScore = 0;
  bonusScore = 0;
  score = 0;
  speed = BASE_SPEED;
  spawnTimer = 0.85;
  gameState = "playing";

  if (scoreValue) scoreValue.textContent = "0";
  if (speedValue) speedValue.textContent = "1.0x";
  if (overlay) overlay.classList.add("hidden");

  startBgTheme();
}

function triggerGameOver() {
  gameState = "gameover";
  stopBgTheme();
  playGameOverSound();
  spawnBurst(
    player.x + player.width / 2,
    player.y + player.height / 2,
    "#38bdf8",
    16
  );

  if (overlayTitle) overlayTitle.textContent = "Game Over!";
  if (overlaySubtitle) {
    overlaySubtitle.textContent = `Your Score: ${score}। Click the restart button to play again.`;
  }
  if (actionBtn) actionBtn.textContent = "Restart";
  if (overlay) overlay.classList.remove("hidden");
}

function jump() {
  if (gameState === "menu" || gameState === "gameover") {
    startGame();
    return;
  }

  if (player.grounded) {
    player.vy = player.jumpVelocity;
    player.grounded = false;
    player.scaleX = 0.82;
    player.scaleY = 1.22;
    playJumpSound();
    spawnBurst(player.x + player.width / 2, GROUND_Y, "#7dd3fc", 7);
  }
}

function spawnObstacle() {
  const isTall = Math.random() > 0.62;
  const width = isTall ? 26 : 34;
  const height = isTall ? 56 : 34;

  obstacles.push({
    x: (canvas ? canvas.width : 840) + 30,
    y: GROUND_Y - height,
    width,
    height,
    passed: false,
    accent: isTall ? "#fb7185" : "#f43f5e"
  });
}

function spawnBurst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI * Math.random();
    const mag = 70 + Math.random() * 180;
    const life = 0.35 + Math.random() * 0.25;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * mag,
      vy: Math.sin(angle) * mag - 40,
      size: 3 + Math.random() * 4,
      life,
      maxLife: life,
      color
    });
  }
}

function hasCollision(a, b) {
  const padX = 5;
  const padY = 4;
  return (
    a.x + padX < b.x + b.width - padX &&
    a.x + a.width - padX > b.x + padX &&
    a.y + padY < b.y + b.height &&
    a.y + a.height - padY > b.y + padY
  );
}

function scrollBuildings(list, layerSpeed, dt) {
  const minSpawnX = canvas ? canvas.width : 840;
  let rightmost = 0;

  for (const b of list) {
    b.x -= layerSpeed * dt;
    if (b.x + b.w > rightmost) {
      rightmost = b.x + b.w;
    }
  }

  for (const b of list) {
    if (b.x + b.w < -20) {
      const gap = 14 + Math.random() * 24;
      b.x = Math.max(rightmost, minSpawnX) + gap;
      b.h = b.minH + Math.random() * (b.maxH - b.minH);
      b.hasRoofLight = Math.random() > 0.55;
      rightmost = b.x + b.w;
    }
  }
}

function update(dt) {
  const activeSpeed = gameState === "playing" ? speed : BASE_SPEED * 0.45;
  scrollBuildings(farBuildings, activeSpeed * 0.22, dt);
  scrollBuildings(nearBuildings, activeSpeed * 0.48, dt);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vy += 650 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  player.scaleX += (1 - player.scaleX) * Math.min(1, dt * 14);
  player.scaleY += (1 - player.scaleY) * Math.min(1, dt * 14);

  if (gameState !== "playing") return;

  speed = Math.min(MAX_SPEED, speed + dt * 11);
  if (speedValue) {
    speedValue.textContent = `${(speed / BASE_SPEED).toFixed(1)}x`;
  }

  distanceScore += dt * (speed / 45);
  player.runCycle += dt * (speed / 28);

  player.vy += player.gravity * dt;
  player.y += player.vy * dt;

  if (player.y >= GROUND_Y - player.height) {
    if (!player.grounded) {
      player.scaleX = 1.2;
      player.scaleY = 0.82;
      spawnBurst(player.x + player.width / 2, GROUND_Y, "#94a3b8", 5);
    }
    player.y = GROUND_Y - player.height;
    player.vy = 0;
    player.grounded = true;
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    const speedFactor = speed / BASE_SPEED;
    const minGap = Math.max(0.62, 0.98 / speedFactor);
    const maxGap = Math.max(1.05, 1.72 / speedFactor);
    spawnTimer = minGap + Math.random() * (maxGap - minGap);
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= speed * dt;

    if (!obs.passed && obs.x + obs.width < player.x) {
      obs.passed = true;
      bonusScore += 5;
    }

    if (hasCollision(player, obs)) {
      syncScore();
      triggerGameOver();
      return;
    }

    if (obs.x + obs.width < -40) {
      obstacles.splice(i, 1);
    }
  }

  syncScore();
}

function drawBuildings(list) {
  if (!ctx) return;
  for (const b of list) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);

    if (b.hasRoofLight) {
      ctx.fillStyle = "rgba(56, 189, 248, 0.45)";
      ctx.fillRect(b.x + b.w * 0.35, GROUND_Y - b.h - 4, 8, 3);
    }
  }
}

function drawPlayer() {
  if (!ctx) return;
  const cx = player.x + player.width / 2;
  const bottomY = player.y + player.height;

  ctx.save();
  ctx.translate(cx, bottomY);
  ctx.scale(player.scaleX, player.scaleY);

  const heightAboveGround = Math.max(0, GROUND_Y - (player.y + player.height));
  const shadowScale = Math.max(0.35, 1 - heightAboveGround / 200);
  ctx.fillStyle = "rgba(2, 6, 23, 0.45)";
  ctx.beginPath();
  ctx.ellipse(
    0,
    GROUND_Y - bottomY + 2,
    18 * shadowScale,
    4 * shadowScale,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  const swing = player.grounded ? Math.sin(player.runCycle) * 9 : 6;
  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(-6, -14);
  ctx.lineTo(-6 - swing, -2);
  ctx.moveTo(6, -14);
  ctx.lineTo(6 + swing, -2);
  ctx.stroke();

  ctx.fillStyle = "#38bdf8";
  drawRoundedRect(
    -player.width / 2,
    -player.height,
    player.width,
    player.height - 12,
    8
  );
  ctx.fill();

  ctx.fillStyle = "#082f49";
  ctx.fillRect(3, -player.height + 11, 10, 7);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(10, -player.height + 12, 2.5, 4);

  ctx.restore();
}

function drawObstacles() {
  if (!ctx) return;
  for (const obs of obstacles) {
    ctx.fillStyle = obs.accent;
    drawRoundedRect(obs.x, obs.y, obs.width, obs.height, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(obs.x + 4, obs.y + 4, obs.width - 8, 5);
  }
}

function drawParticles() {
  if (!ctx) return;
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#090d16");
  sky.addColorStop(1, "#1e293b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, GROUND_Y);

  drawBuildings(farBuildings);
  drawBuildings(nearBuildings);

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(canvas.width, GROUND_Y);
  ctx.stroke();

  drawObstacles();
  drawPlayer();
  drawParticles();
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  update(dt);
  draw();
  requestAnimationFrame(frame);
}

if (actionBtn) {
  actionBtn.addEventListener("click", () => {
    startGame();
  });
}

if (canvas) {
  canvas.addEventListener("pointerdown", () => {
    if (gameState === "playing") {
      jump();
    }
  });
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    jump();
  } else if (e.code === "KeyR" && gameState !== "playing") {
    startGame();
  }
});

requestAnimationFrame(frame);
