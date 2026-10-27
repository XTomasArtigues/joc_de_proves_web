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
function formataData(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ca-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "—";
  }
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

  const cardConcursos = h(`
    <div class="card card-clickable" style="margin-top:28px;">
      <h3>🏆 Concursos</h3>
      <p>Si el teu equip participa en algun concurs, aquí trobaràs els problemes i el marcador.</p>
    </div>`);
  cardConcursos.addEventListener("click", () => { location.hash = "concursos"; });
  app.appendChild(cardConcursos);
}

// ---- Concursos (equips): llista, detall, problema i marcador ----

function badgeEstatConcursAlumnat(c) {
  if (!c.haComencat) return '<span class="badge" style="background:#999">⏳ no ha començat</span>';
  if (c.haAcabat) return '<span class="badge" style="background:#555">🏁 finalitzat</span>';
  return '<span class="badge" style="background:#1e8449">🟢 en marxa</span>';
}

async function mostraConcursosAlumnat() {
  app.innerHTML = "";
  app.appendChild(barraAlumne());
  const tornar = h(`<span class="tornar">← Totes les evidències</span>`);
  tornar.addEventListener("click", () => (location.hash = ""));
  app.appendChild(tornar);
  app.appendChild(h(`<h2>🏆 Concursos</h2>`));

  let concursos;
  try {
    concursos = await apiAlumnat("/api/concursos");
  } catch (e) {
    return;
  }
  if (!concursos.length) {
    app.appendChild(h(`<div class="card"><p>El teu equip encara no participa en cap concurs. Parla amb la professora.</p></div>`));
    return;
  }
  concursos.forEach((c) => {
    const card = h(`
      <div class="card card-clickable">
        <h3>${escapa(c.nom)} ${badgeEstatConcursAlumnat(c)}</h3>
        <p><small>Inici: ${formataData(c.dataInici)} · Durada: ${c.duracioMinuts} min</small></p>
      </div>`);
    card.addEventListener("click", () => { location.hash = `concurs/${encodeURIComponent(c.id)}`; });
    app.appendChild(card);
  });
}

async function mostraDetallConcursAlumnat(id) {
  app.innerHTML = "";
  app.appendChild(barraAlumne());
  const tornar = h(`<span class="tornar">← Tots els concursos</span>`);
  tornar.addEventListener("click", () => (location.hash = "concursos"));
  app.appendChild(tornar);

  let c;
  try {
    c = await apiAlumnat(`/api/concursos/${encodeURIComponent(id)}`);
  } catch (e) {
    app.appendChild(h(`<div class="card"><p>${escapa(e.message)}</p></div>`));
    return;
  }

  app.appendChild(h(`<h2>${escapa(c.nom)} ${badgeEstatConcursAlumnat(c)}</h2>`));

  if (!c.haComencat) {
    app.appendChild(h(`<div class="avis">⏳ Aquest concurs encara no ha començat. Comença el <strong>${formataData(c.dataInici)}</strong> i dura ${c.duracioMinuts} minuts. Torna llavors per veure els problemes.</div>`));
    return;
  }

  app.appendChild(
    h(
      `<div class="avis">${
        c.haAcabat
          ? "🏁 Aquest concurs ja ha finalitzat. Ja no es poden fer més entregues, però pots consultar el marcador final."
          : `🟢 El concurs és en marxa (dura ${c.duracioMinuts} minuts des de ${formataData(c.dataInici)}). Cada problema val els punts indicats; un cop el resolgueu, no cal tornar-lo a entregar.${
              c.bonusPrimer ? ` 🥇 El primer equip a resoldre un problema suma ${c.bonusPrimer} punts extra.` : ""
            }`
      }</div>`
    )
  );

  const btnMarcador = h(`<button class="secondary">📊 Veure el marcador</button>`);
  btnMarcador.addEventListener("click", () => { location.hash = `concurs/${encodeURIComponent(id)}/marcador`; });
  app.appendChild(btnMarcador);

  app.appendChild(h(`<h3 style="margin-top:20px;">Problemes</h3>`));
  if (!c.problemes.length) {
    app.appendChild(h(`<div class="card"><p>Encara no hi ha cap problema configurat.</p></div>`));
    return;
  }
  c.problemes.forEach((pr) => {
    const card = h(`
      <div class="card card-clickable">
        <h3>${escapa(pr.codi)} — ${escapa(pr.titol)} <span class="badge">${pr.punts} punts</span></h3>
        <p>${escapa((pr.enunciat || "").slice(0, 140))}${(pr.enunciat || "").length > 140 ? "…" : ""}</p>
      </div>`);
    card.addEventListener("click", () => { location.hash = `concurs/${encodeURIComponent(id)}/${encodeURIComponent(pr.codi)}`; });
    app.appendChild(card);
  });
}

async function mostraProblemaConcurs(id, codiProblema) {
  app.innerHTML = "";
  app.appendChild(barraAlumne());
  const tornar = h(`<span class="tornar">← Tornar al concurs</span>`);
  tornar.addEventListener("click", () => { location.hash = `concurs/${encodeURIComponent(id)}`; });
  app.appendChild(tornar);

  let c;
  try {
    c = await apiAlumnat(`/api/concursos/${encodeURIComponent(id)}`);
  } catch (e) {
    app.appendChild(h(`<div class="card"><p>${escapa(e.message)}</p></div>`));
    return;
  }
  const pr = (c.problemes || []).find((x) => x.codi === codiProblema);
  if (!pr) {
    app.appendChild(h(`<div class="card"><p>Problema no trobat.</p></div>`));
    return;
  }

  app.appendChild(h(`<h2>${escapa(pr.codi)} — ${escapa(pr.titol)} <span class="badge">${pr.punts} punts</span></h2>`));
  app.appendChild(h(`<div class="card"><p class="enunciat">${escapa(pr.enunciat)}</p></div>`));

  if (c.haAcabat) {
    app.appendChild(h(`<div class="avis">🏁 Aquest concurs ja ha finalitzat; ja no es poden fer més entregues.</div>`));
    return;
  }
  if (!pr.numProves) {
    app.appendChild(h(`<div class="avis">Aquest problema encara no té cap joc de proves configurat per la professora.</div>`));
    return;
  }

  const bloc = h(`
    <div class="card">
      <label>El vostre script</label>
      <textarea class="simple" id="codi-script" rows="10" spellcheck="false" placeholder="Escriu aquí el vostre codi…"></textarea>
      <button id="btn-entrega">Entrega i comprova</button>
      <div id="resultat"></div>
    </div>`);
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
      const res = await apiAlumnat(`/api/concursos/${encodeURIComponent(id)}/problemes/${encodeURIComponent(codiProblema)}/entrega`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codiScript }),
      });
      const proves = res.resultatsProves
        .map((r) => `<div class="prova-linia"><span class="${r.ok ? "prova-ok" : "prova-fail"}">${r.ok ? "✅" : "❌"} ${escapa(r.nom)}</span><br><small>${escapa(r.detall)}</small></div>`)
        .join("");
      resultatDiv.innerHTML = `
        <div class="resultat ${res.superat ? "ok" : "no-ok"}">
          <p><strong>Intent número ${res.intents}.</strong> ${res.superat ? "✅ PROBLEMA RESOLT" : "❌ Encara no"}</p>
          ${proves}
        </div>`;
    } catch (e) {
      resultatDiv.innerHTML = `<div class="resultat no-ok">${escapa(e.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrega i comprova";
    }
  });
}

async function mostraMarcadorConcurs(id) {
  app.innerHTML = "";
  app.appendChild(barraAlumne());
  const tornar = h(`<span class="tornar">← Tornar al concurs</span>`);
  tornar.addEventListener("click", () => { location.hash = `concurs/${encodeURIComponent(id)}`; });
  app.appendChild(tornar);
  app.appendChild(h(`<h2>📊 Marcador</h2>`));

  let dades;
  try {
    dades = await apiAlumnat(`/api/concursos/${encodeURIComponent(id)}/marcador`);
  } catch (e) {
    app.appendChild(h(`<div class="card"><p>${escapa(e.message)}</p></div>`));
    return;
  }
  const div = h(`<div></div>`);
  app.appendChild(div);
  renderitzaMarcadorAlumnat(div, dades);
}

function renderitzaMarcadorAlumnat(div, dades) {
  const problemes = dades.problemes || [];
  if (!dades.marcador || !dades.marcador.length) {
    div.innerHTML = `<p><em>Encara no hi ha cap equip al marcador.</em></p>`;
    return;
  }
  const capcaleresProblemes = problemes.map((pr) => `<th>${escapa(pr.codi)}<br /><small>${pr.punts} punts</small></th>`).join("");
  const files = dades.marcador
    .map((fila, i) => {
      const celles = problemes
        .map((pr) => {
          const cel = fila.celles.find((c) => c.codi === pr.codi);
          if (!cel || cel.estat === "blanc") return `<td style="background:#f4f4f4">—</td>`;
          if (cel.estat === "vermell") return `<td style="background:#f8d7da">${cel.intents}</td>`;
          const color = cel.estat === "primer" ? "#2e7d32" : "#c8e6c9";
          const textColor = cel.estat === "primer" ? "#fff" : "#1b1b1b";
          const bonusText = cel.bonus ? `<br /><small>🥇 +${cel.bonus}</small>` : "";
          return `<td style="background:${color};color:${textColor}">${cel.intents} (${cel.tempsResolucio}+${cel.penalitzacio})${bonusText}</td>`;
        })
        .join("");
      return `<tr>
        <td><strong>${i + 1}.</strong> ${escapa(fila.nom)}</td>
        <td><strong>${fila.punts}</strong></td>
        <td>${fila.temps}</td>
        ${celles}
      </tr>`;
    })
    .join("");
  div.innerHTML = `
    <table>
      <thead><tr><th>Equip</th><th>Punts</th><th>Temps (min)</th>${capcaleresProblemes}</tr></thead>
      <tbody>${files}</tbody>
    </table>
    <p><small>🟩 verd fosc = primer equip a resoldre el problema (🥇 = bonus de punts inclòs). Format de cada cel·la: intents (minuts fins a l'encert + minuts de penalització).</small></p>`;
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
    app.appendChild(h(`<div class="avis">📋 Això és una <strong>evidència avaluable</strong>: la nota depèn de l'intent en què la superis (1r - 10, 2n - 8, 3r - 6, 4t - 4, 5è - 2. 6è - 1), i tens un màxim de <strong>6 intents</strong>. Si els esgotes sense superar-la, la nota final queda fixada en 1 (6è intent).</div>`));
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

  app.appendChild(
    h(
      `<h3>${esRepte ? "Rànquing d'aquest repte" : "Els teus intents d'aquesta evidència"}</h3>`
    )
  );
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
    div.innerHTML = esRepte
      ? `<p><em>Encara ningú ha entregat res per a aquest element.</em></p>`
      : `<p><em>Encara no has entregat res per a aquesta evidència.</em></p>`;
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

  // Evidències: per privacitat, el servidor només envia la pròpia fila de
  // l'alumne/a (mai la dels companys). Es mostra l'estat actual i, a sota,
  // l'historial complet dels seus propis intents amb data i hora (2026-10-27).
  const a = estat.alumnes[0];
  const historial = a.historial || [];
  const filesHistorial = historial
    .map((iso, i) => `<tr><td>Intent ${i + 1}</td><td>${formataData(iso)}</td></tr>`)
    .join("");
  div.innerHTML = `
    <p>
      <strong>Intents:</strong> ${a.intents} &middot;
      <strong>Superat:</strong> ${a.superat ? "Sí" : a.bloquejat ? "No (6 intents esgotats)" : "No"} &middot;
      <strong>Nota:</strong> ${a.nota != null ? a.nota : "pendent"}
      ${a.primer ? ' <span class="badge primer">🏆 vas ser el/la primer/a de la classe</span>' : ""}
    </p>
    <table><thead><tr><th>Intent</th><th>Data i hora</th></tr></thead><tbody>${filesHistorial}</tbody></table>`;
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
  const ruta = location.hash.replace(/^#/, "");
  if (!ruta) return mostraLlista();
  if (ruta === "concursos") return mostraConcursosAlumnat();
  const mConcurs = ruta.match(/^concurs\/([^/]+)\/marcador$/);
  if (mConcurs) return mostraMarcadorConcurs(mConcurs[1]);
  const mProblema = ruta.match(/^concurs\/([^/]+)\/([^/]+)$/);
  if (mProblema) return mostraProblemaConcurs(mProblema[1], mProblema[2]);
  const mDetallConcurs = ruta.match(/^concurs\/([^/]+)$/);
  if (mDetallConcurs) return mostraDetallConcursAlumnat(mDetallConcurs[1]);
  mostraEvidencia(ruta);
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
