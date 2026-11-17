// Public site behaviour shared by every page. No libraries.
// (The home page animation lives in scene.js.)
//  1. Photo panel: tap to light it up on touch screens.
//  2. Background photo loop: photos cross-fade one into the next.
//  3. Photo text: fit the box so a right-aligned signature lines up.

(function () {
  "use strict";

  // ---------- 1. Photo panel ----------
  var panel = document.querySelector("[data-photo-panel]");
  if (panel) {
    panel.addEventListener("click", function () {
      panel.classList.toggle("is-lit");
    });
  }

  // ---------- 2. Background photo loop ----------
  // Every few seconds the next photo cross-fades in (CSS does the fade).
  // It pauses while someone is looking at a photo (hover, keyboard focus
  // or tap) and while the tab is hidden.
  var slides = panel ? panel.querySelectorAll(".photo-stack img") : [];
  if (slides.length > 1) {
    var SLIDE_EVERY = 7000;
    var current = 0;
    var looking = false;
    panel.addEventListener("mouseenter", function () { looking = true; });
    panel.addEventListener("mouseleave", function () { looking = false; });
    setInterval(function () {
      var lit = panel.classList.contains("is-lit") || document.activeElement === panel;
      if (document.hidden || looking || lit) return;
      slides[current].classList.remove("is-active");
      current = (current + 1) % slides.length;
      slides[current].classList.add("is-active");
    }, SLIDE_EVERY);
  }

  // ---------- Gallery: click a photo to see it large ----------
  // Without JavaScript the link simply opens the photo.
  var dialog = document.querySelector("[data-lightbox-dialog]");
  if (dialog && typeof dialog.showModal === "function") {
    var bigImg = dialog.querySelector("[data-lightbox-img]");
    var bigCaption = dialog.querySelector("[data-lightbox-caption]");
    document.querySelectorAll("a[data-lightbox]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        bigImg.src = link.getAttribute("href");
        bigImg.alt = link.dataset.caption || "";
        var parts = [link.dataset.caption, link.dataset.place].filter(Boolean);
        bigCaption.textContent = parts.join(" · ");
        dialog.showModal();
      });
    });
    dialog.querySelector("[data-lightbox-close]").addEventListener("click", function () {
      dialog.close();
    });
    // click outside the photo closes it
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
  }

  // ---------- 3. Photo text ----------
  // Fit the photo text box to its longest wrapped line, so a right-aligned
  // "— Name" signature ends exactly where the quote ends. (CSS alone sizes
  // a wrapped box to its maximum width, not to its longest line.)
  var caption = document.querySelector(".photo-caption");
  function fitCaption() {
    if (!caption) return;
    caption.style.width = "";
    var left = caption.getBoundingClientRect().left;
    var right = left;
    caption.querySelectorAll(".caption-line:not(.photo-signature)").forEach(function (line) {
      var range = document.createRange();
      range.selectNodeContents(line);
      Array.prototype.forEach.call(range.getClientRects(), function (r) {
        if (r.width > 0) right = Math.max(right, r.right);
      });
    });
    if (right > left) caption.style.width = Math.ceil(right - left + 1) + "px";
  }
  if (caption) {
    fitCaption();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitCaption);
    var fitTimer;
    window.addEventListener("resize", function () {
      clearTimeout(fitTimer);
      fitTimer = setTimeout(fitCaption, 120);
    });
  }
})();
