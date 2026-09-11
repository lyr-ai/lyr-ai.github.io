/* Click a figure to see it full size.
 *
 * Diagrams in these posts are wider than the text measure -- one is 4800px --
 * so inline they are unreadable. Each figure image becomes a link to the file
 * itself, which keeps cmd-click and no-JS working, and clicking opens an
 * overlay. In the overlay the image starts fit-to-screen; clicking it again
 * switches to 1:1 and lets you scroll around, which is the only way to read
 * a wide flow diagram.
 */
(function () {
  "use strict";

  var figures = document.querySelectorAll(".post figure img");
  if (!figures.length) return;

  var overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="lightbox-scroll"><img alt=""></div>' +
    '<p class="lightbox-caption"></p>' +
    '<button class="lightbox-close" aria-label="Close">esc</button>';
  document.body.appendChild(overlay);

  var scroll = overlay.querySelector(".lightbox-scroll");
  var full = overlay.querySelector("img");
  var caption = overlay.querySelector(".lightbox-caption");
  var lastFocus = null;

  function open(img) {
    lastFocus = document.activeElement;
    full.src = img.currentSrc || img.src;
    full.alt = img.alt || "";
    var figcaption = img.closest("figure").querySelector("figcaption");
    caption.textContent = figcaption ? figcaption.textContent : "";
    overlay.classList.remove("is-actual");
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    overlay.querySelector(".lightbox-close").focus();
  }

  function close() {
    overlay.hidden = true;
    full.removeAttribute("src");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  Array.prototype.forEach.call(figures, function (img) {
    var href = img.getAttribute("src");
    var link = document.createElement("a");
    link.href = href;
    link.className = "zoom";
    link.setAttribute("aria-label", "View full size");
    img.parentNode.insertBefore(link, img);
    link.appendChild(img);

    link.addEventListener("click", function (event) {
      // Leave modified clicks alone so "open in new tab" still works.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      open(img);
    });
  });

  full.addEventListener("click", function (event) {
    event.stopPropagation();
    overlay.classList.toggle("is-actual");
    if (overlay.classList.contains("is-actual")) {
      // Centre the 1:1 view rather than dumping the reader at the far left.
      scroll.scrollLeft = (scroll.scrollWidth - scroll.clientWidth) / 2;
    }
  });

  overlay.addEventListener("click", close);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !overlay.hidden) close();
  });
})();
