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
  var phoenix = { active: false, x: 0, y: 30, dir: 1, t: 0, wait: 2.5, baseY: 30, speed: 95, bob: 9,
                  state: "fly", mood: "ok", vx: 0, vy: 0, rot: 0, bandage: false };
  // A little bluebird flies lower, through the cloud's height, the other way.
  var bluebird = { active: false, x: 0, y: 66, dir: -1, t: 0, wait: 5, baseY: 66, speed: 70, bob: 6,
                   state: "fly", mood: "ok", vx: 0, vy: 0, rot: 0, bandage: false };
  var birds = [phoenix, bluebird];
  var victim = phoenix;   // the bird the boy is helping

  // When a stray arrow hits the phoenix, the boy on the tree closes his
  // laptop, climbs down, heals the bird, waves it off and climbs back up.
  var rescue = { stage: "none", t: 0, cooldown: 6, x: 0, y: 0, face: 1, laptop: 1, force: false };
  var hearts = [];
  var CLIMB = 55, WALK = 100;
  var pendulum = { theta: 0.55, omega: 0, length: 64, r: 9 };
  var cloud = { x: 0, y: 62, dropTimer: 6, hits: 0, maxHits: 12, broken: false, respawn: 0, shake: 0 };

  // The archer on the train, its arrows, and what flies out of the cloud.
  var archer = { shootTimer: 1.5, pull: 0, aim: -0.8 };
  var arrows = [];
  var sparks = [];
  var rings = [];
  var chunks = [];
  var loot = [];
  var ARROW_G = 260;   // arrows fly in a gentle arc
  var LOOT = [
    { kind: "key", label: "Key" },
    { kind: "mail", label: "Email" },
    { kind: "briefcase", label: "Business" },
    { kind: "bucket", label: "S3" },
    { kind: "badge", label: "IAM" },
    { kind: "police", label: "Policy" },
    { kind: "lock", label: "Lock" },
    { kind: "shield", label: "Shield" }
  ];
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
    // When the archer breaks it, a fresh cloud drifts back in a bit later.
    if (cloud.broken) {
      cloud.respawn -= dt;
      if (cloud.respawn <= 0) {
        cloud.broken = false;
        cloud.hits = 0;
        cloud.maxHits = 10 + Math.floor(Math.random() * 6);
        cloud.x = -60;
      }
    } else {
      cloud.x += 14 * dt;
      if (cloud.x > W + 60) cloud.x = -60;
    }
    cloud.shake *= Math.exp(-9 * dt);
    updateArcher(dt);
    updateEffects(dt);

    cloud.dropTimer -= dt;
    if (cloud.dropTimer <= 0) {
      cloud.dropTimer = 9 + Math.random() * 5;
      if (!cloud.broken && cloud.x > 20 && cloud.x < W - 20 && things.length < MAX_THINGS - 2) {
        addThing("database", cloud.x, cloud.y + 16);
      }
    }

    // Birds: glide across the sky, then rest before the next flight.
    // A hurt bird falls, waits for help, then lifts off again.
    rescue.cooldown -= dt;
    updateRescue(dt);
    birds.forEach(function (bd) { stepBird(bd, dt); });

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
      if (victim.state === "hurt" || boyAway()) makeRoom(b, dt);

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

  // ---------- Archer, arrows, hits and the breaking cloud ----------

  // The archer sits on the roof of the middle carriage.
  function archerSeat() {
    var car = carRect(train.cars[1]);
    return { x: car.x + car.w * 0.5, y: car.y };
  }

  // Bow hand: the bow arm held straight out from the shoulder, along the aim.
  var BOW_ARM = 17;
  var ARCHER_SCALE = 1.35;   // he stands a little taller than the other toys
  function archerShoulder() {
    var s = archerSeat();
    var face = Math.cos(archer.aim) >= 0 ? 1 : -1;
    return { x: s.x + face * ARCHER_SCALE, y: s.y - 21 * ARCHER_SCALE };
  }

  function archerHand() {
    var sh = archerShoulder();
    return { x: sh.x + Math.cos(archer.aim) * BOW_ARM * ARCHER_SCALE, y: sh.y + Math.sin(archer.aim) * BOW_ARM * ARCHER_SCALE };
  }

  function updateArcher(dt) {
    var seat = archerSeat();
    var target = cloud.broken ? { x: seat.x + 40, y: cloud.y } : { x: cloud.x, y: cloud.y };
    var want = Math.atan2(target.y - (seat.y - 21 * ARCHER_SCALE), target.x - seat.x);
    if (archer.paused) want = Math.atan2(0.9, Math.cos(archer.aim) >= 0 ? 1 : -1); // bow lowered
    archer.aim += (want - archer.aim) * Math.min(1, 6 * dt);
    archer.recoil = Math.max(0, (archer.recoil || 0) - dt * 4);
    archer.proud = Math.max(0, (archer.proud || 0) - dt);
    archer.oops = Math.max(0, (archer.oops || 0) - dt);

    archer.shootTimer -= dt;
    var onScreen = seat.x > 12 && seat.x < W - 12;
    var canShoot = !cloud.broken && !archer.paused && onScreen && !reduceMotion;
    // a slow, steady draw before each shot; the string snaps forward on release
    var drawTarget = canShoot ? Math.max(0, Math.min(1, (0.65 - archer.shootTimer) / 0.55)) : 0;
    archer.draw = canShoot ? drawTarget : (archer.draw || 0) * Math.exp(-6 * dt);
    if (archer.shootTimer <= 0 && canShoot) {
      archer.shootTimer = 1.5 + Math.random() * 0.6;
      archer.draw = 0;
      archer.recoil = 1;
      var hand = archerHand();
      var T = 0.75;                                   // flight time
      var tx, ty;
      var stray = birdNearCloud(T);
      if (stray) {
        // the bird flies into the line of fire: the shot misses the cloud
        tx = stray.x + stray.dir * stray.speed * T;
        ty = stray.baseY + Math.sin((stray.t + T) * 2.2) * stray.bob;
      } else {
        tx = cloud.x + 14 * T + (Math.random() - 0.5) * 10; // lead the moving cloud
        ty = cloud.y + (Math.random() - 0.5) * 8;
      }
      arrows.push({
        x: hand.x, y: hand.y,
        vx: (tx - hand.x) / T,
        vy: (ty - hand.y) / T - 0.5 * ARROW_G * T,
        age: 0,
        stray: !!stray
      });
    }

    for (var i = arrows.length - 1; i >= 0; i--) {
      var a = arrows[i];
      a.age += dt;
      a.vy += ARROW_G * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      var hitB = null;
      birds.forEach(function (bd) {
        if (!hitB && birdHittable(bd) && Math.abs(a.x - bd.x) < 16 && Math.abs(a.y - bd.y) < 14) hitB = bd;
      });
      if (hitB) {
        hitBird(hitB, a);
        arrows.splice(i, 1);
        continue;
      }
      var dx = (a.x - cloud.x) / 32, dy = (a.y - (cloud.y + 3)) / 19;
      if (!cloud.broken && !a.stray && dx * dx + dy * dy < 1) {
        hitCloud(a.x, a.y);
        arrows.splice(i, 1);
      } else if (a.age > 3 || a.y > H || a.x < -40 || a.x > W + 40) {
        arrows.splice(i, 1);
      }
    }
  }

  // ---------- The bird rescue ----------

  // Each bird glides across, rests off screen, and comes back the other way.
  function stepBird(b, dt) {
    if (b.state !== "fly") {
      updateHurtBird(b, dt);
    } else if (b.active) {
      b.t += dt;
      b.x += b.dir * b.speed * dt;
      b.y = b.baseY + Math.sin(b.t * 2.2) * b.bob;
      if (b.x < -60 || b.x > W + 60) {
        b.active = false;
        b.wait = (b === phoenix ? 7 : 5) + Math.random() * 5;
        b.dir = -b.dir;
        b.bandage = false;
        b.mood = "ok";
      }
    } else {
      b.wait -= dt;
      if (b.wait <= 0) {
        b.active = true;
        b.t = 0;
        b.x = b.dir > 0 ? -50 : W + 50;
      }
    }
  }

  function birdHittable(b) {
    return b.active && b.state === "fly" && rescue.stage === "none" &&
           rescue.cooldown <= 0 && !b.bandage;
  }

  // A bird that will be close to the cloud when the next arrow gets there.
  function birdNearCloud(T) {
    for (var i = 0; i < birds.length; i++) {
      var b = birds[i];
      if (!birdHittable(b)) continue;
      var bx = b.x + b.dir * b.speed * T;
      if (bx < 25 || bx > W - 25) continue;
      if (rescue.force || Math.abs(bx - (cloud.x + 14 * T)) < 90) return b;
    }
    return null;
  }

  function hitBird(b, a) {
    victim = b;
    b.state = "falling";
    b.mood = "sad";
    b.vx = a.vx * 0.12;
    b.vy = -70;
    b.rot = 0;
    archer.paused = true;
    archer.oops = 3;
    rescue.stage = "wait";
    rescue.t = 0;
    rescue.force = false;
    rings.push({ x: b.x, y: b.y, r: 4, life: 0.45 });
    for (var i = 0; i < 12; i++) {
      var ang = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 90;
      sparks.push({ x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                    life: 0.5 + Math.random() * 0.3, color: i % 2 ? C.peach : (b === phoenix ? C.butter : C.sky) });
    }
  }

  function updateHurtBird(b, dt) {
    var ground = H - TRACK;
    var rest = ground - (b === phoenix ? 9 : 8);
    b.t += dt;
    if (b.state === "falling") {
      b.vy += 700 * dt;
      b.x = Math.max(30, Math.min(W - 30, b.x + b.vx * dt));
      b.y += b.vy * dt;
      b.rot += 5 * dt;
      if (b.y >= rest) {
        b.y = rest;
        b.state = "hurt";
        b.rot = 0;
        for (var i = 0; i < 8; i++) {
          sparks.push({ x: b.x, y: ground - 2, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 60,
                        life: 0.4, color: C.peach });
        }
        rescue.stage = "closing";
        rescue.t = 0;
      }
    } else if (b.state === "hurt") {
      b.y = rest;
    } else if (b.state === "liftoff") {
      b.y -= 70 * dt;
      b.x += b.dir * 45 * dt;
      if (b.y <= b.baseY) {
        b.y = b.baseY;
        b.state = "fly";
        b.t = 0;
      }
    }
  }

  // Toys on the ground roll aside so the hurt bird and the boy stay in view.
  function makeRoom(b, dt) {
    if (b.y < H - TRACK - 90) return;
    var spots = [];
    if (victim.state === "hurt" || victim.state === "liftoff") spots.push(victim.x);
    if (boyAway() && rescue.stage !== "down" && rescue.stage !== "up") spots.push(rescue.x);
    for (var i = 0; i < spots.length; i++) {
      var dx = b.x - spots[i];
      if (Math.abs(dx) < 48 + b.r) b.vx += (dx >= 0 ? 1 : -1) * 1100 * dt;
    }
  }

  function goRescue(stage) {
    rescue.stage = stage;
    rescue.t = 0;
  }

  // Moves the boy towards x; true once he is there.
  function walkTo(x, dt) {
    var d = x - rescue.x;
    rescue.face = d >= 0 ? 1 : -1;
    rescue.x += Math.sign(d) * Math.min(Math.abs(d), WALK * dt);
    return Math.abs(x - rescue.x) < 0.5;
  }

  function updateRescue(dt) {
    var ground = H - TRACK;
    var trunkX = tree.x + 11;
    var top = ground - 108;
    rescue.t += dt;
    switch (rescue.stage) {
      case "closing":   // the laptop lid comes down
        rescue.laptop = Math.max(0, rescue.laptop - dt * 1.6);
        if (rescue.laptop === 0 && rescue.t > 0.9) {
          rescue.x = trunkX; rescue.y = top; rescue.face = -1;
          goRescue("down");
        }
        break;
      case "down":
        rescue.y += CLIMB * dt;
        if (rescue.y >= ground) { rescue.y = ground; goRescue("walk"); }
        break;
      case "walk":
        var side = victim.x >= trunkX ? 1 : -1;
        if (walkTo(victim.x - side * 20, dt)) {
          rescue.face = side;
          goRescue("heal");
        }
        break;
      case "heal":
        if (Math.random() < dt * 7) {
          hearts.push({ x: victim.x + (Math.random() - 0.5) * 18, y: victim.y - 8,
                        vx: (Math.random() - 0.5) * 18, life: 1.5, c: Math.random() < 0.5 ? C.coral : C.rose });
        }
        if (rescue.t > 1.6 && !victim.bandage) { victim.bandage = true; victim.mood = "happy"; }
        if (rescue.t > 2.9) {
          victim.state = "liftoff";
          victim.dir = rescue.face;
          goRescue("wave");
        }
        break;
      case "wave":
        if (rescue.t > 1.9) goRescue("walkBack");
        break;
      case "walkBack":
        if (walkTo(trunkX, dt)) { rescue.face = -1; goRescue("up"); }
        break;
      case "up":
        rescue.y -= CLIMB * dt;
        if (rescue.y <= top) goRescue("opening");
        break;
      case "opening":   // back on his seat, the same laptop opens again
        rescue.laptop = Math.min(1, rescue.laptop + dt * 1.6);
        if (rescue.laptop === 1) {
          goRescue("none");
          archer.paused = false;
          rescue.cooldown = 35 + Math.random() * 20;
        }
        break;
    }
    for (var i = hearts.length - 1; i >= 0; i--) {
      var h = hearts[i];
      h.life -= dt; h.y -= 28 * dt; h.x += h.vx * dt;
      if (h.life <= 0) hearts.splice(i, 1);
    }
  }

  function hitCloud(x, y) {
    archer.proud = 1.2;
    cloud.hits += 1;
    cloud.shake = 4;
    rings.push({ x: x, y: y, r: 3, life: 0.45 });
    for (var i = 0; i < 10; i++) {
      var ang = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 120;
      sparks.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.4 + Math.random() * 0.3,
                    color: i % 2 ? C.butter : C.coral });
    }
    if (cloud.hits >= cloud.maxHits) breakCloud();
  }

  function breakCloud() {
    cloud.broken = true;
    cloud.respawn = 7.5;
    // soft puffs of the burst cloud drift apart and fade quickly
    var color = cloudColor(0.65);
    var parts = [[-18, 4, 10], [0, -4, 12], [19, 4, 9], [-8, 12, 7], [10, 12, 7], [-26, 10, 6], [27, 10, 6]];
    parts.forEach(function (p) {
      chunks.push({ x: cloud.x + p[0], y: cloud.y + p[1], r: p[2], color: color,
                    vx: p[0] * 5 + (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 50, life: 1.3 });
    });
    rings.push({ x: cloud.x, y: cloud.y, r: 10, life: 0.6, big: true });
    var picks = LOOT.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 6 + Math.floor(Math.random() * 3));
    picks.forEach(function (item, i) {
      loot.push({ kind: item.kind, label: item.label, r: 12,
                  x: cloud.x + (i - picks.length / 2) * 6, y: cloud.y,
                  vx: (Math.random() - 0.5) * 260, vy: -120 - Math.random() * 200,
                  angle: 0, spin: (Math.random() - 0.5) * 6, life: 10 });
    });
  }

  function updateEffects(dt) {
    var i;
    for (i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      s.life -= dt; s.vy += 300 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0) sparks.splice(i, 1);
    }
    for (i = rings.length - 1; i >= 0; i--) {
      rings[i].life -= dt;
      rings[i].r += (rings[i].big ? 120 : 50) * dt;
      if (rings[i].life <= 0) rings.splice(i, 1);
    }
    for (i = chunks.length - 1; i >= 0; i--) {
      var c = chunks[i];
      c.life -= dt; c.vy += 120 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r *= 1 + 0.5 * dt;
      if (c.life <= 0) chunks.splice(i, 1);
    }
    var ground = H - TRACK;
    for (i = loot.length - 1; i >= 0; i--) {
      var b = loot[i];
      b.life -= dt;
      // The blast keeps its pop; on the way down the items drift more gently.
      if (b.vy < 0) b.vy += 1100 * dt;
      else b.vy = Math.min(b.vy + 480 * dt, 230);
      if (mouse.inside) pushAway(b, 0.8, dt);
      b.vx *= 0.995;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.spin * dt;
      if (b.y + b.r > ground) {
        b.y = ground - b.r;
        b.vy = -b.vy * 0.4;
        if (Math.abs(b.vy) < 30) b.vy = 0;
        b.vx *= 0.85;
        b.spin = b.vx / b.r * 0.6;
        // settle upright once resting
        if (b.vy === 0) b.angle *= 0.8;
      }
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.5; }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.5; }
      if (b.life <= 0) loot.splice(i, 1);
    }

    // Items bump into each other and roll off the other objects, so they
    // spread out instead of piling up in one spot.
    for (var p = 0; p < loot.length; p++) {
      for (var q = p + 1; q < loot.length; q++) separate(loot[p], loot[q], 0.5);
      for (var t = 0; t < things.length; t++) separate(loot[p], things[t], 1);
    }
  }

  // Pushes circle `a` out of circle `b` (and `b` out of `a` by 1 - share).
  function separate(a, b, share) {
    var dx = a.x - b.x, dy = a.y - b.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var min = a.r + b.r;
    if (d === 0 || d >= min) return;
    var nx = dx / d, ny = dy / d, overlap = min - d;
    a.x += nx * overlap * share;
    a.y += ny * overlap * share;
    if (share < 1) {
      b.x -= nx * overlap * (1 - share);
      b.y -= ny * overlap * (1 - share);
    }
    var vn = a.vx * nx + a.vy * ny;
    if (vn < 0) { a.vx -= 1.4 * vn * nx; a.vy -= 1.4 * vn * ny; }
  }

  // Cloud colour: from soft and light to stormy as the hits add up.
  function cloudColor(t) {
    var from = colors.dark ? [253, 248, 239] : [220, 233, 245];
    var to = colors.dark ? [70, 68, 80] : [92, 90, 104];
    var mix = from.map(function (v, k) { return Math.round(v + (to[k] - v) * t); });
    return "rgb(" + mix.join(",") + ")";
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
    drawChunks();
    drawBalloon();
    drawTrack();
    drawLeaves();
    drawPendulum();
    drawPuffs();
    drawTrain();
    drawArcher();
    drawHelper();
    drawArrows();
    for (var i = 0; i < things.length; i++) drawThing(things[i]);
    drawLoot();
    drawSparks();
    if (phoenix.active || reduceMotion) drawPhoenix();
    if (bluebird.active && !reduceMotion) drawBluebird();
    drawHearts();
  }

  // The Elixir archer: a seasoned bowman standing tall on the carriage roof.
  // Wide stance, quiver on his back, bow arm straight, and the drawing hand
  // pulled back to his cheek. Serious while he aims, proud after a hit,
  // bow raised high when the cloud breaks, shocked if he hits the bird.
  function drawArcher() {
    var s = archerSeat();
    if (s.x < -30 || s.x > W + 30) return;
    var face = Math.cos(archer.aim) >= 0 ? 1 : -1;
    var la = Math.atan2(Math.sin(archer.aim), Math.abs(Math.cos(archer.aim)));
    var ca = Math.cos(la), sa = Math.sin(la);
    var draw = archer.draw || 0;
    var triumph = cloud.broken && !archer.paused;
    var shocked = archer.oops > 0;
    var proud = !shocked && (triumph || (archer.proud > 0 && draw < 0.3));
    var r = 10;
    var lean = -0.06 + Math.min(0, sa) * 0.12 - (proud ? 0.12 : 0);

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(face * ARCHER_SCALE, ARCHER_SCALE);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // legs: front foot forward, back foot braced, knees soft
    ctx.strokeStyle = C.lavenderEdge;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(1, -9); ctx.lineTo(5, -4.5); ctx.lineTo(7, -1);
    ctx.moveTo(-1, -9); ctx.lineTo(-5, -4); ctx.lineTo(-8, -1);
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.ellipse(8.4, -1, 2.6, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-8.6, -1, 2.6, 1.6, 0, 0, Math.PI * 2); ctx.fill();

    // body, leaning back a little: chest out
    ctx.save();
    ctx.translate(0, -9);
    ctx.rotate(lean);

    // quiver on his back, full of arrows
    ctx.save();
    ctx.translate(-7, -13);
    ctx.rotate(-0.45);
    ctx.fillStyle = C.peach;
    roundRect(-2.6, -8, 5.2, 15, 2);
    ctx.fill();
    ctx.strokeStyle = C.coral;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-2.6, -4); ctx.lineTo(2.6, -4); ctx.stroke();
    ctx.fillStyle = C.coral;
    [-1.3, 1.1].forEach(function (o, k) {
      ctx.beginPath();
      ctx.moveTo(o, -8);
      ctx.lineTo(o - 1.7, -12.8 - k);
      ctx.lineTo(o + 1.7, -12.8 - k);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    // the Elixir drop
    ctx.save();
    ctx.translate(0, -r);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3);
    ctx.bezierCurveTo(r * 0.85, -r * 0.35, r * 1.02, r * 0.35, 0, r);
    ctx.bezierCurveTo(-r * 1.02, r * 0.35, -r * 0.85, -r * 0.35, 0, -r * 1.3);
    ctx.fillStyle = C.lavender;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = C.lavenderEdge;
    ctx.stroke();

    // headband, tails flying in the wind of the train
    var flut = Math.sin(time * 9) * 1.6;
    ctx.strokeStyle = C.coral;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-6, -5.6); ctx.quadraticCurveTo(0, -7.4, 6.3, -5.2); ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, -6); ctx.quadraticCurveTo(-11, -8 + flut, -15, -5 - flut);
    ctx.moveTo(-6, -5.4); ctx.quadraticCurveTo(-10, -3 + flut, -14, -1 + flut);
    ctx.stroke();

    // face
    ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.ink;
    ctx.lineWidth = 1;
    if (shocked) {
      // wide eyes, open mouth, a drop of sweat: "oh no, the bird!"
      [1.8, 5.8].forEach(function (ex) {
        dot(ex, -0.5, 2, "#fff");
        ctx.beginPath(); ctx.arc(ex, -0.5, 2, 0, Math.PI * 2); ctx.stroke();
        dot(ex + 0.3, -0.4, 0.9, C.ink);
      });
      ctx.beginPath(); ctx.ellipse(4, 4.2, 1.2, 1.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.sky;
      ctx.beginPath(); ctx.moveTo(-4, -6); ctx.quadraticCurveTo(-6.2, -2.5, -4, -2.2);
      ctx.quadraticCurveTo(-1.8, -2.5, -4, -6); ctx.fill();
    } else if (proud) {
      // eyes closed in a happy curve, a confident smirk, a little blush
      [2, 6].forEach(function (ex) {
        ctx.beginPath(); ctx.arc(ex, 0.8, 1.5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      });
      ctx.beginPath(); ctx.moveTo(1.6, 3.2); ctx.quadraticCurveTo(4.6, 5.4, 7.2, 2.4); ctx.stroke();
      ctx.globalAlpha = 0.55;
      dot(0, 2.6, 1.4, C.rose);
      ctx.globalAlpha = 1;
    } else {
      // focused: one eye squinted shut, the aiming eye fixed on the target,
      // brows pulled down, lips pressed together
      ctx.beginPath(); ctx.moveTo(0.8, 0); ctx.lineTo(3, 0.3); ctx.stroke();
      dot(5.7 + ca * 0.6, -0.2 + sa * 0.6, 1.25, C.ink);
      dot(6 + ca * 0.6, -0.6 + sa * 0.6, 0.45, "#fff");
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(0.3, -3.2); ctx.lineTo(3, -2.1);
      ctx.moveTo(4.4, -2.2); ctx.lineTo(7.4, -3.2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(2.8, 3.7); ctx.lineTo(6, 3.4); ctx.stroke();
    }
    ctx.restore(); // drop
    ctx.restore(); // lean

    // arms and bow
    var sh = { x: 1, y: -21 };
    var back = { x: -1, y: -20.5 };
    ctx.strokeStyle = C.lavenderEdge;
    ctx.lineWidth = 2.4;
    if (triumph) {
      // bow held high overhead, the other hand on his hip
      var hx = 3, hy = -40 + Math.sin(time * 6) * 1.5;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y); ctx.lineTo(hx, hy);
      ctx.moveTo(back.x, back.y); ctx.lineTo(-9, -15); ctx.lineTo(-5, -11);
      ctx.stroke();
      ctx.strokeStyle = C.coral;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(hx, hy - 12); ctx.quadraticCurveTo(hx + 8, hy, hx, hy + 12); ctx.stroke();
      ctx.strokeStyle = colors.muted;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(hx, hy - 12); ctx.lineTo(hx, hy + 12); ctx.stroke();
      dot(hx, hy, 2.5, C.lavender);
      dot(-5, -11, 2.3, C.lavender);
    } else {
      var dir = { x: ca, y: sa };
      var n = { x: -sa, y: ca };
      var push = (archer.recoil || 0) * 1.5;
      var bh = { x: sh.x + ca * (BOW_ARM + push), y: sh.y + sa * (BOW_ARM + push) };
      var pull = 2 + draw * 15;
      if (archer.recoil > 0) pull = 2 + Math.sin(time * 90) * archer.recoil * 1.5; // the string hums
      var nock = { x: bh.x - dir.x * pull, y: bh.y - dir.y * pull };
      var bowR = 12 - draw * 1.5; // the limbs bend as he draws
      var tipA = { x: bh.x + n.x * bowR, y: bh.y + n.y * bowR };
      var tipB = { x: bh.x - n.x * bowR, y: bh.y - n.y * bowR };
      // bow
      ctx.strokeStyle = C.coral;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(tipA.x, tipA.y);
      ctx.quadraticCurveTo(bh.x + dir.x * (7 + draw * 3), bh.y + dir.y * (7 + draw * 3), tipB.x, tipB.y);
      ctx.stroke();
      ctx.strokeStyle = colors.muted;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(tipA.x, tipA.y); ctx.lineTo(nock.x, nock.y); ctx.lineTo(tipB.x, tipB.y);
      ctx.stroke();
      // the next arrow, nocked and drawn
      if (draw > 0.08) {
        var tip = { x: bh.x + dir.x * 6, y: bh.y + dir.y * 6 };
        ctx.strokeStyle = colors.text;
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(nock.x, nock.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
        ctx.fillStyle = colors.text;
        ctx.beginPath();
        ctx.moveTo(tip.x + dir.x * 3, tip.y + dir.y * 3);
        ctx.lineTo(tip.x + n.x * 2.2, tip.y + n.y * 2.2);
        ctx.lineTo(tip.x - n.x * 2.2, tip.y - n.y * 2.2);
        ctx.closePath();
        ctx.fill();
      }
      // bow arm straight out; drawing arm with the elbow high behind
      var elbow = { x: nock.x - dir.x * 8, y: nock.y - dir.y * 8 - 1.5 };
      ctx.strokeStyle = C.lavenderEdge;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y); ctx.lineTo(bh.x, bh.y);
      ctx.moveTo(back.x, back.y); ctx.lineTo(elbow.x, elbow.y); ctx.lineTo(nock.x, nock.y);
      ctx.stroke();
      dot(bh.x, bh.y, 2.5, C.lavender);
      dot(nock.x, nock.y, 2.3, C.lavender);
    }
    ctx.restore();
  }

  function drawArrows() {
    for (var i = 0; i < arrows.length; i++) {
      var a = arrows[i];
      var ang = Math.atan2(a.vy, a.vx);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(ang);
      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(3, -2.6); ctx.lineTo(3, 2.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.coral;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-15, -3); ctx.lineTo(-9, 0); ctx.lineTo(-15, 3); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawSparks() {
    sparks.forEach(function (s) {
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life * 2.5));
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03);
      ctx.stroke();
    });
    rings.forEach(function (g) {
      ctx.globalAlpha = Math.max(0, g.life / (g.big ? 0.6 : 0.45));
      ctx.strokeStyle = g.big ? C.butter : C.cream;
      ctx.lineWidth = g.big ? 3 : 1.5;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function drawChunks() {
    chunks.forEach(function (c) {
      ctx.globalAlpha = Math.max(0, Math.min(0.7, c.life * 0.6));
      dot(c.x, c.y, Math.max(1, c.r), c.color);
    });
    ctx.globalAlpha = 1;
  }

  // What spills out of the broken cloud: the AWS world, as little icons.
  function drawLoot() {
    loot.forEach(function (b) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, b.life / 1.5));
      ctx.translate(b.x, b.y);
      ctx.save();
      ctx.rotate(b.angle);
      drawLootIcon(b.kind, b.r);
      ctx.restore();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  function drawLootIcon(kind, r) {
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = colors.text;
    switch (kind) {
      case "key":
        ctx.fillStyle = C.butter;
        ctx.beginPath(); ctx.arc(-r * 0.45, 0, r * 0.42, 0, Math.PI * 2); ctx.fill(); outline(1);
        dot(-r * 0.45, 0, r * 0.14, colors.bg);
        ctx.fillRect(-r * 0.05, -r * 0.12, r * 1.05, r * 0.24);
        ctx.fillRect(r * 0.62, r * 0.1, r * 0.16, r * 0.3);
        ctx.fillRect(r * 0.85, r * 0.1, r * 0.14, r * 0.22);
        break;
      case "mail":
        ctx.fillStyle = C.cream;
        roundRect(-r, -r * 0.65, r * 2, r * 1.3, 2); ctx.fill(); outline(1);
        ctx.strokeStyle = C.coral; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-r, -r * 0.6); ctx.lineTo(0, r * 0.1); ctx.lineTo(r, -r * 0.6); ctx.stroke();
        break;
      case "briefcase":
        ctx.strokeStyle = "#a9785a"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.55); ctx.lineTo(-r * 0.35, -r * 0.85); ctx.lineTo(r * 0.35, -r * 0.85); ctx.lineTo(r * 0.35, -r * 0.55); ctx.stroke();
        ctx.fillStyle = C.peach;
        roundRect(-r, -r * 0.55, r * 2, r * 1.35, 3); ctx.fill(); outline(1);
        ctx.fillStyle = C.butter; ctx.fillRect(-r * 0.15, -r * 0.1, r * 0.3, r * 0.25);
        break;
      case "bucket":
        // a real bucket: tapered body, bands and a wire handle
        ctx.strokeStyle = colors.muted; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, -r * 0.55, r * 0.85, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = C.coral;
        ctx.beginPath();
        ctx.moveTo(-r * 0.95, -r * 0.55); ctx.lineTo(r * 0.95, -r * 0.55);
        ctx.lineTo(r * 0.7, r); ctx.lineTo(-r * 0.7, r); ctx.closePath();
        ctx.fill(); outline(1);
        ctx.fillStyle = "#f6b0a2";
        ctx.beginPath(); ctx.ellipse(0, -r * 0.55, r * 0.95, r * 0.22, 0, 0, Math.PI * 2); ctx.fill(); outline(1);
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-r * 0.86, -r * 0.05); ctx.lineTo(r * 0.86, -r * 0.05);
        ctx.moveTo(-r * 0.78, r * 0.5); ctx.lineTo(r * 0.78, r * 0.5); ctx.stroke();
        break;
      case "badge":
        ctx.fillStyle = C.sky;
        roundRect(-r * 0.8, -r, r * 1.6, r * 2, 3); ctx.fill(); outline(1);
        dot(0, -r * 0.3, r * 0.3, C.cream);
        ctx.fillStyle = C.cream;
        ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 0.45, r * 0.25, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(-r * 0.5, r * 0.5, r, r * 0.12);
        break;
      case "police":
        // a police-style badge: shield with a star
        ctx.fillStyle = "#7f9fd1";
        ctx.beginPath();
        ctx.moveTo(0, -r); ctx.lineTo(r * 0.85, -r * 0.6); ctx.lineTo(r * 0.7, r * 0.4);
        ctx.lineTo(0, r); ctx.lineTo(-r * 0.7, r * 0.4); ctx.lineTo(-r * 0.85, -r * 0.6); ctx.closePath();
        ctx.fill(); outline(1);
        ctx.fillStyle = C.butter;
        ctx.beginPath();
        for (var i = 0; i < 10; i++) {
          var rad = i % 2 ? r * 0.18 : r * 0.42;
          var ang = -Math.PI / 2 + i * Math.PI / 5;
          if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
          else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        }
        ctx.closePath(); ctx.fill();
        break;
      case "lock":
        ctx.strokeStyle = C.lavenderEdge; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.5, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = C.lavender;
        roundRect(-r * 0.75, -r * 0.2, r * 1.5, r * 1.15, 3); ctx.fill(); outline(1);
        dot(0, r * 0.3, r * 0.15, C.ink);
        break;
      case "shield":
        ctx.fillStyle = C.mint;
        ctx.beginPath();
        ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.9, -r * 0.8, r * 0.85, -r * 0.2);
        ctx.quadraticCurveTo(r * 0.7, r * 0.7, 0, r);
        ctx.quadraticCurveTo(-r * 0.7, r * 0.7, -r * 0.85, -r * 0.2);
        ctx.quadraticCurveTo(-r * 0.9, -r * 0.8, 0, -r);
        ctx.fill(); outline(1);
        ctx.strokeStyle = colors.bg; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-r * 0.35, 0); ctx.lineTo(-r * 0.05, r * 0.3); ctx.lineTo(r * 0.4, -r * 0.3); ctx.stroke();
        break;
    }
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
    var lookUp = birds.some(function (bd) { return bd.active && bd.state === "fly" && Math.abs(bd.x - x) < 160; }) ? 1 : 0;
    boy.lookUp = (boy.lookUp || 0) + (lookUp - (boy.lookUp || 0)) * 0.08;
    boy.blink -= 1 / 120;
    if (boy.blink < -0.12) boy.blink = 2.5 + Math.random() * 3;

    ctx.save();
    ctx.translate(x, seatY);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Away helping the phoenix: only his closed laptop waits on the seat.
    if (boyAway()) {
      ctx.scale(1.3, 1.3);
      drawBoyLaptop(0);
      ctx.restore();
      return;
    }

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

    // laptop resting on his lap; the lid closes when the phoenix needs him
    drawBoyLaptop(rescue.laptop);

    // arms reaching to the keyboard; hands bob while typing
    var typing = rescue.laptop === 1;
    var tapA = typing && Math.sin(t * 15) > 0.3 ? -1.2 : 0;
    var tapB = typing && Math.sin(t * 15 + 2) > 0.3 ? -1.2 : 0;
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
    if (rescue.stage === "wait" || rescue.stage === "closing") {
      ctx.arc(3.2, 3, 1, 0, Math.PI * 2);   // "oh!" the bird is hurt
    } else {
      ctx.arc(3, 2.6, 1.6, 0.1 * Math.PI, 0.8 * Math.PI);
    }
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function boyAway() {
    var st = rescue.stage;
    return st !== "none" && st !== "wait" && st !== "closing" && st !== "opening";
  }

  // The laptop on the seat. open = 1 is the lid up with a lit screen,
  // 0 is the lid shut flat on the keyboard. The hinge sits at the front.
  function drawBoyLaptop(open) {
    var lidX = 17;
    if (open > 0.5) {
      // soft screen glow on his face side (small, so it never looks like a disc)
      ctx.globalAlpha = (colors.dark ? 0.22 : 0.14) * (open - 0.5) * 2;
      dot(lidX - 3, -10, 6, C.butter);
      ctx.globalAlpha = 1;
    }
    // keyboard base
    ctx.fillStyle = C.lavender;
    roundRect(1, -2.5, lidX + 1, 3.2, 1.2);
    ctx.fill();
    // lid: swings on the hinge from flat (pointing back) to tilted up
    var hinge = { x: lidX + 1.5, y: -3 };
    var ang = -Math.PI + open * (Math.PI - 1.36);
    var ux = Math.cos(ang), uy = Math.sin(ang);
    ctx.strokeStyle = C.lavender;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hinge.x, hinge.y);
    ctx.lineTo(hinge.x + ux * 17.5, hinge.y + uy * 17.5);
    ctx.stroke();
    if (open > 0.15) {
      // the bright screen faces him
      ctx.globalAlpha = Math.min(1, open * 1.5);
      ctx.strokeStyle = C.cream;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hinge.x + ux * 3 + uy * 1.2, hinge.y + uy * 3 - ux * 1.2);
      ctx.lineTo(hinge.x + ux * 15 + uy * 1.2, hinge.y + uy * 15 - ux * 1.2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // The boy on the ground: climbing the trunk, walking, kneeling to heal
  // the phoenix, and waving it goodbye.
  function drawHelper() {
    if (!boyAway()) return;
    var st = rescue.stage;
    var skin = "#f2c9a5";
    var hair = "#4a3a33";
    var climbing = st === "down" || st === "up";
    var walking = st === "walk" || st === "walkBack";
    var kneel = st === "heal";
    var ph = rescue.t * 10;

    ctx.save();
    ctx.translate(rescue.x, rescue.y);
    ctx.scale(rescue.face, 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    var hip = kneel ? -8 : -14;
    // legs
    ctx.strokeStyle = "#8aa6c9";
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    var feet;
    if (kneel) {
      ctx.moveTo(0, hip); ctx.lineTo(6, hip + 1); ctx.lineTo(6, 0);   // front knee up
      ctx.moveTo(0, hip); ctx.lineTo(-2, 0); ctx.lineTo(-9, 0);      // back knee down
      feet = [[7.5, 0], [-10, -0.5]];
    } else {
      var sw = walking ? Math.sin(ph) * 0.5 : climbing ? Math.sin(ph) * 0.4 : 0;
      feet = [];
      [1, -1].forEach(function (sg) {
        var a = sw * sg;
        var fx = Math.sin(a) * 14 + (climbing ? 3 : 0), fy = hip + Math.cos(a) * 14;
        var kx = Math.sin(a) * 7 + (climbing ? 5 : 1.5), ky = hip + 7;
        ctx.moveTo(0, hip); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy);
        feet.push([fx + 1.5, fy]);
      });
    }
    ctx.stroke();
    feet.forEach(function (f) { dot(f[0], f[1] - 1, 2.6, C.ink); });

    // body
    var bodyTop = hip - 17;
    ctx.fillStyle = C.coral;
    roundRect(-5, bodyTop, 10, 18, 4);
    ctx.fill();

    // arms
    var shX = 1, shY = bodyTop + 3;
    var hands;
    if (climbing) {
      hands = [[8, shY - 6 + Math.sin(ph) * 3], [8, shY + 2 - Math.sin(ph) * 3]];   // gripping the trunk
    } else if (walking) {
      hands = [[Math.sin(ph) * 7, shY + 11], [-Math.sin(ph) * 7, shY + 11]];
    } else if (kneel) {
      var rub = Math.sin(rescue.t * 7) * 1.5;
      hands = [[14 + rub, hip + 1], [12 - rub, hip + 3]];                          // gently on the bird
    } else {
      hands = [[3, shY + 11], [7 + Math.sin(rescue.t * 11) * 3, shY - 13]];        // waving goodbye
    }
    ctx.strokeStyle = skin;
    ctx.lineWidth = 3;
    ctx.beginPath();
    hands.forEach(function (h) { ctx.moveTo(shX, shY); ctx.lineTo(h[0], h[1]); });
    ctx.stroke();
    hands.forEach(function (h) { dot(h[0], h[1], 1.8, skin); });

    // head
    ctx.save();
    ctx.translate(1, bodyTop - 5);
    ctx.rotate(kneel ? 0.35 : climbing ? -0.15 : 0);
    dot(0, 0, 6.5, skin);
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0, -1, 6.8, Math.PI * 0.95, Math.PI * 2.05);
    ctx.lineTo(4, -2);
    ctx.quadraticCurveTo(0, -3.5, -6.5, 0);
    ctx.closePath();
    ctx.fill();
    dot(3.3, 0.5, 1.1, C.ink);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(3, 2.4, 1.8, 0.1 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function drawHearts() {
    hearts.forEach(function (h) {
      ctx.globalAlpha = Math.max(0, Math.min(1, h.life));
      var s = 3.6;
      ctx.fillStyle = h.c;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y + s * 0.9);
      ctx.bezierCurveTo(h.x - s * 1.6, h.y - s * 0.2, h.x - s * 0.6, h.y - s * 1.4, h.x, h.y - s * 0.5);
      ctx.bezierCurveTo(h.x + s * 0.6, h.y - s * 1.4, h.x + s * 1.6, h.y - s * 0.2, h.x, h.y + s * 0.9);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
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
    if (cloud.broken) return;
    var darkness = Math.min(1, cloud.hits / cloud.maxHits);
    var x = cloud.x + Math.sin(time * 60) * cloud.shake, y = cloud.y;
    // Pale on the light theme, soft cream on the dark theme; darker with each hit.
    ctx.globalAlpha = colors.dark ? 0.55 + darkness * 0.4 : 1;
    ctx.fillStyle = cloudColor(darkness);
    ctx.beginPath();
    ctx.arc(x - 18, y + 4, 13, 0, Math.PI * 2);
    ctx.arc(x, y - 4, 17, 0, Math.PI * 2);
    ctx.arc(x + 19, y + 4, 12, 0, Math.PI * 2);
    ctx.rect(x - 18, y + 4, 37, 13);
    ctx.fill();
    ctx.globalAlpha = 1;

    // cracks appear as it weakens
    var cracks = Math.floor(darkness * 5);
    ctx.strokeStyle = colors.dark ? "rgba(20,20,26,0.7)" : "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.3;
    for (var k = 0; k < cracks; k++) {
      var a = k * 2.1 + 0.4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 3);
      ctx.lineTo(x + Math.cos(a + 0.3) * 10, y + Math.sin(a + 0.3) * 7 - 2);
      ctx.lineTo(x + Math.cos(a - 0.2) * 17, y + Math.sin(a - 0.2) * 11);
      ctx.lineTo(x + Math.cos(a + 0.2) * 24, y + Math.sin(a + 0.2) * 13);
      ctx.stroke();
    }

    ctx.fillStyle = darkness > 0.6 ? C.butter : colors.dark ? C.butter : C.coral;
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
    var st = phoenix.state;
    var flap = st === "falling" ? Math.sin(phoenix.t * 26) * 0.9   // flapping in panic
             : st === "hurt" ? 0.55                                // wings limp
             : Math.sin(phoenix.t * (st === "liftoff" ? 14 : 10)) * 0.7;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(phoenix.dir, 1);
    if (st === "falling") ctx.rotate(phoenix.rot);
    if (st === "hurt") ctx.rotate(0.3 + Math.sin(phoenix.t * 3) * 0.03);   // slumped, head down
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
    if (phoenix.mood === "sad") {
      ctx.moveTo(18, -6); ctx.lineTo(23, -1); ctx.lineTo(18, -2);   // beak drooping
    } else {
      ctx.moveTo(18, -6); ctx.lineTo(24, -4); ctx.lineTo(18, -2);
    }
    ctx.fill();
    drawBirdFace(phoenix, 14, -6);
    drawBirdCare(phoenix, 1, 3);
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

  // A bird's eye by mood: bright and round, sad with a brow and a tear,
  // or a happy curve. (ex, ey) is the eye in the bird's own coordinates.
  function drawBirdFace(b, ex, ey) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.1;
    ctx.lineCap = "round";
    if (b.mood === "sad") {
      ctx.beginPath(); ctx.arc(ex, ey - 0.5, 1.8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex - 2.5, ey - 4.5); ctx.lineTo(ex + 2, ey - 3); ctx.stroke();
      var tearY = ey + 3 + ((b.t * 9) % 7);
      ctx.fillStyle = C.sky;
      ctx.beginPath();
      ctx.moveTo(ex - 0.5, tearY - 2.4);
      ctx.quadraticCurveTo(ex - 2.2, tearY + 0.4, ex - 0.5, tearY + 0.9);
      ctx.quadraticCurveTo(ex + 1.2, tearY + 0.4, ex - 0.5, tearY - 2.4);
      ctx.fill();
    } else if (b.mood === "happy") {
      ctx.beginPath(); ctx.arc(ex, ey + 0.8, 1.8, 1.1 * Math.PI, 1.9 * Math.PI); ctx.stroke();
    } else {
      dot(ex, ey, 1.6, C.ink);
      dot(ex + 0.5, ey - 0.6, 0.6, "#fff");
    }
    if (b.state === "hurt") {
      // little stars circling its head
      for (var k = 0; k < 3; k++) {
        var ang = b.t * 4 + k * 2.1;
        dot(ex - 2 + Math.cos(ang) * 9, ey - 10 + Math.sin(ang) * 3, 1.5, C.butter);
      }
    }
  }

  // The plaster the boy puts on, at (px, py) on the bird's side.
  function drawBirdCare(b, px, py) {
    if (!b.bandage) return;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.4);
    ctx.fillStyle = C.cream;
    roundRect(-5, -2, 10, 4, 1.5);
    ctx.fill();
    ctx.strokeStyle = C.rose;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = C.rose;
    ctx.fillRect(-1.5, -1.5, 3, 3);
    ctx.restore();
  }

  // A small round bluebird that flies lower, right at the cloud's height.
  function drawBluebird() {
    var b = bluebird;
    var st = b.state;
    var flap = st === "falling" ? Math.sin(b.t * 30) * 0.9
             : st === "hurt" ? 0.6
             : Math.sin(b.t * 16) * 0.8;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(b.dir, 1);
    if (st === "falling") ctx.rotate(b.rot);
    if (st === "hurt") ctx.rotate(0.3 + Math.sin(b.t * 3) * 0.03);
    // tail
    ctx.fillStyle = C.lavenderEdge;
    ctx.beginPath();
    ctx.moveTo(-6, -1); ctx.lineTo(-15, -5); ctx.lineTo(-14, 2); ctx.closePath();
    ctx.fill();
    // back wing
    ctx.save();
    ctx.rotate(-flap * 0.5);
    ctx.fillStyle = "#7fa6cf";
    ctx.beginPath(); ctx.ellipse(-3, -6, 7, 3.5, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // round body with a cream belly
    dot(0, 0, 8.5, C.sky);
    ctx.fillStyle = C.cream;
    ctx.beginPath(); ctx.ellipse(2, 3, 5.5, 4, 0.2, 0, Math.PI * 2); ctx.fill();
    // beak
    ctx.fillStyle = C.butter;
    ctx.beginPath();
    if (b.mood === "sad") { ctx.moveTo(7.5, -2.5); ctx.lineTo(11, 1.5); ctx.lineTo(7, 0.5); }
    else { ctx.moveTo(7.5, -3); ctx.lineTo(12.5, -1.2); ctx.lineTo(7.5, 0.5); }
    ctx.fill();
    drawBirdFace(b, 4, -3.5);
    drawBirdCare(b, -1, 2);
    // front wing
    ctx.save();
    ctx.rotate(flap);
    ctx.fillStyle = "#8db4dc";
    ctx.beginPath(); ctx.ellipse(-2, -4, 8, 3.8, -0.7, 0, Math.PI * 2); ctx.fill();
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

  // For trying the rescue without waiting: the next shot strays to the bird.
  canvas.rescueSoon = function () { rescue.cooldown = 0; rescue.force = true; };
  canvas.peek = function () {
    return { archer: archerSeat(), stage: rescue.stage, bird: victim.state, victimKind: victim === phoenix ? "phoenix" : "bluebird", helper: { x: rescue.x, y: rescue.y },
             phoenix: { x: victim.x, y: victim.y, active: victim.active }, draw: archer.draw || 0, proud: archer.proud || 0, loot: loot.map(function (l) { return Math.round(l.y); }) };
  };

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
