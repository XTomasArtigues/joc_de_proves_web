#!/usr/bin/env node
// Joc de Proves — aplicació web (estil Programame) per corregir automàticament
// els scripts que l'alumnat entrega per a les evidències de PTD I.
// Sense dependències externes: només Node.js (http, fs, path, crypto).
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const store = require("./lib/store");
const { executaIAvalua } = require("./lib/corrector");
const { aplicaEntregaEvidencia, aplicaEntregaRepte } = require("./lib/nota");
const { generaHash, comprovaContrasenya } = require("./lib/credencials");

const PUBLIC_DIR = path.join(__dirname, "public");
const cfg = store.carregaConfig();
const PORT = process.env.PORT || cfg.port || 3000;

// ---------- tokens d'administració (en memòria; es perden en reiniciar el servidor) ----------
const tokensAdmin = new Map(); // token -> expiracio (timestamp ms)
const DURADA_SESSIO_MS = 4 * 60 * 60 * 1000; // 4 hores

function creaToken() {
  const token = crypto.randomBytes(24).toString("hex");
  tokensAdmin.set(token, Date.now() + DURADA_SESSIO_MS);
  return token;
}
function tokenValid(token) {
  if (!token || !tokensAdmin.has(token)) return false;
  const exp = tokensAdmin.get(token);
  if (Date.now() > exp) {
    tokensAdmin.delete(token);
    return false;
  }
  return true;
}
function esPeticioAdminAutenticada(req) {
  const auth = req.headers["authorization"] || "";
  const m = auth.match(/^Bearer (.+)$/);
  return m ? tokenValid(m[1]) : false;
}

// ---------- tokens de l'alumnat (en memòria; igual que els d'administració) ----------
const tokensAlumnat = new Map(); // token -> { usuari, exp }
const DURADA_SESSIO_ALUMNE_MS = 8 * 60 * 60 * 1000; // 8 hores (una jornada escolar)

function creaTokenAlumne(usuari) {
  const token = crypto.randomBytes(24).toString("hex");
  tokensAlumnat.set(token, { usuari, exp: Date.now() + DURADA_SESSIO_ALUMNE_MS });
  return token;
}
function usuariDeToken(req) {
  const auth = req.headers["authorization"] || "";
  const m = auth.match(/^Bearer (.+)$/);
  if (!m) return null;
  const info = tokensAlumnat.get(m[1]);
  if (!info) return null;
  if (Date.now() > info.exp) {
    tokensAlumnat.delete(m[1]);
    return null;
  }
  return info.usuari;
}

// ---------- utilitats HTTP ----------
function enviaJSON(res, status, dades) {
  const cos = JSON.stringify(dades);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(cos) });
  res.end(cos);
}
function enviaError(res, status, missatge) {
  enviaJSON(res, status, { error: missatge });
}
function llegeixCos(req) {
  return new Promise((resolve, reject) => {
    let cos = "";
    let massaGran = false;
    req.on("data", (chunk) => {
      cos += chunk;
      if (cos.length > 2 * 1024 * 1024) {
        // 2MB de límit per a un script — més que suficient
        massaGran = true;
        req.destroy();
      }
    });
    req.on("end", () => {
      if (massaGran) return reject(new Error("El cos de la petició és massa gran."));
      if (!cos) return resolve({});
      try {
        resolve(JSON.parse(cos));
      } catch (e) {
        reject(new Error("JSON invàlid."));
      }
    });
    req.on("error", reject);
  });
}

const TIPUS_MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serveixEstatic(req, res, urlPath) {
  let fitxer = urlPath === "/" ? "/index.html" : urlPath;
  const ruta = path.normalize(path.join(PUBLIC_DIR, fitxer));
  if (!ruta.startsWith(PUBLIC_DIR)) {
    enviaError(res, 403, "Prohibit.");
    return;
  }
  fs.readFile(ruta, (err, contingut) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("No trobat.");
      return;
    }
    const ext = path.extname(ruta);
    res.writeHead(200, { "Content-Type": TIPUS_MIME[ext] || "application/octet-stream" });
    res.end(contingut);
  });
}

// ---------- lògica de domini ----------
// Normalitza `sortidaEsperada` tant si arriba com a text sol com si arriba
// com a llista (una prova pot tenir més d'una sortida vàlida, p. ex. true o
// false si l'enunciat permet més d'un plantejament correcte). Retorna sempre
// un array net, sense valors buits.
function normalitzaSortides(valor) {
  const llista = Array.isArray(valor) ? valor : [valor];
  return llista.map((v) => (v || "").toString().trim()).filter((v) => v.length > 0);
}

// "evidencia" (avaluable, amb nota i màxim d'intents) o "repte" (pràctica,
// sense nota ni límit d'intents). Els elements antics sense `tipus` es
// tracten com a evidència, per compatibilitat amb les dades ja creades.
function tipusDe(ev) {
  return ev.tipus === "repte" ? "repte" : "evidencia";
}

function evidenciaPublica(ev) {
  // No revelem mai sortidaEsperada ni els casos de prova a l'alumnat.
  return { codi: ev.codi, tipus: tipusDe(ev), titol: ev.titol, enunciat: ev.enunciat, numProves: (ev.proves || []).length };
}

// Un element (normalment un repte) amagat per la professora no ha d'aparèixer
// mai a l'API pública (llista, detall ni entrega) — només al panell
// d'administració, on sempre es veuen tots, amagats o no.
function visiblePerAlumnat(ev) {
  return !ev.ocult;
}

function estatPublic(estat) {
  const alumnes = Object.entries(estat.alumnes || {}).map(([usuari, a]) => ({
    usuari,
    nom: a.nom || usuari,
    intents: a.intents,
    superat: a.superat,
    intentSuperat: a.intentSuperat != null ? a.intentSuperat : null,
    nota: a.nota != null ? a.nota : null,
    primer: !!a.primer,
    bloquejat: !!a.bloquejat,
  }));
  alumnes.sort((a, b) => {
    if (a.superat !== b.superat) return a.superat ? -1 : 1;
    return (b.nota || 0) - (a.nota || 0);
  });
  return { primerSuperat: estat.primerSuperat || null, alumnes };
}

// ---------- gestor principal ----------
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const p = urlObj.pathname;
  const metode = req.method;

  try {
    // --- API pública (alumnat) ---
    if (p === "/api/evidencies" && metode === "GET") {
      const ev = store.carregaEvidencies();
      return enviaJSON(res, 200, Object.values(ev).filter(visiblePerAlumnat).map(evidenciaPublica));
    }

    let m;
    if ((m = p.match(/^\/api\/evidencies\/([^/]+)$/)) && metode === "GET") {
      const ev = store.carregaEvidencies()[m[1]];
      if (!ev || !visiblePerAlumnat(ev)) return enviaError(res, 404, "Evidència no trobada.");
      return enviaJSON(res, 200, evidenciaPublica(ev));
    }

    if ((m = p.match(/^\/api\/evidencies\/([^/]+)\/entrega$/)) && metode === "POST") {
      const codi = m[1];
      const usuari = usuariDeToken(req);
      if (!usuari) return enviaError(res, 401, "Cal iniciar sessió amb el teu usuari i contrasenya per entregar.");
      const compte = store.carregaAlumnes()[usuari];
      if (!compte) return enviaError(res, 401, "El teu compte ja no existeix. Parla amb la professora.");
      const nom = compte.nom || compte.usuari;

      const cos = await llegeixCos(req);
      const codiScript = (cos.codiScript || "").toString();
      if (!codiScript.trim()) return enviaError(res, 400, "El script és buit.");
      const ev = store.carregaEvidencies()[codi];
      if (!ev || !visiblePerAlumnat(ev)) return enviaError(res, 404, "Element no trobat.");
      if (!ev.proves || !ev.proves.length) return enviaError(res, 400, "Aquest element encara no té cap joc de proves configurat.");

      const tipus = tipusDe(ev);
      const estat = store.carregaEstat(codi);

      if (tipus === "evidencia") {
        const alumneActual = (estat.alumnes || {})[usuari];
        if (alumneActual && alumneActual.superat) {
          return enviaError(res, 409, "Ja has superat aquesta evidència; no cal tornar a entregar-la.");
        }
        if (alumneActual && alumneActual.bloquejat) {
          return enviaError(
            res,
            409,
            "Ja has fet servir els 6 intents permesos per a aquesta evidència sense superar-la. La teva nota ja queda fixada (consulta el rànquing); parla amb la professora si tens dubtes."
          );
        }
      }

      const { resultatsProves, totesOk } = executaIAvalua(codiScript, ev.proves);

      if (tipus === "repte") {
        const { alumne } = aplicaEntregaRepte({ estat, usuari, nom, totesOk });
        store.desaEstat(codi, estat);
        return enviaJSON(res, 200, {
          tipus,
          resultatsProves,
          superat: totesOk,
          intent: alumne.intents,
          intentSuperat: alumne.intentSuperat,
        });
      }

      const { alumne, primerCop } = aplicaEntregaEvidencia({ estat, usuari, nom, totesOk });
      store.desaEstat(codi, estat);

      return enviaJSON(res, 200, {
        tipus,
        resultatsProves,
        superat: totesOk,
        intent: alumne.intents,
        primerCop,
        nota: alumne.nota,
        bloquejat: !!alumne.bloquejat,
      });
    }

    if ((m = p.match(/^\/api\/evidencies\/([^/]+)\/estat$/)) && metode === "GET") {
      // Requereix sessió d'alumnat: el rànquing inclou noms reals i notes,
      // i un cop l'aplicació estigui penjada a internet no ha de ser
      // visible per a qualsevol que tingui l'enllaç.
      if (!usuariDeToken(req)) return enviaError(res, 401, "Cal iniciar sessió per veure el rànquing.");
      const estat = store.carregaEstat(m[1]);
      return enviaJSON(res, 200, estatPublic(estat));
    }

    // --- Alumnat: login, perfil propi i canvi de contrasenya ---
    if (p === "/api/alumnat/login" && metode === "POST") {
      const cos = await llegeixCos(req);
      const usuari = (cos.usuari || "").toString().trim();
      const contrasenya = (cos.contrasenya || "").toString();
      const alumnes = store.carregaAlumnes();
      const compte = alumnes[usuari];
      if (!compte || !comprovaContrasenya(contrasenya, compte.sal, compte.hash)) {
        return enviaError(res, 401, "Usuari o contrasenya incorrectes.");
      }
      return enviaJSON(res, 200, {
        token: creaTokenAlumne(usuari),
        usuari,
        nom: compte.nom || usuari,
        contrasenyaCanviada: !!compte.contrasenyaCanviada,
      });
    }

    if (p === "/api/alumnat/jo" && metode === "GET") {
      const usuari = usuariDeToken(req);
      if (!usuari) return enviaError(res, 401, "Cal iniciar sessió.");
      const compte = store.carregaAlumnes()[usuari];
      if (!compte) return enviaError(res, 401, "El teu compte ja no existeix.");
      return enviaJSON(res, 200, { usuari, nom: compte.nom || usuari, contrasenyaCanviada: !!compte.contrasenyaCanviada });
    }

    if (p === "/api/alumnat/canvia-contrasenya" && metode === "POST") {
      const usuari = usuariDeToken(req);
      if (!usuari) return enviaError(res, 401, "Cal iniciar sessió.");
      const cos = await llegeixCos(req);
      const alumnes = store.carregaAlumnes();
      const compte = alumnes[usuari];
      if (!compte) return enviaError(res, 401, "El teu compte ja no existeix.");
      if (!comprovaContrasenya((cos.actual || "").toString(), compte.sal, compte.hash)) {
        return enviaError(res, 401, "La contrasenya actual no és correcta.");
      }
      const nova = (cos.nova || "").toString();
      if (nova.length < 4) return enviaError(res, 400, "La nova contrasenya ha de tenir almenys 4 caràcters.");
      const { sal, hash } = generaHash(nova);
      compte.sal = sal;
      compte.hash = hash;
      compte.contrasenyaCanviada = true;
      store.desaAlumnes(alumnes);
      return enviaJSON(res, 200, { ok: true });
    }

    // --- Admin: login ---
    if (p === "/api/admin/login" && metode === "POST") {
      const cos = await llegeixCos(req);
      const config = store.carregaConfig();
      if ((cos.password || "") !== config.adminPassword) {
        return enviaError(res, 401, "Contrasenya incorrecta.");
      }
      return enviaJSON(res, 200, { token: creaToken() });
    }

    // --- Admin: tota la resta requereix token ---
    if (p.startsWith("/api/admin/")) {
      if (!esPeticioAdminAutenticada(req)) return enviaError(res, 401, "Cal iniciar sessió com a administradora.");

      if (p === "/api/admin/evidencies" && metode === "GET") {
        return enviaJSON(res, 200, Object.values(store.carregaEvidencies()));
      }

      if (p === "/api/admin/evidencies" && metode === "POST") {
        const cos = await llegeixCos(req);
        const codi = (cos.codi || "").toString().trim();
        if (!codi) return enviaError(res, 400, "Cal un codi (per exemple E011 o R001).");
        const totes = store.carregaEvidencies();
        if (totes[codi]) return enviaError(res, 409, `Ja existeix un element amb el codi ${codi}.`);
        const tipus = cos.tipus === "repte" ? "repte" : "evidencia";
        totes[codi] = { codi, tipus, titol: (cos.titol || "").toString(), enunciat: (cos.enunciat || "").toString(), proves: [], ocult: false };
        store.desaEvidencies(totes);
        return enviaJSON(res, 201, totes[codi]);
      }

      if ((m = p.match(/^\/api\/admin\/evidencies\/([^/]+)$/)) && metode === "PUT") {
        const cos = await llegeixCos(req);
        const totes = store.carregaEvidencies();
        if (!totes[m[1]]) return enviaError(res, 404, "Element no trobat.");
        totes[m[1]].titol = (cos.titol ?? totes[m[1]].titol).toString();
        totes[m[1]].enunciat = (cos.enunciat ?? totes[m[1]].enunciat).toString();
        if (cos.tipus !== undefined) totes[m[1]].tipus = cos.tipus === "repte" ? "repte" : "evidencia";
        if (cos.ocult !== undefined) totes[m[1]].ocult = !!cos.ocult;
        store.desaEvidencies(totes);
        return enviaJSON(res, 200, totes[m[1]]);
      }

      if ((m = p.match(/^\/api\/admin\/evidencies\/([^/]+)$/)) && metode === "DELETE") {
        const totes = store.carregaEvidencies();
        if (!totes[m[1]]) return enviaError(res, 404, "Evidència no trobada.");
        delete totes[m[1]];
        store.desaEvidencies(totes);
        store.esborraEstat(m[1]);
        return enviaJSON(res, 200, { ok: true });
      }

      if ((m = p.match(/^\/api\/admin\/evidencies\/([^/]+)\/proves$/)) && metode === "POST") {
        const cos = await llegeixCos(req);
        const totes = store.carregaEvidencies();
        if (!totes[m[1]]) return enviaError(res, 404, "Evidència no trobada.");
        const sortides = normalitzaSortides(cos.sortidaEsperada);
        if (!cos.nom || sortides.length === 0) return enviaError(res, 400, "Cal un nom de prova i almenys una sortida esperada.");
        const prova = {
          nom: cos.nom.toString(),
          entrada: (cos.entrada || "").toString(),
          sortidaEsperada: sortides.length === 1 ? sortides[0] : sortides,
          mode: cos.mode === "exacta" ? "exacta" : "conte",
        };
        totes[m[1]].proves = totes[m[1]].proves || [];
        totes[m[1]].proves.push(prova);
        store.desaEvidencies(totes);
        return enviaJSON(res, 201, totes[m[1]]);
      }

      if ((m = p.match(/^\/api\/admin\/evidencies\/([^/]+)\/proves\/(\d+)$/)) && metode === "PUT") {
        const cos = await llegeixCos(req);
        const totes = store.carregaEvidencies();
        const idx = parseInt(m[2], 10);
        if (!totes[m[1]] || !totes[m[1]].proves || !totes[m[1]].proves[idx]) return enviaError(res, 404, "Prova no trobada.");
        const actual = totes[m[1]].proves[idx];
        const sortides = normalitzaSortides(cos.sortidaEsperada !== undefined ? cos.sortidaEsperada : actual.sortidaEsperada);
        if (sortides.length === 0) return enviaError(res, 400, "Cal almenys una sortida esperada.");
        totes[m[1]].proves[idx] = {
          nom: (cos.nom !== undefined ? cos.nom : actual.nom).toString(),
          entrada: (cos.entrada !== undefined ? cos.entrada : actual.entrada || "").toString(),
          sortidaEsperada: sortides.length === 1 ? sortides[0] : sortides,
          mode: cos.mode !== undefined ? (cos.mode === "exacta" ? "exacta" : "conte") : actual.mode,
        };
        store.desaEvidencies(totes);
        return enviaJSON(res, 200, totes[m[1]]);
      }

      if ((m = p.match(/^\/api\/admin\/evidencies\/([^/]+)\/proves\/(\d+)$/)) && metode === "DELETE") {
        const totes = store.carregaEvidencies();
        const idx = parseInt(m[2], 10);
        if (!totes[m[1]] || !totes[m[1]].proves || !totes[m[1]].proves[idx]) return enviaError(res, 404, "Prova no trobada.");
        totes[m[1]].proves.splice(idx, 1);
        store.desaEvidencies(totes);
        return enviaJSON(res, 200, totes[m[1]]);
      }

      if ((m = p.match(/^\/api\/admin\/evidencies\/([^/]+)\/estat$/)) && metode === "GET") {
        const estat = store.carregaEstat(m[1]);
        return enviaJSON(res, 200, estat);
      }

      if ((m = p.match(/^\/api\/admin\/evidencies\/([^/]+)\/reset$/)) && metode === "POST") {
        store.esborraEstat(m[1]);
        return enviaJSON(res, 200, { ok: true });
      }

      // --- Admin: gestió de l'alumnat (comptes d'usuari/contrasenya) ---
      if (p === "/api/admin/alumnat" && metode === "GET") {
        const alumnes = store.carregaAlumnes();
        return enviaJSON(
          res,
          200,
          Object.values(alumnes).map((a) => ({
            usuari: a.usuari,
            nom: a.nom || "",
            creat: a.creat,
            contrasenyaCanviada: !!a.contrasenyaCanviada,
          }))
        );
      }

      if (p === "/api/admin/alumnat" && metode === "POST") {
        const cos = await llegeixCos(req);
        const usuari = (cos.usuari || "").toString().trim();
        const contrasenya = (cos.contrasenya || "").toString();
        const nom = (cos.nom || "").toString().trim();
        if (!usuari) return enviaError(res, 400, "Cal un nom d'usuari.");
        if (contrasenya.length < 4) return enviaError(res, 400, "La contrasenya ha de tenir almenys 4 caràcters.");
        const alumnes = store.carregaAlumnes();
        if (alumnes[usuari]) return enviaError(res, 409, `Ja existeix un compte amb l'usuari ${usuari}.`);
        const { sal, hash } = generaHash(contrasenya);
        alumnes[usuari] = { usuari, nom, sal, hash, creat: new Date().toISOString(), contrasenyaCanviada: false };
        store.desaAlumnes(alumnes);
        return enviaJSON(res, 201, { usuari, nom, creat: alumnes[usuari].creat, contrasenyaCanviada: false });
      }

      if (p === "/api/admin/alumnat/massiu" && metode === "POST") {
        const cos = await llegeixCos(req);
        const text = (cos.text || "").toString();
        const alumnes = store.carregaAlumnes();
        const creats = [];
        const jaExistien = [];
        const errors = [];
        text
          .split("\n")
          .map((linia) => linia.trim())
          .filter((linia) => linia.length > 0)
          .forEach((linia) => {
            const parts = linia.split(/[,;\t]/).map((part) => part.trim());
            const usuari = parts[0] || "";
            const contrasenya = parts[1] || "";
            const nom = parts[2] || "";
            if (!usuari || contrasenya.length < 4) {
              errors.push(`"${linia}" — cal usuari i contrasenya d'almenys 4 caràcters (format: usuari,contrasenya,Nom opcional).`);
              return;
            }
            if (alumnes[usuari]) {
              jaExistien.push(usuari);
              return;
            }
            const { sal, hash } = generaHash(contrasenya);
            alumnes[usuari] = { usuari, nom, sal, hash, creat: new Date().toISOString(), contrasenyaCanviada: false };
            creats.push(usuari);
          });
        store.desaAlumnes(alumnes);
        return enviaJSON(res, 200, { creats, jaExistien, errors });
      }

      if ((m = p.match(/^\/api\/admin\/alumnat\/([^/]+)\/reinicia$/)) && metode === "POST") {
        const cos = await llegeixCos(req);
        const alumnes = store.carregaAlumnes();
        if (!alumnes[m[1]]) return enviaError(res, 404, "Compte no trobat.");
        const novaContrasenya = (cos.novaContrasenya || "").toString();
        if (novaContrasenya.length < 4) return enviaError(res, 400, "La contrasenya ha de tenir almenys 4 caràcters.");
        const { sal, hash } = generaHash(novaContrasenya);
        alumnes[m[1]].sal = sal;
        alumnes[m[1]].hash = hash;
        alumnes[m[1]].contrasenyaCanviada = false;
        store.desaAlumnes(alumnes);
        return enviaJSON(res, 200, { ok: true });
      }

      if ((m = p.match(/^\/api\/admin\/alumnat\/([^/]+)$/)) && metode === "DELETE") {
        const alumnes = store.carregaAlumnes();
        if (!alumnes[m[1]]) return enviaError(res, 404, "Compte no trobat.");
        delete alumnes[m[1]];
        store.desaAlumnes(alumnes);
        return enviaJSON(res, 200, { ok: true });
      }

      if (p === "/api/admin/password" && metode === "POST") {
        const cos = await llegeixCos(req);
        const config = store.carregaConfig();
        if ((cos.actual || "") !== config.adminPassword) return enviaError(res, 401, "La contrasenya actual no és correcta.");
        if (!cos.nova || cos.nova.length < 4) return enviaError(res, 400, "La nova contrasenya ha de tenir almenys 4 caràcters.");
        config.adminPassword = cos.nova;
        store.desaConfig(config);
        return enviaJSON(res, 200, { ok: true });
      }

      if (p === "/api/admin/exporta" && metode === "GET") {
        const evidencies = store.carregaEvidencies();
        const estats = {};
        Object.keys(evidencies).forEach((codi) => {
          estats[codi] = store.carregaEstat(codi);
        });
        const alumnes = store.carregaAlumnes();
        const copia = { exportatA: new Date().toISOString(), evidencies, estats, alumnes };
        const cos = JSON.stringify(copia, null, 2);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="joc_de_proves_copia_${Date.now()}.json"`,
          "Content-Length": Buffer.byteLength(cos),
        });
        return res.end(cos);
      }

      if (p === "/api/admin/importa" && metode === "POST") {
        const cos = await llegeixCos(req);
        if (!cos.evidencies) return enviaError(res, 400, "El fitxer no té el format esperat (li falta 'evidencies').");
        store.desaEvidencies(cos.evidencies);
        Object.entries(cos.estats || {}).forEach(([codi, estat]) => store.desaEstat(codi, estat));
        if (cos.alumnes) store.desaAlumnes(cos.alumnes);
        return enviaJSON(res, 200, {
          ok: true,
          evidenciesImportades: Object.keys(cos.evidencies).length,
          alumnesImportats: cos.alumnes ? Object.keys(cos.alumnes).length : 0,
        });
      }

      return enviaError(res, 404, "Ruta d'administració no trobada.");
    }

    // --- Fitxers estàtics (frontend) ---
    if (metode === "GET") {
      return serveixEstatic(req, res, p);
    }

    enviaError(res, 404, "Ruta no trobada.");
  } catch (err) {
    console.error(err);
    enviaError(res, 500, "Error intern del servidor: " + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`Joc de Proves escoltant a http://localhost:${PORT}`);
  console.log(`Contrasenya d'administració actual: ${store.carregaConfig().adminPassword} (canvia-la des del panell d'administració).`);
});
