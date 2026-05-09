const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const screen = document.getElementById('screen');
const startBtn = document.getElementById('start-btn');
const bestScoreLabel = document.getElementById('best-score-label');
const screenTitle = screen.querySelector('h1');
const screenMsg = screen.querySelector('p');
 
const W = canvas.width, H = canvas.height;
 
// ── Game state ──────────────────────────────────────────
let state = 'idle'; // idle | playing | dead
let score = 0, bestScore = 0;
let animId;
 
// ── Bird ─────────────────────────────────────────────────
const BIRD = {
  x: 90, y: H / 2,
  vy: 0,
  r: 16,
  gravity: 0.45,
  flapForce: -8.5,
  maxFall: 11,
  angle: 0,
  frame: 0, frameTimer: 0,
};
 
function resetBird() {
  BIRD.y = H / 2;
  BIRD.vy = 0;
  BIRD.angle = 0;
}
 
// ── Pipes ─────────────────────────────────────────────────
const PIPE_W = 60;
const PIPE_GAP = 150;
const PIPE_SPEED = 2.8;
let pipes = [];
let pipeTimer = 0;
const PIPE_INTERVAL = 90; // frames
 
function addPipe() {
  const minY = 80, maxY = H - 80 - PIPE_GAP;
  const topH = Math.random() * (maxY - minY) + minY;
  pipes.push({ x: W + 10, topH, scored: false });
}
 
// ── Ground ───────────────────────────────────────────────
const GROUND_H = 80;
let groundOffset = 0;
 
// ── Particles ────────────────────────────────────────────
let particles = [];
function spawnParticles(x, y) {
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 1;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color: ['#ffdd57', '#ff6b00', '#ff3366', '#fff'][Math.floor(Math.random() * 4)],
      size: Math.random() * 6 + 2,
    });
  }
}
 
// ── Background clouds ────────────────────────────────────
let clouds = [];
for (let i = 0; i < 6; i++) {
  clouds.push({
    x: Math.random() * W,
    y: Math.random() * (H * 0.5),
    r: Math.random() * 30 + 20,
    speed: Math.random() * 0.4 + 0.1,
    alpha: Math.random() * 0.25 + 0.05,
  });
}
 
// ── Stars ─────────────────────────────────────────────────
let stars = [];
for (let i = 0; i < 60; i++) {
  stars.push({
    x: Math.random() * W,
    y: Math.random() * (H * 0.7),
    r: Math.random() * 1.5 + 0.3,
    twinkle: Math.random() * Math.PI * 2,
  });
}
 
// ── Drawing helpers ───────────────────────────────────────
function drawBackground() {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H - GROUND_H);
  sky.addColorStop(0, '#0d0a2e');
  sky.addColorStop(0.5, '#1a1a4e');
  sky.addColorStop(1, '#2a3a6e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H - GROUND_H);
 
  // Stars
  stars.forEach(s => {
    s.twinkle += 0.04;
    const alpha = 0.4 + Math.sin(s.twinkle) * 0.4;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  });
 
  // Clouds
  clouds.forEach(c => {
    if (state === 'playing') c.x -= c.speed;
    if (c.x + c.r * 2 < 0) c.x = W + c.r;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.arc(c.x + c.r * 0.7, c.y - c.r * 0.4, c.r * 0.7, 0, Math.PI * 2);
    ctx.arc(c.x + c.r * 1.3, c.y, c.r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,200,255,${c.alpha})`;
    ctx.fill();
  });
}
 
function drawGround() {
  if (state === 'playing') groundOffset = (groundOffset + PIPE_SPEED) % 32;
 
  // Ground base
  const gGrad = ctx.createLinearGradient(0, H - GROUND_H, 0, H);
  gGrad.addColorStop(0, '#3d8b37');
  gGrad.addColorStop(0.15, '#2d6e28');
  gGrad.addColorStop(0.15, '#c8a45a');
  gGrad.addColorStop(1, '#a07830');
  ctx.fillStyle = gGrad;
  ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
 
  // Pixel grass top line
  ctx.fillStyle = '#5cb85c';
  ctx.fillRect(0, H - GROUND_H, W, 6);
 
  // Scrolling dirt texture lines
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  for (let x = -groundOffset; x < W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, H - GROUND_H + 18);
    ctx.lineTo(x + 20, H - GROUND_H + 18);
    ctx.stroke();
  }
}
 
function drawPipe(pipe) {
  const x = pipe.x, topH = pipe.topH;
  const botY = topH + PIPE_GAP;
  const botH = H - GROUND_H - botY;
 
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 6, 0, PIPE_W, topH);
  ctx.fillRect(x + 6, botY, PIPE_W, botH);
 
  // Pipe body gradient
  const pGrad = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  pGrad.addColorStop(0, '#2ecc40');
  pGrad.addColorStop(0.35, '#5de84a');
  pGrad.addColorStop(0.65, '#27ae36');
  pGrad.addColorStop(1, '#1a7a26');
 
  ctx.fillStyle = pGrad;
  ctx.fillRect(x, 0, PIPE_W, topH);
  ctx.fillRect(x, botY, PIPE_W, botH);
 
  // Cap
  const capW = PIPE_W + 12, capH = 26;
  const capX = x - 6;
  const capGrad = ctx.createLinearGradient(capX, 0, capX + capW, 0);
  capGrad.addColorStop(0, '#27ae36');
  capGrad.addColorStop(0.4, '#5de84a');
  capGrad.addColorStop(1, '#1a7a26');
 
  ctx.fillStyle = capGrad;
  // Top cap
  ctx.beginPath();
  ctx.roundRect(capX, topH - capH, capW, capH, [0, 0, 4, 4]);
  ctx.fill();
  // Bottom cap
  ctx.beginPath();
  ctx.roundRect(capX, botY, capW, capH, [4, 4, 0, 0]);
  ctx.fill();
 
  // Pipe edge highlights
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 6, 0); ctx.lineTo(x + 6, topH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 6, botY); ctx.lineTo(x + 6, botY + botH);
  ctx.stroke();
}
 
function drawBird() {
  const { x, y, angle, r } = BIRD;
 
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
 
  // Body glow
  const glow = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 1.8);
  glow.addColorStop(0, 'rgba(255,220,50,0.35)');
  glow.addColorStop(1, 'rgba(255,120,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
  ctx.fill();
 
  // Body
  const bodyGrad = ctx.createRadialGradient(-2, -4, 2, 0, 0, r);
  bodyGrad.addColorStop(0, '#ffe566');
  bodyGrad.addColorStop(0.6, '#ffb800');
  bodyGrad.addColorStop(1, '#cc7a00');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
 
  // Wing (animated)
  const wingOffset = Math.sin(BIRD.frame * 0.4) * 5;
  ctx.fillStyle = '#ff9900';
  ctx.beginPath();
  ctx.ellipse(-4, 2 + wingOffset, 9, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();
 
  // White belly
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(3, 3, 7, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();
 
  // Eye white
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(7, -5, 5.5, 0, Math.PI * 2);
  ctx.fill();
 
  // Pupil
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(8.5, -5, 3, 0, Math.PI * 2);
  ctx.fill();
 
  // Eye shine
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(9.5, -6.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
 
  // Beak
  ctx.fillStyle = '#ff6600';
  ctx.beginPath();
  ctx.moveTo(12, -2);
  ctx.lineTo(20, 0);
  ctx.lineTo(12, 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#cc4400';
  ctx.lineWidth = 1;
  ctx.stroke();
 
  ctx.restore();
}
 
function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}
 
// ── Collision ─────────────────────────────────────────────
function checkCollision() {
  const { x, y, r } = BIRD;
  // Ground / ceiling
  if (y + r >= H - GROUND_H || y - r <= 0) return true;
  // Pipes
  for (const p of pipes) {
    const inX = x + r - 6 > p.x && x - r + 6 < p.x + PIPE_W;
    if (inX && (y - r + 4 < p.topH || y + r - 4 > p.topH + PIPE_GAP)) return true;
  }
  return false;
}
 
// ── Game loop ─────────────────────────────────────────────
function update() {
  if (state !== 'playing') return;
 
  BIRD.frame++;
  BIRD.vy = Math.min(BIRD.vy + BIRD.gravity, BIRD.maxFall);
  BIRD.y += BIRD.vy;
  BIRD.angle = Math.max(-0.4, Math.min(Math.PI / 2.2, BIRD.vy * 0.065));
 
  // Pipes
  pipeTimer++;
  if (pipeTimer >= PIPE_INTERVAL) { addPipe(); pipeTimer = 0; }
  pipes.forEach(p => p.x -= PIPE_SPEED);
  pipes = pipes.filter(p => p.x + PIPE_W > -20);
 
  // Score
  pipes.forEach(p => {
    if (!p.scored && p.x + PIPE_W < BIRD.x) {
      p.scored = true;
      score++;
      scoreDisplay.textContent = score;
    }
  });
 
  // Particles
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.15;
    p.life -= 0.03;
  });
  particles = particles.filter(p => p.life > 0);
 
  if (checkCollision()) die();
}
 
function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  pipes.forEach(drawPipe);
  drawGround();
  drawParticles();
  drawBird();
}
 
function loop() {
  update();
  draw();
  animId = requestAnimationFrame(loop);
}
 
// ── State transitions ─────────────────────────────────────
function startGame() {
  score = 0;
  pipes = [];
  pipeTimer = 0;
  particles = [];
  scoreDisplay.textContent = '0';
  resetBird();
  state = 'playing';
  screen.classList.add('hidden');
  scoreDisplay.classList.remove('hidden');
}
 
function die() {
  state = 'dead';
  spawnParticles(BIRD.x, BIRD.y);
  if (score > bestScore) bestScore = score;
 
  setTimeout(() => {
    screenTitle.textContent = score > 0 ? '💥 GAME OVER' : '💥 OOPS!';
    screenMsg.innerHTML = `SCORE: ${score}<br><br>TAP TO PLAY AGAIN`;
    bestScoreLabel.textContent = `BEST: ${bestScore}`;
    startBtn.textContent = 'PLAY AGAIN';
    screen.classList.remove('hidden');
    scoreDisplay.classList.add('hidden');
  }, 700);
}
 
function flap() {
  if (state === 'playing') {
    BIRD.vy = BIRD.flapForce;
  }
}
 
// ── Input ─────────────────────────────────────────────────
canvas.addEventListener('click', flap);
canvas.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, { passive: false });
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); }
});
 
startBtn.addEventListener('click', e => { e.stopPropagation(); startGame(); });
 
// ── Idle animation loop ───────────────────────────────────
let idleT = 0;
function idleLoop() {
  idleT += 0.04;
  BIRD.y = H / 2 + Math.sin(idleT) * 14;
  BIRD.angle = Math.sin(idleT) * 0.18;
  BIRD.frame++;
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawGround();
  drawBird();
  if (state !== 'playing') animId = requestAnimationFrame(idleLoop);
}
 
// Override loop to call idleLoop when not playing
cancelAnimationFrame(animId);
idleLoop();
 
startBtn.addEventListener('click', () => {
  cancelAnimationFrame(animId);
  startGame();
  loop();
}, { once: false });
 
// Re-hook so every play re-starts the game loop
startBtn.addEventListener('click', function handler() {
  cancelAnimationFrame(animId);
});
 
// Replace startGame to also reboot the loop
const _startGame = startGame;
window._startGame = function() {
  cancelAnimationFrame(animId);
  _startGame();
  loop();
};
startBtn.onclick = (e) => { e.stopPropagation(); window._startGame(); };