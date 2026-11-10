// Executa un script de l'alumnat contra el joc de proves d'una evidència
// i retorna el detall de cada prova + si l'ha superat en conjunt.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TMP_DIR = path.join(__dirname, "..", "data", "tmp");

// --- Shim de "prompt-sync" per a l'execució automàtica ------------------
// El paquet real "prompt-sync" obre /dev/tty directament (no llegeix mai de
// stdin) perquè necessita control de terminal en mode raw. En aquest
// corrector, l'script s'executa com a procés fill amb stdio en mode "pipe"
// (sense terminal real), així que obrir /dev/tty falla sempre amb un error
// de baix nivell (fs.openSync) — exactament el bug detectat el 2026-11-09
// amb E013 un cop ja s'havia instal·lat el paquet real.
//
// La solució: deixem un mòdul "prompt-sync" propi dins el node_modules més
// proper al fitxer de l'alumnat (TMP_DIR), que Node resol ABANS que el
// paquet real instal·lat a l'arrel de l'app (la resolució de mòduls de
// Node sempre mira primer el node_modules més a prop del fitxer que fa el
// require). Així, l'script de l'alumnat (que fa `require('prompt-sync')()`
// exactament igual que en VS Code) rep una implementació que simplement
// llegeix tota l'entrada (stdin) un sol cop i en va retornant una línia a
// cada crida — sense necessitar cap terminal real. No calen canvis ni al
// codi de l'alumnat ni al Dossier.
const SHIM_PROMPT_SYNC_DIR = path.join(TMP_DIR, "node_modules", "prompt-sync");
const SHIM_PROMPT_SYNC_CODE = `// Shim generat automàticament pel Joc de Proves — vegeu lib/corrector.js
const fs = require("fs");
module.exports = function crea() {
  let linies = null;
  let index = 0;
  function carrega() {
    if (linies === null) {
      let contingut = "";
      try {
        contingut = fs.readFileSync(0, "utf8");
      } catch (e) {
        contingut = "";
      }
      linies = contingut.split("\\n");
    }
  }
  return function prompt(pregunta) {
    if (pregunta !== undefined && pregunta !== null) {
      try { process.stdout.write(String(pregunta)); } catch (e) { /* ignorar */ }
    }
    carrega();
    const linia = index < linies.length ? linies[index] : "";
    index++;
    return linia.replace(/\\r$/, "");
  };
};
`;

function asseguraShimPromptSync() {
  if (!fs.existsSync(SHIM_PROMPT_SYNC_DIR)) fs.mkdirSync(SHIM_PROMPT_SYNC_DIR, { recursive: true });
  const pkgPath = path.join(SHIM_PROMPT_SYNC_DIR, "package.json");
  const idxPath = path.join(SHIM_PROMPT_SYNC_DIR, "index.js");
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(
      pkgPath,
      JSON.stringify({ name: "prompt-sync", version: "4.2.0", main: "index.js" }, null, 2),
      "utf8"
    );
  }
  if (!fs.existsSync(idxPath)) {
    fs.writeFileSync(idxPath, SHIM_PROMPT_SYNC_CODE, "utf8");
  }
}

function executaUnCop(fitxer, entrada) {
  try {
    const sortida = execFileSync("node", [fitxer], {
      timeout: 5000,
      encoding: "utf8",
      input: entrada || "",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 1024 * 1024,
    });
    return { sortida, error: null };
  } catch (e) {
    const sortida = (e.stdout || "") + (e.stderr || "");
    const vaImprimirAlgunaCosa = !!e.stdout;
    return {
      sortida,
      error: vaImprimirAlgunaCosa
        ? null // va arribar a imprimir alguna cosa abans de petar; ho tractem com a sortida parcial
        : (e.signal === "SIGTERM"
            ? "El programa ha trigat massa (més de 5 segons) — revisa si té un bucle infinit."
            : (e.stderr || e.message || "Error en executar el programa.").toString()),
    };
  }
}

function escapaRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Comprova si `esperat` apareix a `realNet" com a valor "sencer", no com a
// subcadena d'un número més llarg: "6.5" no ha de donar positiu dins "-6.5"
// ni dins "16.5". Només s'aplica aquest control de límits quan `esperat` és
// un número; per a text normal es fa una cerca de subcadena simple.
function conteValor(realNet, esperat) {
  const esNumero = /^-?\d+(\.\d+)?$/.test(esperat);
  if (!esNumero) return realNet.includes(esperat);
  const patro = new RegExp(`(?<![0-9.\\-])${escapaRegex(esperat)}(?![0-9.])`);
  return patro.test(realNet);
}

// Una prova pot tenir més d'una sortida vàlida (per exemple, quan l'enunciat
// permet més d'una manera correcta de plantejar la condició i, per tant, més
// d'un resultat correcte: edat<=16 pot donar true o false depenent de com
// l'alumnat ho hagi plantejat). `sortidaEsperada` pot ser un sol valor
// (string, format antic) o una llista de valors acceptats.
function llistaSortidesEsperades(prova) {
  const valor = prova.sortidaEsperada;
  const llista = Array.isArray(valor) ? valor : [valor];
  return llista.map((v) => (v || "").toString().trim()).filter((v) => v.length > 0);
}

function comprovaUnaSortida(realNet, esperat, esExacta) {
  return esExacta ? realNet === esperat : conteValor(realNet, esperat);
}

function comprovaSortida(real, prova) {
  const esperades = llistaSortidesEsperades(prova);
  const realNet = (real || "").trim();
  const esExacta = prova.mode === "exacta";
  const ok = esperades.some((esperat) => comprovaUnaSortida(realNet, esperat, esExacta));
  const llistaText = esperades.map((e) => `"${e}"`).join(" o ");
  const detall = ok
    ? "Sortida correcta."
    : `Sortida obtinguda: "${realNet.slice(0, 200)}"${realNet.length > 200 ? "…" : ""} — s'esperava ${
        esExacta ? "exactament" : "que contingués"
      }${esperades.length > 1 ? " alguna d'aquestes sortides" : ""}: ${llistaText}.`;
  return { ok, detall };
}

function executaIAvalua(codiScript, proves) {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  asseguraShimPromptSync();
  const fitxer = path.join(TMP_DIR, `script_${Date.now()}_${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(fitxer, codiScript, "utf8");

  const resultatsProves = [];
  try {
    for (const prova of proves) {
      const { sortida, error } = executaUnCop(fitxer, prova.entrada);
      if (error) {
        resultatsProves.push({ nom: prova.nom, ok: false, detall: `Error en executar-se: ${error.toString().split("\n").slice(0, 3).join(" | ")}` });
        continue;
      }
      const { ok, detall } = comprovaSortida(sortida, prova);
      resultatsProves.push({ nom: prova.nom, ok, detall });
    }
  } finally {
    try {
      fs.unlinkSync(fitxer);
    } catch (e) {
      /* ignorar */
    }
  }

  const totesOk = resultatsProves.length > 0 && resultatsProves.every((r) => r.ok);
  return { resultatsProves, totesOk };
}

module.exports = { executaIAvalua };
