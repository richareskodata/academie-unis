// Académie UNIS Togo : application (GitHub Pages + Supabase)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.UNIS_CONFIG || {};
const root = document.getElementById("app");
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = d => d ? new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
const appUrl = () => location.origin + location.pathname;

/* ---------- État ---------- */
let sb, MODULES = [];
let session = null, profile = null, P = {};
let view = "loading", authTab = "login", cur = { m: 0, step: 0 };
let ui = {}, notice = null, sentTo = "", verify = null;
let admin = { loaded: false, rows: [], prog: [], filter: "pending", q: "", err: null };

const isAdmin = () => !!(profile && profile.role === "admin" && profile.approved);
const hasContent = m => Array.isArray(m.seqs) && m.seqs.length > 0;

function prog(id) {
  if (!P[id]) P[id] = { seq: [false, false, false, false, false], quiz: false, best: null, attest: null, code: null, name: null };
  return P[id];
}
function fromRow(r) {
  P[r.module_id] = { seq: r.seq, quiz: r.quiz_passed, best: r.quiz_best, attest: r.attest_date, code: r.attest_code, name: r.attest_name };
}
function unlocked(i) {
  if (isAdmin() || i === 0) return true;
  for (let j = i - 1; j >= 0; j--) if (hasContent(MODULES[j])) return !!prog(MODULES[j].id).code;
  return true;
}
function prevWithContent(i) { for (let j = i - 1; j >= 0; j--) if (hasContent(MODULES[j])) return MODULES[j]; return null; }
function reachable(m, s) {
  const p = prog(m.id);
  if (s === 0) return true;
  if (s < 5) return !!p.seq[s - 1];
  if (s === 5) return p.seq.every(Boolean);
  return !!p.quiz;
}
function firstOpenStep(m) { const p = prog(m.id); if (p.quiz) return 6; const k = p.seq.indexOf(false); return k === -1 ? 5 : k; }

/* ---------- Drapeau ---------- */
function starPoints(cx, cy, R, r) {
  const pts = [];
  for (let k = 0; k < 10; k++) { const a = (-90 + k * 36) * Math.PI / 180, rad = k % 2 ? r : R; pts.push((cx + rad * Math.cos(a)).toFixed(1) + "," + (cy + rad * Math.sin(a)).toFixed(1)); }
  return pts.join(" ");
}
const STAR = starPoints(90, 90, 52, 20);
const FULL = { seq: [1, 1, 1, 1, 1], quiz: 1, code: 1 };
function flagSVG(p, o = {}) {
  const w = o.w || 46;
  let s = `<svg class="${o.big ? "flag-big" : ""}" ${o.big ? "" : `width="${w}" height="${Math.round(w * 0.618)}"`} viewBox="0 0 485 300" role="img" aria-label="${esc(o.label || "Progression du module")}">`;
  for (let i = 0; i < 5; i++) {
    const done = p.seq[i];
    const col = done ? (i % 2 ? "var(--flag-yellow)" : "var(--flag-green)") : "var(--empty)";
    const reach = o.big && o.mod && reachable(o.mod, i);
    s += `<rect class="stripe${reach ? " reach" : ""}" ${o.big && o.mod ? `data-step="${i}"` : ""} x="0" y="${i * 60}" width="485" height="60" fill="${col}"><title>Séquence ${i + 1}${done ? " : validée" : ""}</title></rect>`;
  }
  s += `<rect class="canton" x="0" y="0" width="180" height="180" fill="${p.quiz ? "var(--flag-red)" : "var(--empty-line)"}"><title>Quiz${p.quiz ? " : réussi" : ""}</title></rect>`;
  s += `<polygon class="star" points="${STAR}" fill="#FFFFFF" style="opacity:${p.code ? 1 : 0};transform:scale(${p.code ? 1 : .4})"/>`;
  return s + `</svg>`;
}

/* ---------- Thème clair / sombre ---------- */
const ICONS = {
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>'
};
function themeSwitch() {
  const curT = window.UNIS_THEME ? window.UNIS_THEME.get() : "auto";
  const b = (id, label) => `<button type="button" data-theme-set="${id}" aria-pressed="${curT === id}">${ICONS[id]}${label}</button>`;
  return `<div class="theme-block"><span id="theme-lbl">Affichage</span><div class="theme-switch" role="group" aria-labelledby="theme-lbl">${b("light", "Clair")}${b("dark", "Sombre")}${b("auto", "Système")}</div></div>`;
}

/* ---------- Écrans hors connexion ---------- */
const solo = inner => `<div class="solo"><div class="solo-card">${flagSVG(FULL, { big: true, label: "Drapeau du Togo" })}${inner}<div class="solo-theme">${themeSwitch()}</div></div></div>`;
const field = (name, label, type = "text", ac = "off", extra = "", hint = "") =>
  `<div class="field"><label for="i-${name}">${label}</label><input id="i-${name}" name="${name}" type="${type}" autocomplete="${ac}" required ${extra}>${hint ? `<small>${hint}</small>` : ""}</div>`;
const errSlot = `<p class="feedback ko" role="alert" data-err hidden></p>`;
function noticeHTML() { if (!notice) return ""; const n = notice; notice = null; return `<p class="feedback ${n.type}" role="status">${esc(n.text)}</p>`; }

const V = {};
V.loading = () => solo(`<h1>Académie UNIS</h1><p class="lead">Chargement…</p>`);
V.setup = () => solo(`<h1>Configuration requise</h1><p class="lead">Renseignez l'adresse du projet Supabase et la clé publique dans le fichier config.js, puis rechargez la page.</p>`);
V.contentError = () => solo(`<h1>Contenus indisponibles</h1><p class="lead">Le fichier content.json est introuvable ou contient une erreur de syntaxe. Vérifiez la dernière modification dans GitHub, ou revenez à la version précédente depuis l'historique du fichier.</p>`);

V.auth = () => {
  const tab = (id, label) => `<button type="button" data-tab="${id}" aria-pressed="${authTab === id}">${label}</button>`;
  let f = "";
  if (authTab === "login") f = `<form id="f-login" novalidate>${errSlot}
      ${field("email", "Adresse email", "email", "email")}
      ${field("password", "Mot de passe", "password", "current-password")}
      <button class="btn full" type="submit">Se connecter</button></form>`;
  if (authTab === "signup") f = `<form id="f-signup" novalidate>${errSlot}
      ${field("full_name", "Nom et prénom", "text", "name", 'maxlength="120"', "Tel qu'il figurera sur vos attestations.")}
      ${field("structure", "Structure ou district", "text", "organization", 'maxlength="120"')}
      ${field("fonction", "Fonction", "text", "organization-title", 'maxlength="120"')}
      ${field("email", "Adresse email", "email", "email")}
      ${field("password", "Mot de passe", "password", "new-password", 'minlength="10"', "Au moins 10 caractères.")}
      ${field("password2", "Confirmer le mot de passe", "password", "new-password")}
      <button class="btn full" type="submit">Créer mon compte</button>
      <p class="muted" style="font-size:.85rem;margin:12px 0 0">Votre compte sera activé après validation par l'équipe UNIS.</p></form>`;
  if (authTab === "forgot") f = `<form id="f-forgot" novalidate>${errSlot}
      ${field("email", "Adresse email du compte", "email", "email")}
      <button class="btn full" type="submit">Recevoir un lien de réinitialisation</button></form>`;
  return solo(`<h1>Académie UNIS</h1><p class="lead">Formation des équipes de l'UNIS, Ministère de la Santé du Togo.</p>${noticeHTML()}
    <div class="tabs" role="group" aria-label="Accès au compte">${tab("login", "Connexion")}${tab("signup", "Inscription")}${tab("forgot", "Mot de passe oublié")}</div>${f}
    <div class="solo-foot"><form id="f-verify" class="inline-form" novalidate>${field("code", "Vérifier une attestation", "text", "off", 'placeholder="UNIS-TC1-…" maxlength="40"')}<button class="btn ghost" type="submit">Vérifier</button></form></div>`);
};
V.checkEmail = () => solo(`<h1>Vérifiez votre boîte mail</h1><p class="lead">Un lien de confirmation a été envoyé à ${esc(sentTo)}. Cliquez dessus pour activer votre adresse. L'équipe UNIS validera ensuite votre compte pour ouvrir l'accès aux modules.</p><button class="btn ghost" data-act="toLogin">Retour à la connexion</button>`);
V.resetSent = () => solo(`<h1>Lien envoyé</h1><p class="lead">Si un compte existe pour ${esc(sentTo)}, un lien de réinitialisation vient d'y être envoyé. Il est valable pour une durée limitée.</p><button class="btn ghost" data-act="toLogin">Retour à la connexion</button>`);
V.recovery = () => solo(`<h1>Nouveau mot de passe</h1><p class="lead">Choisissez un nouveau mot de passe pour votre compte.</p>
  <form id="f-recovery" novalidate>${errSlot}
  ${field("password", "Nouveau mot de passe", "password", "new-password", 'minlength="10"', "Au moins 10 caractères.")}
  ${field("password2", "Confirmer le mot de passe", "password", "new-password")}
  <button class="btn full" type="submit">Enregistrer le mot de passe</button></form>`);
V.pending = () => solo(`<h1>Compte en attente</h1><p class="lead">Bonjour ${esc(profile.full_name || profile.email)}. Votre compte est créé. Un administrateur de l'UNIS doit le valider avant que vous puissiez commencer les modules.</p>
  <div class="actions"><button class="btn" data-act="recheck">Vérifier à nouveau</button><button class="btn ghost" data-act="logout">Se déconnecter</button></div>`);
V.verify = () => {
  const r = verify.row, m = r && MODULES.find(x => x.id === r.module_id);
  const body = r
    ? `<p class="feedback ok" role="status"><strong>Attestation authentique.</strong></p><p class="body">Délivrée à <strong>${esc(r.full_name)}</strong> pour le module ${esc(r.module_id)}${m ? " : " + esc(m.title) : ""}, le ${fmtDate(r.attest_date)}.</p>`
    : `<p class="feedback ko" role="alert">Aucune attestation ne correspond à ce code. Vérifiez la saisie, lettres et chiffres compris.</p>`;
  return solo(`<h1>Vérification d'attestation</h1><p class="lead">Code ${esc(verify.code)}</p>${body}<a class="btn ghost" href="${esc(appUrl())}">Aller à la plateforme</a>`);
};

/* ---------- Application connectée ---------- */
function statusText(m, i) {
  if (!hasContent(m)) return "En préparation";
  if (!unlocked(i)) { const pm = prevWithContent(i); return `Verrouillé : terminez ${pm ? pm.id : ""}`; }
  const p = prog(m.id);
  if (p.code) return "Attestation obtenue";
  const n = p.seq.filter(Boolean).length + (p.quiz ? 1 : 0);
  return n ? `En cours, ${n} sur 6 étapes` : "À commencer";
}
function side() {
  let h = `<div class="brand">${flagSVG(FULL, { w: 52, label: "Drapeau du Togo" })}<div><h1>Académie UNIS</h1><p>Renforcement de capacités, Ministère de la Santé du Togo</p></div></div>`;
  [["tc", "Tronc commun"], ["an", "Parcours Analyste"]].forEach(([t, label]) => {
    const mods = MODULES.map((m, i) => [m, i]).filter(([m]) => m.track === t);
    if (!mods.length) return;
    h += `<nav class="track" aria-label="${label}"><h2>${label}</h2><ol>`;
    mods.forEach(([m, i]) => {
      const locked = !unlocked(i) || !hasContent(m);
      h += `<li><button class="mod-btn${locked ? " locked" : ""}" data-mod="${i}" aria-current="${view === "app" && cur.m === i}">
        ${flagSVG(prog(m.id), { w: 46, label: "Progression " + m.id })}
        <span><span class="code">${esc(m.id)}</span> <span class="title">${esc(m.title)}</span><span class="status">${statusText(m, i)}</span></span></button></li>`;
    });
    h += `</ol></nav>`;
  });
  h += `<div class="side-foot">${themeSwitch()}<div class="userbox"><span>Connecté en tant que</span><strong>${esc(profile.full_name || profile.email)}</strong></div>
    ${isAdmin() ? (view === "admin" ? `<button class="btn ghost" data-act="toApp">Retour aux modules</button>` : `<button class="btn ghost" data-act="toAdmin">Administration</button>`) : ""}
    <button class="link-btn" data-act="logout">Se déconnecter</button></div>`;
  return h;
}
const stepLabel = s => s < 5 ? `Séquence ${s + 1}` : (s === 5 ? "Quiz" : "Attestation");

function mainView() {
  const i = cur.m, m = MODULES[i], p = prog(m.id);
  let h = `<header class="mod-head">${flagSVG(p, { big: true, mod: hasContent(m) && unlocked(i) ? m : null, label: "Drapeau de progression du module " + m.id })}
    <div><p class="mod-code">Module ${esc(m.id)}</p><h2 class="mod-title">${esc(m.title)}</h2>
    <p class="mod-meta">${esc(m.duration)}. ${esc(m.intro)}</p>
    ${hasContent(m) ? `<p class="legend">Chaque séquence validée colore une bande du drapeau. Le quiz réussi colore le carré rouge ; l'attestation y ajoute l'étoile.</p>` : ""}</div></header>`;
  if (!hasContent(m)) return h + `<section class="card"><h3>Module en préparation</h3><p class="body">L'équipe pédagogique rédige ce module. Il suivra la même structure : cinq séquences courtes avec une question de validation chacune, un quiz final et une attestation.</p></section>`;
  if (!unlocked(i)) {
    const pm = prevWithContent(i);
    return h + `<section class="card"><h3>Ce module s'ouvrira bientôt</h3><p class="body">Obtenez l'attestation du module ${esc(pm.id)}, ${esc(pm.title)}, pour accéder à celui-ci.</p>
      <div class="actions"><button class="btn" data-mod="${MODULES.indexOf(pm)}">Aller au module ${esc(pm.id)}</button></div></section>`;
  }
  h += `<ol class="steps" aria-label="Étapes du module">`;
  for (let s = 0; s < 7; s++) {
    const done = s < 5 ? p.seq[s] : (s === 5 ? p.quiz : !!p.code);
    const tone = s < 5 ? (s % 2 ? " y" : "") : (s === 5 ? " r" : "");
    h += `<li><button class="step${done ? " done" + tone : ""}" data-step="${s}" ${reachable(m, s) ? "" : "disabled"} aria-current="${cur.step === s}"><span class="dot" aria-hidden="true"></span>${stepLabel(s)}</button></li>`;
  }
  h += `</ol>`;
  const s = cur.step;
  return h + (s < 5 ? seqView(m, p, s) : s === 5 ? quizView(m, p) : attestView(m, p, i));
}

function seqView(m, p, s) {
  const q = m.seqs[s], done = p.seq[s];
  let h = `<section class="card"><p class="kicker">Séquence ${s + 1} sur 5</p><h3>${esc(q.title)}</h3>`;
  (q.body || []).forEach(t => h += `<p class="body">${esc(t)}</p>`);
  h += `<div class="question"><p class="qlabel">Question de validation</p><h4 id="qt">${esc(q.question)}</h4><div class="opts" role="radiogroup" aria-labelledby="qt">`;
  q.options.forEach((o, k) => {
    const chosen = ui.seqChoice === k;
    const st = done && chosen ? " right" : (ui.seqFeedback === "ko" && chosen ? " wrong" : "");
    h += `<label class="opt${st}"><input type="radio" name="sq" value="${k}" ${chosen ? "checked" : ""} ${done ? "disabled" : ""}><span>${esc(o)}</span></label>`;
  });
  h += `</div>`;
  if (done) {
    h += `<p class="feedback ok" role="status"><strong>Séquence validée.</strong> ${esc(q.explain || "")}</p>
      <div class="actions"><button class="btn" data-go="${s + 1}">${s < 4 ? "Passer à la séquence " + (s + 2) : "Passer au quiz"}</button></div>`;
  } else {
    if (ui.seqFeedback === "none") h += `<p class="feedback ko" role="alert">Choisissez une réponse avant de valider.</p>`;
    if (ui.seqFeedback === "ko") h += `<p class="feedback ko" role="alert">Ce n'est pas la bonne réponse. Relisez la séquence et essayez à nouveau.</p>`;
    if (ui.err) h += `<p class="feedback ko" role="alert">${esc(ui.err)}</p>`;
    h += `<div class="actions"><button class="btn" data-act="validate" ${ui.busy ? "disabled" : ""}>${ui.busy ? "Vérification…" : "Valider ma réponse"}</button></div>`;
  }
  return h + `</div></section>`;
}

function quizView(m, p) {
  const r = ui.quizResult;
  let h = `<section class="card"><p class="kicker">Quiz final, ${m.quiz.length} questions. Il faut au moins trois quarts de bonnes réponses.</p><h3>Quiz du module ${esc(m.id)}</h3>`;
  if (p.quiz && !r && !ui.retake) {
    return h + `<p class="feedback ok" role="status"><strong>Quiz réussi.</strong>${p.best != null ? ` Meilleur score : ${p.best} sur ${m.quiz.length}.` : ""} Vous pouvez obtenir votre attestation.</p>
      <div class="actions"><button class="btn" data-go="6">Obtenir mon attestation</button><button class="btn ghost" data-act="retake">Refaire le quiz</button></div></section>`;
  }
  m.quiz.forEach((q, qi) => {
    const verdict = r ? r.correct[qi] : null;
    h += `<div class="quiz-q"><h4 id="qq${qi}">${qi + 1}. ${esc(q.text)}${r ? ` <span class="pill ${verdict ? "ok" : "off"}">${verdict ? "Juste" : "À revoir"}</span>` : ""}</h4><div class="opts" role="radiogroup" aria-labelledby="qq${qi}">`;
    q.options.forEach((o, k) => {
      const chosen = ui.quizAnswers[qi] === k;
      const st = r && chosen ? (verdict ? " right" : " wrong") : "";
      h += `<label class="opt${st}"><input type="radio" name="qz${qi}" data-q="${qi}" value="${k}" ${chosen ? "checked" : ""} ${r ? "disabled" : ""}><span>${esc(o)}</span></label>`;
    });
    h += `</div></div>`;
  });
  if (r) {
    h += `<p class="score">${r.score} sur ${r.total}</p>`;
    h += r.passed
      ? `<p class="feedback ok" role="status"><strong>Quiz réussi.</strong> Le carré rouge du drapeau est désormais coloré.</p><div class="actions"><button class="btn" data-go="6">Obtenir mon attestation</button></div>`
      : `<p class="feedback ko" role="alert">Il faut au moins ${r.needed} bonnes réponses. Relisez les séquences liées aux questions marquées « À revoir », puis recommencez.</p><div class="actions"><button class="btn" data-act="retake">Recommencer le quiz</button></div>`;
  } else {
    if (ui.quizMissing) h += `<p class="feedback ko" role="alert">Répondez à toutes les questions avant de corriger.</p>`;
    if (ui.err) h += `<p class="feedback ko" role="alert">${esc(ui.err)}</p>`;
    h += `<div class="actions"><button class="btn" data-act="grade" ${ui.busy ? "disabled" : ""}>${ui.busy ? "Correction…" : "Corriger le quiz"}</button></div>`;
  }
  return h + `</section>`;
}

function attestView(m, p, i) {
  if (!p.code) {
    return `<section class="card"><h3>Votre attestation</h3><p class="body">L'attestation portera le nom de votre profil : <strong>${esc(profile.full_name)}</strong>. Si ce nom est incorrect, demandez sa correction à un administrateur avant de la générer.</p>
      ${ui.err ? `<p class="feedback ko" role="alert">${esc(ui.err)}</p>` : ""}
      <div class="actions"><button class="btn" data-act="mkcert" ${ui.busy ? "disabled" : ""}>${ui.busy ? "Génération…" : "Générer mon attestation"}</button></div></section>`;
  }
  const next = MODULES.findIndex((mm, j) => j > i && hasContent(mm));
  const link = `${appUrl()}?verifier=${encodeURIComponent(p.code)}`;
  return `<section class="card"><div class="cert">
      <div><p class="c-small">Académie UNIS, Ministère de la Santé du Togo</p>
      <p class="c-small" style="margin-top:22px">Attestation de suivi décernée à</p>
      <p class="c-name">${esc(p.name || profile.full_name)}</p>
      <p class="c-mod">pour avoir suivi et validé le module ${esc(m.id)} : ${esc(m.title)} (${esc(m.duration)}).</p>
      <div class="c-foot"><span>Délivrée le<strong>${fmtDate(p.attest)}</strong></span><span>Code de vérification<strong>${esc(p.code)}</strong></span></div>
      <p class="c-small c-link" style="margin-top:16px;font-size:.8rem;word-break:break-all">Vérifiable sur ${esc(link)}</p></div>
      ${flagSVG(p, { w: 150, label: "Drapeau complété" })}
    </div>
    <div class="actions no-print" style="margin-top:22px"><button class="btn" data-act="print">Imprimer l'attestation</button>
    ${next > -1 ? `<button class="btn ghost" data-mod="${next}">Passer au module ${esc(MODULES[next].id)}</button>` : ""}</div></section>`;
}

/* ---------- Administration ---------- */
function adminFiltered() {
  const q = admin.q.trim().toLowerCase();
  return admin.rows.filter(r => (admin.filter === "all" || !r.approved) &&
    (!q || [r.full_name, r.email, r.structure, r.fonction].join(" ").toLowerCase().includes(q)));
}
function adminTable() {
  const list = adminFiltered();
  if (!list.length) return `<p class="body" style="padding:16px;margin:0">${admin.filter === "pending" && !admin.q ? "Aucun compte en attente de validation." : "Aucun compte ne correspond à la recherche."}</p>`;
  let h = `<table><thead><tr><th scope="col">Nom</th><th scope="col">Structure et fonction</th><th scope="col">Inscription</th><th scope="col">Attestations</th><th scope="col">Statut</th><th scope="col">Actions</th></tr></thead><tbody>`;
  list.forEach(r => {
    const att = admin.prog.filter(x => x.user_id === r.id && x.attest_code).map(x => x.module_id);
    const self = r.id === profile.id, who = esc(r.full_name || r.email);
    h += `<tr><td><strong>${esc(r.full_name || "Sans nom")}</strong><br><span class="muted">${esc(r.email)}</span></td>
      <td>${esc(r.structure)}<br><span class="muted">${esc(r.fonction)}</span></td>
      <td>${new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
      <td>${att.length ? esc(att.join(", ")) : '<span class="muted">Aucune</span>'}</td>
      <td>${r.approved ? `<span class="pill ok">Validé</span>` : `<span class="pill wait">En attente</span>`}${r.role === "admin" ? ` <span class="pill ok">Admin</span>` : ""}</td>
      <td class="acts">${self ? `<span class="muted">Votre compte</span>` :
        (r.approved
          ? `<button class="btn ghost mini" data-user="${r.id}" data-op="suspend" aria-label="Suspendre ${who}">Suspendre</button>` +
            (r.role === "admin"
              ? `<button class="btn ghost mini" data-user="${r.id}" data-op="demote" aria-label="Retirer les droits admin de ${who}">Retirer admin</button>`
              : `<button class="btn ghost mini" data-user="${r.id}" data-op="promote" aria-label="Nommer ${who} administrateur">Nommer admin</button>`)
          : `<button class="btn mini" data-user="${r.id}" data-op="approve" aria-label="Valider le compte de ${who}">Valider</button>`)}</td></tr>`;
  });
  return h + `</tbody></table>`;
}
function adminView() {
  const head = `<header style="margin-bottom:26px"><p class="mod-code">Administration</p><h2 class="mod-title">Comptes et progression</h2></header>`;
  if (!admin.loaded) return head + `<p class="body">Chargement des comptes…</p>`;
  const rows = admin.rows, pending = rows.filter(r => !r.approved).length;
  const attests = admin.prog.filter(x => x.attest_code).length;
  return head + `${admin.err ? `<p class="feedback ko" role="alert">${esc(admin.err)}</p>` : ""}
    <div class="stats"><div><strong>${rows.length}</strong>comptes</div><div><strong>${pending}</strong>en attente de validation</div><div><strong>${attests}</strong>attestations délivrées</div></div>
    <div class="toolbar"><div class="tabs" role="group" aria-label="Filtrer les comptes">
      <button type="button" data-filter="pending" aria-pressed="${admin.filter === "pending"}">En attente (${pending})</button>
      <button type="button" data-filter="all" aria-pressed="${admin.filter === "all"}">Tous (${rows.length})</button></div>
      <input id="a-search" type="search" placeholder="Rechercher un nom, un email, une structure" value="${esc(admin.q)}" aria-label="Rechercher un compte">
      <button class="btn ghost" data-act="refreshAdmin">Actualiser</button><button class="btn ghost" data-act="csv">Exporter en CSV</button></div>
    <div class="tablewrap" id="a-table">${adminTable()}</div>`;
}
async function loadAdmin() {
  const [a, b] = await Promise.all([
    sb.from("profiles").select("*").order("created_at", { ascending: false }),
    sb.from("progress").select("user_id,module_id,attest_date,attest_code,quiz_passed")
  ]);
  admin.err = a.error || b.error ? "Impossible de charger les comptes. Vérifiez votre connexion puis actualisez." : null;
  admin.rows = a.data || []; admin.prog = b.data || []; admin.loaded = true;
  render();
}
async function adminOp(id, op) {
  const r = admin.rows.find(x => x.id === id); if (!r) return;
  const who = r.full_name || r.email;
  let approved = r.approved, role = r.role;
  if (op === "approve") approved = true;
  if (op === "suspend") { if (!confirm(`Suspendre l'accès de ${who} ? Ses droits d'administration seront aussi retirés.`)) return; approved = false; role = "apprenant"; }
  if (op === "promote") { if (!confirm(`Donner les droits d'administration à ${who} ?`)) return; role = "admin"; }
  if (op === "demote") role = "apprenant";
  const { error } = await sb.rpc("admin_set_user", { p_user: id, p_approved: approved, p_role: role });
  if (error) admin.err = error.message; else { r.approved = approved; r.role = role; admin.err = null; }
  render();
}
function exportCsv() {
  const ids = MODULES.filter(hasContent).map(m => m.id);
  const safe = v => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const lines = [["Nom", "Email", "Structure", "Fonction", "Statut", "Rôle", "Inscription", ...ids.map(i => "Attestation " + i)]];
  admin.rows.forEach(r => {
    const at = id => { const x = admin.prog.find(y => y.user_id === r.id && y.module_id === id); return x && x.attest_date ? x.attest_date : ""; };
    lines.push([r.full_name, r.email, r.structure, r.fonction, r.approved ? "Validé" : "En attente", r.role, String(r.created_at).slice(0, 10), ...ids.map(at)]);
  });
  const csv = "\ufeff" + lines.map(l => l.map(safe).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `academie-unis-comptes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- Rendu et navigation ---------- */
function render() {
  if (view === "app" || view === "admin") {
    root.innerHTML = `<div class="app"><aside aria-label="Parcours de formation">${side()}</aside><main id="main">${view === "admin" ? adminView() : mainView()}</main></div>`;
  } else {
    root.innerHTML = (V[view] || V.loading)();
  }
}
function resetUi() { ui = { seqChoice: null, seqFeedback: null, quizAnswers: {}, quizResult: null }; }
function goModule(i) { view = "app"; cur = { m: i, step: hasContent(MODULES[i]) ? firstOpenStep(MODULES[i]) : 0 }; resetUi(); render(); window.scrollTo({ top: 0 }); }
function goStep(s) {
  const m = MODULES[cur.m];
  if (!reachable(m, s)) return;
  cur.step = s; resetUi();
  if (s < 5 && prog(m.id).seq[s]) ui.seqChoice = null;
  render(); document.getElementById("main")?.scrollIntoView({ block: "start" });
}

async function enter() {
  const uid = session.user.id;
  const { data: pr, error } = await sb.from("profiles").select("*").eq("id", uid).single();
  if (error || !pr) { notice = { type: "ko", text: "Profil introuvable. Contactez un administrateur de l'UNIS." }; await sb.auth.signOut(); view = "auth"; return render(); }
  profile = pr;
  if (!pr.approved) { view = "pending"; return render(); }
  const { data: rows } = await sb.from("progress").select("*").eq("user_id", uid);
  P = {}; (rows || []).forEach(fromRow);
  const i = MODULES.findIndex((m, k) => hasContent(m) && unlocked(k) && !prog(m.id).code);
  goModule(i > -1 ? i : 0);
}
async function doVerify(code) {
  code = String(code || "").trim().toUpperCase();
  if (!code) return;
  const { data, error } = await sb.rpc("verify_attestation", { p_code: code });
  verify = { code, row: (!error && data && data[0]) || null };
  history.replaceState(null, "", appUrl() + "?verifier=" + encodeURIComponent(code));
  view = "verify"; render();
}

/* ---------- Actions apprenant ---------- */
async function validateSeq() {
  const m = MODULES[cur.m], s = cur.step;
  ui.err = null;
  if (ui.seqChoice == null) { ui.seqFeedback = "none"; return render(); }
  ui.busy = true; render();
  const { data, error } = await sb.rpc("submit_sequence", { p_module: m.id, p_seq: s, p_choice: ui.seqChoice });
  ui.busy = false;
  if (error) ui.err = error.message;
  else if (data === true) { prog(m.id).seq[s] = true; ui.seqFeedback = null; }
  else ui.seqFeedback = "ko";
  render();
}
async function gradeQuiz() {
  const m = MODULES[cur.m];
  ui.err = null;
  if (Object.keys(ui.quizAnswers).length < m.quiz.length) { ui.quizMissing = true; return render(); }
  ui.quizMissing = false; ui.busy = true; render();
  const answers = m.quiz.map((_, qi) => ui.quizAnswers[qi]);
  const { data, error } = await sb.rpc("submit_quiz", { p_module: m.id, p_answers: answers });
  ui.busy = false;
  if (error) { ui.err = error.message; return render(); }
  ui.quizResult = data;
  const p = prog(m.id);
  if (data.passed) p.quiz = true;
  p.best = Math.max(p.best || 0, data.score);
  render();
}
async function makeCert() {
  const m = MODULES[cur.m];
  ui.err = null; ui.busy = true; render();
  const { data, error } = await sb.rpc("issue_attestation", { p_module: m.id });
  ui.busy = false;
  if (error) { ui.err = error.message; return render(); }
  Object.assign(prog(m.id), { attest: data.date, code: data.code, name: data.name });
  render();
}

/* ---------- Formulaires ---------- */
function formError(form, text) {
  const slot = form.querySelector("[data-err]");
  if (slot) { slot.textContent = text; slot.hidden = false; slot.focus?.(); }
  const btn = form.querySelector("button[type=submit]");
  if (btn && btn.dataset.label) { btn.disabled = false; btn.textContent = btn.dataset.label; }
}
function authMsg(err) {
  const m = String(err && err.message || "").toLowerCase();
  if (m.includes("invalid login")) return "Email ou mot de passe incorrect.";
  if (m.includes("not confirmed")) return "Confirmez d'abord votre adresse email grâce au lien reçu.";
  if (m.includes("already registered")) return "Un compte existe déjà avec cet email. Connectez-vous ou réinitialisez votre mot de passe.";
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives. Patientez quelques minutes puis réessayez.";
  if (m.includes("password")) return "Mot de passe refusé : utilisez au moins 10 caractères, en mélangeant lettres et chiffres.";
  if (m.includes("fetch")) return "Connexion au serveur impossible. Vérifiez votre accès à internet.";
  return "Une erreur est survenue : " + (err && err.message || "inconnue");
}
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function onSubmit(form) {
  const fd = Object.fromEntries(new FormData(form));
  Object.keys(fd).forEach(k => { if (!k.startsWith("password")) fd[k] = String(fd[k]).trim(); });
  const btn = form.querySelector("button[type=submit]");
  const busy = () => { if (btn) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.textContent = "Patientez…"; } };
  try {
    if (form.id === "f-verify") { if (fd.code) await doVerify(fd.code); return; }
    if (form.id === "f-login") {
      if (!validEmail(fd.email) || !fd.password) return formError(form, "Saisissez votre email et votre mot de passe.");
      busy();
      const { data, error } = await sb.auth.signInWithPassword({ email: fd.email, password: fd.password });
      if (error) throw error;
      session = data.session; return await enter();
    }
    if (form.id === "f-signup") {
      if (!fd.full_name || !fd.structure || !fd.fonction) return formError(form, "Renseignez votre nom, votre structure et votre fonction.");
      if (!validEmail(fd.email)) return formError(form, "Saisissez une adresse email valide.");
      if (fd.password.length < 10) return formError(form, "Le mot de passe doit contenir au moins 10 caractères.");
      if (fd.password !== fd.password2) return formError(form, "Les deux mots de passe ne correspondent pas.");
      busy();
      const { data, error } = await sb.auth.signUp({
        email: fd.email, password: fd.password,
        options: { emailRedirectTo: appUrl(), data: { full_name: fd.full_name, structure: fd.structure, fonction: fd.fonction } }
      });
      if (error) throw error;
      if (data.session) { session = data.session; return await enter(); }
      sentTo = fd.email; view = "checkEmail"; return render();
    }
    if (form.id === "f-forgot") {
      if (!validEmail(fd.email)) return formError(form, "Saisissez une adresse email valide.");
      busy();
      const { error } = await sb.auth.resetPasswordForEmail(fd.email, { redirectTo: appUrl() });
      if (error) throw error;
      sentTo = fd.email; view = "resetSent"; return render();
    }
    if (form.id === "f-recovery") {
      if (fd.password.length < 10) return formError(form, "Le mot de passe doit contenir au moins 10 caractères.");
      if (fd.password !== fd.password2) return formError(form, "Les deux mots de passe ne correspondent pas.");
      busy();
      const { error } = await sb.auth.updateUser({ password: fd.password });
      if (error) throw error;
      history.replaceState(null, "", appUrl());
      const { data } = await sb.auth.getSession();
      session = data.session; return await enter();
    }
  } catch (err) { formError(form, authMsg(err)); }
}

/* ---------- Événements ---------- */
document.addEventListener("submit", e => { e.preventDefault(); onSubmit(e.target); });
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-theme-set],[data-tab],[data-act],[data-mod],[data-step],[data-go],[data-filter],[data-op]");
  if (!t) return;
  const d = t.dataset;
  if (d.themeSet) {
    window.UNIS_THEME && window.UNIS_THEME.set(d.themeSet);
    document.querySelectorAll("[data-theme-set]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.themeSet === d.themeSet)));
    return;
  }
  if (d.tab) { authTab = d.tab; return render(); }
  if (d.mod !== undefined) return goModule(+d.mod);
  if (d.step !== undefined) return goStep(+d.step);
  if (d.go !== undefined) return goStep(+d.go);
  if (d.filter) { admin.filter = d.filter; return render(); }
  if (d.op) return adminOp(d.user, d.op);
  switch (d.act) {
    case "toLogin": authTab = "login"; view = "auth"; return render();
    case "recheck": return enter();
    case "logout": await sb.auth.signOut(); session = null; profile = null; P = {}; view = "auth"; authTab = "login"; return render();
    case "toAdmin": view = "admin"; admin.loaded = false; render(); return loadAdmin();
    case "toApp": return goModule(cur.m);
    case "refreshAdmin": admin.loaded = false; render(); return loadAdmin();
    case "csv": return exportCsv();
    case "validate": return validateSeq();
    case "grade": return gradeQuiz();
    case "retake": resetUi(); ui.retake = true; return render();
    case "mkcert": return makeCert();
    case "print": return window.print();
  }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.name === "sq") { ui.seqChoice = +t.value; ui.seqFeedback = null; }
  if (t.dataset && t.dataset.q !== undefined) ui.quizAnswers[+t.dataset.q] = +t.value;
});
document.addEventListener("input", e => {
  if (e.target.id === "a-search") { admin.q = e.target.value; document.getElementById("a-table").innerHTML = adminTable(); }
});

/* ---------- Démarrage ---------- */
async function init() {
  if (!cfg.SUPABASE_URL || /VOTRE/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY)) { view = "setup"; return render(); }
  sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  try {
    const r = await fetch("content.json", { cache: "no-cache" });
    if (!r.ok) throw new Error("absent");
    MODULES = (await r.json()).modules;
    if (!Array.isArray(MODULES) || !MODULES.length) throw new Error("vide");
  } catch (e) { view = "contentError"; return render(); }

  const code = new URLSearchParams(location.search).get("verifier");
  if (code) return doVerify(code);

  sb.auth.onAuthStateChange((event, s) => {
    if (event === "PASSWORD_RECOVERY") { session = s; view = "recovery"; render(); }
    if (event === "SIGNED_OUT" && view !== "auth") { session = null; profile = null; P = {}; view = "auth"; render(); }
  });
  const { data } = await sb.auth.getSession();
  if (view === "recovery") return;
  session = data.session;
  if (session) await enter(); else { view = "auth"; render(); }
}
init();
