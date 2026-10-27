// Persistència senzilla basada en fitxers JSON (sense base de dades externa).
const fs = require("fs");
const path = require("path");

// Carpeta de dades "de fàbrica" dins del propi projecte (la que porta el
// repositori: hi viuen les dades d'exemple que s'entreguen amb l'app, com
// E011 i la contrasenya inicial). Sempre existeix.
const SEED_DATA_DIR = path.join(__dirname, "..", "data");

// Carpeta de dades REAL que fa servir l'aplicació. Si es defineix la
// variable d'entorn DATA_DIR (per exemple, apuntant a un disc persistent de
// Render muntat a /var/data), es fa servir aquesta en lloc de la del
// projecte — així les dades (evidències, intents, notes, comptes) sobreviuen
// als desplegaments. Si no es defineix (per exemple, en local), es fa
// servir la carpeta del projecte com sempre.
const DATA_DIR = process.env.DATA_DIR || SEED_DATA_DIR;
const EVIDENCIES_PATH = path.join(DATA_DIR, "evidencies.json");
const ESTAT_DIR = path.join(DATA_DIR, "estat");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const ALUMNES_PATH = path.join(DATA_DIR, "alumnes.json");
const CONCURSOS_PATH = path.join(DATA_DIR, "concursos.json");
const ESTAT_CONCURSOS_DIR = path.join(DATA_DIR, "estat-concursos");

function copiaSiFaFalta(nomFitxer) {
  // La primera vegada que s'arrenca amb una carpeta de dades nova i buida
  // (per exemple, un disc persistent recent), hi copia els fitxers
  // "de fàbrica" del projecte (evidencies.json, config.json) perquè no calgui
  // tornar a crear l'evidència d'exemple ni la contrasenya inicial a mà.
  // Un cop ja hi existeix el fitxer a la carpeta real, mai es torna a
  // sobreescriure (per no perdre canvis fets des de l'admin).
  if (DATA_DIR === SEED_DATA_DIR) return; // mateixa carpeta: no cal copiar res
  const origen = path.join(SEED_DATA_DIR, nomFitxer);
  const desti = path.join(DATA_DIR, nomFitxer);
  if (!fs.existsSync(desti) && fs.existsSync(origen)) {
    fs.copyFileSync(origen, desti);
  }
}

function asseguraDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ESTAT_DIR)) fs.mkdirSync(ESTAT_DIR, { recursive: true });
  if (!fs.existsSync(ESTAT_CONCURSOS_DIR)) fs.mkdirSync(ESTAT_CONCURSOS_DIR, { recursive: true });
  copiaSiFaFalta("evidencies.json");
  copiaSiFaFalta("config.json");
}

function carregaEvidencies() {
  asseguraDirs();
  if (!fs.existsSync(EVIDENCIES_PATH)) return {};
  return JSON.parse(fs.readFileSync(EVIDENCIES_PATH, "utf8"));
}
function desaEvidencies(dades) {
  asseguraDirs();
  fs.writeFileSync(EVIDENCIES_PATH, JSON.stringify(dades, null, 2));
}

function carregaEstat(codi) {
  asseguraDirs();
  const p = path.join(ESTAT_DIR, `${codi}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  return { codi, primerSuperat: null, alumnes: {} };
}
function desaEstat(codi, estat) {
  asseguraDirs();
  fs.writeFileSync(path.join(ESTAT_DIR, `${codi}.json`), JSON.stringify(estat, null, 2));
}
function esborraEstat(codi) {
  const p = path.join(ESTAT_DIR, `${codi}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function carregaConfig() {
  asseguraDirs();
  if (!fs.existsSync(CONFIG_PATH)) {
    const def = { adminPassword: "canviar-ho", port: 3000 };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(def, null, 2));
    return def;
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}
function desaConfig(cfg) {
  asseguraDirs();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// Comptes de l'alumnat: { "<usuari>": { usuari, nom, sal, hash, creat, contrasenyaCanviada } }
// Mai es guarda la contrasenya en clar, només sal+hash (vegeu lib/credencials.js).
function carregaAlumnes() {
  asseguraDirs();
  if (!fs.existsSync(ALUMNES_PATH)) return {};
  return JSON.parse(fs.readFileSync(ALUMNES_PATH, "utf8"));
}
function desaAlumnes(dades) {
  asseguraDirs();
  fs.writeFileSync(ALUMNES_PATH, JSON.stringify(dades, null, 2));
}

// Concursos (competicions per equips, 2026-10-27): { "<id>": { id, nom,
// dataInici, duracioMinuts, equips: [usuari,...], problemes: [...] } }
function carregaConcursos() {
  asseguraDirs();
  if (!fs.existsSync(CONCURSOS_PATH)) return {};
  return JSON.parse(fs.readFileSync(CONCURSOS_PATH, "utf8"));
}
function desaConcursos(dades) {
  asseguraDirs();
  fs.writeFileSync(CONCURSOS_PATH, JSON.stringify(dades, null, 2));
}

// Estat (intents i marcador en brut) d'un concurs concret, igual que
// `carregaEstat`/`desaEstat` per a evidències/reptes però en una carpeta a
// part perquè els identificadors no xoquin entre tots dos mons.
function carregaEstatConcurs(id) {
  asseguraDirs();
  const p = path.join(ESTAT_CONCURSOS_DIR, `${id}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  return { equips: {} };
}
function desaEstatConcurs(id, estat) {
  asseguraDirs();
  fs.writeFileSync(path.join(ESTAT_CONCURSOS_DIR, `${id}.json`), JSON.stringify(estat, null, 2));
}
function esborraEstatConcurs(id) {
  const p = path.join(ESTAT_CONCURSOS_DIR, `${id}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

module.exports = {
  DATA_DIR,
  carregaEvidencies,
  desaEvidencies,
  carregaEstat,
  desaEstat,
  esborraEstat,
  carregaConfig,
  desaConfig,
  carregaAlumnes,
  desaAlumnes,
  carregaConcursos,
  desaConcursos,
  carregaEstatConcurs,
  desaEstatConcurs,
  esborraEstatConcurs,
};
