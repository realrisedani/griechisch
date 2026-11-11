/* Ελληνικά · 20 Minuten am Tag
   Vanilla JS, kein Build-Schritt. Fortschritt liegt lokal auf dem Gerät (localStorage). */
(() => {
  "use strict";

  const APP_VERSION = "1.0.0";
  const STORE_KEY = "ellinika_v1";
  const ZIEL = 700;
  const DAY = 86400000;
  const CARDS = window.WOERTER.map((r) => ({ id: r[0], el: r[1], de: r[2], typ: r[3], set: r[4], bspEl: r[5], bspDe: r[6], info: r[7] || "" }));
  const BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
  const TYP_LABEL = { verb: "Verb", nomen: "Nomen", adj: "Adjektiv", pron: "Pronomen", art: "Artikel", part: "Partikel", konj: "Verbindung", praep: "Präposition", adv: "Adverb", frage: "Fragewort", zeit: "Zeit", ort: "Ort", floskel: "Floskel", zahl: "Zahl" };

  // ---------- State ----------
  const defaults = () => ({
    c: {},                 // Kartenfortschritt
    sc: {},                // Selbst-Check-Antworten (kern)
    selfcheckDone: false,
    settings: { neu: 6, minuten: 20, tts: true },
    log: {},               // Tag -> { rev, neu, ok, sek }
    streak: 0, lastDay: null
  });
  let S = load();
  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) return Object.assign(defaults(), JSON.parse(raw)); } catch (e) {}
    return defaults();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {} }
  function prog(id) { return S.c[id] || (S.c[id] = { s: "new", ivl: 0, ease: 2.5, due: 0, reps: 0, lapses: 0 }); }
  function today() { const d = new Date(); return d.toISOString().slice(0, 10); }
  function dayLog() { const t = today(); return S.log[t] || (S.log[t] = { rev: 0, neu: 0, ok: 0, sek: 0 }); }
  function dueAt(days) { const d = new Date(); d.setHours(4, 0, 0, 0); return d.getTime() + Math.round(days) * DAY; }

  // ---------- SRS (SM-2 light) ----------
  // grade: 0 nochmal, 1 schwer, 2 gut, 3 leicht
  function grade(id, g) {
    const p = prog(id); const now = Date.now();
    p.reps++;
    if (p.s === "new" || p.s === "learn") {
      if (g === 0) { p.s = "learn"; p.due = now + 60000; }
      else if (g === 1) { p.s = "learn"; p.due = now + 10 * 60000; }
      else { p.s = "review"; p.ivl = g === 3 ? 4 : 1; p.due = dueAt(p.ivl); }
    } else {
      if (g === 0) { p.lapses++; p.ease = Math.max(1.3, p.ease - 0.2); p.ivl = 1; p.s = "learn"; p.due = now + 10 * 60000; }
      else if (g === 1) { p.ease = Math.max(1.3, p.ease - 0.15); p.ivl = Math.max(1, Math.round(p.ivl * 1.2)); p.due = dueAt(p.ivl); }
      else if (g === 2) { p.ivl = Math.max(p.ivl + 1, Math.round(p.ivl * p.ease)); p.due = dueAt(p.ivl); }
      else { p.ease += 0.15; p.ivl = Math.max(p.ivl + 2, Math.round(p.ivl * p.ease * 1.3)); p.due = dueAt(p.ivl); }
      if (p.ivl >= 21) p.s = "known";
    }
    save();
  }
  function markKnown(id) { const p = prog(id); p.s = "review"; p.ivl = 5; p.ease = 2.6; p.due = dueAt(5); p.reps++; save(); }
  function markUnsure(id) { const p = prog(id); p.s = "review"; p.ivl = 1; p.ease = 2.3; p.due = dueAt(1); p.reps++; save(); }
  function resetCard(id) { S.c[id] = { s: "new", ivl: 0, ease: 2.5, due: 0, reps: 0, lapses: 0 }; save(); }

  function counts() {
    const n = { new: 0, learn: 0, review: 0, known: 0 };
    CARDS.forEach((c) => n[prog(c.id).s]++);
    return n;
  }
  function dueCards() {
    const now = Date.now();
    return CARDS.filter((c) => { const p = prog(c.id); return (p.s === "review" || p.s === "learn" || p.s === "known") && p.due <= now; })
      .sort((a, b) => prog(a.id).due - prog(b.id).due);
  }
  function newCandidates(n) {
    const order = window.SET_ORDER;
    return CARDS.filter((c) => prog(c.id).s === "new")
      .sort((a, b) => order.indexOf(a.set) - order.indexOf(b.set) || a.id.localeCompare(b.id))
      .slice(0, n);
  }

  // ---------- TTS ----------
  let voice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const vs = speechSynthesis.getVoices();
    voice = vs.find((v) => /^el/i.test(v.lang) && /premium|enhanced|melina|nikos/i.test(v.name)) || vs.find((v) => /^el/i.test(v.lang)) || null;
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text, rate) {
    if (!("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[;]/g, "?"));
      u.lang = "el-GR"; if (voice) u.voice = voice; u.rate = rate || 0.9;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ---------- Helpers ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const view = $("#view");
  function h(html) { view.innerHTML = html; view.scrollTop = 0; window.scrollTo(0, 0); }
  function esc(s) { return String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m])); }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function toast(msg, action, fn) {
    const t = $("#toast"); t.innerHTML = esc(msg) + (action ? `<button id="toast-act">${esc(action)}</button>` : ""); t.hidden = false;
    if (action) $("#toast-act").onclick = () => { t.hidden = true; fn && fn(); };
    clearTimeout(toast._t); toast._t = setTimeout(() => { if (!action) t.hidden = true; }, 2600);
  }
  function fmtTime(sec) { const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, "0")}`; }
  function speakBtn(text, cls, asSpan) { const tag = asSpan ? "span" : "button"; return `<${tag} class="speak ${cls || ""}" data-say="${esc(text)}" role="button" aria-label="Aussprache">♪</${tag}>`; }
  function stripAccents(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function clozeOf(card) {
    const base = card.el.replace(/^(ο|η|το|τα|οι)\s+/u, "").split(/[\s\/(;]/)[0];
    if (base.length < 3) return null;
    const key = stripAccents(base).slice(0, Math.min(4, base.length));
    const tokens = card.bspEl.split(" ");
    const idx = tokens.findIndex((t) => stripAccents(t.replace(/[.,;!?«»]/g, "")).startsWith(key));
    if (idx < 0) return null;
    const word = tokens[idx].replace(/[.,;!?«»]/g, "");
    const punct = tokens[idx].slice(word.length);
    const blank = "_".repeat(Math.max(4, word.length));
    return { text: tokens.map((t, i) => (i === idx ? `<span class="cloze">${blank}</span>${esc(punct)}` : esc(t))).join(" "), word };
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-say]"); if (b) { e.preventDefault(); speak(b.dataset.say); }
  });

  // ---------- Router ----------
  let current = "home";
  function go(name, arg) {
    current = name;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
    ({ home, woerter, muster, mehr, selfcheck, session, detail }[name] || home)(arg);
  }
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) { if (sessionActive && !confirm("Session abbrechen? Dein Fortschritt bis hier bleibt gespeichert.")) return; endSessionSilently(); go(b.dataset.view); } });

  // ---------- Home ----------
  function home() {
    const n = counts(); const due = dueCards().length; const lg = dayLog();
    const gelernt = n.review + n.known; const pct = Math.min(100, Math.round((gelernt / ZIEL) * 100));
    const kernOffen = CARDS.filter((c) => c.set === "kern" && !S.sc[c.id]).length;
    const hour = new Date().getHours();
    const gruss = hour < 12 ? "Καλημέρα" : hour < 18 ? "Καλησπέρα" : "Καλό βράδυ";
    h(`
      <h1>${gruss}, Dani.</h1>
      <p class="muted">${S.streak > 0 ? `${S.streak} Tag${S.streak === 1 ? "" : "e"} in Folge.` : "Heute ist ein guter Tag zum Anfangen."}</p>
      <div class="stat-row">
        <div class="stat"><b>${gelernt}</b><span>gelernt</span></div>
        <div class="stat"><b>${n.learn}</b><span>in Arbeit</span></div>
        <div class="stat"><b>${due}</b><span>heute fällig</span></div>
      </div>
      <div class="card">
        <div class="small muted">Ziel: ${ZIEL} Wörter · ${CARDS.length} im System</div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="small muted">${pct} % · ${n.known} sitzen fest</div>
      </div>
      ${!S.selfcheckDone ? `
        <div class="card">
          <div class="tag">Tag 1</div>
          <h2 style="margin-top:0">Selbst-Check: Kern-100</h2>
          <p>Die 100 häufigsten Wörter einzeln. Du sagst nur: kenn ich, unsicher, kenn ich nicht. Daraus baut sich dein Plan. Etwa 5 Minuten.</p>
          <button class="btn" id="b-sc">Selbst-Check starten${kernOffen < 100 ? ` (${100 - kernOffen}/100)` : ""}</button>
        </div>` : ""}
      <button class="btn ${S.selfcheckDone ? "" : "sec"}" id="b-sess">Session starten · ${S.settings.minuten} Min</button>
      <div class="card flat small muted">
        Heute: ${lg.rev} wiederholt · ${lg.neu} neu · ${Math.round(lg.sek / 60)} Min.<br>
        Vor der Metro: oben rechts muss „Offline bereit“ stehen. Dann läuft alles ohne Netz.
      </div>
    `);
    $("#b-sc") && ($("#b-sc").onclick = () => go("selfcheck"));
    $("#b-sess").onclick = () => startSession();
  }

  // ---------- Selbst-Check ----------
  function selfcheck() {
    const rest = CARDS.filter((c) => c.set === "kern" && !S.sc[c.id]);
    if (!rest.length) {
      S.selfcheckDone = true; save();
      const k = Object.values(S.sc); const kn = k.filter((v) => v === "k").length, un = k.filter((v) => v === "u").length, no = k.filter((v) => v === "n").length;
      h(`<div class="card summary center">
          <div class="tag">Selbst-Check fertig</div>
          <b class="big">${kn}</b><p>von 100 Kernwörtern kennst du schon.</p>
          <div class="stat-row"><div class="stat"><b>${kn}</b><span>kenn ich</span></div><div class="stat"><b>${un}</b><span>unsicher</span></div><div class="stat"><b>${no}</b><span>neu</span></div></div>
          <p class="small muted">Bekannte kommen in 5 Tagen einmal zur Bestätigung. Unsichere morgen. Neue baust du ab jetzt in den Sessions auf, ${S.settings.neu} pro Tag.</p>
          <button class="btn" id="b-go">Erste Session starten</button>
          <button class="btn ghost" id="b-home">Zur Übersicht</button>
        </div>`);
      $("#b-go").onclick = () => startSession(); $("#b-home").onclick = () => go("home");
      return;
    }
    const c = rest[0]; const done = 100 - rest.length;
    h(`
      <div class="session-head"><span class="phase">Selbst-Check</span><span>${done + 1} / 100</span></div>
      <div class="bar"><i style="width:${done}%"></i></div>
      <div class="card flash">
        <div class="tag">${TYP_LABEL[c.typ] || c.typ}</div>
        <div class="word">${esc(c.el)}</div>
        ${speakBtn(c.el)}
        <div id="ans" class="answer hidden">
          <div class="word de">${esc(c.de)}</div>
          <div class="bsp">${esc(c.bspEl)}<span class="de">${esc(c.bspDe)}</span></div>
          ${c.info ? `<div class="info">${esc(c.info)}</div>` : ""}
        </div>
        <button class="btn ghost" id="b-show" style="margin-top:18px">Bedeutung zeigen</button>
      </div>
      <div class="row">
        <button class="btn green" data-sc="k">Kenn ich</button>
        <button class="btn amber" data-sc="u">Unsicher</button>
        <button class="btn red" data-sc="n">Kenn ich nicht</button>
      </div>
      <p class="small muted center">Ehrlich sein zahlt sich aus: „Kenn ich“ nur, wenn du es auch selbst sagen würdest.</p>
    `);
    if (S.settings.tts) speak(c.el);
    $("#b-show").onclick = () => { $("#ans").classList.remove("hidden"); $("#b-show").classList.add("hidden"); };
    view.querySelectorAll("[data-sc]").forEach((b) => b.onclick = () => {
      const v = b.dataset.sc; S.sc[c.id] = v;
      if (v === "k") markKnown(c.id); else if (v === "u") markUnsure(c.id); else resetCard(c.id);
      save(); selfcheck();
    });
  }

  // ---------- Session ----------
  let sessionActive = false, sess = null, tick = null;
  function startSession() {
    const minuten = S.settings.minuten;
    const q = dueCards().map((c) => c.id);
    const neu = S.selfcheckDone ? newCandidates(S.settings.neu).map((c) => c.id) : [];
    sess = { start: Date.now(), ende: Date.now() + minuten * 60000, q, neu, phase: "review", rev: 0, neuN: 0, ok: 0, again: {}, satz: 0, satzOk: 0 };
    sessionActive = true;
    if (!q.length && !neu.length) { sess.phase = "satzbau"; }
    clearInterval(tick); tick = setInterval(updateTimer, 1000);
    step();
  }
  function endSessionSilently() { sessionActive = false; clearInterval(tick); sess = null; }
  function remaining() { return Math.max(0, Math.round((sess.ende - Date.now()) / 1000)); }
  function updateTimer() {
    if (!sess) return;
    const el = $("#timer"); if (el) { el.textContent = fmtTime(remaining()); el.classList.toggle("low", remaining() < 120); }
    if (remaining() <= 0) finish();
  }
  function head(phase, extra) {
    return `<div class="session-head"><span class="phase">${phase}</span><span>${extra || ""}</span><span class="timer" id="timer">${fmtTime(remaining())}</span></div>`;
  }
  function step() {
    if (!sess) return;
    if (remaining() <= 0) return finish();
    if (sess.phase === "review") {
      if (sess.q.length) return showReview(sess.q.shift());
      sess.phase = "neu";
    }
    if (sess.phase === "neu") {
      if (sess.neu.length) return showNew(sess.neu.shift());
      sess.phase = sess.q.length ? "check" : "satzbau";
    }
    if (sess.phase === "check") {
      if (sess.q.length) return showReview(sess.q.shift(), true);
      sess.phase = "satzbau";
    }
    if (sess.phase === "satzbau") {
      if (sess.satz < 6) return showSatzbau();
      return finish();
    }
  }
  function session() { if (!sess) return startSession(); step(); }

  function showReview(id, isCheck) {
    const c = BY_ID[id]; const p = prog(id);
    const dirEl = isCheck ? true : p.reps % 2 === 0;        // gerade Wiederholungen: Griechisch zeigen
    const cz = !isCheck && p.reps >= 2 && p.reps % 3 === 2 ? clozeOf(c) : null;
    const front = cz ? `<div class="tag">Lückentext</div><div class="bsp" style="font-size:24px;font-weight:600">${cz.text}</div><div class="hint">${esc(c.bspDe)}</div>`
      : dirEl ? `<div class="tag">${TYP_LABEL[c.typ] || c.typ}</div><div class="word">${esc(c.el)}</div>${speakBtn(c.el)}<div class="hint">Was heißt das?</div>`
      : `<div class="tag">${TYP_LABEL[c.typ] || c.typ}</div><div class="word de">${esc(c.de)}</div><div class="hint">Wie sagst du das auf Griechisch?</div>`;
    h(`
      ${head(isCheck ? "Neue festigen" : "Wiederholen", `${sess.q.length + 1} offen`)}
      <div class="card flash">
        ${front}
        <div id="ans" class="answer hidden">
          ${dirEl && !cz ? `<div class="word de">${esc(c.de)}</div>` : `<div class="word">${esc(cz ? cz.word : c.el)}</div>${speakBtn(cz ? c.bspEl : c.el)}`}
          <div class="bsp">${esc(c.bspEl)}<span class="de">${esc(c.bspDe)}</span></div>
          ${c.info ? `<div class="info">${esc(c.info)}</div>` : ""}
        </div>
        <button class="btn" id="b-show" style="margin-top:18px">Antwort zeigen</button>
      </div>
      <div id="grade" class="grade hidden">
        <button class="btn red" data-g="0">Nochmal<small>gleich wieder</small></button>
        <button class="btn amber" data-g="1">Schwer<small>in 10 Min</small></button>
        <button class="btn sec" data-g="2">Gut<small>${p.s === "new" || p.s === "learn" ? "morgen" : Math.max(p.ivl + 1, Math.round(p.ivl * p.ease)) + " Tage"}</small></button>
        <button class="btn green" data-g="3">Leicht<small>${p.s === "new" || p.s === "learn" ? "4 Tage" : Math.max(p.ivl + 2, Math.round(p.ivl * p.ease * 1.3)) + " Tage"}</small></button>
      </div>
    `);
    if (dirEl && !cz && S.settings.tts) speak(c.el);
    $("#b-show").onclick = () => {
      $("#ans").classList.remove("hidden"); $("#grade").classList.remove("hidden"); $("#b-show").classList.add("hidden");
      if ((!dirEl || cz) && S.settings.tts) speak(cz ? c.bspEl : c.el);
    };
    view.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => {
      const g = +b.dataset.g; grade(id, g);
      sess.rev++; if (g >= 2) sess.ok++;
      const lg = dayLog(); lg.rev++; if (g >= 2) lg.ok++;
      if (g <= 1) { sess.again[id] = (sess.again[id] || 0) + 1; if (sess.again[id] <= 3) sess.q.push(id); }
      save(); step();
    });
  }

  function showNew(id) {
    const c = BY_ID[id];
    h(`
      ${head("Neu lernen", `${sess.neu.length + 1} neue`)}
      <div class="card flash">
        <div class="tag">${TYP_LABEL[c.typ] || c.typ} · ${window.SETS[c.set]}</div>
        <div class="word">${esc(c.el)}</div>
        ${speakBtn(c.el)}
        <div class="answer">
          <div class="word de">${esc(c.de)}</div>
          <div class="bsp">${esc(c.bspEl)} ${speakBtn(c.bspEl, "sm")}<span class="de">${esc(c.bspDe)}</span></div>
          ${c.info ? `<div class="info">${esc(c.info)}</div>` : ""}
        </div>
      </div>
      <p class="small muted center">Einmal laut nachsprechen, dann weiter. Gleich kommt es noch einmal zur Abfrage.</p>
      <button class="btn" id="b-next">Hab ich, weiter</button>
      <button class="btn ghost" id="b-known">Kenne ich schon sicher</button>
    `);
    if (S.settings.tts) speak(c.el);
    $("#b-next").onclick = () => { const p = prog(id); p.s = "learn"; p.due = Date.now(); save(); sess.q.push(id); sess.neuN++; dayLog().neu++; save(); step(); };
    $("#b-known").onclick = () => { markKnown(id); sess.neuN++; dayLog().neu++; save(); step(); };
  }

  function showSatzbau() {
    const pool = CARDS.filter((c) => prog(c.id).s !== "new").filter((c) => { const n = c.bspEl.split(" ").length; return n >= 3 && n <= 8; });
    const src = pool.length >= 5 ? pool : CARDS.filter((c) => c.set === "kern" && c.bspEl.split(" ").length >= 3 && c.bspEl.split(" ").length <= 8);
    const c = src[Math.floor(Math.random() * src.length)];
    const tokens = c.bspEl.split(" "); const order = shuffle(tokens.map((_, i) => i));
    let built = [];
    sess.satz++;
    h(`
      ${head("Satzbau", `${sess.satz} / 6`)}
      <div class="card">
        <div class="tag">Baue den Satz</div>
        <p style="font-size:19px;margin-bottom:4px">${esc(c.bspDe)}</p>
        <div class="built" id="built"></div>
        <div class="tiles" id="tiles">${order.map((i) => `<button class="tile" data-i="${i}">${esc(tokens[i])}</button>`).join("")}</div>
        <div id="result" class="center hidden"></div>
        <div class="row"><button class="btn ghost sm" id="b-undo">Zurück</button><button class="btn ghost sm" id="b-skip">Überspringen</button></div>
      </div>
    `);
    const render = () => {
      $("#built").innerHTML = built.map((i) => `<span class="tile">${esc(tokens[i])}</span>`).join("") || `<span class="muted small">Tippe die Wörter in der richtigen Reihenfolge</span>`;
      view.querySelectorAll("#tiles .tile").forEach((t) => t.classList.toggle("used", built.includes(+t.dataset.i)));
      if (built.length === tokens.length) check();
    };
    const check = () => {
      const ok = built.every((i, k) => i === k) || built.map((i) => tokens[i]).join(" ") === c.bspEl;
      $("#built").classList.add(ok ? "ok" : "bad");
      $("#result").classList.remove("hidden");
      $("#result").innerHTML = `<p class="${ok ? "ok-text" : "bad-text"}">${ok ? "Richtig." : "Richtig wäre:"}</p>
        <p style="font-size:20px;font-weight:600">${esc(c.bspEl)} ${speakBtn(c.bspEl, "sm")}</p>
        <button class="btn" id="b-next">Weiter</button>`;
      if (ok) sess.satzOk++;
      if (S.settings.tts) speak(c.bspEl);
      $("#b-next").onclick = () => step();
      $("#b-undo").disabled = true;
    };
    render();
    view.querySelectorAll("#tiles .tile").forEach((t) => t.onclick = () => { built.push(+t.dataset.i); render(); });
    $("#b-undo").onclick = () => { built.pop(); render(); };
    $("#b-skip").onclick = () => step();
  }

  function finish() {
    if (!sess) return;
    const sek = Math.round((Date.now() - sess.start) / 1000);
    const lg = dayLog(); lg.sek += sek;
    const t = today();
    if (S.lastDay !== t) {
      const y = new Date(Date.now() - DAY).toISOString().slice(0, 10);
      S.streak = S.lastDay === y ? S.streak + 1 : 1; S.lastDay = t;
    }
    save();
    const quote = sess.rev ? Math.round((sess.ok / sess.rev) * 100) : null;
    const s = sess; endSessionSilently();
    h(`<div class="card summary center">
        <div class="tag">Session fertig</div>
        <b class="big">${fmtTime(sek)}</b><p class="muted">Minuten heute</p>
        <div class="stat-row">
          <div class="stat"><b>${s.rev}</b><span>wiederholt</span></div>
          <div class="stat"><b>${s.neuN}</b><span>neu</span></div>
          <div class="stat"><b>${quote === null ? "–" : quote + " %"}</b><span>gewusst</span></div>
        </div>
        <p class="small muted">Satzbau: ${s.satzOk} von ${s.satz} richtig. ${S.streak > 1 ? `${S.streak} Tage in Folge.` : ""}</p>
        <p class="small">Wochen-Mission: Nimm einen Satz von heute und benutze ihn heute noch mit deiner Freundin. Ihre Korrektur schickst du Claude, daraus wird eine Karte.</p>
        <button class="btn" id="b-home">Fertig</button>
        <button class="btn ghost" id="b-more">Noch eine Runde</button>
      </div>`);
    $("#b-home").onclick = () => go("home"); $("#b-more").onclick = () => startSession();
  }

  // ---------- Wörter ----------
  let filterSet = "alle", filterStatus = "alle";
  function woerter() {
    const sets = ["alle", ...window.SET_ORDER];
    const stats = [["alle", "Alle"], ["new", "Neu"], ["learn", "In Arbeit"], ["review", "Gelernt"], ["known", "Sitzt"]];
    const list = CARDS.filter((c) => (filterSet === "alle" || c.set === filterSet) && (filterStatus === "alle" || prog(c.id).s === filterStatus));
    h(`
      <h1>Wörter</h1>
      <div class="chips">${sets.map((s) => `<button class="chip ${filterSet === s ? "active" : ""}" data-set="${s}">${s === "alle" ? "Alle Sets" : window.SETS[s]}</button>`).join("")}</div>
      <div class="chips">${stats.map(([k, l]) => `<button class="chip ${filterStatus === k ? "active" : ""}" data-st="${k}">${l}</button>`).join("")}</div>
      <p class="small muted">${list.length} Wörter</p>
      <div class="list">${list.map((c) => `<button class="item" data-id="${c.id}"><span class="dot ${prog(c.id).s}"></span><span class="grow"><span class="el">${esc(c.el)}</span><br><span class="de">${esc(c.de)}</span></span>${speakBtn(c.el, "sm", true)}</button>`).join("") || `<div class="item muted">Nichts in dieser Auswahl.</div>`}</div>
    `);
    view.querySelectorAll("[data-set]").forEach((b) => b.onclick = () => { filterSet = b.dataset.set; woerter(); });
    view.querySelectorAll("[data-st]").forEach((b) => b.onclick = () => { filterStatus = b.dataset.st; woerter(); });
    view.querySelectorAll(".item[data-id]").forEach((b) => b.onclick = (e) => { if (e.target.closest("[data-say]")) return; go("detail", b.dataset.id); });
  }
  function detail(id) {
    const c = BY_ID[id]; const p = prog(id);
    const st = { new: "Neu", learn: "In Arbeit", review: "Gelernt", known: "Sitzt fest" }[p.s];
    const due = p.due ? new Date(p.due).toLocaleDateString("de-DE") : "–";
    h(`
      <button class="btn ghost sm" id="b-back">← Wörter</button>
      <div class="card flash">
        <div class="tag">${TYP_LABEL[c.typ] || c.typ} · ${window.SETS[c.set]}</div>
        <div class="word">${esc(c.el)}</div>${speakBtn(c.el)}
        <div class="answer"><div class="word de">${esc(c.de)}</div>
          <div class="bsp">${esc(c.bspEl)} ${speakBtn(c.bspEl, "sm")}<span class="de">${esc(c.bspDe)}</span></div>
          ${c.info ? `<div class="info">${esc(c.info)}</div>` : ""}</div>
      </div>
      <div class="card small muted">Status: <b>${st}</b> · Wiederholungen: ${p.reps} · Intervall: ${p.ivl} Tage · nächste Abfrage: ${due}</div>
      <div class="row"><button class="btn sec" id="b-known">Kenne ich sicher</button><button class="btn ghost" id="b-reset">Zurücksetzen</button></div>
    `);
    $("#b-back").onclick = () => go("woerter");
    $("#b-known").onclick = () => { markKnown(id); toast("Als bekannt markiert, Bestätigung in 5 Tagen."); detail(id); };
    $("#b-reset").onclick = () => { resetCard(id); toast("Zurückgesetzt."); detail(id); };
  }

  // ---------- Muster ----------
  function muster() {
    h(`
      <h1>Satzmuster</h1>
      <p class="muted">Die 10 Muster, mit denen du 80 % deines Alltags baust. Keine Tabellen, nur Bausteine.</p>
      <div class="list">${window.MUSTER.map((m) => `<div class="muster-item"><div class="t">${esc(m[0])}</div><div class="f">${esc(m[1])}</div><div class="ex">${speakBtn(m[2], "sm")}<span><span class="el">${esc(m[2])}</span><span class="de">${esc(m[3])}</span></span></div></div>`).join("")}</div>
    `);
  }

  // ---------- Mehr / Einstellungen ----------
  function mehr() {
    const s = S.settings;
    h(`
      <h1>Mehr</h1>
      <div class="card">
        <div class="field"><label>Neue Wörter pro Tag<span class="small muted">6 ist ein gutes Tempo für 20 Minuten</span></label>
          <span class="stepper"><button data-k="neu" data-d="-1">−</button><b id="v-neu">${s.neu}</b><button data-k="neu" data-d="1">+</button></span></div>
        <div class="field"><label>Minuten pro Session</label>
          <span class="stepper"><button data-k="minuten" data-d="-5">−</button><b id="v-minuten">${s.minuten}</b><button data-k="minuten" data-d="5">+</button></span></div>
        <div class="field"><label>Aussprache automatisch<span class="small muted">Griechische Stimme des Handys, offline</span></label>
          <button class="switch ${s.tts ? "on" : ""}" id="sw-tts" aria-label="Aussprache"></button></div>
      </div>
      <h2>Offline</h2>
      <div class="card">
        <p id="off-text" class="small muted">Prüfe …</p>
        <button class="btn sec" id="b-cache">Tageseinheit jetzt laden</button>
        <p class="small muted">Alles Nötige liegt danach auf dem Handy: Wörter, Sätze, App. In der Metro einfach die App vom Homescreen öffnen.</p>
      </div>
      <h2>Daten</h2>
      <div class="card">
        <p class="small muted">Dein Fortschritt liegt nur auf diesem Gerät. Einmal pro Woche sichern lohnt sich.</p>
        <div class="row"><button class="btn ghost" id="b-export">Sichern (JSON)</button><label class="btn ghost" style="margin:10px 0">Wiederherstellen<input type="file" id="f-import" accept="application/json" hidden></label></div>
        <button class="btn red" id="b-reset">Alles zurücksetzen</button>
      </div>
      <p class="small muted center">Version ${APP_VERSION} · ${CARDS.length} Wörter · Audio: ${voice ? esc(voice.name) : "keine griechische Stimme gefunden"}</p>
      <p class="small muted center">Fragen, Korrekturen deiner Freundin, neue Wörter: an Claude schicken, daraus werden Karten.</p>
    `);
    view.querySelectorAll(".stepper button").forEach((b) => b.onclick = () => {
      const k = b.dataset.k, d = +b.dataset.d; const lim = k === "neu" ? [2, 15] : [5, 45];
      S.settings[k] = Math.min(lim[1], Math.max(lim[0], S.settings[k] + d)); save(); $("#v-" + k).textContent = S.settings[k];
    });
    $("#sw-tts").onclick = () => { S.settings.tts = !S.settings.tts; save(); $("#sw-tts").classList.toggle("on", S.settings.tts); if (S.settings.tts) speak("Καλημέρα"); };
    $("#b-cache").onclick = () => precache(true);
    $("#b-export").onclick = () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `ellinika-fortschritt-${today()}.json`; a.click();
    };
    $("#f-import").onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then((txt) => { const d = JSON.parse(txt); if (!d.c || !d.settings) throw 0; S = Object.assign(defaults(), d); save(); toast("Wiederhergestellt."); go("home"); }).catch(() => toast("Datei passt nicht."));
    };
    $("#b-reset").onclick = () => { if (confirm("Wirklich alles zurücksetzen? Fortschritt und Selbst-Check gehen verloren.")) { S = defaults(); save(); toast("Zurückgesetzt."); go("home"); } };
    checkOffline();
  }

  // ---------- Offline / Service Worker ----------
  const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./data/woerter.js", "./manifest.webmanifest"];
  const badge = $("#offline-badge");
  function setBadge(state, text) { badge.className = "badge " + state; badge.textContent = text; }
  async function checkOffline() {
    if (!("serviceWorker" in navigator) || !("caches" in window)) { setBadge("warn", "Offline nicht möglich"); setOffText("Dieser Browser unterstützt keinen Offline-Modus. Am Handy Safari oder Chrome nehmen."); return false; }
    try {
      const keys = await caches.keys(); const key = keys.find((k) => k.startsWith("ellinika-"));
      if (!key) { setBadge("warn", "Noch nicht geladen"); setOffText("Noch nichts auf dem Gerät. Einmal „Tageseinheit jetzt laden“ tippen."); return false; }
      const c = await caches.open(key);
      const hits = await Promise.all(ASSETS.map((a) => c.match(a, { ignoreSearch: true })));
      const ok = hits.every(Boolean);
      const when = localStorage.getItem("ellinika_cached_at");
      setBadge(ok ? "ok" : "warn", ok ? "Offline bereit" : "Unvollständig");
      setOffText(ok ? `Offline bereit. Zuletzt geladen: ${when ? new Date(+when).toLocaleString("de-DE") : "beim Installieren"}.` : "Noch nicht alles geladen. Bitte einmal laden.");
      return ok;
    } catch (e) { setBadge("warn", "Offline unklar"); return false; }
  }
  function setOffText(t) { const el = $("#off-text"); if (el) el.textContent = t; }
  async function precache(manual) {
    if (!("caches" in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const keys = await caches.keys(); const key = keys.find((k) => k.startsWith("ellinika-")) || "ellinika-manual";
      const c = await caches.open(key);
      await c.addAll(ASSETS.concat(["./icons/favicon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png"]));
      localStorage.setItem("ellinika_cached_at", String(Date.now()));
      if (manual) toast("Geladen. Du kannst offline gehen.");
      reg && reg.update && reg.update().catch(() => {});
    } catch (e) { if (manual) toast("Laden fehlgeschlagen. Bist du online?"); }
    checkOffline();
  }
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const reg = await navigator.serviceWorker.register("sw.js");
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing; if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) toast("Neue Version verfügbar.", "Neu laden", () => { nw.postMessage("SKIP_WAITING"); setTimeout(() => location.reload(), 300); });
          });
        });
        await navigator.serviceWorker.ready;
        if (navigator.onLine) precache(false); else checkOffline();
      } catch (e) { checkOffline(); }
    });
    window.addEventListener("online", () => precache(false));
    window.addEventListener("offline", () => checkOffline());
  } else { checkOffline(); }

  // ---------- Start ----------
  go("home");
})();
