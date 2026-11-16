// Public site behaviour. No libraries.
//  1. Photo panel: tap to light it up on touch screens.
//  2. A small physics scene on the home page: a little train runs along a
//     track (wheels roll, smoke rises) while colourful balls fall under
//     gravity, bounce, and sometimes catch a ride on the train's roof.

(function () {
  "use strict";

  // ---------- 1. Photo panel ----------
  var panel = document.querySelector("[data-photo-panel]");
  if (panel) {
    panel.addEventListener("click", function () {
      panel.classList.toggle("is-lit");
    });
  }

  // ---------- 2. Physics scene ----------
  var canvas = document.querySelector("canvas[data-physics]");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var BALL_COLORS = ["#e4572e", "#f3a712", "#669bbc", "#a8c686", "#db5461", "#8d6a9f", "#2a9d8f"];

  var GRAVITY = 1400;     // px/s²
  var BOUNCE = 0.55;      // restitution
  var AIR = 0.997;        // per-step damping
  var GRIP = 0.9;         // slow-down when rolling on the ground
  var PUSH_RADIUS = 120;
  var PUSH_FORCE = 4200;
  var MAX_BALLS = 16;
  var TRAIN_SPEED = 72;   // px/s
  var TRACK = 10;         // track height from the bottom

  var W = 0, H = 0, dpr = 1;
  var balls = [];
  var puffs = [];
  var mouse = { x: -1e4, y: -1e4, inside: false };
  var colors = {};
  var onScreen = true;
  var lastTime = 0;
  var frame = 0;
  var dropTimer = 0.2;
  var puffTimer = 0;
  var colorIndex = 0;

  // Train: engine first (rightmost), then two carriages.
  var train = { x: 0, travelled: 0, cars: [] };

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function readColors() {
    colors = {
      text: cssVar("--text"),
      muted: cssVar("--muted"),
      accent: cssVar("--accent"),
      rule: cssVar("--rule"),
      surface: cssVar("--surface"),
      bg: cssVar("--bg")
    };
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildTrain() {
    // Offsets are measured back from the front of the train.
    train.cars = [
      { kind: "engine", back: 0, w: 74, h: 34 },
      { kind: "car", back: 84, w: 60, h: 28, color: "#e4572e" },
      { kind: "car", back: 154, w: 60, h: 28, color: "#f3a712" }
    ];
    train.length = 214;
    train.x = W * 0.55;
  }

  // World rectangle of a car body (top-left x/y, width, height).
  function carRect(car) {
    var right = train.x - car.back;
    var bottom = H - TRACK - 10; // wheels sit below the body
    return { x: right - car.w, y: bottom - car.h, w: car.w, h: car.h };
  }

  function addBall(x, y) {
    var r = 9 + Math.random() * 9;
    balls.push({
      x: Math.min(W - r, Math.max(r, x)),
      y: y,
      vx: (Math.random() - 0.5) * 60,
      vy: 0,
      r: r,
      m: r * r,
      color: BALL_COLORS[colorIndex++ % BALL_COLORS.length]
    });
    if (balls.length > MAX_BALLS) balls.shift();
  }

  // ---------- Simulation ----------

  function step(dt) {
    // Train moves at constant speed and wraps around.
    train.x += TRAIN_SPEED * dt;
    train.travelled += TRAIN_SPEED * dt;
    if (train.x - train.length > W + 20) train.x = -20;

    // Smoke rises (warm air is lighter), drifts back and spreads out.
    puffTimer -= dt;
    if (puffTimer <= 0) {
      puffTimer = 0.22;
      var engine = carRect(train.cars[0]);
      puffs.push({ x: engine.x + engine.w - 13, y: engine.y - 12, r: 4, age: 0, life: 2.2,
                   vx: -TRAIN_SPEED * 0.35 + (Math.random() - 0.5) * 10, vy: -38 });
    }
    for (var p = puffs.length - 1; p >= 0; p--) {
      var puff = puffs[p];
      puff.age += dt;
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.vy *= 0.99;
      puff.r += 9 * dt;
      if (puff.age > puff.life) puffs.splice(p, 1);
    }

    // A new ball every so often, up to a handful.
    dropTimer -= dt;
    if (dropTimer <= 0) {
      dropTimer = 1.4 + Math.random();
      if (balls.length < 10) addBall(40 + Math.random() * (W - 80), -20);
    }

    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      b.vy += GRAVITY * dt;

      if (mouse.inside) {
        var dx = b.x - mouse.x, dy = b.y - mouse.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < PUSH_RADIUS) {
          var push = (1 - d / PUSH_RADIUS) * PUSH_FORCE * dt;
          b.vx += (dx / d) * push;
          b.vy += (dy / d) * push - push * 0.4;
        }
      }

      b.vx *= AIR;
      b.vy *= AIR;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Ground (the track)
      var ground = H - TRACK;
      if (b.y + b.r > ground) {
        b.y = ground - b.r;
        b.vy = -b.vy * BOUNCE;
        if (Math.abs(b.vy) < 30) b.vy = 0;
        b.vx *= GRIP;
      }
      // Walls
      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * BOUNCE; }
      if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * BOUNCE; }

      // Train cars: solid boxes moving to the right.
      for (var c = 0; c < train.cars.length; c++) {
        collideWithBox(b, carRect(train.cars[c]), dt);
      }
    }

    // Ball-ball collisions
    for (var a = 0; a < balls.length; a++) {
      for (var k = a + 1; k < balls.length; k++) {
        var p1 = balls[a], p2 = balls[k];
        var nx = p2.x - p1.x, ny = p2.y - p1.y;
        var dist = Math.sqrt(nx * nx + ny * ny);
        var min = p1.r + p2.r;
        if (dist === 0 || dist >= min) continue;
        nx /= dist; ny /= dist;
        var overlap = min - dist, total = p1.m + p2.m;
        p1.x -= nx * overlap * (p2.m / total); p1.y -= ny * overlap * (p2.m / total);
        p2.x += nx * overlap * (p1.m / total); p2.y += ny * overlap * (p1.m / total);
        var rel = (p2.vx - p1.vx) * nx + (p2.vy - p1.vy) * ny;
        if (rel < 0) {
          var j = (-(1 + BOUNCE) * rel) / (1 / p1.m + 1 / p2.m);
          p1.vx -= (j / p1.m) * nx; p1.vy -= (j / p1.m) * ny;
          p2.vx += (j / p2.m) * nx; p2.vy += (j / p2.m) * ny;
        }
      }
    }
  }

  // Circle vs moving box. On the roof, friction drags the ball along with
  // the train; on the sides, the train shoves it.
  function collideWithBox(b, box, dt) {
    var cx = Math.max(box.x, Math.min(b.x, box.x + box.w));
    var cy = Math.max(box.y, Math.min(b.y, box.y + box.h));
    var dx = b.x - cx, dy = b.y - cy;
    var d2 = dx * dx + dy * dy;
    if (d2 >= b.r * b.r) return;

    var d = Math.sqrt(d2);
    var nx, ny;
    if (d > 0) { nx = dx / d; ny = dy / d; }
    else { nx = 0; ny = -1; d = 0; }
    b.x += nx * (b.r - d);
    b.y += ny * (b.r - d);

    // Velocity relative to the train
    var rvx = b.vx - TRAIN_SPEED, rvy = b.vy;
    var vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      rvx -= (1 + BOUNCE) * vn * nx;
      rvy -= (1 + BOUNCE) * vn * ny;
    }
    if (ny < -0.7) {
      // Riding on the roof: friction pulls it toward the train's speed.
      rvx *= Math.max(0, 1 - 6 * dt);
      if (Math.abs(rvy) < 40) rvy = 0;
    }
    b.vx = rvx + TRAIN_SPEED;
    b.vy = rvy;
  }

  // ---------- Drawing ----------

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawTrack();
    drawPuffs();
    drawTrain();
    for (var i = 0; i < balls.length; i++) drawBall(balls[i]);
  }

  function drawTrack() {
    var y = H - TRACK;
    ctx.strokeStyle = colors.rule;
    ctx.lineWidth = 3;
    for (var x = 0; x < W; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, y + 2);
      ctx.lineTo(x + 8, y + 2);
      ctx.stroke();
    }
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  function drawPuffs() {
    for (var i = 0; i < puffs.length; i++) {
      var p = puffs[i];
      ctx.globalAlpha = 0.35 * (1 - p.age / p.life);
      ctx.fillStyle = colors.muted;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWheel(x, y, r) {
    ctx.fillStyle = colors.text;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Rolling without slipping: angle = distance / radius.
    var angle = train.travelled / r;
    ctx.strokeStyle = colors.bg;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * r * 0.75, y + Math.sin(angle) * r * 0.75);
    ctx.lineTo(x - Math.cos(angle) * r * 0.75, y - Math.sin(angle) * r * 0.75);
    ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTrain() {
    var wheelY = H - TRACK - 6;

    // Couplings
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(train.x - train.length, wheelY - 8);
    ctx.lineTo(train.x - 10, wheelY - 8);
    ctx.stroke();

    for (var i = train.cars.length - 1; i >= 0; i--) {
      var car = train.cars[i];
      var r = carRect(car);

      if (car.kind === "engine") {
        // The train runs to the right: cab at the back, chimney at the front.
        // boiler
        ctx.fillStyle = colors.accent;
        roundRect(r.x + 26, r.y + 8, r.w - 26, r.h - 8, 6);
        ctx.fill();
        // cab with window
        ctx.fillStyle = colors.text;
        roundRect(r.x, r.y - 6, 30, r.h + 6, 4);
        ctx.fill();
        ctx.fillStyle = colors.bg;
        roundRect(r.x + 8, r.y + 1, 15, 11, 2);
        ctx.fill();
        // chimney
        ctx.fillStyle = colors.text;
        ctx.fillRect(r.x + r.w - 18, r.y - 6, 10, 14);
        ctx.fillRect(r.x + r.w - 21, r.y - 9, 16, 4);
        // lamp
        ctx.fillStyle = "#f3a712";
        ctx.beginPath();
        ctx.arc(r.x + r.w + 2, r.y + r.h - 6, 3, 0, Math.PI * 2);
        ctx.fill();
        drawWheel(r.x + 15, wheelY - 2, 9);
        drawWheel(r.x + 42, wheelY, 7);
        drawWheel(r.x + r.w - 12, wheelY, 7);
      } else {
        ctx.fillStyle = car.color;
        roundRect(r.x, r.y, r.w, r.h, 5);
        ctx.fill();
        ctx.fillStyle = colors.bg;
        ctx.globalAlpha = 0.85;
        roundRect(r.x + 8, r.y + 6, 16, 10, 2); ctx.fill();
        roundRect(r.x + r.w - 24, r.y + 6, 16, 10, 2); ctx.fill();
        ctx.globalAlpha = 1;
        drawWheel(r.x + 13, wheelY, 7);
        drawWheel(r.x + r.w - 13, wheelY, 7);
      }
    }
  }

  function drawBall(b) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- Loop & input ----------

  function loop(time) {
    if (!onScreen || document.hidden) {
      lastTime = 0;
      requestAnimationFrame(loop);
      return;
    }
    var dt = lastTime ? Math.min(1 / 30, (time - lastTime) / 1000) : 1 / 60;
    lastTime = time;
    if (frame++ % 30 === 0) readColors();
    step(dt / 2);
    step(dt / 2);
    draw();
    requestAnimationFrame(loop);
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener("pointermove", function (e) {
    var p = pointerPos(e);
    mouse.x = p.x; mouse.y = p.y; mouse.inside = true;
  });
  canvas.addEventListener("pointerleave", function () { mouse.inside = false; });
  canvas.addEventListener("pointerdown", function (e) {
    var p = pointerPos(e);
    addBall(p.x, Math.min(p.y, H * 0.5));
    if (reduceMotion) settleAndDraw();
  });

  function settleAndDraw() {
    var x = train.x;
    for (var i = 0; i < 600; i++) step(1 / 60);
    train.x = x;
    draw();
  }

  function init() {
    resize();
    readColors();
    buildTrain();
    for (var i = 0; i < 5; i++) addBall(40 + Math.random() * (W - 80), -20 - i * 70);
    if (reduceMotion) {
      settleAndDraw();
      new MutationObserver(function () { readColors(); draw(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return;
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
      }).observe(canvas);
    }
    requestAnimationFrame(loop);
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var oldW = W || 1;
      resize();
      balls.forEach(function (b) { b.x = Math.min(W - b.r, b.x * (W / oldW)); });
      if (reduceMotion) { readColors(); draw(); }
    }, 120);
  });

  init();
})();
