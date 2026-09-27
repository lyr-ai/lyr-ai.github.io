// Shared helpers for the two design prototypes. Low fidelity on purpose:
// static storyboards, no statistics, no animation. Data is the collapse
// scenario from data.js (the demo scenarios decided by the real engine).
window.P = (() => {
  const S = window.EXPLORER_DATA.scenarios.find(s => s.key === "collapse");
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const count = str => str.split("1").length - 1;
  const short = n => n.split("-")[0];
  const pct = x => `${Math.round(x * 100)}%`;
  const hero = S.tasks.find(t => t.gate === "FIRED");               // the collapsed capability
  const overall = Math.round((S.score.candidate - S.score.baseline) * 100);
  const heroDrop = Math.round((count(hero.candidate) - count(hero.baseline)) / S.trials * 100);
  function frame(title, caption) {
    const f = document.createElement("section");
    f.className = "frame";
    f.innerHTML = `<div class="act">${title}</div>${caption ? `<h2>${caption}</h2>` : ""}`;
    document.querySelector("#frames").appendChild(f);
    return f;
  }
  function contrast(el) {
    el.insertAdjacentHTML("beforeend", `
      <div class="contrast">
        <div><div class="k">Overall</div><div class="big">${overall}</div><div class="s">${pct(S.score.baseline)} → ${pct(S.score.candidate)}</div></div>
        <div class="vs">vs</div>
        <div class="hot"><div class="k">${short(hero.name)}</div><div class="big">${heroDrop}</div><div class="s">${count(hero.baseline)}/${S.trials} → ${count(hero.candidate)}/${S.trials}</div></div>
      </div>`);
  }
  function gates(el) {
    el.insertAdjacentHTML("beforeend", `
      <div class="gates">
        <span><b>Broad reliability</b> <em class="ok">✓ PASS</em></span>
        <span><b>Capability regression</b> <em class="bad">✕ REGRESSION</em></span>
        <span class="verdict">✕ REGRESSION</span>
      </div>`);
  }
  return { S, css, count, short, pct, hero, overall, heroDrop, frame, contrast, gates };
})();
