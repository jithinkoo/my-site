// Admin only: shrink large photos in the browser before upload, so phone
// photos (often 3-8 MB) become ~200-500 KB JPEGs. If anything here isn't
// supported by the browser, the original file is uploaded unchanged.
(function () {
  var MAX_SIDE = 1600;
  var SHRINK_ABOVE = 1.5 * 1024 * 1024;

  function kb(n) {
    return Math.round(n / 1024) + " KB";
  }

  document.querySelectorAll("input[type=file][data-resize]").forEach(function (input) {
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= SHRINK_ABOVE) return;
      if (typeof createImageBitmap !== "function" || typeof DataTransfer !== "function") return;

      var note = input.parentElement.querySelector("[data-resize-note]");

      createImageBitmap(file)
        .then(function (bmp) {
          var scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
          var canvas = document.createElement("canvas");
          canvas.width = Math.round(bmp.width * scale);
          canvas.height = Math.round(bmp.height * scale);
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(
            function (blob) {
              if (!blob || blob.size >= file.size) return;
              var name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
              var dt = new DataTransfer();
              dt.items.add(new File([blob], name, { type: "image/jpeg" }));
              input.files = dt.files;
              if (note) note.textContent = "Resized from " + kb(file.size) + " to " + kb(blob.size) + " for faster loading.";
            },
            "image/jpeg",
            0.85
          );
        })
        .catch(function () {});
    });
  });
})();
