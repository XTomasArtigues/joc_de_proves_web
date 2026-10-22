// Executa un script de l'alumnat contra el joc de proves d'una evidència
// i retorna el detall de cada prova + si l'ha superat en conjunt.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TMP_DIR = path.join(__dirname, "..", "data", "tmp");

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
