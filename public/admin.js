// Frontend d'administració (sense cap framework, vanilla JS).
const app = document.getElementById("app");

function h(html) {
  const div = document.createElement("div");
  div.innerHTML = html.trim();
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
async function alternaOcult(codi, ocultActual, callback) {
  try {
    await api(`/api/admin/evidencies/${encodeURIComponent(codi)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ocult: !ocultActual }),
    });
    callback();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

// ---- bloc reutilitzable per introduir una o més sortides acceptades ----
// Algunes proves admeten més d'una sortida correcta (p. ex. una condició com
// edat<=16 pot donar true o false depenent de com l'alumnat hagi plantejat
// l'script, i totes dues han de comptar com a bones).
function creaBlocSortides(valorsInicials) {
  const valors = valorsInicials && valorsInicials.length ? valorsInicials : [""];
  const bloc = h(`<div class="bloc-sortides"></div>`);
  function afegeixFila(valor) {
    const fila = h(`
      <div class="fila-sortida" style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
        <input type="text" class="sortida-input" style="flex:1" value="${escapa(valor || "")}" placeholder="Sortida acceptada" />
        <button type="button" class="secondary btn-treu-sortida" title="Treu aquesta alternativa">✕</button>
      </div>`);
    fila.querySelector(".btn-treu-sortida").addEventListener("click", () => {
      if (bloc.querySelectorAll(".fila-sortida").length > 1) fila.remove();
      else fila.querySelector(".sortida-input").value = "";
    });
    bloc.appendChild(fila);
  }
  valors.forEach(afegeixFila);
  const btnAfegeix = h(`<button type="button" class="secondary">+ Afegeix una sortida alternativa</button>`);
  btnAfegeix.addEventListener("click", () => afegeixFila(""));
  bloc.appendChild(btnAfegeix);
  bloc.llegeixValors = () =>
    Array.from(bloc.querySelectorAll(".sortida-input"))
      .map((inp) => inp.value.trim())
      .filter((v) => v.length > 0);
  return bloc;
}

function getToken() {
  try { return sessionStorage.getItem("jocdeproves_admin_token") || ""; } catch (e) { return ""; }
}
function setToken(t) {
  try { sessionStorage.setItem("jocdeproves_admin_token", t); } catch (e) {}
}
function esborraToken() {
  try { sessionStorage.removeItem("jocdeproves_admin_token"); } catch (e) {}
}

async function api(ruta, opcions = {}) {
  opcions.headers = Object.assign({}, opcions.headers, { Authorization: `Bearer ${getToken()}` });
  const resp = await fetch(ruta, opcions);
  const dades = await resp.json().catch(() => ({}));
  if (resp.status === 401) {
    esborraToken();
    mostraLogin("La sessió ha caducat o no és vàlida. Torna a entrar.");
    throw new Error("No autoritzat.");
  }
  if (!resp.ok) throw new Error(dades.error || `Error ${resp.status}`);
  return dades;
}

function mostraLogin(avis) {
  app.innerHTML = "";
  app.appendChild(h(`
    <div class="card" style="max-width:420px;margin:40px auto;">
      <h2>Accés professora</h2>
      ${avis ? `<div class="avis">${escapa(avis)}</div>` : ""}
      <label>Contrasenya</label>
      <input type="password" id="pwd" />
      <button id="btn-login">Entra</button>
      <p id="login-error" style="color:#c0392b"></p>
    </div>
  `));
  document.getElementById("btn-login").addEventListener("click", login);
  document.getElementById("pwd").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
}

async function login() {
  const password = document.getElementById("pwd").value;
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const dades = await res.json();
    if (!res.ok) throw new Error(dades.error || "Error");
    setToken(dades.token);
    mostraDashboard();
  } catch (e) {
    document.getElementById("login-error").textContent = e.message;
  }
}

async function mostraDashboard() {
  app.innerHTML = "<p>Carregant…</p>";
  let evidencies;
  try {
    evidencies = await api("/api/admin/evidencies");
  } catch (e) {
    return;
  }
  app.innerHTML = "";

  const capsalera = h(`<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
    <h2>Evidències i reptes</h2>
    <div>
      <button id="btn-alumnat" class="secondary">👤 Alumnat</button>
      <button id="btn-concursos" class="secondary">🏆 Concursos</button>
      <button id="btn-exporta" class="secondary">⬇️ Còpia de seguretat</button>
      <button id="btn-importa" class="secondary">⬆️ Restaura còpia</button>
      <button id="btn-canvia-pwd" class="secondary">Canviar contrasenya</button>
      <button id="btn-logout" class="secondary">Tanca sessió</button>
    </div>
  </div>`);
  app.appendChild(capsalera);
  document.getElementById("btn-logout").addEventListener("click", () => { esborraToken(); mostraLogin(); });
  document.getElementById("btn-canvia-pwd").addEventListener("click", mostraCanviaPassword);
  document.getElementById("btn-alumnat").addEventListener("click", mostraAlumnat);
  document.getElementById("btn-concursos").addEventListener("click", mostraConcursos);
  document.getElementById("btn-exporta").addEventListener("click", exportaCopia);
  document.getElementById("btn-importa").addEventListener("click", importaCopia);

  app.appendChild(h(`<div class="avis">💾 <strong>Important si fas servir allotjament al núvol:</strong> algunes plataformes gratuïtes esborren els fitxers en reiniciar el servei. Fes una "Còpia de seguretat" sovint (sobretot al final de cada sessió de classe) i guarda-la al teu ordinador.</div>`));

  const evidenciesLlista = evidencies.filter((ev) => (ev.tipus || "evidencia") !== "repte");
  const reptesLlista = evidencies.filter((ev) => ev.tipus === "repte");

  function creaCardElement(ev) {
    const card = h(`
      <div class="card card-clickable">
        <h3>${escapa(ev.codi)} — ${escapa(ev.titol) || "<sense títol>"} <span class="badge">${(ev.proves || []).length} prova(es)</span>${
      ev.ocult ? ' <span class="badge" style="background:#999">🙈 amagat a l\'alumnat</span>' : ""
    }</h3>
        <p>${escapa((ev.enunciat || "").slice(0, 140))}${(ev.enunciat || "").length > 140 ? "…" : ""}</p>
        <button type="button" class="secondary btn-toggle-ocult">${ev.ocult ? "👁️ Mostra a l'alumnat" : "🙈 Amaga a l'alumnat"}</button>
      </div>`);
    card.addEventListener("click", () => mostraDetallEvidencia(ev.codi));
    card.querySelector(".btn-toggle-ocult").addEventListener("click", (e) => {
      e.stopPropagation();
      alternaOcult(ev.codi, ev.ocult, mostraDashboard);
    });
    return card;
  }

  app.appendChild(h(`<h3>📋 Evidències <small style="font-weight:normal;color:var(--muted);">— avaluables, amb nota i màxim 6 intents</small></h3>`));
  if (!evidenciesLlista.length) app.appendChild(h(`<p><em>Encara no hi ha cap evidència.</em></p>`));
  evidenciesLlista.forEach((ev) => app.appendChild(creaCardElement(ev)));

  app.appendChild(h(`<h3 style="margin-top:28px;">🎯 Reptes de classe <small style="font-weight:normal;color:var(--muted);">— pràctica, sense nota, intents il·limitats</small></h3>`));
  if (!reptesLlista.length) app.appendChild(h(`<p><em>Encara no hi ha cap repte.</em></p>`));
  reptesLlista.forEach((ev) => app.appendChild(creaCardElement(ev)));

  app.appendChild(h(`
    <div class="card">
      <h3>+ Nou element</h3>
      <label>Tipus</label>
      <select id="nou-tipus">
        <option value="evidencia">Evidència avaluable (nota, màxim 6 intents)</option>
        <option value="repte">Repte de classe (pràctica, sense nota, intents il·limitats)</option>
      </select>
      <div class="inline">
        <div><label>Codi</label><input type="text" id="nou-codi" placeholder="E012 o R001" /></div>
        <div style="flex:2"><label>Títol</label><input type="text" id="nou-titol" placeholder="Nom curt" /></div>
      </div>
      <label>Enunciat</label>
      <textarea class="simple" id="nou-enunciat" rows="4" placeholder="Explica a l'alumnat què ha de fer el seu script..."></textarea>
      <button id="btn-crea-evidencia">Crea l'element</button>
      <p id="crea-error" style="color:#c0392b"></p>
    </div>
  `));
  document.getElementById("btn-crea-evidencia").addEventListener("click", async () => {
    const tipus = document.getElementById("nou-tipus").value;
    const codi = document.getElementById("nou-codi").value.trim();
    const titol = document.getElementById("nou-titol").value.trim();
    const enunciat = document.getElementById("nou-enunciat").value.trim();
    const err = document.getElementById("crea-error");
    if (!codi) { err.textContent = "Cal un codi."; return; }
    try {
      await api("/api/admin/evidencies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codi, titol, enunciat, tipus }) });
      mostraDashboard();
    } catch (e) {
      err.textContent = e.message;
    }
  });
}

async function exportaCopia() {
  try {
    const resp = await fetch("/api/admin/exporta", { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!resp.ok) throw new Error("No s'ha pogut exportar.");
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `joc_de_proves_copia_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert("Error en exportar: " + e.message);
  }
}

function importaCopia() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.addEventListener("change", async () => {
    const fitxer = input.files[0];
    if (!fitxer) return;
    if (!confirm("Això sobreescriurà les evidències i l'estat actuals amb el contingut del fitxer. Vols continuar?")) return;
    try {
      const text = await fitxer.text();
      const dades = JSON.parse(text);
      await api("/api/admin/importa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dades) });
      alert("Còpia restaurada correctament.");
      mostraDashboard();
    } catch (e) {
      alert("Error en importar: " + e.message);
    }
  });
  input.click();
}

async function mostraAlumnat() {
  app.innerHTML = "<p>Carregant…</p>";
  let alumnat;
  try {
    alumnat = await api("/api/admin/alumnat");
  } catch (e) {
    return;
  }
  app.innerHTML = "";
  const tornar = h(`<span class="tornar">← Totes les evidències i reptes</span>`);
  tornar.addEventListener("click", mostraDashboard);
  app.appendChild(tornar);

  app.appendChild(h(`<h2>👤 Alumnat</h2>`));
  app.appendChild(h(`<div class="avis">Crea aquí un usuari i una contrasenya per a cada alumne/a. Els hi has de donar tu (per exemple, en paper o de paraula a classe); després cada alumne/a podrà canviar la seva contrasenya des de la seva pròpia pantalla.</div>`));

  const taulaDiv = h(`<div></div>`);
  app.appendChild(taulaDiv);
  renderitzaTaulaAlumnat(taulaDiv, alumnat);

  // ---- afegeix un alumne ----
  app.appendChild(h(`
    <div class="card">
      <h3>+ Afegeix un alumne/a</h3>
      <div class="inline">
        <div><label>Usuari</label><input type="text" id="al-usuari" placeholder="joan.puig" /></div>
        <div><label>Contrasenya inicial</label><input type="text" id="al-contrasenya" placeholder="mínim 4 caràcters" /></div>
        <div style="flex:2"><label>Nom complet (opcional)</label><input type="text" id="al-nom" placeholder="Joan Puig" /></div>
      </div>
      <button id="btn-afegeix-alumne">Crea el compte</button>
      <p id="al-error" style="color:#c0392b"></p>
    </div>
  `));
  document.getElementById("btn-afegeix-alumne").addEventListener("click", async () => {
    const usuari = document.getElementById("al-usuari").value.trim();
    const contrasenya = document.getElementById("al-contrasenya").value;
    const nom = document.getElementById("al-nom").value.trim();
    const err = document.getElementById("al-error");
    if (!usuari || contrasenya.length < 4) { err.textContent = "Cal un usuari i una contrasenya d'almenys 4 caràcters."; return; }
    try {
      await api("/api/admin/alumnat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuari, contrasenya, nom }) });
      mostraAlumnat();
    } catch (e) {
      err.textContent = e.message;
    }
  });

  // ---- afegeix en massa ----
  app.appendChild(h(`
    <div class="card">
      <h3>+ Afegeix alumnat en massa</h3>
      <p><small>Una línia per alumne/a, amb el format <code>usuari,contrasenya,Nom Complet</code> (el nom és opcional). Pots separar els camps amb coma, punt i coma o tabulador (útil si ho enganxes d'un full de càlcul).</small></p>
      <textarea class="simple" id="al-massiu" rows="6" placeholder="joan.puig,inicial123,Joan Puig&#10;maria.soler,inicial456,Maria Soler"></textarea>
      <button id="btn-afegeix-massiu">Crea tots els comptes</button>
      <p id="al-massiu-resultat"></p>
    </div>
  `));
  document.getElementById("btn-afegeix-massiu").addEventListener("click", async () => {
    const text = document.getElementById("al-massiu").value;
    const resultatP = document.getElementById("al-massiu-resultat");
    if (!text.trim()) { resultatP.style.color = "#c0392b"; resultatP.textContent = "Enganxa almenys una línia."; return; }
    try {
      const resultat = await api("/api/admin/alumnat/massiu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      resultatP.style.color = "#1e8449";
      resultatP.textContent = `Creats: ${resultat.creats.length}. Ja existien: ${resultat.jaExistien.length}. Errors: ${resultat.errors.length}.`;
      if (resultat.errors.length) {
        resultatP.style.color = "#c0392b";
        resultatP.innerHTML += `<br>${resultat.errors.map((e) => escapa(e)).join("<br>")}`;
      }
      mostraAlumnat();
    } catch (e) {
      resultatP.style.color = "#c0392b";
      resultatP.textContent = e.message;
    }
  });
}

function renderitzaTaulaAlumnat(div, alumnat) {
  if (!alumnat.length) {
    div.innerHTML = `<p><em>Encara no hi ha cap compte d'alumne/a creat.</em></p>`;
    return;
  }
  div.innerHTML = "";
  // Nota: cada alumne/a es renderitza com un "card" (no com a <tr>), perquè
  // el navegador descarta les files <tr> creades amb innerHTML dins d'un
  // <div> solt (regles d'anàlisi de taules HTML) — el mateix patró que ja
  // fan servir les proves del joc, més avall.
  alumnat
    .slice()
    .sort((a, b) => (a.nom || a.usuari).localeCompare(b.nom || b.usuari))
    .forEach((a) => {
      const fila = h(`
        <div class="fila-prova">
          <strong>${escapa(a.nom) || escapa(a.usuari)}</strong> <span class="badge">${escapa(a.usuari)}</span>
          ${a.contrasenyaCanviada ? "" : '<span class="badge" style="background:#e0b93a;">encara amb la contrasenya inicial</span>'}
          <br /><small>Creat: ${a.creat ? new Date(a.creat).toLocaleDateString("ca-ES") : ""}</small>
          <br /><button class="secondary" data-accio="reinicia">Reinicia contrasenya</button>
          <button class="danger" data-accio="elimina">Elimina</button>
          <div class="bloc-reinici" style="display:none;margin-top:8px;"></div>
        </div>`);
      fila.querySelector('[data-accio="elimina"]').addEventListener("click", async () => {
        if (!confirm(`Segur que vols eliminar el compte de ${a.usuari}? Es conservarà el seu historial de notes, però ja no podrà entrar.`)) return;
        await api(`/api/admin/alumnat/${encodeURIComponent(a.usuari)}`, { method: "DELETE" });
        mostraAlumnat();
      });
      fila.querySelector('[data-accio="reinicia"]').addEventListener("click", () => {
        const bloc = fila.querySelector(".bloc-reinici");
        if (bloc.style.display !== "none") {
          bloc.style.display = "none";
          bloc.innerHTML = "";
          return;
        }
        bloc.innerHTML = "";
        bloc.style.display = "block";
        bloc.appendChild(h(`<label>Nova contrasenya per a ${escapa(a.usuari)}</label>`));
        const inputPwd = h(`<input type="text" placeholder="mínim 4 caràcters" />`);
        bloc.appendChild(inputPwd);
        const errP = h(`<p style="color:#c0392b;margin:6px 0 0;"></p>`);
        const btnDesa = h(`<button>Desa</button>`);
        btnDesa.addEventListener("click", async () => {
          const novaContrasenya = inputPwd.value;
          if (novaContrasenya.length < 4) {
            errP.textContent = "Cal almenys 4 caràcters.";
            return;
          }
          try {
            await api(`/api/admin/alumnat/${encodeURIComponent(a.usuari)}/reinicia`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ novaContrasenya }),
            });
            mostraAlumnat();
          } catch (e) {
            errP.textContent = e.message;
          }
        });
        bloc.appendChild(btnDesa);
        bloc.appendChild(errP);
      });
      div.appendChild(fila);
    });
}

// ---- Concursos (competicions per equips, a l'estil ICPC/Programa'm) ----
// Un concurs té una data/hora d'inici i una durada (en minuts): mentre no
// ha començat, els equips no en veuen els problemes; un cop acabat, ja no
// es poden fer més entregues. Cada equip és un compte d'alumnat normal
// (es crea igual que qualsevol alumne/a a "👤 Alumnat") que la professora
// assigna a la llista de participants del concurs. (2026-10-27)

function badgeEstatConcurs(c) {
  const ara = Date.now();
  const inici = new Date(c.dataInici).getTime();
  const fi = inici + (c.duracioMinuts || 0) * 60000;
  if (ara < inici) return '<span class="badge" style="background:#999">⏳ no ha començat</span>';
  if (ara > fi) return '<span class="badge" style="background:#555">🏁 finalitzat</span>';
  return '<span class="badge" style="background:#1e8449">🟢 en marxa</span>';
}

// Converteix un ISO a valor per a <input type="datetime-local"> (hora local
// del navegador) i a l'inrevés.
function isoADatetimeLocal(iso) {
  const d = new Date(iso);
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function mostraConcursos() {
  app.innerHTML = "<p>Carregant…</p>";
  let concursos;
  try {
    concursos = await api("/api/admin/concursos");
  } catch (e) {
    return;
  }
  app.innerHTML = "";
  const tornar = h(`<span class="tornar">← Totes les evidències i reptes</span>`);
  tornar.addEventListener("click", mostraDashboard);
  app.appendChild(tornar);

  app.appendChild(h(`<h2>🏆 Concursos</h2>`));
  app.appendChild(h(`<div class="avis">Un concurs és una competició per equips (a l'estil d'un concurs de programació): cada problema val uns punts que tu decideixes, guanya qui en suma més, i en cas d'empat guanya qui ha trigat menys temps (amb 20 minuts de penalització per cada entrega incorrecta d'un problema que acaba resolent-se). Els "equips" són comptes d'alumnat normal — crea'ls a "👤 Alumnat" i després assigna'ls aquí al concurs que els toqui.</div>`));

  if (!concursos.length) app.appendChild(h(`<p><em>Encara no hi ha cap concurs creat.</em></p>`));
  concursos
    .slice()
    .sort((a, b) => new Date(b.dataInici) - new Date(a.dataInici))
    .forEach((c) => {
      const card = h(`
        <div class="card card-clickable">
          <h3>${escapa(c.id)} — ${escapa(c.nom)} ${badgeEstatConcurs(c)}</h3>
          <p><small>Inici: ${formataData(c.dataInici)} · Durada: ${c.duracioMinuts} min · ${(c.problemes || []).length} problema(es) · ${(c.equips || []).length} equip(s)</small></p>
        </div>`);
      card.addEventListener("click", () => mostraDetallConcurs(c.id));
      app.appendChild(card);
    });

  app.appendChild(h(`
    <div class="card">
      <h3>+ Nou concurs</h3>
      <div class="inline">
        <div><label>Identificador</label><input type="text" id="c-id" placeholder="C1" /></div>
        <div style="flex:2"><label>Nom</label><input type="text" id="c-nom" placeholder="Concurs de programació — 1a eliminatòria" /></div>
      </div>
      <div class="inline">
        <div><label>Data i hora d'inici</label><input type="datetime-local" id="c-inici" /></div>
        <div><label>Durada (minuts)</label><input type="number" id="c-durada" value="120" min="1" /></div>
        <div><label>Bonus pel primer a resoldre (punts)</label><input type="number" id="c-bonus" value="2" min="0" /></div>
      </div>
      <p><small>El bonus s'afegeix, a banda dels punts del problema, a l'equip que el resolgui abans que ningú més. Posa-hi 0 si no en vols cap.</small></p>
      <button id="btn-crea-concurs">Crea el concurs</button>
      <p id="c-error" style="color:#c0392b"></p>
    </div>
  `));
  document.getElementById("btn-crea-concurs").addEventListener("click", async () => {
    const id = document.getElementById("c-id").value.trim();
    const nom = document.getElementById("c-nom").value.trim();
    const iniciLocal = document.getElementById("c-inici").value;
    const duracioMinuts = parseInt(document.getElementById("c-durada").value, 10);
    const bonusPrimer = parseInt(document.getElementById("c-bonus").value, 10) || 0;
    const err = document.getElementById("c-error");
    if (!id || !nom || !iniciLocal || !duracioMinuts) { err.textContent = "Cal omplir tots els camps."; return; }
    try {
      await api("/api/admin/concursos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, nom, dataInici: new Date(iniciLocal).toISOString(), duracioMinuts, bonusPrimer }),
      });
      mostraConcursos();
    } catch (e) {
      err.textContent = e.message;
    }
  });
}

async function mostraDetallConcurs(id) {
  app.innerHTML = "<p>Carregant…</p>";
  let concursos, alumnat, marcadorDades;
  try {
    [concursos, alumnat, marcadorDades] = await Promise.all([
      api("/api/admin/concursos"),
      api("/api/admin/alumnat"),
      api(`/api/admin/concursos/${encodeURIComponent(id)}/marcador`),
    ]);
  } catch (e) {
    return;
  }
  const c = concursos.find((x) => x.id === id);
  if (!c) { mostraConcursos(); return; }

  app.innerHTML = "";
  const tornar = h(`<span class="tornar">← Tots els concursos</span>`);
  tornar.addEventListener("click", mostraConcursos);
  app.appendChild(tornar);

  app.appendChild(h(`<h2>${escapa(c.id)} — ${escapa(c.nom)} ${badgeEstatConcurs(c)}</h2>`));

  // ---- dades generals ----
  const formC = h(`
    <div class="card">
      <h3>Dades del concurs</h3>
      <label>Nom</label>
      <input type="text" id="ed-c-nom" value="${escapa(c.nom)}" />
      <div class="inline">
        <div><label>Data i hora d'inici</label><input type="datetime-local" id="ed-c-inici" value="${isoADatetimeLocal(c.dataInici)}" /></div>
        <div><label>Durada (minuts)</label><input type="number" id="ed-c-durada" value="${c.duracioMinuts}" min="1" /></div>
        <div><label>Bonus pel primer a resoldre (punts)</label><input type="number" id="ed-c-bonus" value="${c.bonusPrimer || 0}" min="0" /></div>
      </div>
      <button id="btn-desa-c">Desa els canvis</button>
      <button id="btn-elimina-c" class="danger">Elimina aquest concurs</button>
      <p id="c-msg"></p>
    </div>
  `);
  app.appendChild(formC);
  document.getElementById("btn-desa-c").addEventListener("click", async () => {
    const nom = document.getElementById("ed-c-nom").value.trim();
    const iniciLocal = document.getElementById("ed-c-inici").value;
    const duracioMinuts = parseInt(document.getElementById("ed-c-durada").value, 10);
    const bonusPrimer = parseInt(document.getElementById("ed-c-bonus").value, 10) || 0;
    const msg = document.getElementById("c-msg");
    try {
      await api(`/api/admin/concursos/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, dataInici: new Date(iniciLocal).toISOString(), duracioMinuts, bonusPrimer }),
      });
      mostraDetallConcurs(id);
    } catch (e) {
      msg.style.color = "#c0392b";
      msg.textContent = e.message;
    }
  });
  document.getElementById("btn-elimina-c").addEventListener("click", async () => {
    if (!confirm(`Segur que vols eliminar el concurs ${id} i tot el seu marcador? No es pot desfer.`)) return;
    await api(`/api/admin/concursos/${encodeURIComponent(id)}`, { method: "DELETE" });
    mostraConcursos();
  });

  // ---- equips participants ----
  const cardEquips = h(`<div class="card"><h3>Equips participants</h3><div id="llista-equips"></div><button id="btn-desa-equips">Desa els equips</button><p id="equips-msg"></p></div>`);
  app.appendChild(cardEquips);
  const llistaEquips = cardEquips.querySelector("#llista-equips");
  if (!alumnat.length) {
    llistaEquips.innerHTML = `<p><em>Encara no hi ha cap compte creat a "👤 Alumnat". Crea'n un per a cada equip (per exemple amb el nom de l'equip com a usuari).</em></p>`;
  } else {
    alumnat
      .slice()
      .sort((a, b) => (a.nom || a.usuari).localeCompare(b.nom || b.usuari))
      .forEach((a) => {
        const marcat = (c.equips || []).includes(a.usuari);
        const fila = h(`
          <label style="display:block;font-weight:normal;margin:4px 0;">
            <input type="checkbox" class="chk-equip" value="${escapa(a.usuari)}" ${marcat ? "checked" : ""} />
            ${escapa(a.nom) || escapa(a.usuari)} <span class="badge">${escapa(a.usuari)}</span>
          </label>`);
        llistaEquips.appendChild(fila);
      });
  }
  document.getElementById("btn-desa-equips").addEventListener("click", async () => {
    const equips = Array.from(cardEquips.querySelectorAll(".chk-equip:checked")).map((inp) => inp.value);
    const msg = document.getElementById("equips-msg");
    try {
      await api(`/api/admin/concursos/${encodeURIComponent(id)}/equips`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equips }),
      });
      msg.style.color = "#1e8449";
      msg.textContent = "Equips desats.";
    } catch (e) {
      msg.style.color = "#c0392b";
      msg.textContent = e.message;
    }
  });

  // ---- problemes ----
  app.appendChild(h(`<h3>Problemes (${(c.problemes || []).length})</h3>`));
  const problemesDiv = h(`<div></div>`);
  app.appendChild(problemesDiv);
  renderitzaProblemesConcurs(problemesDiv, id, c.problemes || []);

  app.appendChild(h(`
    <div class="card">
      <h3>+ Afegeix un problema</h3>
      <div class="inline">
        <div><label>Codi</label><input type="text" id="pr-codi" placeholder="A" /></div>
        <div style="flex:2"><label>Títol</label><input type="text" id="pr-titol" placeholder="Nom curt del problema" /></div>
        <div><label>Punts</label><input type="number" id="pr-punts" value="10" min="1" /></div>
      </div>
      <label>Enunciat</label>
      <textarea class="simple" id="pr-enunciat" rows="4" placeholder="Explica el problema que han de resoldre els equips..."></textarea>
      <button id="btn-afegeix-problema">Afegeix el problema</button>
      <p id="pr-error" style="color:#c0392b"></p>
    </div>
  `));
  document.getElementById("btn-afegeix-problema").addEventListener("click", async () => {
    const codi = document.getElementById("pr-codi").value.trim();
    const titol = document.getElementById("pr-titol").value.trim();
    const punts = parseInt(document.getElementById("pr-punts").value, 10);
    const enunciat = document.getElementById("pr-enunciat").value.trim();
    const err = document.getElementById("pr-error");
    if (!codi || !punts) { err.textContent = "Cal un codi i un valor en punts."; return; }
    try {
      await api(`/api/admin/concursos/${encodeURIComponent(id)}/problemes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codi, titol, enunciat, punts }),
      });
      mostraDetallConcurs(id);
    } catch (e) {
      err.textContent = e.message;
    }
  });

  // ---- marcador ----
  app.appendChild(h(`<h3>Marcador</h3>`));
  const marcadorDiv = h(`<div></div>`);
  app.appendChild(marcadorDiv);
  renderitzaMarcador(marcadorDiv, marcadorDades, alumnat);
}

function renderitzaProblemesConcurs(div, concursId, problemes) {
  if (!problemes.length) {
    div.innerHTML = `<p><em>Encara no hi ha cap problema. Els equips no podran entregar res fins que n'hi hagi almenys un amb una prova configurada.</em></p>`;
    return;
  }
  div.innerHTML = "";
  problemes.forEach((pr) => {
    const fila = h(`
      <div class="fila-prova">
        <strong>${escapa(pr.codi)} — ${escapa(pr.titol) || "<sense títol>"}</strong>
        <span class="badge">${pr.punts || 0} punts</span>
        <span class="badge">${(pr.proves || []).length} prova(es)</span>
        <br /><small>${escapa((pr.enunciat || "").slice(0, 140))}${(pr.enunciat || "").length > 140 ? "…" : ""}</small>
        <br /><button class="secondary" data-accio="proves">Gestiona les proves</button>
        <button class="danger" data-accio="elimina">Elimina el problema</button>
        <div class="bloc-proves" style="display:none;margin-top:8px;"></div>
      </div>`);
    fila.querySelector('[data-accio="elimina"]').addEventListener("click", async () => {
      if (!confirm(`Segur que vols eliminar el problema ${pr.codi}?`)) return;
      await api(`/api/admin/concursos/${encodeURIComponent(concursId)}/problemes/${encodeURIComponent(pr.codi)}`, { method: "DELETE" });
      mostraDetallConcurs(concursId);
    });
    fila.querySelector('[data-accio="proves"]').addEventListener("click", () => {
      const bloc = fila.querySelector(".bloc-proves");
      if (bloc.style.display !== "none") {
        bloc.style.display = "none";
        bloc.innerHTML = "";
        return;
      }
      bloc.style.display = "block";
      renderitzaProvesConcurs(bloc, concursId, pr);
    });
    div.appendChild(fila);
  });
}

function renderitzaProvesConcurs(div, concursId, problema) {
  div.innerHTML = "";
  const proves = problema.proves || [];
  if (!proves.length) {
    div.appendChild(h(`<p><em>Encara no hi ha cap prova per a aquest problema.</em></p>`));
  } else {
    proves.forEach((p, i) => {
      const sortides = llistaSortidesDe(p);
      const filaP = h(`
        <div class="fila-prova">
          <strong>${escapa(p.nom)}</strong> <span class="badge">${p.mode === "exacta" ? "sortida exacta" : "conté"}</span>
          <br /><small>Entrada: ${p.entrada ? `<code>${escapa(p.entrada)}</code>` : "<em>(cap)</em>"}</small>
          <br /><small>Sortida(es): ${sortides.map((s) => `<code>${escapa(s)}</code>`).join(" <em>o</em> ")}</small>
          <br /><button class="danger" data-accio="elimina">Elimina aquesta prova</button>
        </div>`);
      filaP.querySelector('[data-accio="elimina"]').addEventListener("click", async () => {
        await api(`/api/admin/concursos/${encodeURIComponent(concursId)}/problemes/${encodeURIComponent(problema.codi)}/proves/${i}`, { method: "DELETE" });
        mostraDetallConcurs(concursId);
      });
      div.appendChild(filaP);
    });
  }

  const cardNova = h(`
    <div class="card">
      <label>Nom de la prova</label>
      <input type="text" class="np-nom" placeholder="Calcula bé el resultat" />
      <label>Entrada per teclat (deixa-ho buit si no en necessita)</label>
      <textarea class="simple np-entrada" rows="2"></textarea>
      <label>Sortida(es) esperada(es)</label>
      <div class="np-sortides-host"></div>
      <label>Mode de comprovació</label>
      <select class="np-mode">
        <option value="conte">Que la sortida CONTINGUI aquest text</option>
        <option value="exacta">Que la sortida sigui EXACTAMENT aquest text</option>
      </select>
      <button class="btn-afegeix-np">Afegeix la prova</button>
      <p class="np-error" style="color:#c0392b"></p>
    </div>
  `);
  div.appendChild(cardNova);
  const blocSortidesNova = creaBlocSortides([""]);
  cardNova.querySelector(".np-sortides-host").appendChild(blocSortidesNova);
  cardNova.querySelector(".btn-afegeix-np").addEventListener("click", async () => {
    const nom = cardNova.querySelector(".np-nom").value.trim();
    const entrada = cardNova.querySelector(".np-entrada").value;
    const sortidaEsperada = blocSortidesNova.llegeixValors();
    const mode = cardNova.querySelector(".np-mode").value;
    const err = cardNova.querySelector(".np-error");
    if (!nom || sortidaEsperada.length === 0) { err.textContent = "Cal un nom i almenys una sortida esperada."; return; }
    try {
      await api(`/api/admin/concursos/${encodeURIComponent(concursId)}/problemes/${encodeURIComponent(problema.codi)}/proves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, entrada, sortidaEsperada, mode }),
      });
      mostraDetallConcurs(concursId);
    } catch (e) {
      err.textContent = e.message;
    }
  });
}

// Marcador (taula tipus ICPC): una fila per equip, ordenades per punts
// (desc.) i, en cas d'empat, per temps acumulat (asc.) — vegeu lib/concurs.js.
// S'usa tant des del panell d'administració com des de la vista dels equips
// (vegeu la mateixa funció, adaptada, a public/app.js).
function renderitzaMarcador(div, dades, alumnat) {
  const nomsPerUsuari = {};
  (alumnat || []).forEach((a) => { nomsPerUsuari[a.usuari] = a.nom || a.usuari; });
  const problemes = dades.problemes || [];
  if (!dades.marcador || !dades.marcador.length) {
    div.innerHTML = `<p><em>Encara no hi ha cap equip assignat a aquest concurs.</em></p>`;
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
        <td><strong>${i + 1}.</strong> ${escapa(nomsPerUsuari[fila.equip] || fila.equip)}</td>
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

function mostraCanviaPassword() {
  app.innerHTML = "";
  const tornar = h(`<span class="tornar">← Tornar</span>`);
  tornar.addEventListener("click", mostraDashboard);
  app.appendChild(tornar);
  app.appendChild(h(`
    <div class="card" style="max-width:420px;">
      <h3>Canviar contrasenya d'administració</h3>
      <label>Contrasenya actual</label>
      <input type="password" id="pwd-actual" />
      <label>Nova contrasenya</label>
      <input type="password" id="pwd-nova" />
      <button id="btn-desa-pwd">Desa</button>
      <p id="pwd-msg"></p>
    </div>
  `));
  document.getElementById("btn-desa-pwd").addEventListener("click", async () => {
    const actual = document.getElementById("pwd-actual").value;
    const nova = document.getElementById("pwd-nova").value;
    const msg = document.getElementById("pwd-msg");
    try {
      await api("/api/admin/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actual, nova }) });
      msg.style.color = "#1e8449";
      msg.textContent = "Contrasenya canviada.";
    } catch (e) {
      msg.style.color = "#c0392b";
      msg.textContent = e.message;
    }
  });
}

async function mostraDetallEvidencia(codi) {
  app.innerHTML = "<p>Carregant…</p>";
  let evidencies, estat;
  try {
    [evidencies, estat] = await Promise.all([api("/api/admin/evidencies"), api(`/api/admin/evidencies/${encodeURIComponent(codi)}/estat`)]);
  } catch (e) {
    return;
  }
  const ev = evidencies.find((e) => e.codi === codi);
  if (!ev) { mostraDashboard(); return; }

  const tipus = ev.tipus === "repte" ? "repte" : "evidencia";

  app.innerHTML = "";
  const tornar = h(`<span class="tornar">← Totes les evidències i reptes</span>`);
  tornar.addEventListener("click", mostraDashboard);
  app.appendChild(tornar);

  app.appendChild(h(`<h2>${escapa(ev.codi)} <span class="badge" style="background:${tipus === "repte" ? "#8e6fc0" : "var(--mission)"};">${tipus === "repte" ? "Repte de pràctica" : "Evidència avaluable"}</span>${
    ev.ocult ? ' <span class="badge" style="background:#999">🙈 amagat a l\'alumnat</span>' : ""
  }</h2>`));
  app.appendChild(h(`<div class="avis">${
    tipus === "repte"
      ? "🎯 És un <strong>repte de pràctica</strong>: no té nota, i l'alumnat pot entregar-lo tants cops com vulgui. Només es mostren els intents que ha necessitat."
      : "📋 És una <strong>evidència avaluable</strong>: nota de l'1 al 10 segons l'intent en què se supera, màxim 6 intents en total (si s'esgoten sense superar-ho, la nota final queda en 1)."
  }</div>`));

  const formEv = h(`
    <div class="card">
      <label>Tipus</label>
      <select id="ed-tipus">
        <option value="evidencia">Evidència avaluable (nota, màxim 6 intents)</option>
        <option value="repte">Repte de classe (pràctica, sense nota, intents il·limitats)</option>
      </select>
      <label>Títol</label>
      <input type="text" id="ed-titol" value="${escapa(ev.titol)}" />
      <label>Enunciat (el que veu l'alumnat)</label>
      <textarea class="simple" id="ed-enunciat" rows="6">${escapa(ev.enunciat)}</textarea>
      <button id="btn-desa-ev">Desa els canvis</button>
      <button type="button" id="btn-toggle-ocult-detall" class="secondary">${ev.ocult ? "👁️ Mostra a l'alumnat" : "🙈 Amaga a l'alumnat"}</button>
      <button id="btn-elimina-ev" class="danger">Elimina aquest element</button>
      <p id="ev-msg"></p>
    </div>
  `);
  app.appendChild(formEv);
  document.getElementById("ed-tipus").value = tipus;
  document.getElementById("btn-toggle-ocult-detall").addEventListener("click", () => {
    alternaOcult(codi, ev.ocult, () => mostraDetallEvidencia(codi));
  });
  document.getElementById("btn-desa-ev").addEventListener("click", async () => {
    const titol = document.getElementById("ed-titol").value;
    const enunciat = document.getElementById("ed-enunciat").value;
    const novTipus = document.getElementById("ed-tipus").value;
    const msg = document.getElementById("ev-msg");
    try {
      await api(`/api/admin/evidencies/${encodeURIComponent(codi)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titol, enunciat, tipus: novTipus }) });
      msg.style.color = "#1e8449";
      msg.textContent = "Desat.";
      if (novTipus !== tipus) mostraDetallEvidencia(codi);
    } catch (e) {
      msg.style.color = "#c0392b";
      msg.textContent = e.message;
    }
  });
  document.getElementById("btn-elimina-ev").addEventListener("click", async () => {
    if (!confirm(`Segur que vols eliminar ${codi} i tot el seu historial d'entregues? Aquesta acció no es pot desfer.`)) return;
    await api(`/api/admin/evidencies/${encodeURIComponent(codi)}`, { method: "DELETE" });
    mostraDashboard();
  });

  // ---- Joc de proves ----
  app.appendChild(h(`<h3>Joc de proves (${(ev.proves || []).length})</h3>`));
  const provesDiv = h(`<div id="llista-proves"></div>`);
  app.appendChild(provesDiv);
  renderitzaProves(provesDiv, codi, ev.proves || []);

  const cardNovaProva = h(`
    <div class="card">
      <h3>+ Afegir prova</h3>
      <label>Nom de la prova (què comprova)</label>
      <input type="text" id="p-nom" placeholder="Calcula bé el canvi" />
      <label>Entrada per teclat (deixa-ho buit si l'script no en necessita)</label>
      <textarea class="simple" id="p-entrada" rows="2" placeholder="Una línia per cada promptSync(), si n'hi ha"></textarea>
      <label>Sortida(es) esperada(es)</label>
      <div id="p-sortides-host"></div>
      <p style="margin:2px 0 10px;"><small>Si un mateix enunciat admet més d'un resultat correcte (per exemple, una condició com <code>edat&lt;=16</code> pot donar <code>true</code> o <code>false</code> segons com s'hagi plantejat l'script), afegeix-hi totes les sortides vàlides: n'hi haurà prou que en coincideixi una.</small></p>
      <label>Mode de comprovació</label>
      <select id="p-mode">
        <option value="conte">Que la sortida CONTINGUI aquest text</option>
        <option value="exacta">Que la sortida sigui EXACTAMENT aquest text</option>
      </select>
      <button id="btn-afegeix-prova">Afegeix la prova</button>
      <p id="prova-error" style="color:#c0392b"></p>
    </div>
  `);
  app.appendChild(cardNovaProva);
  const blocSortidesNova = creaBlocSortides([""]);
  cardNovaProva.querySelector("#p-sortides-host").appendChild(blocSortidesNova);
  document.getElementById("btn-afegeix-prova").addEventListener("click", async () => {
    const nom = document.getElementById("p-nom").value.trim();
    const entrada = document.getElementById("p-entrada").value;
    const sortidaEsperada = blocSortidesNova.llegeixValors();
    const mode = document.getElementById("p-mode").value;
    const err = document.getElementById("prova-error");
    if (!nom || sortidaEsperada.length === 0) { err.textContent = "Cal un nom i almenys una sortida esperada."; return; }
    try {
      await api(`/api/admin/evidencies/${encodeURIComponent(codi)}/proves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, entrada, sortidaEsperada, mode }),
      });
      mostraDetallEvidencia(codi);
    } catch (e) {
      err.textContent = e.message;
    }
  });

  // ---- Estat / rànquing ----
  app.appendChild(h(`<h3>Estat dels lliuraments</h3>`));
  const estatDiv = h(`<div></div>`);
  app.appendChild(estatDiv);
  renderitzaEstatAdmin(estatDiv, estat, tipus);

  const btnReset = h(`<button class="danger">Esborra tots els intents i notes d'aquesta evidència</button>`);
  btnReset.addEventListener("click", async () => {
    if (!confirm(`Segur que vols esborrar tot l'historial de ${codi}? No es pot desfer.`)) return;
    await api(`/api/admin/evidencies/${encodeURIComponent(codi)}/reset`, { method: "POST" });
    mostraDetallEvidencia(codi);
  });
  app.appendChild(btnReset);
}

function llistaSortidesDe(p) {
  return Array.isArray(p.sortidaEsperada) ? p.sortidaEsperada : [p.sortidaEsperada];
}

function renderitzaProves(div, codi, proves) {
  if (!proves.length) {
    div.innerHTML = `<p><em>Encara no hi ha cap prova configurada per a aquesta evidència. L'alumnat no podrà entregar fins que n'hi hagi almenys una.</em></p>`;
    return;
  }
  div.innerHTML = "";
  proves.forEach((p, i) => {
    const sortides = llistaSortidesDe(p);
    const fila = h(`
      <div class="fila-prova">
        <strong>${escapa(p.nom)}</strong> <span class="badge">${p.mode === "exacta" ? "sortida exacta" : "conté"}</span>
        <br /><small>Entrada: ${p.entrada ? `<code>${escapa(p.entrada)}</code>` : "<em>(cap)</em>"}</small>
        <br /><small>Sortida(es) esperada(es): ${sortides.map((s) => `<code>${escapa(s)}</code>`).join(" <em>o</em> ")}</small>
        <br /><button class="secondary" data-accio="edita">Edita</button>
        <button class="danger" data-accio="elimina">Elimina aquesta prova</button>
        <div class="bloc-edicio" style="display:none;margin-top:8px;"></div>
      </div>`);
    fila.querySelector('[data-accio="elimina"]').addEventListener("click", async () => {
      await api(`/api/admin/evidencies/${encodeURIComponent(codi)}/proves/${i}`, { method: "DELETE" });
      mostraDetallEvidencia(codi);
    });
    fila.querySelector('[data-accio="edita"]').addEventListener("click", () => {
      const blocEdicio = fila.querySelector(".bloc-edicio");
      if (blocEdicio.style.display !== "none") {
        blocEdicio.style.display = "none";
        blocEdicio.innerHTML = "";
        return;
      }
      blocEdicio.innerHTML = "";
      blocEdicio.style.display = "block";
      blocEdicio.appendChild(h(`<label>Nom de la prova</label>`));
      const inputNom = h(`<input type="text" value="${escapa(p.nom)}" />`);
      blocEdicio.appendChild(inputNom);
      blocEdicio.appendChild(h(`<label>Entrada per teclat</label>`));
      const inputEntrada = h(`<textarea class="simple" rows="2">${escapa(p.entrada || "")}</textarea>`);
      blocEdicio.appendChild(inputEntrada);
      blocEdicio.appendChild(h(`<label>Sortida(es) esperada(es)</label>`));
      const blocSortides = creaBlocSortides(sortides);
      blocEdicio.appendChild(blocSortides);
      blocEdicio.appendChild(h(`<label>Mode de comprovació</label>`));
      const selectMode = h(`
        <select>
          <option value="conte">Que la sortida CONTINGUI aquest text</option>
          <option value="exacta">Que la sortida sigui EXACTAMENT aquest text</option>
        </select>`);
      selectMode.value = p.mode === "exacta" ? "exacta" : "conte";
      blocEdicio.appendChild(selectMode);
      const errEdicio = h(`<p style="color:#c0392b"></p>`);
      const btnDesa = h(`<button>Desa els canvis</button>`);
      btnDesa.addEventListener("click", async () => {
        const sortidaEsperada = blocSortides.llegeixValors();
        if (!inputNom.value.trim() || sortidaEsperada.length === 0) {
          errEdicio.textContent = "Cal un nom i almenys una sortida esperada.";
          return;
        }
        try {
          await api(`/api/admin/evidencies/${encodeURIComponent(codi)}/proves/${i}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nom: inputNom.value.trim(),
              entrada: inputEntrada.value,
              sortidaEsperada,
              mode: selectMode.value,
            }),
          });
          mostraDetallEvidencia(codi);
        } catch (e) {
          errEdicio.textContent = e.message;
        }
      });
      blocEdicio.appendChild(btnDesa);
      blocEdicio.appendChild(errEdicio);
    });
    div.appendChild(fila);
  });
}

function renderitzaEstatAdmin(div, estat, tipus) {
  const noms = Object.keys(estat.alumnes || {}).sort();
  if (!noms.length) {
    div.innerHTML = `<p><em>Encara ningú ha entregat res.</em></p>`;
    return;
  }
  if (tipus === "repte") {
    const files = noms
      .map((nom) => {
        const a = estat.alumnes[nom];
        return `<tr>
          <td>${escapa(nom)}</td>
          <td>${a.intents}</td>
          <td>${a.superat ? `Sí (a l'intent ${a.intentSuperat})` : "Encara no"}</td>
          <td>${formataData(a.ultimIntent)}</td>
        </tr>`;
      })
      .join("");
    div.innerHTML = `<table><thead><tr><th>Alumne/a</th><th>Intents</th><th>Superat</th><th>Últim intent</th></tr></thead><tbody>${files}</tbody></table>`;
    return;
  }
  const files = noms
    .map((nom) => {
      const a = estat.alumnes[nom];
      let estatText;
      if (a.superat) estatText = `Sí (${a.intentSuperat}è intent)`;
      else if (a.bloquejat) estatText = `No — 6 intents esgotats, bloquejat`;
      else estatText = "No";
      return `<tr>
        <td>${escapa(nom)}${a.primer ? ' <span class="badge primer">🏆</span>' : ""}</td>
        <td>${a.intents}</td>
        <td>${estatText}</td>
        <td>${a.nota != null ? a.nota : "pendent"}</td>
        <td>${formataData(a.ultimIntent)}</td>
      </tr>`;
    })
    .join("");
  div.innerHTML = `
    ${estat.primerSuperat ? `<p>🏆 Primer/a en superar-ho: <strong>${escapa(estat.primerSuperat)}</strong></p>` : ""}
    <table><thead><tr><th>Alumne/a</th><th>Intents</th><th>Superat</th><th>Nota</th><th>Últim intent</th></tr></thead><tbody>${files}</tbody></table>`;
}

// ---- arrencada ----
if (getToken()) {
  mostraDashboard();
} else {
  mostraLogin();
}
