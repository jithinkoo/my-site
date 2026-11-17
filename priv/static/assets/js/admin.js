// Admin only: shrink large photos in the browser before upload, so phone
// photos (often 3-8 MB) become ~200-500 KB JPEGs. Works for one file or
// many. If anything isn't supported, the original files upload unchanged.
(function () {
  var MAX_SIDE = 1600;
  var SHRINK_ABOVE = 1.5 * 1024 * 1024;

  function kb(n) {
    return Math.round(n / 1024) + " KB";
  }

  // Resolves to a smaller JPEG File, or the original file if not worth it.
  function shrink(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= SHRINK_ABOVE) {
      return Promise.resolve(file);
    }
    return createImageBitmap(file)
      .then(function (bmp) {
        var scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        return new Promise(function (resolve) {
          canvas.toBlob(
            function (blob) {
              if (!blob || blob.size >= file.size) return resolve(file);
              var name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
              resolve(new File([blob], name, { type: "image/jpeg" }));
            },
            "image/jpeg",
            0.85
          );
        });
      })
      .catch(function () {
        return file;
      });
  }

  document.querySelectorAll("input[type=file][data-resize]").forEach(function (input) {
    input.addEventListener("change", function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length) return;
      if (typeof createImageBitmap !== "function" || typeof DataTransfer !== "function") return;

      var note = input.parentElement.querySelector("[data-resize-note]");
      var before = files.reduce(function (sum, f) { return sum + f.size; }, 0);

      Promise.all(files.map(shrink)).then(function (smaller) {
        var after = smaller.reduce(function (sum, f) { return sum + f.size; }, 0);
        if (after >= before) return;
        var dt = new DataTransfer();
        smaller.forEach(function (f) { dt.items.add(f); });
        input.files = dt.files;
        if (note) {
          var what = files.length === 1 ? "" : files.length + " photos ";
          note.textContent = "Resized " + what + "from " + kb(before) + " to " + kb(after) + " for faster loading.";
        }
      });
    });
  });
})();
