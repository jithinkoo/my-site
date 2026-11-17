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
      fb.textContent = r.correct ? pick(["Correct! 🎉", "Spot on!", "Yes! Well done.", "Nailed it!"]) : "Not quite. The right answer is highlighted.";
      el.card.appendChild(fb);

      if (r.correct) {
        countUp(data.score, r.gained);
        mascot.celebrate(data.streak >= 3);
      } else {
        mascot.sad();
      }
      updateStreak(data.streak);

      setTimeout(function () { apply(data); busy = false; }, r.correct ? 1300 : 1700);
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
  }

  function renderName() {
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
    clear(el.card);
    var time = formatTime(data.elapsed_ms);
    el.card.appendChild(tag("p", "quiz-number", "All done"));
    el.card.appendChild(tag("p", "quiz-q",
      "You scored " + data.score + " (" + data.correct + " of " + data.total + " right) in " + time + "."));
    if (data.new_high) {
      el.card.appendChild(tag("p", "quiz-feedback good", "🏆 New high score! Your name is now at the top for everyone."));
      mascot.celebrate(true);
    } else if (data.high) {
      el.card.appendChild(tag("p", "hint", "The high score to beat is " + data.high.score + " by " + data.high.name + "."));
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
      el.high.appendChild(document.createTextNode("🏆 High score "));
      el.high.appendChild(tag("b", null, String(high.score)));
      el.high.appendChild(document.createTextNode(" by "));
      el.high.appendChild(tag("b", null, high.name));
    } else {
      el.high.textContent = "🏆 No high score yet. Be the first!";
    }
    el.high.classList.toggle("is-new", isNew);
  }

  function updateStreak(n) {
    var on = n >= 3;
    el.streak.hidden = !on;
    if (on) el.streakN.textContent = String(n);
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
      if (sad) ctx.rotate(Math.sin(Date.now() / 120) * 0.03);
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
      if (body.mood === "joy") {
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

      // little arms up when celebrating
      if (body.mood === "joy") {
        ctx.strokeStyle = "#9c86c9";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, r * 0.1); ctx.lineTo(-r * 1.25, -r * 0.45);
        ctx.moveTo(r * 0.85, r * 0.1); ctx.lineTo(r * 1.25, -r * 0.45);
        ctx.stroke();
      }
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
      }
    };
  })();

  window.addEventListener("resize", function () { if (!quiz.hidden) { mascot.stop(); mascot.start(); } });
})();
