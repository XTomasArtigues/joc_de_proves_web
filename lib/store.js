// Persistència senzilla basada en fitxers JSON (sense base de dades externa).
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const EVIDENCIES_PATH = path.join(DATA_DIR, "evidencies.json");
const ESTAT_DIR = path.join(DATA_DIR, "estat");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const ALUMNES_PATH = path.join(DATA_DIR, "alumnes.json");

function asseguraDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ESTAT_DIR)) fs.mkdirSync(ESTAT_DIR, { recursive: true });
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
};
