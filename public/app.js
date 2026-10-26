// Frontend de l'alumnat (sense cap framework, vanilla JS).
const app = document.getElementById("app");

function h(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.firstElementChild;
}
function escapa(text) {
  return (text || "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// API pública (no requereix sessió): llista d'evidències/reptes, enunciat, rànquing.
async function api(ruta, opcions) {
  const resp = await fetch(ruta, opcions);
  const dades = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dades.error || `Error ${resp.status}`);
  return dades;
}

// ---- sessió de l'alumne/a ----
// S'usa sessionStorage (no localStorage) perquè els ordinadors de l'aula
// solen ser compartits entre alumnat de grups diferents: la sessió es tanca
// en tancar la pestanya/finestra, no queda oberta per al següent que l'usi.
let alumneActual = null; // { usuari, nom, contrasenyaCanviada }

function getTokenAlumne() {
  try { return sessionStorage.getItem("jocdeproves_alumne_token") || ""; } catch (e) { return ""; }
}
function setTokenAlumne(t) {
  try { sessionStorage.setItem("jocdeproves_alumne_token", t); } catch (e) {}
}
function esborraTokenAlumne() {
  try { sessionStorage.removeItem("jocdeproves_alumne_token"); } catch (e) {}
}

// API autenticada (com a alumne/a): entrega, canvi de contrasenya, perfil propi.
async function apiAlumnat(ruta, opcions = {}) {
  opcions.headers = Object.assign({}, opcions.headers, { Authorization: `Bearer ${getTokenAlumne()}` });
  const resp = await fetch(ruta, opcions);
  const dades = await resp.json().catch(() => ({}));
  if (resp.status === 401) {
    esborraTokenAlumne();
    alumneActual = null;
    mostraLoginAlumnat("La sessió ha caducat o no és vàlida. Torna a entrar.");
    throw new Error("No autoritzat.");
  }
  if (!resp.ok) throw new Error(dades.error || `Error ${resp.status}`);
  return dades;
}

function mostraLoginAlumnat(avis) {
  app.innerHTML = "";
  app.appendChild(h(`
    <div class="card" style="max-width:420px;margin:40px auto;">
      <h2>Accés de l'alumnat</h2>
      ${avis ? `<div class="avis">${escapa(avis)}</div>` : ""}
      <label>Nom d'usuari</label>
      <input type="text" id="login-usuari" autocomplete="username" />
      <label>Contrasenya</label>
      <input type="password" id="login-contrasenya" autocomplete="current-password" />
      <button id="btn-login-alumne">Entra</button>
      <p id="login-alumne-error" style="color:#c0392b"></p>
      <p style="margin-top:14px;"><small>Si no tens usuari i contrasenya, demana'ls a la professora.</small></p>
    </div>
  `));
  document.getElementById("btn-login-alumne").addEventListener("click", loginAlumne);
  document.getElementById("login-contrasenya").addEventListener("keydown", (e) => { if (e.key === "Enter") loginAlumne(); });
}

async function loginAlumne() {
  const usuari = document.getElementById("login-usuari").value.trim();
  const contrasenya = document.getElementById("login-contrasenya").value;
  const err = document.getElementById("login-alumne-error");
  if (!usuari || !contrasenya) {
    err.textContent = "Cal escriure l'usuari i la contrasenya.";
    return;
  }
  try {
    const res = await fetch("/api/alumnat/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuari, contrasenya }),
    });
    const dades = await res.json();
    if (!res.ok) throw new Error(dades.error || "Error");
    setTokenAlumne(dades.token);
    alumneActual = { usuari: dades.usuari, nom: dades.nom, contrasenyaCanviada: dades.contrasenyaCanviada };
    router();
  } catch (e) {
    err.textContent = e.message;
  }
}

function barraAlumne() {
  const barra = h(`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
      <span>Connectat/da com a <strong>${escapa(alumneActual.nom)}</strong></span>
      <div>
        <button class="secondary" id="btn-canvia-contrasenya-alumne">Canvia la contrasenya</button>
        <button class="secondary" id="btn-logout-alumne">Tanca sessió</button>
      </div>
    </div>`);
  barra.querySelector("#btn-canvia-contrasenya-alumne").addEventListener("click", mostraCanviaContrasenyaAlumnat);
  barra.querySelector("#btn-logout-alumne").addEventListener("click", () => {
    esborraTokenAlumne();
    alumneActual = null;
    mostraLoginAlumnat();
  });
  return barra;
}

function avisCanviaContrasenya() {
  if (alumneActual.contrasenyaCanviada) return null;
  const avis = h(`
    <div class="avis">
      🔑 Encara tens la contrasenya que et va donar la professora.
      <a href="#" id="link-canvia-ara">Canvia-la ara</a> (recomanat).
    </div>`);
  avis.querySelector("#link-canvia-ara").addEventListener("click", (e) => {
    e.preventDefault();
    mostraCanviaContrasenyaAlumnat();
  });
  return avis;
}

function mostraCanviaContrasenyaAlumnat() {
  app.innerHTML = "";
  app.appendChild(barraAlumne());
  const tornar = h(`<span class="tornar">← Tornar</span>`);
  tornar.addEventListener("click", () => router());
  app.appendChild(tornar);
  app.appendChild(h(`
    <div class="card" style="max-width:420px;">
      <h3>Canvia la teva contrasenya</h3>
      <label>Contrasenya actual</label>
      <input type="password" id="cc-actual" autocomplete="current-password" />
      <label>Contrasenya nova</label>
      <input type="password" id="cc-nova" autocomplete="new-password" />
      <button id="btn-desa-cc">Desa la nova contrasenya</button>
      <p id="cc-msg"></p>
    </div>
  `));
  document.getElementById("btn-desa-cc").addEventListener("click", async () => {
    const actual = document.getElementById("cc-actual").value;
    const nova = document.getElementById("cc-nova").value;
    const msg = document.getElementById("cc-msg");
    try {
      await apiAlumnat("/api/alumnat/canvia-contrasenya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual, nova }),
      });
      msg.style.color = "#1e8449";
      msg.textContent = "Contrasenya canviada correctament.";
      alumneActual.contrasenyaCanviada = true;
    } catch (e) {
      msg.style.color = "#c0392b";
      msg.textContent = e.message;
    }
  });
}

async function mostraLlista() {
  app.innerHTML = "";
  app.appendChild(barraAlumne());
  const avis = avisCanviaContrasenya();
  if (avis) app.appendChild(avis);
  app.appendChild(h(`<p>Carregant evidències…</p>`));

  let evidencies;
  try {
    evidencies = await api("/api/evidencies");
  } catch (e) {
    app.appendChild(h(`<div class="card"><p>No s'han pogut carregar les evidències: ${escapa(e.message)}</p></div>`));
    return;
  }
  app.innerHTML = "";
  app.appendChild(barraAlumne());
  const avis2 = avisCanviaContrasenya();
  if (avis2) app.appendChild(avis2);

  if (!evidencies.length) {
    app.appendChild(h(`<h2>Joc de Proves</h2>`));
    app.appendChild(h(`<div class="card"><p>Encara no hi ha cap evidència ni repte configurat. Parla amb la professora.</p></div>`));
    return;
  }

  function creaCard(ev) {
    const resum = (ev.enunciat || "").slice(0, 140);
    const card = h(`
      <div class="card card-clickable" data-codi="${escapa(ev.codi)}">
        <h3>${escapa(ev.codi)} — ${escapa(ev.titol)} ${ev.numProves ? "" : '<span class="badge" style="background:#999">sense proves encara</span>'}</h3>
        <p>${escapa(resum)}${(ev.enunciat || "").length > 140 ? "…" : ""}</p>
      </div>`);
    card.addEventListener("click", () => {
      location.hash = `#${ev.codi}`;
    });
    return card;
  }

  const evidenciesLlista = evidencies.filter((ev) => ev.tipus !== "repte");
  const reptesLlista = evidencies.filter((ev) => ev.tipus === "repte");

  app.appendChild(h(`<h2>📋 Evidències</h2>`));
  app.appendChild(h(`<p><small>Es corregeixen automàticament i compten per a la nota. Màxim 6 intents.</small></p>`));
  if (!evidenciesLlista.length) app.appendChild(h(`<div class="card"><p>Encara no hi ha cap evidència configurada.</p></div>`));
  evidenciesLlista.forEach((ev) => app.appendChild(creaCard(ev)));

  app.appendChild(h(`<h2 style="margin-top:28px;">🎯 Reptes de classe</h2>`));
  app.appendChild(h(`<p><small>Per practicar: sense nota, pots intentar-ho tants cops com vulguis.</small></p>`));
  if (!reptesLlista.length) app.appendChild(h(`<div class="card"><p>Encara no hi ha cap repte configurat.</p></div>`));
  reptesLlista.forEach((ev) => app.appendChild(creaCard(ev)));
}

async function mostraEvidencia(codi) {
  app.innerHTML = "";
  app.appendChild(barraAlumne());
  app.appendChild(h(`<p>Carregant…</p>`));
  let ev, estat;
  try {
    [ev, estat] = await Promise.all([api(`/api/evidencies/${encodeURIComponent(codi)}`), apiAlumnat(`/api/evidencies/${encodeURIComponent(codi)}/estat`)]);
  } catch (e) {
    app.innerHTML = "";
    app.appendChild(barraAlumne());
    app.appendChild(h(`<div class="card"><p>${escapa(e.message)}</p></div>`));
    return;
  }
  app.innerHTML = "";
  app.appendChild(barraAlumne());
  const tornar = h(`<span class="tornar">← Totes les evidències</span>`);
  tornar.addEventListener("click", () => (location.hash = ""));
  app.appendChild(tornar);

  const esRepte = ev.tipus === "repte";
  app.appendChild(h(`<h2>${escapa(ev.codi)} — ${escapa(ev.titol)} <span class="badge" style="background:${esRepte ? "#8e6fc0" : "var(--mission)"};">${esRepte ? "Repte de pràctica" : "Evidència avaluable"}</span></h2>`));
  app.appendChild(h(`<div class="card"><p class="enunciat">${escapa(ev.enunciat)}</p></div>`));
  if (esRepte) {
    app.appendChild(h(`<div class="avis">🎯 Això és un <strong>repte de pràctica</strong>: no té nota, i pots entregar-lo tants cops com vulguis fins que et surti bé.</div>`));
  } else {
    app.appendChild(h(`<div class="avis">📋 Això és una <strong>evidència avaluable</strong>: la nota depèn de l'intent en què la superis, i tens un màxim de <strong>6 intents</strong>. Si els esgotes sense superar-la, la nota final queda fixada en 1.</div>`));
  }

  if (!ev.numProves) {
    app.appendChild(h(`<div class="avis">Aquest element encara no té cap joc de proves configurat per la professora. Torna-ho a provar més endavant.</div>`));
    return;
  }

  const bloc = h(`
    <div class="card">
      <label>El teu script</label>
      <textarea class="editor" id="codi-script" placeholder="// escriu aquí el teu codi JavaScript"></textarea>
      <button id="btn-entrega">Entrega i comprova</button>
      <div id="resultat"></div>
    </div>
  `);
  app.appendChild(bloc);

  document.getElementById("btn-entrega").addEventListener("click", async () => {
    const codiScript = document.getElementById("codi-script").value;
    const resultatDiv = document.getElementById("resultat");
    if (!codiScript.trim()) {
      resultatDiv.innerHTML = `<div class="resultat no-ok">El script és buit.</div>`;
      return;
    }
    const btn = document.getElementById("btn-entrega");
    btn.disabled = true;
    btn.textContent = "Comprovant…";
    try {
      const res = await apiAlumnat(`/api/evidencies/${encodeURIComponent(codi)}/entrega`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codiScript }),
      });
      renderitzaResultat(resultatDiv, res);
      carregaRanquing(codi, esRepte);
    } catch (e) {
      resultatDiv.innerHTML = `<div class="resultat no-ok">${escapa(e.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrega i comprova";
    }
  });

  app.appendChild(h(`<h3>Rànquing d'aquest ${esRepte ? "repte" : "evidència"}</h3>`));
  const ranquingDiv = h(`<div id="ranquing"></div>`);
  app.appendChild(ranquingDiv);
  renderitzaRanquing(ranquingDiv, estat, esRepte);
}

function renderitzaResultat(div, res) {
  const proves = res.resultatsProves
    .map((r) => `<div class="prova-linia"><span class="${r.ok ? "prova-ok" : "prova-fail"}">${r.ok ? "✅" : "❌"} ${escapa(r.nom)}</span><br><small>${escapa(r.detall)}</small></div>`)
    .join("");

  if (res.tipus === "repte") {
    const extra = res.superat
      ? `<p>✅ Ho has aconseguit en ${res.intentSuperat} intent${res.intentSuperat === 1 ? "" : "s"}. Pots seguir practicant si vols.</p>`
      : `<p>Encara no ho has aconseguit. Pots tornar-ho a intentar tants cops com vulguis.</p>`;
    div.innerHTML = `
      <div class="resultat ${res.superat ? "ok" : "no-ok"}">
        <p><strong>Intent número ${res.intent}.</strong> ${res.superat ? "✅ SUPERAT" : "❌ Encara no superat"}</p>
        ${proves}
        ${extra}
      </div>`;
    return;
  }

  let extra = "";
  if (res.superat) {
    extra = `<p class="nota-gran">Nota: ${res.nota} / 10</p>`;
    if (res.primerCop) extra += `<p>🏆 Ets el/la primer/a de la classe a superar-ho! +1 punt de bonus ja inclòs.</p>`;
  } else if (res.bloquejat) {
    extra = `<p><strong>Has esgotat els 6 intents sense superar-ho.</strong> La teva nota final per a aquesta evidència és ${res.nota}. Ja no pots tornar a entregar-la.</p>`;
  } else {
    extra = `<p>Encara no superat. Et queden intents (fins a un màxim de 6 en total)${res.nota != null ? ` — nota actual: ${res.nota}` : ""}.</p>`;
  }
  div.innerHTML = `
    <div class="resultat ${res.superat ? "ok" : "no-ok"}">
      <p><strong>Intent número ${res.intent} de 6.</strong> ${res.superat ? "✅ SUPERAT" : "❌ Encara no superat"}</p>
      ${proves}
      ${extra}
    </div>`;
}

function renderitzaRanquing(div, estat, esRepte) {
  if (!estat.alumnes.length) {
    div.innerHTML = `<p><em>Encara ningú ha entregat res per a aquest element.</em></p>`;
    return;
  }
  if (esRepte) {
    const files = estat.alumnes
      .map(
        (a) => `<tr>
          <td>${escapa(a.nom)}</td>
          <td>${a.intents}</td>
          <td>${a.superat ? `Sí (a l'intent ${a.intentSuperat})` : "Encara no"}</td>
        </tr>`
      )
      .join("");
    div.innerHTML = `<table><thead><tr><th>Alumne/a</th><th>Intents</th><th>Superat</th></tr></thead><tbody>${files}</tbody></table>`;
    return;
  }
  const files = estat.alumnes
    .map(
      (a) => `<tr>
        <td>${escapa(a.nom)}${a.primer ? ' <span class="badge primer">🏆 primer/a</span>' : ""}</td>
        <td>${a.intents}</td>
        <td>${a.superat ? "Sí" : a.bloquejat ? "No (6 intents esgotats)" : "No"}</td>
        <td>${a.nota != null ? a.nota : "pendent"}</td>
      </tr>`
    )
    .join("");
  div.innerHTML = `<table><thead><tr><th>Alumne/a</th><th>Intents</th><th>Superat</th><th>Nota</th></tr></thead><tbody>${files}</tbody></table>`;
}

async function carregaRanquing(codi, esRepte) {
  const div = document.getElementById("ranquing");
  if (!div) return;
  try {
    const estat = await apiAlumnat(`/api/evidencies/${encodeURIComponent(codi)}/estat`);
    renderitzaRanquing(div, estat, esRepte);
  } catch (e) {
    /* ignorar */
  }
}

function router() {
  if (!alumneActual) return;
  const codi = location.hash.replace(/^#/, "");
  if (codi) mostraEvidencia(codi);
  else mostraLlista();
}
window.addEventListener("hashchange", router);

async function arrencada() {
  const token = getTokenAlumne();
  if (!token) {
    mostraLoginAlumnat();
    return;
  }
  try {
    const jo = await apiAlumnat("/api/alumnat/jo");
    alumneActual = jo;
    router();
  } catch (e) {
    /* apiAlumnat ja mostra la pantalla de login si cal */
  }
}
arrencada();
