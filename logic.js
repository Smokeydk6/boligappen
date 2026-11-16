/* Boligappen – ren logik (kan testes uden DOM) */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Bolig = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PEPPER = "boligappen-v1:";
  var API = "https://mantledb.sh/v2/";

  var MOMENTS = [
    { id: "nedtrykt", label: "Nedtrykt", emoji: "😔" },
    { id: "okay", label: "Okay", emoji: "🙂" },
    { id: "godt", label: "Godt", emoji: "😊" },
    { id: "taenker", label: "Tænker på dig", emoji: "🤗" }
  ];

  var ENERGY = [
    { id: "lav", label: "Lav", level: 0 },
    { id: "mellem", label: "Mellem", level: 1 },
    { id: "hoj", label: "Høj", level: 2 },
    { id: "fyldt", label: "Energifyldt", level: 3 }
  ];

  /* Lange humørliste – ingen seksuelle/kropslige termer (fx. «Liderlig» er bevidst udeladt). */
  var MOODS = [
    { id: "afslappet", label: "Afslappet", emoji: "😌", on: true },
    { id: "ensom", label: "Ensom", emoji: "🥺", on: true },
    { id: "anspaendt", label: "Anspændt", emoji: "😬", on: false },
    { id: "assertiv", label: "Assertiv", emoji: "💪", on: false },
    { id: "gnaven", label: "Gnaven", emoji: "😠", on: true },
    { id: "bange", label: "Bange", emoji: "😨", on: false },
    { id: "ked", label: "Ked af det", emoji: "😢", on: true },
    { id: "drillesyg", label: "Drillesyg", emoji: "😜", on: false },
    { id: "dynamisk", label: "Dynamisk", emoji: "⚡", on: false },
    { id: "selvglad", label: "Selvglad", emoji: "😎", on: false },
    { id: "foelelsesladet", label: "Følelsesladet", emoji: "🥹", on: false },
    { id: "energisk", label: "Energisk", emoji: "🤩", on: true },
    { id: "flirtende", label: "Flirtende", emoji: "😉", on: false },
    { id: "flittig", label: "Flittig", emoji: "📚", on: false },
    { id: "flov", label: "Flov", emoji: "😳", on: false },
    { id: "fredfuld", label: "Fredfuld", emoji: "☮️", on: false },
    { id: "frisk", label: "Frisk", emoji: "🌿", on: true },
    { id: "frustreret", label: "Frustreret", emoji: "😤", on: true },
    { id: "glad", label: "Glad", emoji: "😊", on: true },
    { id: "glemsom", label: "Glemsom", emoji: "🤷", on: false },
    { id: "god", label: "God", emoji: "🙂", on: true },
    { id: "hjemmelig", label: "Hjemmelig", emoji: "🏠", on: true },
    { id: "haabefuld", label: "Håbefuld", emoji: "🌟", on: false },
    { id: "inspireret", label: "Inspireret", emoji: "💡", on: false },
    { id: "jaloux", label: "Jaloux", emoji: "😒", on: false },
    { id: "jublende", label: "Jublende", emoji: "🥳", on: false },
    { id: "traet", label: "Træt", emoji: "😩", on: true },
    { id: "keder", label: "Keder sig", emoji: "😑", on: false },
    { id: "legende", label: "Legende", emoji: "🤭", on: false },
    { id: "lykkelig", label: "Lykkelig", emoji: "😁", on: true },
    { id: "elendig", label: "Elendig", emoji: "😞", on: false },
    { id: "motiveret", label: "Motiveret", emoji: "🔥", on: true },
    { id: "neutral", label: "Neutral", emoji: "😐", on: true },
    { id: "normal", label: "Normal", emoji: "😶", on: false },
    { id: "optimistisk", label: "Optimistisk", emoji: "🌈", on: false },
    { id: "panikslagen", label: "Panikslagen", emoji: "😱", on: false },
    { id: "plaget", label: "Plaget", emoji: "😣", on: false },
    { id: "rolig", label: "Rolig", emoji: "😇", on: true },
    { id: "selvsikker", label: "Selvsikker", emoji: "🦁", on: false },
    { id: "skuffet", label: "Skuffet", emoji: "😔", on: false },
    { id: "stolt", label: "Stolt", emoji: "🏅", on: false },
    { id: "stresset", label: "Stresset", emoji: "😫", on: true },
    { id: "syg", label: "Syg", emoji: "🤒", on: false },
    { id: "soevnig", label: "Søvnig", emoji: "😴", on: true },
    { id: "tilfreds", label: "Tilfreds", emoji: "☺️", on: true },
    { id: "udmattet", label: "Udmattet", emoji: "🥱", on: false },
    { id: "uopmaerksom", label: "Uopmærksom", emoji: "🌀", on: false }
  ];

  /* valence: -2 .. +2, energyNeed: 0..3 (hvor meget energi aktiviteten typisk kræver) */
  var ACTIVITIES = [
    { id: "dart", title: "Spil dart", emoji: "🎯", valence: 1, energyNeed: 2, blurb: "Et parti dart i stuen." },
    { id: "film", title: "Se en film", emoji: "🎬", valence: 0, energyNeed: 0, blurb: "Sofa, tæppe og noget lækkert at spise." },
    { id: "tur", title: "Gå en tur", emoji: "🚶", valence: 0, energyNeed: 1, blurb: "Frisk luft og en snak undervejs." },
    { id: "braetspil", title: "Spil et brætspil", emoji: "🎲", valence: 1, energyNeed: 1, blurb: "Hygge ved bordet." },
    { id: "mad", title: "Lav aftensmad sammen", emoji: "🍳", valence: 1, energyNeed: 2, blurb: "I køkkenet, musikken på." },
    { id: "computerspil", title: "Spil et computerspil", emoji: "🎮", valence: 1, energyNeed: 1, blurb: "Et coop-spil eller en turnering." },
    { id: "te", title: "Hygge med te eller kaffe", emoji: "🍵", valence: 0, energyNeed: 0, blurb: "Stille stund i sofaen." },
    { id: "kort", title: "Spil kort", emoji: "🃏", valence: 1, energyNeed: 1, blurb: "Et hurtigt parti ved bordet." },
    { id: "bage", title: "Bag noget lækkert", emoji: "🧁", valence: 1, energyNeed: 2, blurb: "Kage, boller eller bare popcorn." },
    { id: "musik", title: "Hør musik sammen", emoji: "🎧", valence: 0, energyNeed: 0, blurb: "En fælles playliste og dæmpet lys." },
    { id: "quiz", title: "Hold en quiz", emoji: "🧠", valence: 1, energyNeed: 1, blurb: "I mod hinanden eller som hold." },
    { id: "takeaway", title: "Bestil takeaway", emoji: "🥡", valence: 1, energyNeed: 0, blurb: "Ingen skal stå i køkkenet i aften." },
    { id: "serie", title: "Se en serie", emoji: "📺", valence: 0, energyNeed: 0, blurb: "Næste afsnit – eller en helt ny." },
    { id: "puslespil", title: "Puslespil eller tegne", emoji: "🧩", valence: 0, energyNeed: 0, blurb: "Rolig aktivitet side om side." },
    { id: "opryd", title: "Ryd op sammen og beløn jer", emoji: "✨", valence: 0, energyNeed: 2, blurb: "Fælles indsats, fælles belønning." },
    { id: "gaa-ud", title: "Gå en tur i byen", emoji: "🌃", valence: 1, energyNeed: 3, blurb: "Når overskuddet er der." },
    { id: "dans", title: "Dans i stuen", emoji: "💃", valence: 2, energyNeed: 3, blurb: "Sæt noget svingende på." },
    { id: "picnic", title: "Picnic i stuen", emoji: "🧺", valence: 1, energyNeed: 1, blurb: "Tæppe på gulvet og lidt godt." }
  ];

  var VALENCE = {
    glad: 2, god: 1, lykkelig: 2, tilfreds: 1, rolig: 1, afslappet: 1, frisk: 1,
    hjemmelig: 1, motiveret: 2, energisk: 2, optimistisk: 2, haabefuld: 2,
    inspireret: 2, jublende: 2, stolt: 2, selvsikker: 1, selvglad: 1, legende: 1,
    dynamisk: 1, fredfuld: 1, flirtende: 1, drillesyg: 1, flittig: 1, assertiv: 1,
    neutral: 0, normal: 0, glemsom: 0, keder: -1, soevnig: 0, traet: -1,
    udmattet: -1, uopmaerksom: 0, ensom: -1, ked: -2, gnaven: -1, frustreret: -1,
    stresset: -2, skuffet: -1, bange: -2, anspaendt: -1, elendig: -2,
    panikslagen: -2, plaget: -2, jaloux: -1, flov: -1, foelelsesladet: 0, syg: -1
  };

  function normalizeCode(code) {
    return String(code || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9æøå]+/gi, "");
  }

  function validCode(code) {
    var n = normalizeCode(code);
    return n.length >= 4 && n.length <= 24;
  }

  function generateCode() {
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    var bytes;
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      bytes = new Uint8Array(6);
      crypto.getRandomValues(bytes);
    } else {
      bytes = [0, 0, 0, 0, 0, 0].map(function () { return Math.floor(Math.random() * 256); });
    }
    for (var i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
    return out.slice(0, 3) + "-" + out.slice(3);
  }

  function bytesToHex(buf) {
    var arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    var s = "";
    for (var i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, "0");
    return s;
  }

  function sha256HexSyncFallback(text) {
    /* Bruges kun hvis Web Crypto mangler (bør ikke ske i appen). */
    throw new Error("SHA-256 kræver Web Crypto");
  }

  function sha256Hex(text) {
    var data = new TextEncoder().encode(text);
    if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
      return crypto.subtle.digest("SHA-256", data).then(bytesToHex);
    }
    if (typeof require === "function") {
      var hex = require("crypto").createHash("sha256").update(text).digest("hex");
      return Promise.resolve(hex);
    }
    return Promise.reject(new Error("SHA-256 ikke tilgængelig"));
  }

  function storageFor(code) {
    return sha256Hex(PEPPER + normalizeCode(code)).then(function (h) {
      var ns = "ba" + h.slice(0, 14);
      var path = "s" + h.slice(14, 30);
      return { ns: ns, path: path, url: API + ns + "/" + path };
    });
  }

  function todayISO(d) {
    d = d || new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function addDays(iso, n) {
    var p = iso.split("-").map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + n);
    return todayISO(d);
  }

  function weekStartMonday(iso) {
    var p = iso.split("-").map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    var day = d.getDay(); /* 0 søn */
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return todayISO(d);
  }

  function defaultMembers() {
    return [
      { id: "m1", name: "Person 1", color: "#E89BB5", emoji: "🌸" },
      { id: "m2", name: "Person 2", color: "#C7B0E3", emoji: "🌙" },
      { id: "m3", name: "Person 3", color: "#8EC6C5", emoji: "🌿" }
    ];
  }

  function defaultMoods() {
    return MOODS.map(function (m) {
      return { id: m.id, label: m.label, emoji: m.emoji, on: m.on, ts: 0 };
    });
  }

  function emptyState(code, members) {
    return {
      version: 1,
      code: normalizeCode(code),
      updatedAt: 0,
      members: (members || defaultMembers()).map(function (m) {
        return {
          id: m.id,
          name: m.name,
          color: m.color,
          emoji: m.emoji,
          nameTs: 0,
          days: {}
        };
      }),
      moods: defaultMoods(),
      activities: [], /* {id, title, emoji, custom, votes:{mid:{v,ts}}, ts, status} */
      suggestion: null, /* {id, activityId, title, emoji, reason, ts, random} */
      customActivities: [], /* ældre felt, læses stadig */
      catalog: [], /* {id, title, emoji, energyTags, energyNeed, blurb, hidden, deleted, ts, custom} */
      ideas: [] /* {id, text, authorId, authorName, status, statusTs, ts, deleted, deletedTs} */
    };
  }

  function dayEntry(member, iso) {
    if (!member || !member.days) return null;
    return member.days[iso] || null;
  }

  function energyLevel(id) {
    for (var i = 0; i < ENERGY.length; i++) if (ENERGY[i].id === id) return ENERGY[i].level;
    return null;
  }

  function moodValence(moodId) {
    if (moodId == null || VALENCE[moodId] == null) return 0;
    return VALENCE[moodId];
  }

  function combinedMood(state, iso) {
    iso = iso || todayISO();
    var energies = [];
    var valences = [];
    var moods = [];
    (state.members || []).forEach(function (m) {
      var e = dayEntry(m, iso);
      if (!e) return;
      if (e.energy) {
        var lv = energyLevel(e.energy);
        if (lv != null) energies.push(lv);
      }
      if (e.mood) {
        valences.push(moodValence(e.mood));
        moods.push(e.mood);
      }
    });
    var energyAvg = energies.length ? energies.reduce(function (a, b) { return a + b; }, 0) / energies.length : null;
    var valenceAvg = valences.length ? valences.reduce(function (a, b) { return a + b; }, 0) / valences.length : null;
    return {
      energyAvg: energyAvg,
      valenceAvg: valenceAvg,
      count: Math.max(energies.length, valences.length),
      moods: moods
    };
  }

  function tagsFromNeed(need) {
    var map = { 0: "lav", 1: "mellem", 2: "hoj", 3: "fyldt" };
    return map[need] != null ? [map[need]] : ["mellem"];
  }

  function energyNeedFromTags(tags) {
    if (!tags || !tags.length) return 1;
    var sum = 0, n = 0, i, lv;
    for (i = 0; i < tags.length; i++) {
      lv = energyLevel(tags[i]);
      if (lv != null) { sum += lv; n++; }
    }
    return n ? Math.round(sum / n) : 1;
  }

  function normalizeActivity(a) {
    a = a || {};
    var tags = (a.energyTags && a.energyTags.length) ? a.energyTags.slice() : tagsFromNeed(a.energyNeed);
    var need = a.energyNeed == null ? energyNeedFromTags(tags) : a.energyNeed;
    return {
      id: a.id,
      title: a.title || "Aktivitet",
      emoji: a.emoji || "⭐",
      valence: a.valence == null ? 0 : a.valence,
      energyNeed: need,
      energyTags: tags,
      blurb: a.blurb || "",
      custom: !!a.custom,
      hidden: !!a.hidden,
      deleted: !!a.deleted,
      ts: a.ts || 0,
      deletedTs: a.deletedTs || 0
    };
  }

  function resolveCatalog(state) {
    var byId = {};
    var order = [];
    function put(item, force) {
      if (!item || !item.id) return;
      var cur = byId[item.id];
      if (!cur || force || (item.ts || 0) >= (cur.ts || 0)) {
        byId[item.id] = normalizeActivity(Object.assign({}, cur || {}, item));
      }
      if (order.indexOf(item.id) < 0) order.push(item.id);
    }
    ACTIVITIES.forEach(function (a) { put(Object.assign({}, a, { custom: false, ts: 0 }), true); });
    (state && state.customActivities || []).forEach(function (a) {
      put(Object.assign({ valence: 0, energyNeed: 1, blurb: "Jeres egen aktivitet.", custom: true }, a));
    });
    (state && state.catalog || []).forEach(function (a) { put(a); });
    return order.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function editableCatalog(state) {
    return resolveCatalog(state).filter(function (a) { return !a.deleted; });
  }

  function activityPool(state) {
    return resolveCatalog(state).filter(function (a) { return !a.deleted && !a.hidden; });
  }

  function findActivity(state, id) {
    var list = resolveCatalog(state);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function activityEnergyLevels(act) {
    var tags = act && act.energyTags;
    var levels = [];
    if (tags && tags.length) {
      tags.forEach(function (t) {
        var lv = energyLevel(t);
        if (lv != null) levels.push(lv);
      });
    }
    if (!levels.length && act && act.energyNeed != null) levels.push(act.energyNeed);
    return levels.length ? levels : [1];
  }

  function energyDistance(act, e) {
    var levels = activityEnergyLevels(act);
    var best = 99, i, d;
    for (i = 0; i < levels.length; i++) {
      d = Math.abs(levels[i] - e);
      if (d < best) best = d;
    }
    return best;
  }

  function scoreActivity(act, combo) {
    var score = 0;
    var need = energyNeedFromTags(act.energyTags) || act.energyNeed || 0;
    if (combo.energyAvg == null && combo.valenceAvg == null) {
      score = 2 - Math.abs(need - 1);
      if (act.id === "dart") score += 0.5;
      return score;
    }
    var e = combo.energyAvg == null ? 1 : combo.energyAvg;
    var v = combo.valenceAvg == null ? 0 : combo.valenceAvg;
    score -= energyDistance(act, e) * 2;
    score -= Math.abs((act.valence || 0) - v);
    if (act.id === "dart" && e >= 1.2) score += 1.4;
    if (act.id === "dart" && e < 0.8) score -= 1;
    if (v < -0.5 && need >= 3) score -= 2;
    if (v < -0.5 && need === 0) score += 0.8;
    return score;
  }

  function suggestionReason(act, combo) {
    if (combo.count === 0) return "Et bud, indtil I har logget dagens humør og energi.";
    var e = combo.energyAvg;
    var v = combo.valenceAvg;
    if (act.id === "dart" && e != null && e >= 1.2) return "I har energi nok til et parti dart.";
    if (e != null && e < 0.8) return "Energien er lav i dag – noget roligt passer godt.";
    if (v != null && v >= 1 && e != null && e >= 2) return "Godt humør og høj energi – tid til noget sjovt sammen.";
    if (v != null && v >= 1) return "Humøret er godt – her er noget, I kan samles om.";
    if (v != null && v < -0.5) return "I kunne trænge til noget skånsomt og hyggeligt.";
    return "Valgt ud fra jeres samlede humør og energi i dag.";
  }

  function suggestActivities(state, iso, n) {
    n = n || 3;
    var combo = combinedMood(state, iso);
    var pool = activityPool(state).slice();
    pool.sort(function (a, b) {
      var d = scoreActivity(b, combo) - scoreActivity(a, combo);
      if (d !== 0) return d;
      return a.id < b.id ? -1 : 1;
    });
    return pool.slice(0, n).map(function (act) {
      return Object.assign({}, act, { reason: suggestionReason(act, combo), score: scoreActivity(act, combo) });
    });
  }

  function pickRandom(state, iso, excludeId) {
    var combo = combinedMood(state, iso);
    var pool = activityPool(state).filter(function (a) { return a.id !== excludeId; });
    if (!pool.length) pool = activityPool(state);
    /* Vægt efter score, men stadig tilfældigt */
    var weights = pool.map(function (a) { return Math.max(0.2, scoreActivity(a, combo) + 3); });
    var sum = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = Math.random() * sum;
    var acc = 0;
    var act = pool[0];
    for (var i = 0; i < pool.length; i++) {
      acc += weights[i];
      if (r <= acc) { act = pool[i]; break; }
    }
    return Object.assign({}, act, { reason: suggestionReason(act, combo), random: true });
  }

  /* ---- Merge af delt tilstand (felt-tidsstempler, så to telefoner ikke overskriver hinanden) ---- */
  function newer(a, b) {
    return (a || 0) >= (b || 0) ? a : b;
  }

  function mergeMembers(local, remote) {
    var byId = {};
    (local || []).concat(remote || []).forEach(function (m) {
      if (!m || !m.id) return;
      var cur = byId[m.id];
      if (!cur) {
        byId[m.id] = {
          id: m.id,
          name: m.name,
          color: m.color,
          emoji: m.emoji,
          nameTs: m.nameTs || 0,
          days: Object.assign({}, m.days || {})
        };
        return;
      }
      if ((m.nameTs || 0) >= (cur.nameTs || 0) && m.name) {
        cur.name = m.name;
        cur.nameTs = m.nameTs || 0;
        if (m.color) cur.color = m.color;
        if (m.emoji) cur.emoji = m.emoji;
      }
      Object.keys(m.days || {}).forEach(function (day) {
        var inc = m.days[day];
        var have = cur.days[day];
        if (!have || (inc && (inc.ts || 0) >= (have.ts || 0))) cur.days[day] = inc;
      });
    });
    /* Bevar rækkefølge m1,m2,m3 hvis muligt */
    var ids = ["m1", "m2", "m3"];
    Object.keys(byId).forEach(function (id) {
      if (ids.indexOf(id) < 0) ids.push(id);
    });
    return ids.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function mergeMoods(local, remote) {
    var byId = {};
    (local || defaultMoods()).concat(remote || []).forEach(function (m) {
      if (!m || !m.id) return;
      var cur = byId[m.id];
      if (!cur || (m.ts || 0) >= (cur.ts || 0)) byId[m.id] = Object.assign({}, cur || {}, m);
    });
    var order = (local && local.length ? local : defaultMoods()).map(function (m) { return m.id; });
    Object.keys(byId).forEach(function (id) {
      if (order.indexOf(id) < 0) order.push(id);
    });
    return order.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function mergeVoteMap(a, b) {
    var out = Object.assign({}, a || {});
    Object.keys(b || {}).forEach(function (k) {
      if (!out[k] || (b[k].ts || 0) >= (out[k].ts || 0)) out[k] = b[k];
    });
    return out;
  }

  function mergeActivities(local, remote) {
    var byId = {};
    (local || []).concat(remote || []).forEach(function (a) {
      if (!a || !a.id) return;
      var cur = byId[a.id];
      if (!cur) {
        byId[a.id] = Object.assign({}, a, { votes: Object.assign({}, a.votes || {}) });
        return;
      }
      var newerAct = (a.ts || 0) >= (cur.ts || 0) ? a : cur;
      var olderAct = newerAct === a ? cur : a;
      byId[a.id] = Object.assign({}, olderAct, newerAct, {
        votes: mergeVoteMap(cur.votes, a.votes)
      });
    });
    return Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (a, b) {
      return (a.ts || 0) - (b.ts || 0);
    });
  }

  function mergeCustom(local, remote) {
    var byId = {};
    (local || []).concat(remote || []).forEach(function (a) {
      if (!a || !a.id) return;
      if (!byId[a.id] || (a.ts || 0) >= (byId[a.id].ts || 0)) byId[a.id] = a;
    });
    return Object.keys(byId).map(function (k) { return byId[k]; });
  }

  function mergeIdeas(local, remote) {
    var byId = {};
    (local || []).concat(remote || []).forEach(function (a) {
      if (!a || !a.id) return;
      var cur = byId[a.id];
      if (!cur) {
        byId[a.id] = Object.assign({}, a);
        return;
      }
      var out = Object.assign({}, cur);
      if ((a.ts || 0) >= (out.ts || 0)) {
        out.text = a.text;
        out.authorId = a.authorId || out.authorId;
        out.authorName = a.authorName || out.authorName;
        out.ts = a.ts;
      }
      if ((a.statusTs || 0) >= (out.statusTs || 0)) {
        out.status = a.status || "ny";
        out.statusTs = a.statusTs || 0;
      }
      if ((a.deletedTs || 0) >= (out.deletedTs || 0) && (a.deletedTs || a.deleted)) {
        out.deleted = !!a.deleted;
        out.deletedTs = a.deletedTs || 0;
      }
      byId[a.id] = out;
    });
    return Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (x, y) {
      return (y.ts || 0) - (x.ts || 0);
    });
  }

  function visibleIdeas(state) {
    return (state.ideas || []).filter(function (i) { return !i.deleted; });
  }

  function mergeCatalog(local, remote) {
    var byId = {};
    (local || []).concat(remote || []).forEach(function (a) {
      if (!a || !a.id) return;
      var cur = byId[a.id];
      var stamp = Math.max(a.ts || 0, a.deletedTs || 0);
      var curStamp = cur ? Math.max(cur.ts || 0, cur.deletedTs || 0) : -1;
      if (!cur || stamp >= curStamp) byId[a.id] = Object.assign({}, cur || {}, a);
    });
    return Object.keys(byId).map(function (k) { return byId[k]; });
  }

  function mergeState(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    var suggestion;
    if (!local.suggestion) suggestion = remote.suggestion;
    else if (!remote.suggestion) suggestion = local.suggestion;
    else suggestion = (remote.suggestion.ts || 0) >= (local.suggestion.ts || 0) ? remote.suggestion : local.suggestion;
    return {
      version: 1,
      code: local.code || remote.code,
      updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
      members: mergeMembers(local.members, remote.members),
      moods: mergeMoods(local.moods, remote.moods),
      activities: mergeActivities(local.activities, remote.activities),
      customActivities: mergeCustom(local.customActivities, remote.customActivities),
      catalog: mergeCatalog(local.catalog, remote.catalog),
      ideas: mergeIdeas(local.ideas, remote.ideas),
      suggestion: suggestion
    };
  }

  function voteCounts(activity) {
    var c = { ja: 0, nej: 0, maaske: 0 };
    Object.keys((activity && activity.votes) || {}).forEach(function (k) {
      var v = activity.votes[k] && activity.votes[k].v;
      if (v === "ja") c.ja++;
      else if (v === "nej") c.nej++;
      else if (v === "maaske") c.maaske++;
    });
    return c;
  }

  function enabledMoods(state) {
    return (state.moods || defaultMoods()).filter(function (m) { return m.on !== false; });
  }

  function findMood(state, id) {
    var list = (state && state.moods) || MOODS;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function monthMatrix(year, month) {
    /* month 0-11, uger starter mandag */
    var first = new Date(year, month, 1);
    var startOffset = (first.getDay() + 6) % 7;
    var daysIn = new Date(year, month + 1, 0).getDate();
    var cells = [];
    var i;
    for (i = 0; i < startOffset; i++) cells.push(null);
    for (i = 1; i <= daysIn; i++) cells.push(todayISO(new Date(year, month, i)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  return {
    MOMENTS: MOMENTS,
    ENERGY: ENERGY,
    MOODS: MOODS,
    ACTIVITIES: ACTIVITIES,
    API: API,
    normalizeCode: normalizeCode,
    validCode: validCode,
    generateCode: generateCode,
    sha256Hex: sha256Hex,
    storageFor: storageFor,
    todayISO: todayISO,
    addDays: addDays,
    weekStartMonday: weekStartMonday,
    defaultMembers: defaultMembers,
    defaultMoods: defaultMoods,
    emptyState: emptyState,
    dayEntry: dayEntry,
    energyLevel: energyLevel,
    moodValence: moodValence,
    combinedMood: combinedMood,
    activityPool: activityPool,
    resolveCatalog: resolveCatalog,
    editableCatalog: editableCatalog,
    findActivity: findActivity,
    tagsFromNeed: tagsFromNeed,
    energyNeedFromTags: energyNeedFromTags,
    normalizeActivity: normalizeActivity,
    suggestActivities: suggestActivities,
    pickRandom: pickRandom,
    suggestionReason: suggestionReason,
    mergeState: mergeState,
    mergeCatalog: mergeCatalog,
    mergeIdeas: mergeIdeas,
    visibleIdeas: visibleIdeas,
    mergeMembers: mergeMembers,
    voteCounts: voteCounts,
    enabledMoods: enabledMoods,
    findMood: findMood,
    monthMatrix: monthMatrix
  };
});
