// Home page quiz: Watch / Quiz tabs, two-option questions, a running timer,
// a counting score, and an Elixir drop that celebrates right answers.
// Answers are checked by the server (/quiz/*); this file only shows them.

(function () {
  "use strict";

  var root = document.querySelector("[data-playground]");
  if (!root) return;

  var tabs = root.querySelectorAll("[data-mode]");
  var scene = root.querySelector("canvas[data-physics]");
  var hintWatch = root.querySelector("[data-hint-watch]");
  var quiz = root.querySelector("[data-quiz]");
  if (!quiz) return;

  var el = {
    high: quiz.querySelector("[data-quiz-high]"),
    score: quiz.querySelector("[data-quiz-score]"),
    gain: quiz.querySelector("[data-quiz-gain]"),
    time: quiz.querySelector("[data-quiz-time]"),
    streak: quiz.querySelector("[data-quiz-streak]"),
    streakN: quiz.querySelector("[data-quiz-streak-n]"),
    card: quiz.querySelector("[data-quiz-card]"),
    mascot: quiz.querySelector("canvas[data-quiz-mascot]")
  };

  var csrf = (document.querySelector("meta[name=csrf-token]") || {}).content;
  var state = null;          // last payload from the server
  var startedLocal = null;   // local clock time the run started (for the timer)
  var shownScore = 0;
  var busy = false;
  var NAME_KEY = "quizName";
  var questionShownAt = 0;
  var thinkTimer = null;
  var thinkInterval = null;
  var THINK_AFTER_MS = 4000;
  var SLOW_WRONG_S = 8;

  var THINKING_LINES = [
    "Hmm… let me think.",
    "My brain is working…",
    "Loading genius… 37%",
    "Both answers look suspicious.",
    "No rush. The timer is only judging a little.",
    "Asking my inner Elixir process…",
    "Thinking harder than a Monday morning.",
    "Gears turning… almost there!"
  ];

  // ---------- Tabs ----------

  function setMode(mode) {
    tabs.forEach(function (tab) {
      var on = tab.dataset.mode === mode;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.classList.toggle("is-active", on);
    });
    var q = mode === "quiz";
    quiz.hidden = !q;
    if (scene) scene.hidden = q;
    if (hintWatch) hintWatch.hidden = q;
    if (q) {
      mascot.start();
      if (!state) resume();
    } else {
      mascot.stop();
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () { setMode(tab.dataset.mode); });
  });

  // ---------- Server ----------

  function api(method, path, body) {
    return fetch(path, {
      method: method,
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json", "x-csrf-token": csrf },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
        return data;
      });
    });
  }

  function resume() {
    api("GET", "/quiz/state").then(function (data) {
      if (data.phase === "idle") {
        renderHigh(data.high, false);
        return;
      }
      apply(data);
    }).catch(function () {});
  }

  function start() {
    if (busy) return;
    busy = true;
    api("POST", "/quiz/start").then(function (data) {
      shownScore = 0;
      el.score.textContent = "0";
      apply(data);
    }).catch(showError).then(function () { busy = false; });
  }

  function answer(choice, button) {
    if (busy) return;
    busy = true;
    var thoughtFor = Math.round((Date.now() - questionShownAt) / 1000);
    stopThinking();
    var buttons = el.card.querySelectorAll(".quiz-option");
    buttons.forEach(function (b) { b.disabled = true; });

    api("POST", "/quiz/answer", { choice: choice }).then(function (data) {
      var r = data.result;
      buttons.forEach(function (b) {
        if (b.dataset.choice === r.correct_choice) b.classList.add("is-right");
      });
      if (!r.correct) button.classList.add("is-wrong");

      var fb = document.createElement("p");
      fb.className = "quiz-feedback " + (r.correct ? "good" : "bad");
      fb.textContent = r.correct
        ? pick(["Correct!", "Spot on!", "Yes! Well done.", "Nailed it!"])
        : thoughtFor >= SLOW_WRONG_S
          ? pick([
              thoughtFor + " seconds of deep thought… nope!",
              "All that thinking… and still a miss!",
              "My brain gears jammed on that one!",
              "Plot twist: the long think didn't help."
            ])
          : pick(["Oops! Not quite.", "Whoa, that one spun me round!", "So close… but no.", "Hmm, my head is spinning!"]);
      el.card.appendChild(fb);

      if (r.correct) {
        countUp(data.score, r.gained);
        mascot.celebrate(data.streak >= 3);
      } else {
        mascot.dizzy();
      }
      updateStreak(data.streak);

      // Wrong answer with a reason: a little speech bubble pops out of the
      // dizzy drop, then fades away by itself after a couple of seconds.
      if (!r.correct && r.explanation) popBubble(r.explanation);

      var wait = r.correct ? 1300 : r.explanation ? 2800 : 1700;
      setTimeout(function () { apply(data); busy = false; }, wait);
    }).catch(function (err) { showError(err); busy = false; });
  }

  function sendName(name) {
    if (busy) return;
    busy = true;
    try { localStorage.setItem(NAME_KEY, name); } catch (e) {}
    api("POST", "/quiz/name", { name: name }).then(apply).catch(showError).then(function () { busy = false; });
  }

  // ---------- Rendering ----------

  function apply(data) {
    state = data;
    startedLocal = Date.now() - data.elapsed_ms;
    if (data.score !== shownScore && !el.score.classList.contains("bump")) {
      shownScore = data.score;
      el.score.textContent = String(data.score);
    }
    updateStreak(data.streak);
    renderHigh(data.high, !!data.new_high);

    if (data.phase === "question") renderQuestion(data.question);
    else if (data.phase === "name") renderName();
    else if (data.phase === "done") renderDone(data);
    else if (data.phase === "empty") renderMessage("Questions are on their way. Check back soon!");
  }

  function renderQuestion(q) {
    clear(el.card);
    el.card.appendChild(tag("p", "quiz-number", "Question " + q.number + " of " + q.total));
    el.card.appendChild(tag("p", "quiz-q", q.text));
    var opts = tag("div", "quiz-options");
    [["a", q.a], ["b", q.b]].forEach(function (pair) {
      var b = tag("button", "quiz-option");
      b.type = "button";
      b.dataset.choice = pair[0];
      b.appendChild(tag("span", "key", pair[0].toUpperCase()));
      b.appendChild(document.createTextNode(pair[1]));
      b.addEventListener("click", function () { answer(pair[0], b); });
      opts.appendChild(b);
    });
    el.card.appendChild(opts);
    startThinkingClock();
  }

  // If a question is taking a while, the drop starts "thinking" out loud.
  function startThinkingClock() {
    stopThinking();
    questionShownAt = Date.now();
    thinkTimer = setTimeout(startThinking, THINK_AFTER_MS);
  }

  function startThinking() {
    if (!state || state.phase !== "question" || busy) return;
    mascot.think();
    var lines = THINKING_LINES.slice().sort(function () { return Math.random() - 0.5; });
    var i = 0;
    var bubble = thinkingBubble();
    bubble.textContent = lines[0];
    thinkInterval = setInterval(function () {
      i = (i + 1) % lines.length;
      bubble.classList.remove("swap");
      void bubble.offsetWidth;
      bubble.classList.add("swap");
      bubble.textContent = lines[i];
    }, 3200);
  }

  function stopThinking() {
    clearTimeout(thinkTimer);
    clearInterval(thinkInterval);
    thinkTimer = thinkInterval = null;
    var old = quiz.querySelector(".quiz-bubble.thinking");
    if (old) old.remove();
    mascot.calm();
  }

  function thinkingBubble() {
    var stage = quiz.querySelector(".quiz-stage");
    var bubble = tag("p", "quiz-bubble thinking");
    bubble.setAttribute("role", "status");
    stage.appendChild(bubble);
    return bubble;
  }

  function renderName() {
    stopThinking();
    clear(el.card);
    el.card.appendChild(tag("p", "quiz-number", "One quick thing"));
    el.card.appendChild(tag("p", "quiz-q", "May I know your name?"));
    var form = tag("form", "quiz-name-form");
    var input = tag("input");
    input.type = "text";
    input.maxLength = 40;
    input.placeholder = "Your name";
    input.setAttribute("aria-label", "Your name");
    try { input.value = localStorage.getItem(NAME_KEY) || ""; } catch (e) {}
    var save = tag("button", "button", "Continue");
    save.type = "submit";
    var skip = tag("button", "button button-quiet", "Skip");
    skip.type = "button";
    form.appendChild(input);
    form.appendChild(save);
    form.appendChild(skip);
    form.addEventListener("submit", function (e) { e.preventDefault(); sendName(input.value); });
    skip.addEventListener("click", function () { sendName(""); });
    el.card.appendChild(form);
    el.card.appendChild(tag("p", "hint", "If you set the high score, this name is shown to everyone."));
    setTimeout(function () { input.focus(); }, 50);
  }

  function renderDone(data) {
    stopThinking();
    clear(el.card);
    var time = formatTime(data.elapsed_ms);
    el.card.appendChild(tag("p", "quiz-number", "All done"));
    el.card.appendChild(tag("p", "quiz-q",
      "You scored " + data.score + " (" + data.correct + " of " + data.total + " right) in " + time + "."));
    if (data.new_high) {
      el.card.appendChild(tag("p", "quiz-feedback good", "New high score! Your name is now at the top for everyone."));
      mascot.celebrate(true);
    } else if (data.high) {
      el.card.appendChild(tag("p", "hint", "The high score to beat is " + data.high.score + " by " + data.high.name + "."));
      mascot.wave();
    } else {
      mascot.wave();
    }
    var actions = tag("div", "quiz-actions");
    var again = tag("button", "button", "Play again");
    again.type = "button";
    again.addEventListener("click", start);
    actions.appendChild(again);
    el.card.appendChild(actions);
    startedLocal = null;
    el.time.textContent = time;
  }

  function renderMessage(text) {
    clear(el.card);
    el.card.appendChild(tag("p", "quiz-q", text));
  }

  function renderHigh(high, isNew) {
    clear(el.high);
    if (high) {
      el.high.appendChild(document.createTextNode("High score "));
      el.high.appendChild(tag("b", null, String(high.score)));
      el.high.appendChild(document.createTextNode(" by "));
      el.high.appendChild(tag("b", null, high.name));
    } else {
      el.high.textContent = "No high score yet. Be the first!";
    }
    el.high.classList.toggle("is-new", isNew);
  }

  function updateStreak(n) {
    var on = n >= 3;
    el.streak.hidden = !on;
    if (on) el.streakN.textContent = String(n);
  }

  function popBubble(text) {
    var stage = quiz.querySelector(".quiz-stage");
    var old = stage.querySelector(".quiz-bubble");
    if (old) old.remove();
    var bubble = tag("p", "quiz-bubble", text);
    bubble.setAttribute("role", "status");
    stage.appendChild(bubble);
    setTimeout(function () { bubble.remove(); }, 2700);
  }

  function showError(err) {
    var p = tag("p", "quiz-feedback bad", err.message || "Something went wrong.");
    el.card.appendChild(p);
  }

  // Count the score up one point at a time, with a "+10" pop.
  function countUp(target, gained) {
    var from = shownScore;
    shownScore = target;
    el.gain.textContent = "+" + gained;
    el.gain.classList.remove("show");
    void el.gain.offsetWidth;
    el.gain.classList.add("show");
    el.score.classList.add("bump");
    var steps = Math.max(1, target - from);
    var i = 0;
    var timer = setInterval(function () {
      i++;
      el.score.textContent = String(from + Math.round((target - from) * (i / steps)));
      if (i >= steps) {
        clearInterval(timer);
        setTimeout(function () { el.score.classList.remove("bump"); }, 500);
      }
    }, 45);
  }

  // The timer is based on when the run started, so it keeps going while
  // the tab is hidden or the window is minimised.
  setInterval(function () {
    if (startedLocal && state && state.phase !== "done") el.time.textContent = formatTime(Date.now() - startedLocal);
  }, 250);

  function formatTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    var h = Math.floor(m / 60);
    var mm = h ? String(m % 60).padStart(2, "0") : String(m);
    return (h ? h + ":" : "") + mm + ":" + String(s % 60).padStart(2, "0");
  }

  function tag(name, cls, text) {
    var n = document.createElement(name);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  var startBtn = quiz.querySelector("[data-quiz-start]");
  if (startBtn) startBtn.addEventListener("click", start);

  // ---------- The Elixir drop mascot ----------
  // Jumps for joy (a real gravity bounce) with confetti when you're right,
  // droops when you're wrong. Little drops rain down on a 3-in-a-row streak.

  var mascot = (function () {
    var canvas = el.mascot;
    var ctx = canvas && canvas.getContext && canvas.getContext("2d");
    var W = 0, H = 0, running = false, last = 0;
    var body = { y: 0, vy: 0, squash: 0, mood: "happy", moodTime: 0, blink: 2 };
    var bits = [];
    var COLORS = ["#f0907a", "#f3d58b", "#a8d5ba", "#a9cbe8", "#c7b3e6", "#eeb0bf"];

    function size() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function ground() { return H - 14; }
    function radius() { return Math.min(W, H) * 0.24; }

    function tick(t) {
      if (!running) return;
      var dt = last ? Math.min(1 / 30, (t - last) / 1000) : 1 / 60;
      last = t;

      // gravity bounce
      var r = radius();
      body.vy += 2200 * dt;
      body.y += body.vy * dt;
      if (body.y > 0) {
        if (body.vy > 300) body.squash = Math.min(0.3, body.vy / 3000);
        body.y = 0;
        body.vy = -body.vy * 0.35;
        if (Math.abs(body.vy) < 60) body.vy = 0;
      }
      body.squash *= Math.exp(-9 * dt);
      body.moodTime -= dt;
      if (body.moodTime <= 0) body.mood = "happy";
      body.blink -= dt;
      if (body.blink < -0.15) body.blink = 2 + Math.random() * 3;

      for (var i = bits.length - 1; i >= 0; i--) {
        var b = bits[i];
        b.vy += (b.drop ? 900 : 700) * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.spin += dt * 8; b.life -= dt;
        if (b.life <= 0 || b.y > H + 20) bits.splice(i, 1);
      }

      draw(r);
      requestAnimationFrame(tick);
    }

    function draw(r) {
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, base = ground();

      // shadow shrinks as the drop jumps
      var lift = Math.min(1, -body.y / (H * 0.5));
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.ellipse(cx, base + 4, r * (0.9 - lift * 0.4), r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, base + body.y);
      ctx.scale(1 + body.squash, 1 - body.squash);
      ctx.translate(0, -r);
      var sad = body.mood === "sad";
      var dizzy = body.mood === "dizzy";
      var now = Date.now() / 1000;
      if (sad) ctx.rotate(Math.sin(now * 8) * 0.03);
      // dizzy: a big wobbly sway, like it's about to topple over
      if (dizzy) {
        ctx.translate(0, r);
        ctx.rotate(Math.sin(now * 5.5) * 0.22);
        ctx.translate(0, -r);
      }
      var thinking = body.mood === "thinking";
      // thinking: a slow, pondering side-to-side tilt
      if (thinking) {
        ctx.translate(0, r);
        ctx.rotate(Math.sin(now * 1.4) * 0.07);
        ctx.translate(0, -r);
      }
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.3);
      ctx.bezierCurveTo(r * 0.85, -r * 0.35, r * 1.02, r * 0.35, 0, r);
      ctx.bezierCurveTo(-r * 1.02, r * 0.35, -r * 0.85, -r * 0.35, 0, -r * 1.3);
      ctx.fillStyle = sad ? "#d8cdea" : "#c7b3e6";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#9c86c9";
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.12, r * 0.24, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // face
      ctx.fillStyle = "#3b3040";
      ctx.strokeStyle = "#3b3040";
      ctx.lineWidth = 2;
      if (thinking) {
        // eyes glancing up and to the side, one eyebrow raised
        var look = Math.sin(now * 0.8) > 0 ? 1 : -1;
        ctx.fillStyle = "#3b3040";
        ctx.beginPath(); ctx.arc(-r * 0.3 + look * r * 0.06, -r * 0.02, r * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.3 + look * r * 0.06, -r * 0.02, r * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-r * 0.42, -r * 0.24); ctx.lineTo(-r * 0.18, -r * 0.2);
        ctx.moveTo(r * 0.18, -r * 0.3); ctx.quadraticCurveTo(r * 0.3, -r * 0.38, r * 0.44, -r * 0.3);
        ctx.stroke();
        // a small "hmm" mouth, pushed to one side
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.05, r * 0.42); ctx.lineTo(r * 0.2, r * 0.38);
        ctx.stroke();
        // thought dots floating up to two turning gears: the brain at work
        for (var d = 0; d < 3; d++) {
          var phase = (now * 0.9 + d / 3) % 1;
          ctx.globalAlpha = 0.35 + 0.65 * Math.sin(phase * Math.PI);
          ctx.fillStyle = "#a9cbe8";
          ctx.beginPath();
          ctx.arc(r * (0.45 + d * 0.18), -r * (1.35 + d * 0.22), 2 + d * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        gear(r * 1.05, -r * 2.05, r * 0.3, now * 2.2, "#f3d58b");
        gear(r * 1.5, -r * 1.75, r * 0.2, -now * 3.3 + 0.3, "#a8d5ba");
      } else if (dizzy) {
        // spiral eyes
        [-1, 1].forEach(function (side) {
          ctx.beginPath();
          for (var a = 0; a < Math.PI * 4; a += 0.3) {
            var rr = (a / (Math.PI * 4)) * r * 0.16;
            var px = side * r * 0.3 + Math.cos(a + now * 6 * side) * rr;
            var py = r * 0.06 + Math.sin(a + now * 6 * side) * rr;
            if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.lineWidth = 1.6;
          ctx.stroke();
        });
        // wavy "uh-oh" mouth
        ctx.beginPath();
        for (var m = -1; m <= 1.001; m += 0.25) {
          var mx = m * r * 0.28, my = r * 0.45 + Math.sin(m * 6 + now * 8) * r * 0.05;
          if (m === -1) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
        }
        ctx.lineWidth = 2;
        ctx.stroke();
        // a sweat drop sliding down
        var sweatY = -r * 0.6 + ((now * 0.9) % 1) * r * 0.9;
        ctx.fillStyle = "#a9cbe8";
        ctx.beginPath();
        ctx.moveTo(r * 0.72, sweatY - 6);
        ctx.quadraticCurveTo(r * 0.72 + 5, sweatY + 1, r * 0.72, sweatY + 5);
        ctx.quadraticCurveTo(r * 0.72 - 5, sweatY + 1, r * 0.72, sweatY - 6);
        ctx.fill();
        // stars circling the head
        for (var s = 0; s < 3; s++) {
          var ang = now * 4 + s * (Math.PI * 2 / 3);
          var sx = Math.cos(ang) * r * 0.85;
          var sy = -r * 1.45 + Math.sin(ang) * r * 0.22;
          star(sx, sy, 5 + Math.sin(ang) * 1.5, s % 2 ? "#f3d58b" : "#f0907a");
        }
      } else if (body.mood === "joy") {
        // ^ ^ eyes
        ctx.beginPath();
        ctx.moveTo(-r * 0.42, r * 0.12); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(-r * 0.18, r * 0.12);
        ctx.moveTo(r * 0.18, r * 0.12); ctx.lineTo(r * 0.3, 0); ctx.lineTo(r * 0.42, r * 0.12);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, r * 0.3, r * 0.26, 0, Math.PI);
        ctx.fillStyle = "#3b3040";
        ctx.fill();
      } else {
        if (body.blink < 0) {
          ctx.beginPath();
          ctx.moveTo(-r * 0.4, r * 0.08); ctx.lineTo(-r * 0.2, r * 0.08);
          ctx.moveTo(r * 0.2, r * 0.08); ctx.lineTo(r * 0.4, r * 0.08);
          ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.08, r * 0.1, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(r * 0.3, r * 0.08, r * 0.1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath();
        if (sad) ctx.arc(0, r * 0.55, r * 0.2, 1.15 * Math.PI, 1.85 * Math.PI);
        else ctx.arc(0, r * 0.3, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(238,140,160,0.5)";
      ctx.beginPath(); ctx.arc(-r * 0.58, r * 0.35, r * 0.11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.58, r * 0.35, r * 0.11, 0, Math.PI * 2); ctx.fill();

      // Arms and little mitten hands: the drop shows how it feels.
      armsFor(body.mood, r, now);
      ctx.restore();

      bits.forEach(function (b) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.spin);
        ctx.globalAlpha = Math.max(0, Math.min(1, b.life));
        ctx.fillStyle = b.color;
        if (b.drop) {
          ctx.beginPath();
          ctx.moveTo(0, -6); ctx.quadraticCurveTo(5, 1, 0, 5); ctx.quadraticCurveTo(-5, 1, 0, -6);
          ctx.fill();
        } else {
          ctx.fillRect(-3, -1.5, 6, 3);
        }
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    }

    // One arm from the shoulder to a mitten hand, with a soft elbow bend.
    function arm(sx, sy, hx, hy, bend, r) {
      var mx = (sx + hx) / 2 + bend * r;
      var my = (sy + hy) / 2 + Math.abs(bend) * r * 0.4;
      ctx.strokeStyle = "#9c86c9";
      ctx.lineWidth = Math.max(2.5, r * 0.09);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, hx, hy);
      ctx.stroke();
      ctx.fillStyle = "#c7b3e6";
      ctx.beginPath();
      ctx.arc(hx, hy, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // a tiny thumb
      ctx.beginPath();
      ctx.arc(hx + (hx > sx ? -1 : 1) * r * 0.1, hy - r * 0.1, r * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = "#c7b3e6";
      ctx.fill();
      ctx.stroke();
    }

    // Body language for each mood (drop-local coordinates, r = size).
    function armsFor(mood, r, now) {
      var L = [-r * 0.82, r * 0.18];   // left shoulder
      var R = [r * 0.82, r * 0.18];    // right shoulder
      var wave, sway;
      switch (mood) {
        case "joy":       // both arms up, hands waving
          wave = Math.sin(now * 14) * r * 0.12;
          arm(L[0], L[1], -r * 1.35, -r * 0.6 + wave, -0.25, r);
          arm(R[0], R[1], r * 1.35, -r * 0.6 - wave, 0.25, r);
          break;
        case "thinking":  // hand on chin, other hand on hip
          arm(R[0], R[1], r * 0.28, r * 0.62, 0.35, r);
          arm(L[0], L[1], -r * 0.95, r * 0.62, -0.45, r);
          break;
        case "dizzy":     // hands clutching the head
          sway = Math.sin(now * 7) * r * 0.06;
          arm(L[0], L[1], -r * 0.62 + sway, -r * 0.82, -0.5, r);
          arm(R[0], R[1], r * 0.62 + sway, -r * 0.82, 0.5, r);
          break;
        case "sad":       // hands together in front, a bit sheepish
          arm(L[0], L[1], -r * 0.2, r * 0.95, -0.3, r);
          arm(R[0], R[1], r * 0.2, r * 0.95, 0.3, r);
          break;
        case "wave":      // a friendly wave with one hand
          wave = Math.sin(now * 9) * r * 0.18;
          arm(L[0], L[1], -r * 1.05, r * 0.75, -0.2, r);
          arm(R[0], R[1], r * 1.3 + wave * 0.4, -r * 0.7 + wave, 0.3, r);
          break;
        default:          // relaxed at the sides, gently swaying
          sway = Math.sin(now * 2) * r * 0.05;
          arm(L[0], L[1], -r * 1.05, r * 0.78 + sway, -0.2, r);
          arm(R[0], R[1], r * 1.05, r * 0.78 - sway, 0.2, r);
      }
    }

    function gear(x, y, radius, angle, color) {
      var teeth = 8;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      for (var i = 0; i < teeth * 2; i++) {
        var a = (i / (teeth * 2)) * Math.PI * 2;
        var rad = i % 2 ? radius * 0.78 : radius;
        ctx.lineTo(Math.cos(a - 0.12) * rad, Math.sin(a - 0.12) * rad);
        ctx.lineTo(Math.cos(a + 0.12) * rad, Math.sin(a + 0.12) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fdf8ef";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function star(x, y, size, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = color;
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var rad = i % 2 ? size * 0.45 : size;
        var a = -Math.PI / 2 + i * Math.PI / 5;
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    return {
      start: function () {
        if (!ctx || running) return;
        size();
        running = true;
        last = 0;
        requestAnimationFrame(tick);
      },
      stop: function () { running = false; },
      celebrate: function (big) {
        body.vy = -Math.sqrt(2 * 2200 * H * (big ? 0.42 : 0.3));
        body.mood = "joy";
        body.moodTime = 1.6;
        var cx = W / 2, cy = ground() - radius();
        for (var i = 0; i < (big ? 60 : 32); i++) {
          bits.push({ x: cx, y: cy, vx: (Math.random() - 0.5) * 360, vy: -Math.random() * 420 - 80,
                      spin: Math.random() * 6, life: 1.2 + Math.random() * 0.6,
                      color: COLORS[i % COLORS.length], drop: false });
        }
        if (big) {
          for (var k = 0; k < 14; k++) {
            bits.push({ x: Math.random() * W, y: -10 - Math.random() * 60, vx: 0, vy: 60 + Math.random() * 80,
                        spin: 0, life: 2.4, color: "#c7b3e6", drop: true });
          }
        }
      },
      sad: function () {
        body.mood = "sad";
        body.moodTime = 1.7;
      },
      // End of a quiz: a friendly wave goodbye.
      wave: function () {
        body.mood = "wave";
        body.moodTime = 4;
      },
      // Taking a while: chin on paw, gears turning, until the answer comes.
      think: function () {
        body.mood = "thinking";
        body.moodTime = 1e9;
      },
      calm: function () {
        if (body.mood === "thinking") {
          body.mood = "happy";
          body.moodTime = 0;
        }
      },
      // Wrong answer: a little stumble hop, then dizzy with stars.
      dizzy: function () {
        body.vy = -Math.sqrt(2 * 2200 * H * 0.08);
        body.mood = "dizzy";
        body.moodTime = 3.5;
      }
    };
  })();

  window.addEventListener("resize", function () { if (!quiz.hidden) { mascot.stop(); mascot.start(); } });
})();
