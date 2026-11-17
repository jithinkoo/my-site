// Home page animation: "Little things in motion". No libraries.
//
// A soft, light-coloured physics scene:
//  - a little train runs along the track (wheels roll, smoke rises)
//  - things fall under gravity, bounce and roll: cricket balls, footballs,
//    shuttlecocks (high air drag: they fall slowly and turn cork-down) and
//    a comic Elixir-style drop that squashes when it lands
//  - a comic flame-bird phoenix glides across the sky, flapping its wings
//  - a hot-air balloon floats up on buoyancy and drifts with the wind
//  - a pendulum swings (and gets a nudge when the mouse passes)
// Move the mouse to push things; click or tap to drop something new.

(function () {
  "use strict";

  var canvas = document.querySelector("canvas[data-physics]");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Light, soft colours that sit well on both the light and dark themes.
  var C = {
    peach: "#f6bd9c",
    coral: "#f0907a",
    mint: "#a8d5ba",
    lavender: "#c7b3e6",
    lavenderEdge: "#9c86c9",
    butter: "#f3d58b",
    sky: "#a9cbe8",
    rose: "#eeb0bf",
    cream: "#fdf8ef",
    ink: "#3b3040"
  };

  var GRAVITY = 1400;      // px/s²
  var BOUNCE = 0.55;       // restitution
  var AIR = 0.997;         // per-step damping for normal things
  var SHUTTLE_DRAG = 4.5;  // per-second drag for shuttlecocks
  var GRIP = 0.9;          // slow-down when rolling on the ground
  var PUSH_RADIUS = 120;
  var PUSH_FORCE = 4200;
  var MAX_THINGS = 14;
  var TRAIN_SPEED = 72;    // px/s
  var TRACK = 10;          // track height from the bottom
  var KINDS = ["drop", "cricket", "football", "shuttle"];

  var W = 0, H = 0, dpr = 1, time = 0;
  var things = [];
  var puffs = [];
  var mouse = { x: -1e4, y: -1e4, vx: 0, inside: false, lastX: 0, lastT: 0 };
  var colors = {};
  var onScreen = true;
  var lastTime = 0;
  var frame = 0;
  var dropTimer = 0.4;
  var puffTimer = 0;
  var kindIndex = 0;

  var train = { x: 0, travelled: 0, cars: [], length: 214 };
  var balloon = { x: 0, y: 0, vx: 0, vy: -24, phase: Math.random() * 6 };
  var phoenix = { active: false, x: 0, y: 34, dir: 1, t: 0, wait: 2.5 };
  var pendulum = { theta: 0.55, omega: 0, length: 64, r: 9 };

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function readColors() {
    colors = {
      text: cssVar("--text"),
      muted: cssVar("--muted"),
      rule: cssVar("--rule"),
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

  // ---------- Objects ----------

  function buildTrain() {
    train.cars = [
      { kind: "engine", back: 0, w: 74, h: 34 },
      { kind: "car", back: 84, w: 60, h: 28, color: C.peach },
      { kind: "car", back: 154, w: 60, h: 28, color: C.mint }
    ];
    train.x = W * 0.55;
  }

  function carRect(car) {
    var right = train.x - car.back;
    var bottom = H - TRACK - 10;
    return { x: right - car.w, y: bottom - car.h, w: car.w, h: car.h };
  }

  function addThing(kind, x, y) {
    var r = { drop: 15, cricket: 10, football: 14, shuttle: 10 }[kind];
    things.push({
      kind: kind,
      x: Math.min(W - r, Math.max(r, x)),
      y: y,
      vx: (Math.random() - 0.5) * 60,
      vy: 0,
      r: r,
      m: kind === "shuttle" ? r * r * 0.3 : r * r,
      // balls start at any rotation; the drop and shuttle start upright
      angle: kind === "cricket" || kind === "football" ? Math.random() * 6 : 0,
      spin: 0,
      squash: 0,
      blink: 2 + Math.random() * 3
    });
    if (things.length > MAX_THINGS) things.shift();
  }

  function nextKind() {
    return KINDS[kindIndex++ % KINDS.length];
  }

  function resetBalloon(fromBelow) {
    balloon.x = 60 + Math.random() * Math.max(1, W - 200);
    balloon.y = fromBelow ? H + 50 : H * 0.55;
    balloon.vy = -24;
  }

  // ---------- Simulation ----------

  function step(dt) {
    time += dt;

    // Train: constant speed, wraps around.
    train.x += TRAIN_SPEED * dt;
    train.travelled += TRAIN_SPEED * dt;
    if (train.x - train.length > W + 20) train.x = -20;

    // Smoke: warm air rises, drifts back and spreads.
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

    // Balloon: buoyancy pulls it up to a gentle steady speed; wind sways it.
    balloon.vy += (-24 - balloon.vy) * 0.8 * dt;
    balloon.vx = 16 * Math.sin(time * 0.35 + balloon.phase);
    if (mouse.inside) pushAway(balloon, 0.25, dt);
    balloon.x += balloon.vx * dt;
    balloon.y += balloon.vy * dt;
    if (balloon.y < -70) resetBalloon(true);

    // Phoenix: glides across the sky, then rests before the next flight.
    if (phoenix.active) {
      phoenix.t += dt;
      phoenix.x += phoenix.dir * 95 * dt;
      phoenix.y = 34 + Math.sin(phoenix.t * 2.2) * 9;
      if (phoenix.x < -60 || phoenix.x > W + 60) {
        phoenix.active = false;
        phoenix.wait = 7 + Math.random() * 5;
        phoenix.dir = -phoenix.dir;
      }
    } else {
      phoenix.wait -= dt;
      if (phoenix.wait <= 0) {
        phoenix.active = true;
        phoenix.t = 0;
        phoenix.x = phoenix.dir > 0 ? -50 : W + 50;
      }
    }

    // Pendulum: theta'' = -(g / L) sin(theta), with a little air damping.
    pendulum.omega += -(GRAVITY / pendulum.length / 6) * Math.sin(pendulum.theta) * dt;
    pendulum.omega *= 0.9995;
    var bob = pendulumBob();
    if (mouse.inside) {
      var dxp = bob.x - mouse.x, dyp = bob.y - mouse.y;
      if (dxp * dxp + dyp * dyp < 45 * 45) pendulum.omega += mouse.vx * 0.0006;
    }
    pendulum.theta += pendulum.omega * dt;

    // New things now and then.
    dropTimer -= dt;
    if (dropTimer <= 0) {
      dropTimer = 1.6 + Math.random();
      if (things.length < 9) addThing(nextKind(), 40 + Math.random() * (W - 80), -20);
    }

    for (var i = 0; i < things.length; i++) {
      var b = things[i];
      b.vy += GRAVITY * dt;
      if (mouse.inside) pushAway(b, 1, dt);

      if (b.kind === "shuttle") {
        // Strong air drag: slow fall, and the heavy cork turns to lead.
        var k = Math.exp(-SHUTTLE_DRAG * dt);
        b.vx *= k;
        b.vy *= k;
        var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (speed > 40) {
          var target = Math.atan2(b.vy, b.vx) - Math.PI / 2;
          var diff = Math.atan2(Math.sin(target - b.angle), Math.cos(target - b.angle));
          b.angle += diff * Math.min(1, 6 * dt);
        }
      } else {
        b.vx *= AIR;
        b.vy *= AIR;
      }

      if (b.kind === "drop") {
        // Bottom-heavy: rocks back upright.
        b.angle = Math.atan2(Math.sin(b.angle), Math.cos(b.angle));
        b.spin += -b.angle * 9 * dt;
        b.spin *= 0.94;
        b.squash *= Math.exp(-7 * dt);
        b.blink -= dt;
        if (b.blink < -0.15) b.blink = 2 + Math.random() * 3;
      } else if (b.kind !== "shuttle") {
        b.spin *= 0.99;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.kind !== "shuttle") b.angle += b.spin * dt;

      // Ground
      var ground = H - TRACK;
      if (b.y + b.r > ground) {
        b.y = ground - b.r;
        if (b.kind === "drop" && b.vy > 200) b.squash = Math.min(0.35, b.vy / 2500);
        b.vy = -b.vy * (b.kind === "shuttle" ? 0.15 : BOUNCE);
        if (Math.abs(b.vy) < 30) b.vy = 0;
        b.vx *= GRIP;
        if (b.kind === "cricket" || b.kind === "football") b.spin = b.vx / b.r;
      }
      // Walls
      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * BOUNCE; }
      if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * BOUNCE; }

      // Train cars are solid moving boxes; the pendulum bob is a solid ball.
      for (var c = 0; c < train.cars.length; c++) collideWithBox(b, carRect(train.cars[c]), dt);
      collideWithBob(b, bob);
    }

    // Thing-thing collisions
    for (var a = 0; a < things.length; a++) {
      for (var q = a + 1; q < things.length; q++) {
        var p1 = things[a], p2 = things[q];
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

  function pushAway(body, strength, dt) {
    var dx = body.x - mouse.x, dy = body.y - mouse.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d < PUSH_RADIUS) {
      var push = (1 - d / PUSH_RADIUS) * PUSH_FORCE * strength * dt;
      body.vx += (dx / d) * push;
      body.vy += (dy / d) * push - push * 0.4;
    }
  }

  function pendulumBob() {
    var ax = W - 48, ay = 0;
    return {
      ax: ax, ay: ay,
      x: ax + Math.sin(pendulum.theta) * pendulum.length,
      y: ay + Math.cos(pendulum.theta) * pendulum.length
    };
  }

  function collideWithBob(b, bob) {
    var dx = b.x - bob.x, dy = b.y - bob.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var min = b.r + pendulum.r;
    if (d === 0 || d >= min) return;
    var nx = dx / d, ny = dy / d;
    b.x += nx * (min - d);
    b.y += ny * (min - d);
    var vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + BOUNCE) * vn * nx;
      b.vy -= (1 + BOUNCE) * vn * ny;
      pendulum.omega -= vn * nx * 0.002; // the bob feels the knock too
    }
  }

  // Circle vs moving box: riding on the roof, shoved by the sides.
  function collideWithBox(b, box, dt) {
    var cx = Math.max(box.x, Math.min(b.x, box.x + box.w));
    var cy = Math.max(box.y, Math.min(b.y, box.y + box.h));
    var dx = b.x - cx, dy = b.y - cy;
    var d2 = dx * dx + dy * dy;
    if (d2 >= b.r * b.r) return;
    var d = Math.sqrt(d2), nx, ny;
    if (d > 0) { nx = dx / d; ny = dy / d; } else { nx = 0; ny = -1; d = 0; }
    b.x += nx * (b.r - d);
    b.y += ny * (b.r - d);
    var rvx = b.vx - TRAIN_SPEED, rvy = b.vy;
    var vn = rvx * nx + rvy * ny;
    if (vn < 0) { rvx -= (1 + BOUNCE) * vn * nx; rvy -= (1 + BOUNCE) * vn * ny; }
    if (ny < -0.7) {
      rvx *= Math.max(0, 1 - 6 * dt);
      if (Math.abs(rvy) < 40) rvy = 0;
    }
    b.vx = rvx + TRAIN_SPEED;
    b.vy = rvy;
  }

  // ---------- Drawing ----------

  function outline(width) {
    ctx.lineWidth = width || 1.5;
    ctx.strokeStyle = colors.text;
    ctx.globalAlpha = 0.35;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBalloon();
    drawTrack();
    drawPendulum();
    drawPuffs();
    drawTrain();
    for (var i = 0; i < things.length; i++) drawThing(things[i]);
    if (phoenix.active || reduceMotion) drawPhoenix();
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
      ctx.globalAlpha = 0.3 * (1 - p.age / p.life);
      ctx.fillStyle = colors.muted;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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

  function drawWheel(x, y, r) {
    ctx.fillStyle = colors.text;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    var angle = train.travelled / r; // rolling without slipping
    ctx.strokeStyle = colors.bg;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * r * 0.75, y + Math.sin(angle) * r * 0.75);
    ctx.lineTo(x - Math.cos(angle) * r * 0.75, y - Math.sin(angle) * r * 0.75);
    ctx.stroke();
  }

  function drawTrain() {
    var wheelY = H - TRACK - 6;
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
        // Runs right: cab at the back, chimney at the front.
        ctx.fillStyle = C.coral;
        roundRect(r.x + 26, r.y + 8, r.w - 26, r.h - 8, 6);
        ctx.fill();
        outline(1);
        ctx.fillStyle = C.sky;
        roundRect(r.x, r.y - 6, 30, r.h + 6, 4);
        ctx.fill();
        outline(1);
        ctx.fillStyle = C.cream;
        roundRect(r.x + 8, r.y + 1, 15, 11, 2);
        ctx.fill();
        ctx.fillStyle = C.lavender;
        ctx.fillRect(r.x + r.w - 18, r.y - 6, 10, 14);
        ctx.fillRect(r.x + r.w - 21, r.y - 9, 16, 4);
        ctx.fillStyle = C.butter;
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
        outline(1);
        ctx.fillStyle = C.cream;
        roundRect(r.x + 8, r.y + 6, 16, 10, 2); ctx.fill();
        roundRect(r.x + r.w - 24, r.y + 6, 16, 10, 2); ctx.fill();
        drawWheel(r.x + 13, wheelY, 7);
        drawWheel(r.x + r.w - 13, wheelY, 7);
      }
    }
  }

  function drawPendulum() {
    var bob = pendulumBob();
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bob.ax, bob.ay);
    ctx.lineTo(bob.x, bob.y);
    ctx.stroke();
    ctx.fillStyle = C.mint;
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, pendulum.r, 0, Math.PI * 2);
    ctx.fill();
    outline(1);
  }

  function drawBalloon() {
    var x = balloon.x, y = balloon.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(balloon.vx * 0.006);
    // ropes and basket
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9, 18); ctx.lineTo(-5, 30);
    ctx.moveTo(9, 18); ctx.lineTo(5, 30);
    ctx.stroke();
    ctx.fillStyle = C.peach;
    roundRect(-6, 30, 12, 8, 2);
    ctx.fill();
    outline(1);
    // envelope with stripes
    var stripes = [C.butter, C.sky, C.rose, C.sky, C.butter];
    for (var s = 0; s < stripes.length; s++) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, 21, 25, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = stripes[s];
      ctx.fillRect(-21 + s * 8.4, -25, 8.6, 50);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, 21, 25, 0, 0, Math.PI * 2);
    outline(1.2);
    ctx.restore();
  }

  function drawThing(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    if (b.kind === "drop") drawDrop(b);
    else if (b.kind === "cricket") drawCricketBall(b.r);
    else if (b.kind === "football") drawFootball(b.r);
    else drawShuttle(b.r);
    ctx.restore();
  }

  // Comic Elixir-style drop: stretches as it falls, squashes when it lands.
  function drawDrop(b) {
    var r = b.r;
    var stretch = Math.min(0.25, Math.abs(b.vy) / 2600);
    var sy = (1 + stretch) * (1 - b.squash);
    var sx = 1 / (1 + stretch) * (1 + b.squash);
    ctx.translate(0, r * (1 - sy)); // keep the bottom on the ground
    ctx.scale(sx, sy);

    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3);
    ctx.bezierCurveTo(r * 0.85, -r * 0.35, r * 1.02, r * 0.35, 0, r);
    ctx.bezierCurveTo(-r * 1.02, r * 0.35, -r * 0.85, -r * 0.35, 0, -r * 1.3);
    ctx.fillStyle = C.lavender;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.lavenderEdge;
    ctx.stroke();

    // shine
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.12, r * 0.24, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // face
    ctx.fillStyle = C.ink;
    ctx.strokeStyle = C.ink;
    if (b.blink < 0) {
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, r * 0.1); ctx.lineTo(-r * 0.18, r * 0.1);
      ctx.moveTo(r * 0.18, r * 0.1); ctx.lineTo(r * 0.4, r * 0.1);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-r * 0.29, r * 0.08, r * 0.11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.29, r * 0.08, r * 0.11, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, r * 0.3, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = "rgba(238,140,160,0.55)";
    ctx.beginPath(); ctx.arc(-r * 0.55, r * 0.35, r * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.55, r * 0.35, r * 0.11, 0, Math.PI * 2); ctx.fill();
  }

  function drawCricketBall(r) {
    ctx.fillStyle = C.coral;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    outline(1);
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(-r * 1.45, 0, r * 1.15, -0.5, 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 1.45, 0, r * 1.15, Math.PI - 0.5, Math.PI + 0.5);
    ctx.stroke();
  }

  function drawFootball(r) {
    ctx.fillStyle = C.cream;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    outline(1.2);
    // centre pentagon and spokes
    ctx.fillStyle = C.ink;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * (2 * Math.PI / 5);
      var px = Math.cos(a) * r * 0.36, py = Math.sin(a) * r * 0.36;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1;
    for (var k = 0; k < 5; k++) {
      var b = -Math.PI / 2 + k * (2 * Math.PI / 5);
      ctx.beginPath();
      ctx.moveTo(Math.cos(b) * r * 0.36, Math.sin(b) * r * 0.36);
      ctx.lineTo(Math.cos(b) * r * 0.95, Math.sin(b) * r * 0.95);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Shuttlecock: cork at +y (it leads when falling), feather skirt behind.
  function drawShuttle(r) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, r * 0.25);
    ctx.lineTo(-r * 0.95, -r * 1.15);
    ctx.lineTo(r * 0.95, -r * 1.15);
    ctx.lineTo(r * 0.35, r * 0.25);
    ctx.closePath();
    ctx.fillStyle = C.cream;
    ctx.fill();
    outline(1);
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 0.8;
    for (var i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.12, r * 0.25);
      ctx.lineTo(i * r * 0.4, -r * 1.15);
      ctx.stroke();
    }
    ctx.fillStyle = C.butter;
    ctx.beginPath();
    ctx.arc(0, r * 0.35, r * 0.42, 0, Math.PI);
    ctx.lineTo(-r * 0.42, r * 0.3);
    ctx.lineTo(r * 0.42, r * 0.3);
    ctx.closePath();
    ctx.fill();
    outline(1);
  }

  // Comic flame-bird phoenix, flapping as it glides.
  function drawPhoenix() {
    var x = reduceMotion ? W * 0.3 : phoenix.x;
    var y = reduceMotion ? 34 : phoenix.y;
    var flap = Math.sin(phoenix.t * 10) * 0.7;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(phoenix.dir, 1); // face the way it flies

    // flame tail, flickering
    var tail = [C.butter, C.peach, C.coral];
    for (var i = 0; i < 3; i++) {
      var len = 22 + i * 5 + Math.sin(phoenix.t * 12 + i) * 3;
      ctx.fillStyle = tail[i];
      ctx.beginPath();
      ctx.moveTo(-8, -2 + i * 2);
      ctx.quadraticCurveTo(-8 - len * 0.6, -10 + i * 6, -8 - len, -4 + i * 5);
      ctx.quadraticCurveTo(-8 - len * 0.5, 2 + i * 3, -8, 3 + i);
      ctx.fill();
    }

    // back wing
    ctx.save();
    ctx.rotate(-flap * 0.6);
    ctx.fillStyle = C.peach;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(-6, -22, -20, -24);
    ctx.quadraticCurveTo(-10, -10, -4, 2);
    ctx.fill();
    ctx.restore();

    // body and head
    ctx.fillStyle = C.coral;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 8, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(12, -5, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // crest
    ctx.fillStyle = C.butter;
    ctx.beginPath();
    ctx.moveTo(10, -10);
    ctx.quadraticCurveTo(9, -19, 4, -20);
    ctx.quadraticCurveTo(10, -16, 14, -10);
    ctx.fill();
    // beak
    ctx.fillStyle = C.butter;
    ctx.beginPath();
    ctx.moveTo(18, -6); ctx.lineTo(24, -4); ctx.lineTo(18, -2);
    ctx.fill();
    // eye
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.arc(14, -6, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(14.5, -6.6, 0.6, 0, Math.PI * 2); ctx.fill();

    // front wing
    ctx.save();
    ctx.rotate(flap);
    ctx.fillStyle = C.butter;
    ctx.beginPath();
    ctx.moveTo(2, -2);
    ctx.quadraticCurveTo(-2, -26, -16, -30);
    ctx.quadraticCurveTo(-6, -14, -2, 3);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // ---------- Loop & input ----------

  function loop(t) {
    if (!onScreen || document.hidden) {
      lastTime = 0;
      requestAnimationFrame(loop);
      return;
    }
    var dt = lastTime ? Math.min(1 / 30, (t - lastTime) / 1000) : 1 / 60;
    lastTime = t;
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
    var now = performance.now();
    var dtm = Math.max(1, now - mouse.lastT) / 1000;
    mouse.vx = (p.x - mouse.lastX) / dtm;
    mouse.lastX = p.x;
    mouse.lastT = now;
    mouse.x = p.x; mouse.y = p.y; mouse.inside = true;
  });
  canvas.addEventListener("pointerleave", function () { mouse.inside = false; });
  canvas.addEventListener("pointerdown", function (e) {
    var p = pointerPos(e);
    addThing(nextKind(), p.x, Math.min(p.y, H * 0.5));
    if (reduceMotion) settleAndDraw();
  });

  function settleAndDraw() {
    var x = train.x;
    for (var i = 0; i < 600; i++) step(1 / 60);
    train.x = x;
    resetBalloon(false);
    draw();
  }

  function init() {
    resize();
    readColors();
    buildTrain();
    resetBalloon(false);
    for (var i = 0; i < 4; i++) addThing(nextKind(), 60 + Math.random() * (W - 120), -20 - i * 80);
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
      things.forEach(function (b) { b.x = Math.min(W - b.r, b.x * (W / oldW)); });
      if (reduceMotion) { readColors(); draw(); }
    }, 120);
  });

  init();
})();
