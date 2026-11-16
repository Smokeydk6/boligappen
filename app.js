/* Boligappen – UI, synk og navigation */
(function () {
  "use strict";
  var B = window.Bolig;
  var SESSION_KEY = "boligappen-session-v1";
  var STATE_KEY = "boligappen-state-v1";
  var DOW = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];
  var MONTHS = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
  var MONTHS_SHORT = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];

  var session = {
    code: null,
    me: null,
    page: "home",
    setupStep: "welcome",
    day: B.todayISO(),
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    sheet: null,
    sync: "offline",
    lastSync: 0,
    toast: null,
    storageUrl: null,
    ideaDraft: "",
    setup: { code: "", names: ["", "", ""], me: "m1", joinCode: "", joinBusy: false, error: "" }
  };
  var state = null;
  var toastTimer = null;
  var pollTimer = null;
  var pushChain = Promise.resolve();

  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function uid(prefix) {
    return (prefix || "id") + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }
  function me() {
    var id = session.me;
    return (state.members || []).filter(function (m) { return m.id === id; })[0] || state.members[0];
  }
  function memberById(id) {
    return (state.members || []).filter(function (m) { return m.id === id; })[0];
  }
  function greeting() {
    var h = new Date().getHours();
    if (h < 10) return "Godmorgen";
    if (h < 17) return "Hej";
    return "Godaften";
  }
  function formatDate(iso) {
    if (!iso) return "";
    var p = iso.split("-").map(Number);
    return p[2] + ". " + MONTHS_SHORT[p[1] - 1] + " " + p[0];
  }
  function formatTs(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return d.getDate() + ". " + MONTHS_SHORT[d.getMonth()] + " " + d.getFullYear();
  }
  function weekdayIndex(iso) {
    var p = iso.split("-").map(Number);
    return (new Date(p[0], p[1] - 1, p[2]).getDay() + 6) % 7;
  }

  function loadLocal() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (s && s.code && s.me) {
        session.code = s.code;
        session.me = s.me;
      }
    } catch (e) {}
    try {
      var st = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
      if (st && st.members) state = st;
    } catch (e) {}
  }
  function saveLocal() {
    try {
      if (session.code && session.me) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ code: session.code, me: session.me }));
      }
      if (state) localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {}
  }
  function persist() {
    if (state) state.updatedAt = Date.now();
    saveLocal();
    render();
    schedulePush();
  }

  function toast(msg) {
    session.toast = msg;
    render();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { session.toast = null; render(); }, 2400);
  }

  function openSheet(name, data) { session.sheet = { name: name, data: data || {} }; render(); }
  function closeSheet() { session.sheet = null; render(); }

  function go(page) {
    if (page === "dart") page = "forslag";
    session.page = page;
    session.sheet = null;
    if (page === "kalender") {
      var d = new Date();
      session.calYear = d.getFullYear();
      session.calMonth = d.getMonth();
    }
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- synk ---------- */
  function schedulePush() {
    pushChain = pushChain.then(push).catch(function () {});
  }

  function pull() {
    if (!session.storageUrl) return Promise.resolve();
    session.sync = session.sync === "offline" ? "offline" : "syncing";
    return fetch(session.storageUrl, { cache: "no-store" }).then(function (r) {
      if (r.status === 404) {
        session.sync = "ok";
        session.lastSync = Date.now();
        return schedulePush();
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json().then(function (remote) {
        if (remote && typeof remote === "object") {
          state = B.mergeState(state, remote);
          saveLocal();
        }
        session.sync = "ok";
        session.lastSync = Date.now();
        render();
      });
    }).catch(function () {
      session.sync = "offline";
      render();
    });
  }

  function push() {
    if (!session.storageUrl || !state) return Promise.resolve();
    return fetch(session.storageUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      session.sync = "ok";
      session.lastSync = Date.now();
      render();
    }).catch(function () {
      session.sync = "offline";
      render();
    });
  }

  function startPoll() {
    clearInterval(pollTimer);
    pollTimer = setInterval(function () {
      if (document.hidden) return;
      pull();
    }, 5000);
  }

  function enterHousehold(code, meId, existing) {
    var norm = B.normalizeCode(code);
    session.code = norm;
    session.me = meId;
    session.setupStep = "welcome";
    return B.storageFor(norm).then(function (s) {
      session.storageUrl = s.url;
      if (existing) state = B.mergeState(existing, state && state.code === norm ? state : null) || existing;
      if (!state || state.code !== norm) state = B.emptyState(norm);
      session.page = "home";
      session.day = B.todayISO();
      saveLocal();
      render();
      return pull().then(function () { return push(); });
    });
  }

  /* ---------- handlinger ---------- */
  function ensureDay(member, iso) {
    if (!member.days) member.days = {};
    if (!member.days[iso]) member.days[iso] = { ts: 0 };
    return member.days[iso];
  }
  function patchMyDay(patch) {
    var m = me();
    if (!m) return;
    var iso = session.day;
    var cur = ensureDay(m, iso);
    m.days[iso] = Object.assign({}, cur, patch, { ts: Date.now() });
    persist();
  }

  function setMoment(id) {
    var cur = B.dayEntry(me(), session.day);
    patchMyDay({ moment: cur && cur.moment === id ? null : id });
  }
  function setMood(id) {
    var cur = B.dayEntry(me(), session.day);
    patchMyDay({ mood: cur && cur.mood === id ? null : id });
  }
  function setEnergy(id) { patchMyDay({ energy: id }); }
  function setEnergyLevel(n) {
    var e = B.ENERGY[Math.max(0, Math.min(3, n))];
    if (e) setEnergy(e.id);
  }
  function setNote(text) { patchMyDay({ note: text }); }

  function applySuggestion(item, random) {
    state.suggestion = {
      id: uid("sug"),
      activityId: item.id,
      title: item.title,
      emoji: item.emoji,
      reason: item.reason,
      random: !!random || !!item.random,
      ts: Date.now()
    };
    persist();
  }
  function refreshSuggestion() {
    var list = B.suggestActivities(state, session.day, 3);
    if (list[0]) applySuggestion(list[0], false);
  }
  function randomSuggestion() {
    var cur = state.suggestion && state.suggestion.activityId;
    applySuggestion(B.pickRandom(state, session.day, cur), true);
  }
  function putSuggestionToVote() {
    var sug = state.suggestion;
    if (!sug) return;
    var existing = (state.activities || []).filter(function (a) { return a.activityId === sug.activityId && a.status !== "done"; })[0];
    if (existing) { toast("Den er allerede til afstemning."); go("aktiviteter"); return; }
    state.activities = state.activities || [];
    state.activities.push({
      id: uid("act"),
      activityId: sug.activityId,
      title: sug.title,
      emoji: sug.emoji,
      custom: !!sug.custom,
      votes: {},
      ts: Date.now(),
      status: "open"
    });
    persist();
    toast("Tilføjet til afstemning.");
    go("aktiviteter");
  }
  var ACT_EMOJIS = ["🎯","🎬","🚶","🎲","🍳","🎮","🍵","🃏","🧁","🎧","🧠","🥡","📺","🧩","✨","🌃","💃","🧺","⭐","🎵","📚","🏃","🎨","🎤","🍕","☕","🛋️","🎉","🧘","🧹","⚽","🏓","🌱","🚗","🏖️","🪄"];

  function upsertCatalogItem(patch) {
    state.catalog = state.catalog || [];
    var existing = B.findActivity(state, patch.id) || { custom: true, valence: 0 };
    var item = B.normalizeActivity(Object.assign({}, existing, patch, { ts: Date.now() }));
    var idx = -1;
    state.catalog.forEach(function (a, i) { if (a.id === item.id) idx = i; });
    if (idx >= 0) state.catalog[idx] = item;
    else state.catalog.push(item);
    persist();
    return item;
  }

  function openEditActivity(id) {
    var item = id ? B.findActivity(state, id) : null;
    if (item) {
      openSheet("edit-act", {
        id: item.id,
        title: item.title,
        emoji: item.emoji,
        energyTags: (item.energyTags || []).slice(),
        blurb: item.blurb || "",
        custom: !!item.custom,
        hidden: !!item.hidden,
        isNew: false
      });
    } else {
      openSheet("edit-act", {
        isNew: true,
        title: "",
        emoji: "⭐",
        energyTags: ["mellem"],
        blurb: "",
        custom: true,
        hidden: false
      });
    }
  }

  function saveActivityFromSheet() {
    var d = session.sheet && session.sheet.data;
    if (!d) return;
    var title = (d.title || "").trim();
    if (!title) return toast("Skriv et navn til aktiviteten.");
    var tags = d.energyTags && d.energyTags.length ? d.energyTags.slice() : ["mellem"];
    var id = d.isNew ? uid("cact") : (d.id || uid("cact"));
    upsertCatalogItem({
      id: id,
      title: title,
      emoji: (d.emoji || "⭐").trim() || "⭐",
      energyTags: tags,
      energyNeed: B.energyNeedFromTags(tags),
      blurb: (d.blurb || "").trim(),
      custom: d.isNew ? true : !!d.custom,
      hidden: !!d.hidden,
      deleted: false
    });
    closeSheet();
    toast(d.isNew ? "Aktiviteten er tilføjet." : "Aktiviteten er gemt.");
    if (session.page !== "aktiviteter") go("aktiviteter");
  }

  function toggleHideActivity(id) {
    var item = B.findActivity(state, id);
    if (!item) return;
    var next = !item.hidden;
    if (session.sheet && session.sheet.data && session.sheet.data.id === id) session.sheet.data.hidden = next;
    upsertCatalogItem(Object.assign({}, item, { hidden: next }));
  }

  function deleteActivity(id) {
    var item = B.findActivity(state, id);
    if (!item) return;
    upsertCatalogItem(Object.assign({}, item, { deleted: true, deletedTs: Date.now() }));
    closeSheet();
    toast("Aktiviteten er slettet.");
  }

  function toggleSheetTag(tag) {
    if (!session.sheet || !session.sheet.data) return;
    var tags = (session.sheet.data.energyTags || []).slice();
    var i = tags.indexOf(tag);
    if (i >= 0) {
      if (tags.length === 1) return; /* mindst ét tag */
      tags.splice(i, 1);
    } else tags.push(tag);
    session.sheet.data.energyTags = tags;
    render();
  }
  function vote(actId, v) {
    var act = (state.activities || []).filter(function (a) { return a.id === actId; })[0];
    if (!act) return;
    act.votes = act.votes || {};
    var cur = act.votes[session.me];
    if (cur && cur.v === v) delete act.votes[session.me];
    else act.votes[session.me] = { v: v, ts: Date.now() };
    act.ts = Date.now();
    persist();
  }


  function addIdea(text) {
    text = (text || "").trim();
    if (!text) return toast("Skriv dit forslag først.");
    var m = me();
    state.ideas = state.ideas || [];
    state.ideas.unshift({
      id: uid("idea"),
      text: text,
      authorId: m.id,
      authorName: m.name,
      status: "ny",
      statusTs: Date.now(),
      ts: Date.now(),
      deleted: false,
      deletedTs: 0
    });
    session.ideaDraft = "";
    persist();
    toast("Forslaget er gemt.");
  }
  function toggleIdeaStatus(id) {
    var idea = (state.ideas || []).filter(function (i) { return i.id === id; })[0];
    if (!idea) return;
    idea.status = idea.status === "lavet" ? "ny" : "lavet";
    idea.statusTs = Date.now();
    persist();
  }
  function deleteIdea(id) {
    var idea = (state.ideas || []).filter(function (i) { return i.id === id; })[0];
    if (!idea) return;
    idea.deleted = true;
    idea.deletedTs = Date.now();
    closeSheet();
    persist();
  }

  function renameMood(id, label) {
    label = (label || "").trim();
    if (!label) return;
    (state.moods || []).forEach(function (m) {
      if (m.id === id) { m.label = label; m.ts = Date.now(); }
    });
    persist();
  }
  function toggleMood(id) {
    (state.moods || []).forEach(function (m) {
      if (m.id === id) { m.on = m.on === false ? true : false; m.ts = Date.now(); }
    });
    persist();
  }
  function renameMember(id, name) {
    name = (name || "").trim();
    if (!name) return;
    (state.members || []).forEach(function (m) {
      if (m.id === id) { m.name = name; m.nameTs = Date.now(); }
    });
    persist();
  }

  function leaveHousehold() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(STATE_KEY);
    state = null;
    session.code = null;
    session.me = null;
    session.storageUrl = null;
    session.page = "setup";
    session.setupStep = "welcome";
    session.setup = { code: B.generateCode(), names: ["", "", ""], me: "m1", joinCode: "", joinBusy: false, error: "" };
    render();
  }

  /* ---------- visning ---------- */
  function syncPill() {
    var cls = "sync-pill";
    var txt = "Synkroniseret";
    if (session.sync === "offline") { cls += " offline"; txt = "Offline – viser sidst gemte"; }
    else if (session.sync === "err") { cls += " err"; txt = "Kunne ikke synke"; }
    else if (session.sync === "syncing") { txt = "Synkroniserer…"; }
    return '<div class="' + cls + '"><span class="dot"></span>' + esc(txt) + "</div>";
  }
  function topBar(showBack) {
    var left = showBack
      ? '<button class="icon-btn" data-act="back" aria-label="Tilbage">←</button>'
      : syncPill();
    return '<div class="top-row">' + left +
      '<div style="display:flex;gap:8px">' +
      '<button class="icon-btn" data-act="go" data-page="forslag" aria-label="Forslag til appen">💡</button>' +
      '<button class="icon-btn" data-act="go" data-page="indstillinger" aria-label="Indstillinger">⚙️</button>' +
      "</div></div>";
  }

  function tabBar() {
    function tab(page, ico, label) {
      return '<button class="tab' + (session.page === page ? " on" : "") + '" data-act="go" data-page="' + page + '">' +
        '<span class="ico">' + ico + "</span>" + label + "</button>";
    }
    return '<nav class="tabbar">' +
      tab("home", "🏠", "I dag") +
      tab("kalender", "📅", "Kalender") +
      '<button class="plus" data-act="plus" aria-label="Tilføj">+</button>' +
      tab("aktiviteter", "🎲", "Aktiviteter") +
      tab("forslag", "💡", "Forslag") +
      "</nav>";
  }

  function chipsMoment(member, editable) {
    var entry = B.dayEntry(member, session.day) || {};
    return '<div class="hint">Mit øjeblik</div><div class="chips">' +
      B.MOMENTS.map(function (c) {
        var on = entry.moment === c.id ? " on" : "";
        var dis = editable ? "" : " disabled";
        var act = editable ? ' data-act="moment" data-id="' + c.id + '"' : "";
        return '<button class="chip' + on + dis + '"' + act + ">" + c.emoji + " " + esc(c.label) + "</button>";
      }).join("") + "</div>";
  }
  function energySlider(member, editable) {
    var entry = B.dayEntry(member, session.day) || {};
    var lv = entry.energy ? B.energyLevel(entry.energy) : 1;
    if (lv == null) lv = 1;
    return '<div class="slider-block"><label>Min energi <span class="ends">LAV — HØJ</span></label>' +
      '<input type="range" min="0" max="3" step="1" value="' + lv + '"' +
      (editable ? ' data-act="energy-range"' : " disabled") + "></div>";
  }

  function moodGrid() {
    var enabled = B.enabledMoods(state);
    var entry = B.dayEntry(me(), session.day) || {};
    var show = enabled.slice(0, 11);
    var html = '<div class="mood-grid">';
    show.forEach(function (m) {
      html += '<button class="mood-cell' + (entry.mood === m.id ? " on" : "") + '" data-act="mood" data-id="' + m.id + '">' +
        '<span class="emo">' + m.emoji + '</span><span class="lab">' + esc(m.label) + "</span></button>";
    });
    html += '<button class="mood-cell more" data-act="mood-more">Mere</button></div>';
    return html;
  }

  function weekRow() {
    var start = B.weekStartMonday(session.day);
    var today = B.todayISO();
    var html = '<div class="week">';
    var i;
    for (i = 0; i < 7; i++) html += '<div class="dow">' + DOW[i] + "</div>";
    for (i = 0; i < 7; i++) {
      var iso = B.addDays(start, i);
      var cls = "day";
      if (iso === session.day) cls += " on";
      if (iso === today) cls += " today";
      var dots = "";
      (state.members || []).forEach(function (m) {
        var e = B.dayEntry(m, iso);
        if (e && (e.mood || e.energy || e.moment)) {
          dots += '<i style="background:' + esc(m.color) + '"></i>';
        }
      });
      var num = iso.split("-")[2].replace(/^0/, "");
      html += '<button class="' + cls + '" data-act="pick-day" data-day="' + iso + '">' + num +
        '<span class="dots">' + dots + "</span></button>";
    }
    html += "</div>";
    return html;
  }

  function renderHome() {
    var m = me();
    var sug = state.suggestion;
    if (!sug) {
      var first = B.suggestActivities(state, session.day, 1)[0];
      if (first) sug = { title: first.title, emoji: first.emoji, reason: first.reason, activityId: first.id };
    }
    var others = (state.members || []).map(function (x) { return x.name; }).join(", ");
    var html = topBar(false) +
      '<header class="hero">' +
      '<img class="mascot" src="mascot.svg" alt="Boligappen">' +
      "<h1>" + esc(greeting()) + (m ? ", " + esc(m.name) : "") + "</h1>" +
      '<p class="sub">Hvordan har I det i husstanden i dag?</p></header>';

    html += '<section class="card forslag-wrap"><h2>Dagens forslag</h2>';
    if (sug) {
      html += '<div class="forslag-circle"><div class="emo">' + (sug.emoji || "🎯") + "</div>" +
        '<div class="title">' + esc(sug.title) + "</div></div>" +
        '<p class="forslag-reason">' + esc(sug.reason || "") + "</p>";
    }
    html += '<div class="row-btns">' +
      '<button class="btn" data-act="vote-sug">Afstemning</button>' +
      '<button class="btn ghost" data-act="random-sug">Tilfældigt</button>' +
      '<button class="btn ghost" data-act="go" data-page="aktiviteter">Rediger forslag</button>' +
      "</div></section>";

    html += '<section class="card"><h2>Deler med ' + esc(others) + "</h2>";
    (state.members || []).forEach(function (mem) {
      var mine = mem.id === session.me;
      var entry = B.dayEntry(mem, session.day) || {};
      var mood = entry.mood ? B.findMood(state, entry.mood) : null;
      html += '<div class="member-block"><div class="member-head">' +
        '<div class="avatar" style="background:' + esc(mem.color) + '">' + (mem.emoji || "🙂") + "</div>" +
        "<div><div class=\"who\">" + esc(mem.name) +
        (mine ? '<span class="you-badge">dig</span>' : "") + "</div>" +
        '<div class="meta">' + (mood ? mood.emoji + " " + esc(mood.label) : "Ikke logget endnu") + "</div></div></div>";
      html += chipsMoment(mem, mine);
      html += energySlider(mem, mine);
      html += "</div>";
    });
    html += "</section>";

    html += '<section class="card prompt"><h2>Hvordan har du det i dag?</h2>' +
      "<p>Vælg humør, energi og evt. en note – dine roomies kan se det.</p></section>";

    html += '<section class="card"><h2>I dag <span style="color:var(--muted);font-weight:700;font-size:14px">· ' +
      formatDate(session.day) + "</span></h2>" + weekRow() + "</section>";

    html += '<section class="card"><h2>Humør</h2>' + moodGrid() + "</section>";

    var entry = B.dayEntry(me(), session.day) || {};
    html += '<section class="card"><h2>Energi</h2><div class="energy-row">';
    B.ENERGY.forEach(function (e) {
      html += '<button class="chip' + (entry.energy === e.id ? " on" : "") + '" data-act="energy" data-id="' + e.id + '">' +
        esc(e.label) + "</button>";
    });
    html += "</div></section>";

    html += '<section class="card"><h2>Note</h2>' +
      '<textarea class="note-box" data-act="note" placeholder="Skriv noget">' + esc(entry.note || "") + "</textarea></section>";

    return html;
  }

  function renderKalender() {
    var y = session.calYear, mo = session.calMonth;
    var cells = B.monthMatrix(y, mo);
    var html = topBar(false) + '<div class="card"><div class="cal-nav">' +
      '<button class="icon-btn" data-act="cal-prev">‹</button>' +
      "<h2>" + MONTHS[mo] + " " + y + "</h2>" +
      '<button class="icon-btn" data-act="cal-next">›</button></div>' +
      '<div class="cal-grid">';
    DOW.forEach(function (d) { html += '<div class="dow">' + d + "</div>"; });
    var today = B.todayISO();
    cells.forEach(function (iso) {
      if (!iso) { html += '<div class="cal-cell empty"></div>'; return; }
      var cls = "cal-cell";
      if (iso === today) cls += " today";
      if (iso === session.day) cls += " sel";
      var num = iso.split("-")[2].replace(/^0/, "");
      var dots = "";
      (state.members || []).forEach(function (m) {
        var e = B.dayEntry(m, iso);
        if (e && (e.mood || e.energy || e.moment)) dots += '<i style="background:' + esc(m.color) + '"></i>';
      });
      html += '<button class="' + cls + '" data-act="pick-day" data-day="' + iso + '"><div class="n">' + num +
        '</div><span class="dots" style="justify-content:center">' + dots + "</span></button>";
    });
    html += "</div></div>";

    html += '<div class="card"><h2>' + formatDate(session.day) + "</h2>";
    (state.members || []).forEach(function (m) {
      var e = B.dayEntry(m, session.day) || {};
      var mood = e.mood ? B.findMood(state, e.mood) : null;
      var en = e.energy ? B.ENERGY.filter(function (x) { return x.id === e.energy; })[0] : null;
      var mom = e.moment ? B.MOMENTS.filter(function (x) { return x.id === e.moment; })[0] : null;
      html += '<div class="member-block"><div class="member-head">' +
        '<div class="avatar" style="background:' + esc(m.color) + '">' + (m.emoji || "🙂") + "</div>" +
        "<div><div class=\"who\">" + esc(m.name) + "</div>" +
        '<div class="meta">' +
        (mood ? mood.emoji + " " + esc(mood.label) : "Ingen humør") +
        (en ? " · " + en.label + " energi" : "") +
        (mom ? " · " + mom.label : "") +
        "</div></div></div>";
      if (e.note) html += '<p style="margin:0 0 0 54px">' + esc(e.note) + "</p>";
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  function energyTagLabels(act) {
    return (act.energyTags || B.tagsFromNeed(act.energyNeed) || []).map(function (id) {
      var e = B.ENERGY.filter(function (x) { return x.id === id; })[0];
      return e ? e.label : id;
    }).join(", ");
  }

  function renderAktiviteter() {
    var html = topBar(false) +
      '<div class="card"><h2>Forslag ud fra jeres humør</h2><div class="act-list">';
    var sugList = B.suggestActivities(state, session.day, 4);
    if (!sugList.length) html += '<p class="hint">Ingen synlige aktiviteter. Tilføj eller vis nogle nedenunder.</p>';
    sugList.forEach(function (a) {
      html += '<div class="act-item"><div class="t">' + a.emoji + " " + esc(a.title) + "</div>" +
        '<div class="hint" style="margin:4px 0 8px">' + esc(a.blurb || "") + (a.reason ? " · " + esc(a.reason) : "") +
        (a.energyTags && a.energyTags.length ? " · Energi: " + esc(energyTagLabels(a)) : "") + "</div>" +
        '<div class="act-actions">' +
        '<button class="btn" data-act="pick-act" data-id="' + a.id + '">Vælg som dagens forslag</button>' +
        '<button class="btn ghost" data-act="edit-act" data-id="' + a.id + '">Rediger</button></div></div>';
    });
    html += '</div><div class="row-btns" style="margin-top:12px">' +
      '<button class="btn ghost" data-act="random-sug">Tilfældigt forslag</button>' +
      '<button class="btn" data-act="new-act">Tilføj aktivitet</button></div></div>';

    html += '<div class="card"><h2>Jeres aktivitetsliste</h2>' +
      '<p class="hint">Alle tre i husstanden kan omdøbe, skifte emoji, sætte energimærker, skjule eller slette aktiviteter – også de indbyggede.</p><div class="act-list">';
    var catalog = B.editableCatalog(state);
    if (!catalog.length) html += '<p class="hint">Listen er tom. Tilføj en aktivitet.</p>';
    catalog.forEach(function (a) {
      html += '<div class="act-item' + (a.hidden ? " is-hidden" : "") + '"><div class="t">' + a.emoji + " " + esc(a.title) +
        (a.hidden ? ' <span class="hidden-tag">skjult</span>' : "") + "</div>" +
        '<div class="hint" style="margin:4px 0 0">' + (a.blurb ? esc(a.blurb) + " · " : "") +
        "Energi: " + esc(energyTagLabels(a) || "—") + "</div>" +
        '<div class="act-actions">' +
        '<button class="chip" data-act="edit-act" data-id="' + a.id + '">Rediger</button>' +
        '<button class="chip" data-act="hide-act" data-id="' + a.id + '">' + (a.hidden ? "Vis igen" : "Skjul") + "</button>" +
        '<button class="chip" data-act="act-del-ask" data-id="' + a.id + '">Slet</button></div></div>';
    });
    html += '</div><button class="btn wide" data-act="new-act" style="margin-top:12px">Tilføj aktivitet</button></div>';

    html += '<div class="card"><h2>Afstemning</h2>';
    var open = (state.activities || []).filter(function (a) { return a.status !== "done"; });
    if (!open.length) html += '<p class="hint">Ingen aktiviteter til afstemning endnu.</p>';
    html += '<div class="act-list">';
    open.forEach(function (a) {
      var c = B.voteCounts(a);
      var mine = a.votes && a.votes[session.me] && a.votes[session.me].v;
      html += '<div class="act-item"><div class="t">' + (a.emoji || "⭐") + " " + esc(a.title) + "</div>" +
        '<div class="votes">' +
        '<button class="chip' + (mine === "ja" ? " on" : "") + '" data-act="vote" data-id="' + a.id + '" data-v="ja">👍 Ja (' + c.ja + ")</button>" +
        '<button class="chip' + (mine === "maaske" ? " on" : "") + '" data-act="vote" data-id="' + a.id + '" data-v="maaske">🤔 Måske (' + c.maaske + ")</button>" +
        '<button class="chip' + (mine === "nej" ? " on" : "") + '" data-act="vote" data-id="' + a.id + '" data-v="nej">👎 Nej (' + c.nej + ")</button>" +
        "</div></div>";
    });
    html += "</div></div>";
    return html;
  }

  function renderForslag() {
    var ideas = B.visibleIdeas(state);
    var html = topBar(false) +
      '<div class="card idea-form"><h2>Forslag til appen</h2>' +
      '<p class="hint">Har du en idé til en ny funktion? Skriv den her – alle tre i husstanden kan se listen.</p>' +
      '<textarea class="note-box" data-act="idea-draft" placeholder="Fx. en fælles indkøbsliste…">' +
      esc(session.ideaDraft || "") + "</textarea>" +
      '<button class="btn wide" data-act="idea-add" style="margin-top:10px">Gem forslag</button></div>';

    html += '<div class="card"><h2>Jeres forslag</h2>';
    if (!ideas.length) html += '<p class="hint">Ingen forslag endnu. Vær den første!</p>';
    ideas.forEach(function (idea) {
      var st = idea.status === "lavet" ? "lavet" : "ny";
      html += '<div class="act-item idea-card"><div class="text">' + esc(idea.text) + "</div>" +
        '<div class="meta">' + esc(idea.authorName || "Ukendt") + " · " + formatTs(idea.ts) + "</div>" +
        '<div class="row-btns" style="justify-content:flex-start">' +
        '<button class="chip status-' + st + '" data-act="idea-status" data-id="' + idea.id + '">' +
        (st === "lavet" ? "✓ Lavet" : "Ny") + " · tryk for at skifte</button>" +
        '<button class="chip" data-act="idea-del-ask" data-id="' + idea.id + '">Slet</button>' +
        "</div></div>";
    });
    html += "</div>";
    return html;
  }

  function renderIndstillinger() {
    var html = topBar(true) +
      '<div class="card"><h2>Indstillinger</h2>' +
      '<button class="list-row" data-act="go" data-page="forslag"><span class="ico">💡</span>' +
      "<div><div class=\"who\">Forslag til appen</div><div class=\"meta\">Idéer fra husstanden</div></div>" +
      '<span class="go">›</span></button>' +
      '<button class="list-row" data-act="go" data-page="aktiviteter"><span class="ico">🎲</span>' +
      "<div><div class=\"who\">Aktiviteter</div><div class=\"meta\">Rediger dagens forslag og listen</div></div>" +
      '<span class="go">›</span></button>' +
      "</div>";

    html += '<div class="card"><h2>Husstandskode</h2>' +
      '<div class="code-big">' + esc((session.code || "").toUpperCase()) + "</div>" +
      '<p class="hint">Del koden med dine roomies, så I ser den samme husstand.</p>' +
      '<button class="btn ghost wide" data-act="copy-code">Kopiér kode</button></div>';

    html += '<div class="card"><h2>Hvem er du?</h2>';
    (state.members || []).forEach(function (m) {
      html += '<div class="name-row">' +
        '<button class="pick-me' + (session.me === m.id ? " on" : "") + '" data-act="set-me" data-id="' + m.id + '">' +
        (session.me === m.id ? "✓" : "") + "</button>" +
        '<div class="avatar" style="background:' + esc(m.color) + '">' + (m.emoji || "🙂") + "</div>" +
        '<input class="field" data-act="rename-member" data-id="' + m.id + '" value="' + esc(m.name) + '"></div>';
    });
    html += "</div>";

    html += '<div class="card"><h2>Humør – tryk for at omdøbe</h2>' +
      '<p class="hint">Slå humør til eller fra, og giv dem dine egne navne.</p>';
    (state.moods || []).forEach(function (m) {
      html += '<div class="mood-edit">' +
        '<span class="emo">' + m.emoji + "</span>" +
        '<button class="name" data-act="rename-mood-ask" data-id="' + m.id + '">' + esc(m.label) + "</button>" +
        '<button class="pen" data-act="rename-mood-ask" data-id="' + m.id + '" aria-label="Omdøb">✏️</button>' +
        '<button class="toggle' + (m.on === false ? "" : " on") + '" data-act="toggle-mood" data-id="' + m.id +
        '" aria-label="Slå til eller fra"><i></i></button></div>';
    });
    html += "</div>";

    html += '<div class="card"><button class="list-row" data-act="leave"><span class="ico">🚪</span>' +
      "<div class=\"danger\">Forlad husstand på denne telefon</div></button></div>" +
      '<p class="hint" style="text-align:center">Boligappen · ingen reklamer · data deles kun via jeres husstandskode</p>';
    return html;
  }

  function renderSetup() {
    var s = session.setup;
    var html = '<div class="setup"><img class="mascot" src="mascot.svg" alt="">';
    if (s.error) html += '<p class="hint" style="color:#c44">' + esc(s.error) + "</p>";
    if (session.setupStep === "welcome") {
      html += "<h1>Boligappen</h1><p class=\"sub\">Humør, energi og aktiviteter – sammen i husstanden.</p>" +
        '<div class="card"><button class="btn wide" data-act="setup-create">Opret husstand</button>' +
        '<button class="btn ghost wide" data-act="setup-join-start" style="margin-top:10px">Jeg har en kode</button></div></div>';
      return html;
    }
    if (session.setupStep === "create") {
      html += "<h1>Ny husstand</h1><p class=\"sub\">Del koden med dine to roomies.</p></div>" +
        '<div class="card"><div class="code-big">' + esc(s.code) + "</div>" +
        '<button class="btn ghost wide" data-act="setup-regen">Ny kode</button>' +
        "<h2 style=\"margin-top:18px\">Hvem bor her?</h2><p class=\"hint\">Skriv jeres navne og tryk på cirklen ud for dig selv.</p>";
      [0, 1, 2].forEach(function (i) {
        var id = "m" + (i + 1);
        html += '<div class="name-row"><button class="pick-me' + (s.me === id ? " on" : "") +
          '" data-act="setup-me" data-id="' + id + '">' + (s.me === id ? "✓" : "") + "</button>" +
          '<input class="field" placeholder="Person ' + (i + 1) + '" data-act="setup-name" data-i="' + i +
          '" value="' + esc(s.names[i] || "") + '"></div>';
      });
      html += '<button class="btn wide" data-act="setup-create-go">Fortsæt</button>' +
        '<button class="btn ghost wide" data-act="setup-back" style="margin-top:8px">Tilbage</button></div>';
      return html;
    }
    if (session.setupStep === "join") {
      html += "<h1>Tilslut</h1><p class=\"sub\">Skriv husstandskoden, I deler.</p></div>" +
        '<div class="card"><input class="field" data-act="setup-join-code" placeholder="Fx. K7M-2PQ" value="' +
        esc(s.joinCode) + '">' +
        (s.joinBusy ? "<p class=\"hint\">Søger efter husstanden…</p>" : '<button class="btn wide" data-act="setup-join-go">Fortsæt</button>') +
        '<button class="btn ghost wide" data-act="setup-back" style="margin-top:8px">Tilbage</button></div>';
      return html;
    }
    if (session.setupStep === "join-pick") {
      html += "<h1>Hvem er du?</h1><p class=\"sub\">Vælg dig selv i husstanden.</p></div><div class=\"card\">";
      (s.remote.members || []).forEach(function (m) {
        html += '<button class="list-row" data-act="setup-join-pick" data-id="' + m.id + '">' +
          '<div class="avatar" style="background:' + esc(m.color) + '">' + (m.emoji || "🙂") + "</div>" +
          "<div class=\"who\">" + esc(m.name) + "</div><span class=\"go\">›</span></button>";
      });
      html += '<button class="btn ghost wide" data-act="setup-back" style="margin-top:8px">Tilbage</button></div>';
      return html;
    }
    return html;
  }

  function renderSheet() {
    var sh = session.sheet;
    if (!sh) return "";
    var inner = "";
    if (sh.name === "plus") {
      inner = "<h2>Tilføj</h2>" +
        '<button class="list-row" data-act="plus-log"><span class="ico">😊</span><div>Log humør og energi</div><span class="go">›</span></button>' +
        '<button class="list-row" data-act="new-act"><span class="ico">⭐</span><div>Ny aktivitet</div><span class="go">›</span></button>' +
        '<button class="list-row" data-act="go" data-page="forslag"><span class="ico">💡</span><div>Forslag til appen</div><span class="go">›</span></button>';
    } else if (sh.name === "mood-more") {
      var entry = B.dayEntry(me(), session.day) || {};
      inner = "<h2>Alle humør</h2><div class=\"mood-grid\">";
      B.enabledMoods(state).forEach(function (m) {
        inner += '<button class="mood-cell' + (entry.mood === m.id ? " on" : "") + '" data-act="mood" data-id="' + m.id + '">' +
          '<span class="emo">' + m.emoji + '</span><span class="lab">' + esc(m.label) + "</span></button>";
      });
      inner += "</div>";
    } else if (sh.name === "edit-act") {
      var d = sh.data || {};
      inner = "<h2>" + (d.isNew ? "Ny aktivitet" : "Rediger aktivitet") + "</h2>" +
        '<p class="hint">Ændringer synkroniseres til hele husstanden.</p>' +
        '<label class="hint">Navn</label>' +
        '<input class="field" data-act="edit-act-title" placeholder="Fx. Spil Uno" value="' + esc(d.title || "") + '">' +
        '<label class="hint">Emoji</label>' +
        '<div class="emoji-grid">';
      ACT_EMOJIS.forEach(function (em) {
        inner += '<button type="button" class="' + (d.emoji === em ? "on" : "") + '" data-act="pick-emoji" data-emoji="' + em + '">' + em + "</button>";
      });
      inner += '</div>' +
        '<label class="hint">Energimærker (hvornår passer den?)</label><div class="chips" style="margin:8px 0 12px">';
      B.ENERGY.forEach(function (e) {
        var on = (d.energyTags || []).indexOf(e.id) >= 0;
        inner += '<button class="chip' + (on ? " on" : "") + '" data-act="edit-act-tag" data-id="' + e.id + '">' + esc(e.label) + "</button>";
      });
      inner += '</div><label class="hint">Kort beskrivelse (valgfrit)</label>' +
        '<input class="field" data-act="edit-act-blurb" placeholder="Hvad går det ud på?" value="' + esc(d.blurb || "") + '">' +
        (d.isNew ? "" : '<button class="btn ghost wide" data-act="hide-act" data-id="' + esc(d.id || "") + '" style="margin-bottom:8px">' +
          (d.hidden ? "Vis i forslag igen" : "Skjul i dagens forslag") + "</button>") +
        '<button class="btn wide" data-act="save-act">' + (d.isNew ? "Tilføj" : "Gem") + "</button>";
    } else if (sh.name === "rename-mood") {
      var mood = B.findMood(state, sh.data.id);
      inner = "<h2>Omdøb humør</h2>" +
        '<input class="field" data-act="rename-mood-val" value="' + esc((sh.data.label != null ? sh.data.label : (mood && mood.label)) || "") + '">' +
        '<button class="btn wide" data-act="rename-mood-save">Gem</button>';
    } else if (sh.name === "idea-del") {
      inner = "<h2>Slet forslaget?</h2><p>Det forsvinder for alle i husstanden.</p>" +
        '<div class="confirm-row"><button class="btn ghost" data-act="sheet-close">Annuller</button>' +
        '<button class="btn" data-act="idea-del" data-id="' + esc(sh.data.id) + '">Slet</button></div>';
    } else if (sh.name === "act-del") {
      inner = "<h2>Slet aktiviteten?</h2><p>Den fjernes fra listen hos alle i husstanden.</p>" +
        '<div class="confirm-row"><button class="btn ghost" data-act="sheet-close">Annuller</button>' +
        '<button class="btn" data-act="act-del" data-id="' + esc(sh.data.id) + '">Slet</button></div>';
    } else if (sh.name === "leave") {
      inner = "<h2>Forlad husstand?</h2><p>Appen glemmer koden på denne telefon. De andres data bliver.</p>" +
        '<div class="confirm-row"><button class="btn ghost" data-act="sheet-close">Annuller</button>' +
        '<button class="btn" data-act="leave-yes">Forlad</button></div>';
    }
    return '<div class="sheet-bg" data-act="sheet-bg"><div class="sheet"><div class="handle"></div>' + inner + "</div></div>";
  }

  function renderToast() {
    if (!session.toast) return "";
    return '<div class="toast">' + esc(session.toast) + "</div>";
  }

  function render() {
    var root = document.getElementById("app");
    if (!root) return;
    if (!session.code || !state) {
      root.innerHTML = '<div class="screen" id="screen">' + renderSetup() + "</div>" + renderToast();
      bindFields(root);
      return;
    }
    var body = "";
    if (session.page === "kalender") body = renderKalender();
    else if (session.page === "aktiviteter") body = renderAktiviteter();
    else if (session.page === "forslag") body = renderForslag();
    else if (session.page === "indstillinger") body = renderIndstillinger();
    else body = renderHome();
    var tabs = (session.page === "forslag" || session.page === "indstillinger") ? tabBar() : tabBar();
    root.innerHTML = '<div class="screen" id="screen">' + body + "</div>" + tabs + renderSheet() + renderToast();
    bindFields(root);
  }

  function bindFields(root) {
    root.querySelectorAll("[data-act=note]").forEach(function (el) {
      el.addEventListener("change", function () { setNote(el.value); });
      el.addEventListener("blur", function () { setNote(el.value); });
    });
    root.querySelectorAll("[data-act=energy-range]").forEach(function (el) {
      el.addEventListener("change", function () { setEnergyLevel(parseInt(el.value, 10)); });
    });
    root.querySelectorAll("[data-act=idea-draft]").forEach(function (el) {
      el.addEventListener("input", function () { session.ideaDraft = el.value; });
    });
    root.querySelectorAll("[data-act=setup-name]").forEach(function (el) {
      el.addEventListener("input", function () { session.setup.names[parseInt(el.getAttribute("data-i"), 10)] = el.value; });
    });
    root.querySelectorAll("[data-act=setup-join-code]").forEach(function (el) {
      el.addEventListener("input", function () { session.setup.joinCode = el.value; });
    });
    root.querySelectorAll("[data-act=rename-member]").forEach(function (el) {
      el.addEventListener("change", function () { renameMember(el.getAttribute("data-id"), el.value); });
    });
    root.querySelectorAll("[data-act=edit-act-title]").forEach(function (el) {
      el.addEventListener("input", function () { if (session.sheet) session.sheet.data.title = el.value; });
    });
    root.querySelectorAll("[data-act=edit-act-blurb]").forEach(function (el) {
      el.addEventListener("input", function () { if (session.sheet) session.sheet.data.blurb = el.value; });
    });
    root.querySelectorAll("[data-act=rename-mood-val]").forEach(function (el) {
      el.addEventListener("input", function () { if (session.sheet) session.sheet.data.label = el.value; });
    });
  }

  /* bind uses addEventListener on root every render – that would stack if we don't replace innerHTML (we do, so listeners are gone). Good. */

  function onClick(ev) {
    var t = ev.target.closest("[data-act]");
    if (!t) return;
    var act = t.getAttribute("data-act");
    var id = t.getAttribute("data-id");
    var page = t.getAttribute("data-page");

    if (act === "go") { go(page); return; }
    if (act === "back") { go("home"); return; }
    if (act === "sheet-bg" && ev.target.classList.contains("sheet-bg")) { closeSheet(); return; }
    if (act === "sheet-close") { closeSheet(); return; }
    if (act === "plus") { openSheet("plus"); return; }
    if (act === "plus-log") { closeSheet(); go("home"); return; }
    if (act === "mood-more") { openSheet("mood-more"); return; }
    if (act === "pick-day") { session.day = t.getAttribute("data-day"); if (session.page !== "kalender") go("home"); else render(); return; }
    if (act === "moment") { setMoment(id); return; }
    if (act === "mood") { setMood(id); if (session.sheet && session.sheet.name === "mood-more") closeSheet(); return; }
    if (act === "energy") { setEnergy(id); return; }
    if (act === "vote-sug") { putSuggestionToVote(); return; }
    if (act === "random-sug") { randomSuggestion(); if (session.page !== "home") go("home"); return; }
    if (act === "pick-act") {
      var item = B.activityPool(state).filter(function (a) { return a.id === id; })[0];
      if (item) {
        var combo = B.combinedMood(state, session.day);
        applySuggestion(Object.assign({}, item, { reason: B.suggestionReason(item, combo) }), false);
        go("home");
      }
      return;
    }
    if (act === "new-act") { openEditActivity(null); return; }
    if (act === "edit-act") { openEditActivity(id); return; }
    if (act === "save-act") { saveActivityFromSheet(); return; }
    if (act === "pick-emoji") {
      if (session.sheet && session.sheet.data) { session.sheet.data.emoji = t.getAttribute("data-emoji"); render(); }
      return;
    }
    if (act === "edit-act-tag") { toggleSheetTag(id); return; }
    if (act === "hide-act") { toggleHideActivity(id); return; }
    if (act === "act-del-ask") { openSheet("act-del", { id: id }); return; }
    if (act === "act-del") { deleteActivity(id); return; }
    if (act === "vote") { vote(id, t.getAttribute("data-v")); return; }
    if (act === "idea-add") { addIdea(session.ideaDraft); return; }
    if (act === "idea-status") { toggleIdeaStatus(id); return; }
    if (act === "idea-del-ask") { openSheet("idea-del", { id: id }); return; }
    if (act === "idea-del") { deleteIdea(id); return; }
    if (act === "copy-code") {
      var code = (session.code || "").toUpperCase();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () { toast("Koden er kopieret."); }).catch(function () { toast(code); });
      } else toast(code);
      return;
    }
    if (act === "set-me") { session.me = id; saveLocal(); render(); return; }
    if (act === "rename-mood-ask") { openSheet("rename-mood", { id: id }); return; }
    if (act === "rename-mood-save") {
      renameMood(session.sheet.data.id, session.sheet.data.label);
      closeSheet();
      return;
    }
    if (act === "toggle-mood") { toggleMood(id); return; }
    if (act === "leave") { openSheet("leave"); return; }
    if (act === "leave-yes") { closeSheet(); leaveHousehold(); return; }
    if (act === "cal-prev") {
      session.calMonth--;
      if (session.calMonth < 0) { session.calMonth = 11; session.calYear--; }
      render(); return;
    }
    if (act === "cal-next") {
      session.calMonth++;
      if (session.calMonth > 11) { session.calMonth = 0; session.calYear++; }
      render(); return;
    }
    if (act === "setup-create") {
      session.setupStep = "create";
      session.setup.code = B.generateCode();
      session.setup.error = "";
      render(); return;
    }
    if (act === "setup-join-start") { session.setupStep = "join"; session.setup.error = ""; render(); return; }
    if (act === "setup-back") { session.setupStep = "welcome"; session.setup.error = ""; render(); return; }
    if (act === "setup-regen") { session.setup.code = B.generateCode(); render(); return; }
    if (act === "setup-me") { session.setup.me = id; render(); return; }
    if (act === "setup-create-go") {
      var names = session.setup.names.map(function (n, i) { return (n || "").trim() || ("Person " + (i + 1)); });
      if (!B.validCode(session.setup.code)) { session.setup.error = "Koden skal være på 4–24 tegn."; render(); return; }
      var members = B.defaultMembers();
      members.forEach(function (m, i) { m.name = names[i]; });
      var fresh = B.emptyState(session.setup.code, members);
      enterHousehold(session.setup.code, session.setup.me, fresh);
      return;
    }
    if (act === "setup-join-go") {
      var jc = session.setup.joinCode;
      if (!B.validCode(jc)) { session.setup.error = "Koden skal være på 4–24 tegn."; render(); return; }
      session.setup.joinBusy = true;
      session.setup.error = "";
      render();
      B.storageFor(jc).then(function (s) {
        return fetch(s.url, { cache: "no-store" }).then(function (r) {
          if (r.status === 404) {
            session.setup.joinBusy = false;
            session.setup.error = "Ingen husstand med den kode endnu. Tjek koden, eller opret en ny.";
            render();
            return;
          }
          if (!r.ok) throw new Error();
          return r.json().then(function (remote) {
            session.setup.joinBusy = false;
            session.setup.remote = remote && remote.members ? remote : B.emptyState(jc);
            session.setup.pendingUrl = s.url;
            session.setupStep = "join-pick";
            render();
          });
        });
      }).catch(function () {
        session.setup.joinBusy = false;
        session.setup.error = "Kunne ikke hente husstanden. Tjek nettet, eller prøv igen.";
        render();
      });
      return;
    }
    if (act === "setup-join-pick") {
      enterHousehold(session.setup.joinCode, id, session.setup.remote);
      return;
    }
  }

  function handleBack() {
    if (session.sheet) { closeSheet(); return true; }
    if (session.page === "forslag" || session.page === "indstillinger") { go("home"); return true; }
    if (session.page && session.page !== "home" && session.code) { go("home"); return true; }
    if (!session.code && session.setupStep !== "welcome") { session.setupStep = "welcome"; render(); return true; }
    return false;
  }

  window.BoligApp = { back: handleBack, getState: function () { return state; }, getSession: function () { return session; } };

  function boot() {
    var root = document.getElementById("app");
    if (root && !root.__boligBound) {
      root.addEventListener("click", onClick);
      root.__boligBound = true;
    }
    loadLocal();
    if (session.code && state) {
      session.page = "home";
      B.storageFor(session.code).then(function (s) {
        session.storageUrl = s.url;
        render();
        pull();
        startPoll();
      });
      render();
      startPoll();
      return;
    }
    session.page = "setup";
    session.setup.code = B.generateCode();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
