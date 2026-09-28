/* Home: filter the post list by topic card, and sort it.
 * The page works without this script (all posts, newest first). The chosen
 * topic lives in the URL hash (#agent-memory) so a filtered view can be
 * linked; the sort order is remembered per browser. */
(function () {
  var list = document.querySelector(".post-list");
  if (!list) return;
  var items = Array.prototype.slice.call(list.children);
  var topics = Array.prototype.slice.call(document.querySelectorAll(".topic"));
  var sorts = Array.prototype.slice.call(document.querySelectorAll("[data-sort]"));
  var countEl = document.getElementById("list-count");
  var blurbEl = document.getElementById("list-blurb");
  var emptyEl = document.getElementById("list-empty");
  var blurbs = {};
  document.querySelectorAll("template.topic-blurb").forEach(function (t) {
    blurbs[t.dataset.topic] = t.innerHTML.trim();
  });

  var state = { topic: "all", sort: "new" };
  try { state.sort = localStorage.getItem("lyr-home-sort") || "new"; } catch (e) {}

  function apply() {
    var shown = 0;
    items.forEach(function (li) {
      var on = state.topic === "all" || li.dataset.topic === state.topic;
      li.hidden = !on;
      if (on) shown++;
    });
    items.slice().sort(function (a, b) {
      if (state.sort === "az") return a.dataset.title.localeCompare(b.dataset.title);
      var d = Number(a.dataset.date) - Number(b.dataset.date);
      return state.sort === "old" ? d : -d;
    }).forEach(function (li) { list.appendChild(li); });

    topics.forEach(function (a) {
      var on = a.dataset.topic === state.topic;
      a.classList.toggle("is-active", on);
      a.setAttribute("aria-pressed", on ? "true" : "false");
    });
    sorts.forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.sort === state.sort ? "true" : "false");
    });
    countEl.textContent = shown + (shown === 1 ? " post" : " posts");
    blurbEl.textContent = state.topic !== "all" && blurbs[state.topic] ? " — " + blurbs[state.topic] : "";
    emptyEl.hidden = shown !== 0;
  }

  function fromHash() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ""));
    var known = topics.some(function (a) { return a.dataset.topic === h; });
    state.topic = known ? h : "all";
    apply();
  }

  topics.forEach(function (a) {
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      var t = a.dataset.topic;
      history.replaceState(null, "", t === "all" ? location.pathname : "#" + t);
      state.topic = t;
      apply();
      document.querySelector(".list-bar").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  sorts.forEach(function (b) {
    b.addEventListener("click", function () {
      state.sort = b.dataset.sort;
      try { localStorage.setItem("lyr-home-sort", state.sort); } catch (e) {}
      apply();
    });
  });
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
