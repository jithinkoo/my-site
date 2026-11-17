// Home page animation: "Little things in motion". No libraries.
//
// A soft, light-coloured physics scene made of the things in my life:
//  - background: layered mountains, a little tree whose leaves flutter down
//  - sky: a comic phoenix gliding, a hot-air balloon rising on buoyancy,
//    an "aws" cloud drifting by that now and then drops a database
//  - ground: a little train (wheels roll, smoke rises) and a pendulum
//  - falling things that bounce, roll, stack and ride the train:
//    Elixir drop, Python snake, shuttlecock, cricket ball, football,
//    laptop, database, git branch, social network, atom, and letters in
//    Malayalam, English, Tamil and Hindi
// Move the mouse to push things; click or tap to drop something new.
// All drawings are simple original cartoons, not official logos.

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
    leaf: "#8fc79f",
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
  var MAX_THINGS = 16;
  var TRAIN_SPEED = 72;    // px/s
  var TRACK = 10;          // track height from the bottom

  var KINDS = ["drop", "snake", "shuttle", "cricket", "laptop", "letter", "football",
               "git", "atom", "social", "letter", "database"];
  var RADIUS = { drop: 15, snake: 14, shuttle: 10, cricket: 10, football: 14, laptop: 17,
                 database: 13, git: 13, social: 13, atom: 13, letter: 14 };
  var SPINNERS = { cricket: true, football: true };   // roll freely
  var LETTERS = [
    { ch: "അ", color: C.mint },     // Malayalam
    { ch: "A", color: C.sky },      // English
    { ch: "அ", color: C.peach },    // Tamil
    { ch: "अ", color: C.butter }    // Hindi
  ];
  var LETTER_FONT = "600 17px 'Nirmala UI', 'Noto Sans Malayalam', 'Noto Sans Tamil', " +
                    "'Noto Sans Devanagari', 'Segoe UI', sans-serif";

  var W = 0, H = 0, dpr = 1, time = 0;
  var things = [];
  var puffs = [];
  var leaves = [];
  var mouse = { x: -1e4, y: -1e4, vx: 0, inside: false, lastX: 0, lastT: 0 };
  var colors = {};
  var onScreen = true;
  var lastTime = 0;
  var frame = 0;
  var dropTimer = 0.4;
  var puffTimer = 0;
  var leafTimer = 1;
  var kindIndex = 0;
  var letterIndex = 0;

  var train = { x: 0, travelled: 0, cars: [], length: 214 };
  var balloon = { x: 0, y: 0, vx: 0, vy: -24, phase: Math.random() * 6 };
  var phoenix = { active: false, x: 0, y: 30, dir: 1, t: 0, wait: 2.5 };
  var pendulum = { theta: 0.55, omega: 0, length: 64, r: 9 };
  var cloud = { x: 0, y: 62, dropTimer: 6 };
  var tree = { x: 48 };

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
    colors.dark = document.documentElement.dataset.theme === "dark" ||
      (!document.documentElement.dataset.theme &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
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
    var r = RADIUS[kind];
    var thing = {
      kind: kind,
      x: Math.min(W - r, Math.max(r, x)),
      y: y,
      vx: (Math.random() - 0.5) * 60,
      vy: 0,
      r: r,
      m: kind === "shuttle" ? r * r * 0.3 : kind === "laptop" ? r * r * 1.6 : r * r,
      angle: SPINNERS[kind] ? Math.random() * 6 : 0,
      spin: 0,
      squash: 0,
      blink: 2 + Math.random() * 3
    };
    if (kind === "letter") thing.letter = LETTERS[letterIndex++ % LETTERS.length];
    things.push(thing);
    if (things.length > MAX_THINGS) things.shift();
  }

  function nextKind() {
    return KINDS[kindIndex++ % KINDS.length];
  }

  function resetBalloon(fromBelow) {
    balloon.x = 90 + Math.random() * Math.max(1, W - 220);
    balloon.y = fromBelow ? H + 50 : H * 0.5;
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

    // Leaves: light and flat, so air drag wins; they sway as they fall.
    leafTimer -= dt;
    if (leafTimer <= 0) {
      leafTimer = 1.8 + Math.random() * 1.5;
      if (leaves.length < 8) {
        leaves.push({ x: tree.x + (Math.random() - 0.5) * 44, y: H - TRACK - 82 + Math.random() * 18,
                      phase: Math.random() * 6, age: 0, landed: 0,
                      color: Math.random() < 0.5 ? C.leaf : C.butter });
      }
    }
    for (var l = leaves.length - 1; l >= 0; l--) {
      var leaf = leaves[l];
      leaf.age += dt;
      if (leaf.landed > 0) {
        leaf.landed += dt;
        if (leaf.landed > 4) leaves.splice(l, 1);
        continue;
      }
      leaf.y += 26 * dt;
      leaf.x += Math.sin(leaf.age * 2.4 + leaf.phase) * 38 * dt + 6 * dt;
      if (leaf.y > H - TRACK - 3) { leaf.y = H - TRACK - 3; leaf.landed = 0.001; }
    }

    // Balloon: buoyancy pulls it up to a gentle steady speed; wind sways it.
    balloon.vy += (-24 - balloon.vy) * 0.8 * dt;
    balloon.vx = 16 * Math.sin(time * 0.35 + balloon.phase);
    if (mouse.inside) pushAway(balloon, 0.25, dt);
    balloon.x += balloon.vx * dt;
    balloon.y += balloon.vy * dt;
    if (balloon.y < -70) resetBalloon(true);

    // AWS cloud drifts; now and then it drops a database (cloud storage!).
    cloud.x += 14 * dt;
    if (cloud.x > W + 60) cloud.x = -60;
    cloud.dropTimer -= dt;
    if (cloud.dropTimer <= 0) {
      cloud.dropTimer = 9 + Math.random() * 5;
      if (cloud.x > 20 && cloud.x < W - 20 && things.length < MAX_THINGS - 2) {
        addThing("database", cloud.x, cloud.y + 16);
      }
    }

    // Phoenix: glides across the sky, then rests before the next flight.
    if (phoenix.active) {
      phoenix.t += dt;
      phoenix.x += phoenix.dir * 95 * dt;
      phoenix.y = 30 + Math.sin(phoenix.t * 2.2) * 9;
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
      dropTimer = 1.5 + Math.random();
      if (things.length < 11) addThing(nextKind(), 70 + Math.random() * (W - 140), -20);
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

      if (SPINNERS[b.kind]) {
        b.spin *= 0.99;
        b.angle += b.spin * dt;
      } else if (b.kind !== "shuttle") {
        // Bottom-heavy: tumbles, then rocks back upright.
        b.angle = Math.atan2(Math.sin(b.angle), Math.cos(b.angle));
        b.spin += -b.angle * 9 * dt;
        b.spin *= 0.94;
        b.angle += b.spin * dt;
      }
      b.squash *= Math.exp(-7 * dt);
      b.blink -= dt;
      if (b.blink < -0.15) b.blink = 2 + Math.random() * 3;

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Ground
      var ground = H - TRACK;
      if (b.y + b.r > ground) {
        b.y = ground - b.r;
        if (b.vy > 200) b.squash = Math.min(0.35, b.vy / 2500);
        b.vy = -b.vy * (b.kind === "shuttle" ? 0.15 : BOUNCE);
        if (Math.abs(b.vy) < 30) b.vy = 0;
        b.vx *= GRIP;
        if (SPINNERS[b.kind]) b.spin = b.vx / b.r;
      }
      // Walls
      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * BOUNCE; }
      if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * BOUNCE; }

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

  // ---------- Drawing helpers ----------

  function outline(width) {
    ctx.lineWidth = width || 1.5;
    ctx.strokeStyle = colors.text;
    ctx.globalAlpha = 0.35;
    ctx.stroke();
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

  function dot(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function face(x, y, s, blinking) {
    ctx.fillStyle = C.ink;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.3;
    if (blinking) {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.42, y); ctx.lineTo(x - s * 0.18, y);
      ctx.moveTo(x + s * 0.18, y); ctx.lineTo(x + s * 0.42, y);
      ctx.stroke();
    } else {
      dot(x - s * 0.3, y, s * 0.11, C.ink);
      dot(x + s * 0.3, y, s * 0.11, C.ink);
    }
    ctx.beginPath();
    ctx.arc(x, y + s * 0.2, s * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // ---------- Scene drawing ----------

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawMountains();
    drawTree();
    drawCloud();
    drawBalloon();
    drawTrack();
    drawLeaves();
    drawPendulum();
    drawPuffs();
    drawTrain();
    for (var i = 0; i < things.length; i++) drawThing(things[i]);
    if (phoenix.active || reduceMotion) drawPhoenix();
  }

  function drawMountains() {
    var base = H - TRACK;
    // Low and pale, so they stay in the background.
    var alpha = colors.dark ? 0.16 : 0.26;
    var ranges = [
      { color: C.lavender, peaks: [[0, 0.74], [0.18, 0.54], [0.34, 0.72], [0.52, 0.5], [0.7, 0.7], [0.86, 0.52], [1, 0.72]] },
      { color: C.mint, peaks: [[0, 0.88], [0.12, 0.74], [0.28, 0.87], [0.45, 0.7], [0.62, 0.88], [0.8, 0.74], [1, 0.86]] }
    ];
    ranges.forEach(function (range) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = range.color;
      ctx.beginPath();
      ctx.moveTo(0, base);
      range.peaks.forEach(function (pk) { ctx.lineTo(pk[0] * W, pk[1] * H); });
      ctx.lineTo(W, base);
      ctx.closePath();
      ctx.fill();
    });
    // snow caps on the far peaks
    ctx.globalAlpha = colors.dark ? 0.3 : 0.9;
    ctx.fillStyle = colors.dark ? C.cream : "#ffffff";
    [[0.18, 0.54], [0.52, 0.5], [0.86, 0.52]].forEach(function (pk) {
      var x = pk[0] * W, y = pk[1] * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 12, y + 10);
      ctx.lineTo(x + 5, y + 8);
      ctx.lineTo(x, y + 11);
      ctx.lineTo(x - 5, y + 8);
      ctx.lineTo(x - 11, y + 10);
      ctx.closePath();
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // A taller tree with a round crown; a boy sits on top with his laptop.
  var CANOPY = [[-20, -78, 22], [20, -80, 21], [0, -100, 26], [-6, -72, 20], [10, -70, 19]];

  function drawTree() {
    var ground = H - TRACK;
    var x = tree.x;
    var sway = Math.sin(time * 0.8) * 1.5;

    // trunk and a small branch
    ctx.fillStyle = C.peach;
    roundRect(x - 6, ground - 72, 12, 72, 4);
    ctx.fill();
    outline(1);
    ctx.strokeStyle = C.peach;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 2, ground - 44);
    ctx.lineTo(x + 18, ground - 58);
    ctx.stroke();

    // crown
    CANOPY.forEach(function (blob) {
      dot(x + blob[0] + sway, ground + blob[1], blob[2], C.leaf);
    });
    ctx.globalAlpha = 0.18;
    dot(x - 8 + sway, ground - 106, 9, "#ffffff"); // a little light on the leaves
    ctx.globalAlpha = 1;

    drawBoy(x + sway, ground - 124);
  }

  // The boy on the treetop: sitting, legs dangling, laptop held on his lap,
  // typing away. He blinks, and looks up when the phoenix flies past.
  var boy = { blink: 3 };

  function drawBoy(x, seatY) {
    var skin = "#f2c9a5";
    var hair = "#4a3a33";
    var t = time;
    var lookUp = phoenix.active && Math.abs(phoenix.x - x) < 160 ? 1 : 0;
    boy.lookUp = (boy.lookUp || 0) + (lookUp - (boy.lookUp || 0)) * 0.08;
    boy.blink -= 1 / 120;
    if (boy.blink < -0.12) boy.blink = 2.5 + Math.random() * 3;

    ctx.save();
    ctx.translate(x, seatY);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // legs: thigh forward, shin dangling and swinging
    var swing = Math.sin(t * 1.6) * 0.25;
    [[-1, 0], [2, 0.6]].forEach(function (leg) {
      var kneeX = 9 + leg[0], kneeY = 1;
      var footX = kneeX + Math.sin(swing + leg[1]) * 6;
      var footY = kneeY + 13;
      ctx.strokeStyle = "#8aa6c9";
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(-1, 0);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();
      dot(footX + 1.5, footY + 1, 2.6, C.ink);
    });

    // body
    ctx.fillStyle = C.coral;
    roundRect(-6, -17, 10, 18, 4);
    ctx.fill();

    // laptop resting on his lap, lid open towards him
    var lidX = 17, lidTop = -20;
    // soft screen glow on his face side (small, so it never looks like a disc)
    ctx.globalAlpha = colors.dark ? 0.22 : 0.14;
    dot(lidX - 3, -10, 6, C.butter);
    ctx.globalAlpha = 1;
    // keyboard base on his lap
    ctx.fillStyle = C.lavender;
    roundRect(1, -2.5, lidX + 1, 3.2, 1.2);
    ctx.fill();
    // lid, tilted back, with a bright screen facing him
    ctx.beginPath();
    ctx.moveTo(lidX - 1, -1.5);
    ctx.lineTo(lidX + 3, lidTop);
    ctx.lineTo(lidX + 7.5, lidTop + 1);
    ctx.lineTo(lidX + 3.5, -1.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lidX + 0.6, -4);
    ctx.lineTo(lidX + 3.6, lidTop + 3);
    ctx.stroke();

    // arms reaching to the keyboard; hands bob while typing
    var tapA = Math.sin(t * 15) > 0.3 ? -1.2 : 0;
    var tapB = Math.sin(t * 15 + 2) > 0.3 ? -1.2 : 0;
    ctx.strokeStyle = skin;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-1, -13); ctx.lineTo(6, -6); ctx.lineTo(8, -3.5 + tapA);
    ctx.moveTo(1, -12); ctx.lineTo(9, -6); ctx.lineTo(11, -3.5 + tapB);
    ctx.stroke();

    // head (tilts up a little when the phoenix passes)
    ctx.save();
    ctx.translate(-1, -23);
    ctx.rotate(0.18 - boy.lookUp * 0.45);
    dot(0, 0, 6.5, skin);
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0, -1, 6.8, Math.PI * 0.95, Math.PI * 2.05);
    ctx.lineTo(4, -2);
    ctx.quadraticCurveTo(0, -3.5, -6.5, 0);
    ctx.closePath();
    ctx.fill();
    // eye and smile, facing the laptop
    if (boy.blink < 0) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(2.2, 0.5); ctx.lineTo(4.4, 0.5); ctx.stroke();
    } else {
      dot(3.3, 0.5, 1.1, C.ink);
    }
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(3, 2.6, 1.6, 0.1 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function drawLeaves() {
    for (var i = 0; i < leaves.length; i++) {
      var leaf = leaves[i];
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.landed ? 0.2 : Math.sin(leaf.age * 2.4 + leaf.phase) * 0.9);
      ctx.globalAlpha = leaf.landed ? Math.max(0, 1 - leaf.landed / 4) : 1;
      ctx.fillStyle = leaf.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawCloud() {
    var x = cloud.x, y = cloud.y;
    // Pale sky-blue on the light theme, soft cream on the dark theme.
    ctx.globalAlpha = colors.dark ? 0.55 : 1;
    ctx.fillStyle = colors.dark ? C.cream : "#dce9f5";
    ctx.beginPath();
    ctx.arc(x - 18, y + 4, 13, 0, Math.PI * 2);
    ctx.arc(x, y - 4, 17, 0, Math.PI * 2);
    ctx.arc(x + 19, y + 4, 12, 0, Math.PI * 2);
    ctx.rect(x - 18, y + 4, 37, 13);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.dark ? C.butter : C.coral;
    ctx.font = "700 11px 'Segoe UI', Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("aws", x, y + 8);
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
      dot(p.x, p.y, p.r, colors.muted);
    }
    ctx.globalAlpha = 1;
  }

  function drawWheel(x, y, r) {
    dot(x, y, r, colors.text);
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
        dot(r.x + r.w + 2, r.y + r.h - 6, 3, C.butter);
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
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, pendulum.r, 0, Math.PI * 2);
    ctx.fillStyle = C.mint;
    ctx.fill();
    outline(1);
  }

  function drawBalloon() {
    ctx.save();
    ctx.translate(balloon.x, balloon.y);
    ctx.rotate(balloon.vx * 0.006);
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
    if (b.squash > 0.01 && !SPINNERS[b.kind] && b.kind !== "shuttle") {
      ctx.translate(0, b.r * b.squash);
      ctx.scale(1 + b.squash, 1 - b.squash);
    }
    switch (b.kind) {
      case "drop": drawDrop(b); break;
      case "snake": drawSnake(b); break;
      case "cricket": drawCricketBall(b.r); break;
      case "football": drawFootball(b.r); break;
      case "shuttle": drawShuttle(b.r); break;
      case "laptop": drawLaptop(b.r); break;
      case "database": drawDatabase(b.r); break;
      case "git": drawGit(b.r); break;
      case "social": drawSocial(b.r); break;
      case "atom": drawAtom(b.r); break;
      case "letter": drawLetter(b); break;
    }
    ctx.restore();
  }

  // Elixir-style drop with a face; stretches while falling fast.
  function drawDrop(b) {
    var r = b.r;
    var stretch = Math.min(0.25, Math.abs(b.vy) / 2600);
    ctx.scale(1 / (1 + stretch), 1 + stretch);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3);
    ctx.bezierCurveTo(r * 0.85, -r * 0.35, r * 1.02, r * 0.35, 0, r);
    ctx.bezierCurveTo(-r * 1.02, r * 0.35, -r * 0.85, -r * 0.35, 0, -r * 1.3);
    ctx.fillStyle = C.lavender;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.lavenderEdge;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.12, r * 0.24, -0.4, 0, Math.PI * 2);
    ctx.fill();
    face(0, r * 0.1, r, b.blink < 0);
    ctx.globalAlpha = 0.55;
    dot(-r * 0.55, r * 0.35, r * 0.11, "#ee8ca0");
    dot(r * 0.55, r * 0.35, r * 0.11, "#ee8ca0");
    ctx.globalAlpha = 1;
  }

  // Python: a friendly curled-up snake in soft blue and yellow.
  function drawSnake(b) {
    var r = b.r;
    dot(0, 0, r, C.sky);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    outline(1);
    ctx.strokeStyle = C.butter;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (var t = 0; t < 4.2 * Math.PI; t += 0.2) {
      var rr = r * 0.85 * (1 - t / (4.6 * Math.PI));
      var px = Math.cos(t) * rr, py = Math.sin(t) * rr;
      if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // head poking out with a tongue
    dot(r * 0.75, -r * 0.75, r * 0.42, C.sky);
    ctx.beginPath();
    ctx.arc(r * 0.75, -r * 0.75, r * 0.42, 0, Math.PI * 2);
    outline(1);
    dot(r * 0.88, -r * 0.84, r * 0.09, C.ink);
    ctx.strokeStyle = C.coral;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(r * 1.12, -r * 0.7);
    ctx.lineTo(r * 1.4, -r * 0.66);
    ctx.lineTo(r * 1.5, -r * 0.76);
    ctx.moveTo(r * 1.4, -r * 0.66);
    ctx.lineTo(r * 1.5, -r * 0.58);
    ctx.stroke();
  }

  function drawCricketBall(r) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = C.coral;
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
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = C.cream;
    ctx.fill();
    outline(1.2);
    ctx.fillStyle = C.ink;
    ctx.strokeStyle = C.ink;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * (2 * Math.PI / 5);
      var px = Math.cos(a) * r * 0.36, py = Math.sin(a) * r * 0.36;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
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

  // Open laptop with a few lines of "code" on the screen.
  function drawLaptop(r) {
    ctx.fillStyle = C.lavender;
    roundRect(-r, -r * 0.9, r * 2, r * 1.3, 3);
    ctx.fill();
    outline(1);
    ctx.fillStyle = C.cream;
    roundRect(-r * 0.82, -r * 0.74, r * 1.64, r * 0.98, 2);
    ctx.fill();
    var lines = [[C.coral, 0.9], [C.mint, 0.6], [C.sky, 1.1], [C.butter, 0.5]];
    lines.forEach(function (ln, i) {
      ctx.fillStyle = ln[0];
      ctx.fillRect(-r * 0.66 + (i % 2) * 4, -r * 0.6 + i * r * 0.21, r * ln[1], r * 0.1);
    });
    ctx.fillStyle = C.lavender;
    ctx.beginPath();
    ctx.moveTo(-r * 1.15, r * 0.42);
    ctx.lineTo(r * 1.15, r * 0.42);
    ctx.lineTo(r * 1.0, r * 0.62);
    ctx.lineTo(-r * 1.0, r * 0.62);
    ctx.closePath();
    ctx.fill();
    outline(1);
  }

  // Classic database cylinder.
  function drawDatabase(r) {
    var w = r * 0.9, h = r * 1.5, e = r * 0.32;
    ctx.fillStyle = C.butter;
    ctx.beginPath();
    ctx.moveTo(-w, -h / 2);
    ctx.lineTo(-w, h / 2);
    ctx.ellipse(0, h / 2, w, e, 0, Math.PI, 0, true);
    ctx.lineTo(w, -h / 2);
    ctx.closePath();
    ctx.fill();
    outline(1);
    ctx.fillStyle = "#f8e3ad";
    ctx.beginPath();
    ctx.ellipse(0, -h / 2, w, e, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(1);
    ctx.strokeStyle = colors.text;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    [-h / 6, h / 6].forEach(function (y) {
      ctx.beginPath();
      ctx.ellipse(0, y, w, e, 0, 0, Math.PI);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  // Git: a branch that splits off and merges back.
  function drawGit(r) {
    ctx.fillStyle = C.sky;
    roundRect(-r, -r, r * 2, r * 2, r * 0.45);
    ctx.fill();
    outline(1);
    ctx.strokeStyle = C.ink;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, r * 0.6);
    ctx.lineTo(-r * 0.35, -r * 0.6);
    ctx.moveTo(-r * 0.35, r * 0.25);
    ctx.quadraticCurveTo(r * 0.4, r * 0.2, r * 0.4, -r * 0.2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    dot(-r * 0.35, -r * 0.6, r * 0.18, C.coral);
    dot(-r * 0.35, r * 0.6, r * 0.18, C.cream);
    dot(r * 0.4, -r * 0.25, r * 0.18, C.butter);
  }

  // Social network: people dots connected to each other.
  function drawSocial(r) {
    ctx.fillStyle = C.rose;
    roundRect(-r, -r, r * 2, r * 2, r * 0.45);
    ctx.fill();
    outline(1);
    var nodes = [[0, -r * 0.48], [-r * 0.5, r * 0.4], [r * 0.5, r * 0.4]];
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(nodes[0][0], nodes[0][1]);
    ctx.lineTo(nodes[1][0], nodes[1][1]);
    ctx.lineTo(nodes[2][0], nodes[2][1]);
    ctx.closePath();
    ctx.stroke();
    nodes.forEach(function (n) { dot(n[0], n[1], r * 0.24, C.cream); });
    dot(0, -r * 0.48, r * 0.1, C.coral);
  }

  // Atom: electrons orbiting a nucleus.
  function drawAtom(r) {
    dot(0, 0, r, colors.dark ? "rgba(253,248,239,0.12)" : "rgba(169,203,232,0.25)");
    ctx.strokeStyle = C.lavenderEdge;
    ctx.lineWidth = 1.1;
    for (var i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 3);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.95, r * 0.36, 0, 0, Math.PI * 2);
      ctx.stroke();
      var t = time * 3 + i * 2;
      dot(Math.cos(t) * r * 0.95, Math.sin(t) * r * 0.36, 2, C.coral);
      ctx.restore();
    }
    dot(0, 0, r * 0.22, C.butter);
  }

  // A letter bubble: Malayalam, English, Tamil or Hindi.
  function drawLetter(b) {
    var r = b.r;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = b.letter.color;
    ctx.fill();
    outline(1);
    ctx.fillStyle = C.ink;
    ctx.font = LETTER_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.letter.ch, 0, 1);
  }

  // Comic flame-bird phoenix, flapping as it glides.
  function drawPhoenix() {
    var x = reduceMotion ? W * 0.3 : phoenix.x;
    var y = reduceMotion ? 30 : phoenix.y;
    var flap = Math.sin(phoenix.t * 10) * 0.7;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(phoenix.dir, 1);
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
    ctx.save();
    ctx.rotate(-flap * 0.6);
    ctx.fillStyle = C.peach;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(-6, -22, -20, -24);
    ctx.quadraticCurveTo(-10, -10, -4, 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = C.coral;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 8, -0.15, 0, Math.PI * 2);
    ctx.fill();
    dot(12, -5, 6.5, C.coral);
    ctx.fillStyle = C.butter;
    ctx.beginPath();
    ctx.moveTo(10, -10);
    ctx.quadraticCurveTo(9, -19, 4, -20);
    ctx.quadraticCurveTo(10, -16, 14, -10);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(18, -6); ctx.lineTo(24, -4); ctx.lineTo(18, -2);
    ctx.fill();
    dot(14, -6, 1.6, C.ink);
    dot(14.5, -6.6, 0.6, "#fff");
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
    cloud.x = W * 0.35;
    for (var i = 0; i < 6; i++) addThing(nextKind(), 80 + Math.random() * (W - 160), -20 - i * 70);
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
