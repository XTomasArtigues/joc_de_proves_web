// Persistència de dades de l'aplicació.
//
// Té dos modes, triats automàticament segons si existeix la variable
// d'entorn DATABASE_URL:
//
//  - MODE FITXERS (sense DATABASE_URL): el de sempre. Tot es llegeix i
//    s'escriu directament a fitxers JSON dins DATA_DIR. Senzill, però amb
//    Render necessita un disc persistent de pagament, perquè el disc normal
//    (gratuït) s'esborra a cada reinici.
//  - MODE BASE DE DADES (amb DATABASE_URL definida, p. ex. una base de dades
//    Postgres gratuïta de Neon): totes les dades es guarden com a files
//    "clau -> bloc JSON" en una sola taula (`dades_app`), que fa de rèplica
//    persistent del que abans eren fitxers. En arrencar, `init()` carrega
//    totes les files en un mapa en memòria (`cache`); a partir d'aquí, totes
//    les funcions de lectura (carregaX) llegeixen del mapa — instantani, com
//    sempre — i totes les d'escriptura (desaX/esborraX) actualitzen primer
//    el mapa i després encuen una escriptura a la base de dades en segon
//    pla. Així no cal canviar res a server.js: les ~70 crides existents a
//    store.carregaX()/desaX() continuen sent síncrones i funcionen igual,
//    tant si hi ha base de dades com si no.
//
// Avantatge del mode base de dades: amb Render en pla gratuït (0$/mes, sense
// disc persistent) les dades ja no es perden mai, perquè viuen fora del
// disc de Render. Avantatge del mode fitxers: no necessita cap servei
// extern ni variable d'entorn — segueix funcionant igual en local.
const fs = require("fs");
const path = require("path");

// Carpeta de dades "de fàbrica" dins del propi projecte (la que porta el
// repositori: hi viuen les dades d'exemple que s'entreguen amb l'app, com
// E011 i la contrasenya inicial). Sempre existeix i es fa servir per fer la
// primera càrrega inicial (llavor), tant en mode fitxers com en mode base
// de dades.
const SEED_DATA_DIR = path.join(__dirname, "..", "data");

// Carpeta de dades REAL que fa servir l'aplicació en MODE FITXERS. Si es
// defineix la variable d'entorn DATA_DIR (per exemple, apuntant a un disc
// persistent de Render muntat a /var/data), es fa servir aquesta en lloc de
// la del projecte. En MODE BASE DE DADES no es fa servir (les dades no
// viuen en cap disc).
const DATA_DIR = process.env.DATA_DIR || SEED_DATA_DIR;
const EVIDENCIES_PATH = path.join(DATA_DIR, "evidencies.json");
const ESTAT_DIR = path.join(DATA_DIR, "estat");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const ALUMNES_PATH = path.join(DATA_DIR, "alumnes.json");
const CONCURSOS_PATH = path.join(DATA_DIR, "concursos.json");
const ESTAT_CONCURSOS_DIR = path.join(DATA_DIR, "estat-concursos");

const DATABASE_URL = process.env.DATABASE_URL || "";
const USA_BASE_DADES = !!DATABASE_URL;

let pool = null; // instància de pg.Pool (només en mode base de dades)
let cache = null; // Map clau -> valor JSON, rèplica en memòria de la taula
let colaEscriptura = Promise.resolve(); // serialitza les escriptures a la BD, una rere l'altra

// ---------------------------------------------------------------------------
// MODE FITXERS — tal com funcionava abans (sense base de dades externa)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// MODE BASE DE DADES — taula única "clau -> bloc JSON"
// ---------------------------------------------------------------------------

async function asseguraTaula() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dades_app (
      clau TEXT PRIMARY KEY,
      valor JSONB NOT NULL,
      actualitzat TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

function desaClauBD(clau, valor) {
  // S'encua perquè les escriptures es facin en ordre (una rere l'altra) i no
  // es perdi cap si en vénen moltes de seguides en poc temps. Els errors es
  // registren a la consola però no fan caure el servidor: la còpia en
  // memòria (cache) ja s'ha actualitzat igualment, així que l'aplicació
  // continua funcionant encara que la base de dades estigui momentàniament
  // inaccessible; només es perdria aquell canvi concret si el procés es
  // reinicia abans de poder tornar a connectar.
  colaEscriptura = colaEscriptura
    .then(() =>
      pool.query(
        `INSERT INTO dades_app (clau, valor, actualitzat) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (clau) DO UPDATE SET valor = $2::jsonb, actualitzat = now()`,
        [clau, JSON.stringify(valor)]
      )
    )
    .catch((err) => {
      console.error(`[store] ERROR desant "${clau}" a la base de dades:`, err.message);
    });
  return colaEscriptura;
}

function esborraClauBD(clau) {
  colaEscriptura = colaEscriptura
    .then(() => pool.query("DELETE FROM dades_app WHERE clau = $1", [clau]))
    .catch((err) => {
      console.error(`[store] ERROR esborrant "${clau}" de la base de dades:`, err.message);
    });
  return colaEscriptura;
}

function llegeixJSONDeFabrica(nomFitxer) {
  const p = path.join(SEED_DATA_DIR, nomFitxer);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// S'ha de cridar (i esperar) una sola vegada en arrencar el servidor, abans
// de posar-se a escoltar peticions. En mode fitxers no fa res (resol a
// l'instant). En mode base de dades: connecta, crea la taula si cal, carrega
// totes les files en memòria i, si la base de dades és totalment nova
// (encara no hi ha ni "evidencies" ni "config"), la pobla amb les dades de
// fàbrica del projecte — igual que `copiaSiFaFalta` feia amb els fitxers.
async function init() {
  if (!USA_BASE_DADES) return;
  const { Pool } = require("pg");
  pool = new Pool({
    connectionString: DATABASE_URL,
    // Neon (i la majoria de Postgres gestionats) exigeixen SSL; el seu
    // certificat no sempre encadena amb una CA que Node reconegui per
    // defecte dins de contenidors mínims, així que no es verifica la cadena
    // — la connexió continua xifrada igualment. És la configuració habitual
    // recomanada per Neon per a aquest tipus d'entorn.
    ssl: { rejectUnauthorized: false },
  });
  await asseguraTaula();
  const resultat = await pool.query("SELECT clau, valor FROM dades_app");
  cache = new Map();
  for (const fila of resultat.rows) cache.set(fila.clau, fila.valor);

  if (!cache.has("evidencies")) {
    const llavor = llegeixJSONDeFabrica("evidencies.json") || {};
    cache.set("evidencies", llavor);
    await desaClauBD("evidencies", llavor);
  }
  if (!cache.has("config")) {
    const llavor = llegeixJSONDeFabrica("config.json") || { adminPassword: "canviar-ho", port: 3000 };
    cache.set("config", llavor);
    await desaClauBD("config", llavor);
  }
  console.log(`[store] Mode base de dades actiu (Postgres). ${cache.size} claus carregades.`);
}

// ---------------------------------------------------------------------------
// API pública — idèntica a abans, síncrona, tant si hi ha base de dades com
// si no (en mode base de dades llegeix/escriu sobre `cache`, ja carregada
// per `init()`; l'escriptura real a la BD passa en segon pla).
// ---------------------------------------------------------------------------

function carregaEvidencies() {
  if (USA_BASE_DADES) return cache.get("evidencies") || {};
  asseguraDirs();
  if (!fs.existsSync(EVIDENCIES_PATH)) return {};
  return JSON.parse(fs.readFileSync(EVIDENCIES_PATH, "utf8"));
}
function desaEvidencies(dades) {
  if (USA_BASE_DADES) {
    cache.set("evidencies", dades);
    desaClauBD("evidencies", dades);
    return;
  }
  asseguraDirs();
  fs.writeFileSync(EVIDENCIES_PATH, JSON.stringify(dades, null, 2));
}

function carregaEstat(codi) {
  if (USA_BASE_DADES) return cache.get(`estat:${codi}`) || { codi, primerSuperat: null, alumnes: {} };
  asseguraDirs();
  const p = path.join(ESTAT_DIR, `${codi}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  return { codi, primerSuperat: null, alumnes: {} };
}
function desaEstat(codi, estat) {
  if (USA_BASE_DADES) {
    cache.set(`estat:${codi}`, estat);
    desaClauBD(`estat:${codi}`, estat);
    return;
  }
  asseguraDirs();
  fs.writeFileSync(path.join(ESTAT_DIR, `${codi}.json`), JSON.stringify(estat, null, 2));
}
function esborraEstat(codi) {
  if (USA_BASE_DADES) {
    cache.delete(`estat:${codi}`);
    esborraClauBD(`estat:${codi}`);
    return;
  }
  const p = path.join(ESTAT_DIR, `${codi}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function carregaConfig() {
  if (USA_BASE_DADES) return cache.get("config") || { adminPassword: "canviar-ho", port: 3000 };
  asseguraDirs();
  if (!fs.existsSync(CONFIG_PATH)) {
    const def = { adminPassword: "canviar-ho", port: 3000 };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(def, null, 2));
    return def;
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}
function desaConfig(cfg) {
  if (USA_BASE_DADES) {
    cache.set("config", cfg);
    desaClauBD("config", cfg);
    return;
  }
  asseguraDirs();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// Comptes de l'alumnat: { "<usuari>": { usuari, nom, sal, hash, creat, contrasenyaCanviada } }
// Mai es guarda la contrasenya en clar, només sal+hash (vegeu lib/credencials.js).
function carregaAlumnes() {
  if (USA_BASE_DADES) return cache.get("alumnes") || {};
  asseguraDirs();
  if (!fs.existsSync(ALUMNES_PATH)) return {};
  return JSON.parse(fs.readFileSync(ALUMNES_PATH, "utf8"));
}
function desaAlumnes(dades) {
  if (USA_BASE_DADES) {
    cache.set("alumnes", dades);
    desaClauBD("alumnes", dades);
    return;
  }
  asseguraDirs();
  fs.writeFileSync(ALUMNES_PATH, JSON.stringify(dades, null, 2));
}

// Concursos (competicions per equips, 2026-10-27): { "<id>": { id, nom,
// dataInici, duracioMinuts, equips: [usuari,...], problemes: [...] } }
function carregaConcursos() {
  if (USA_BASE_DADES) return cache.get("concursos") || {};
  asseguraDirs();
  if (!fs.existsSync(CONCURSOS_PATH)) return {};
  return JSON.parse(fs.readFileSync(CONCURSOS_PATH, "utf8"));
}
function desaConcursos(dades) {
  if (USA_BASE_DADES) {
    cache.set("concursos", dades);
    desaClauBD("concursos", dades);
    return;
  }
  asseguraDirs();
  fs.writeFileSync(CONCURSOS_PATH, JSON.stringify(dades, null, 2));
}

// Estat (intents i marcador en brut) d'un concurs concret, igual que
// `carregaEstat`/`desaEstat` per a evidències/reptes però en una carpeta (o
// clau) a part perquè els identificadors no xoquin entre tots dos mons.
function carregaEstatConcurs(id) {
  if (USA_BASE_DADES) return cache.get(`estatConcurs:${id}`) || { equips: {} };
  asseguraDirs();
  const p = path.join(ESTAT_CONCURSOS_DIR, `${id}.json`);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  return { equips: {} };
}
function desaEstatConcurs(id, estat) {
  if (USA_BASE_DADES) {
    cache.set(`estatConcurs:${id}`, estat);
    desaClauBD(`estatConcurs:${id}`, estat);
    return;
  }
  asseguraDirs();
  fs.writeFileSync(path.join(ESTAT_CONCURSOS_DIR, `${id}.json`), JSON.stringify(estat, null, 2));
}
function esborraEstatConcurs(id) {
  if (USA_BASE_DADES) {
    cache.delete(`estatConcurs:${id}`);
    esborraClauBD(`estatConcurs:${id}`);
    return;
  }
  const p = path.join(ESTAT_CONCURSOS_DIR, `${id}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

module.exports = {
  DATA_DIR,
  USA_BASE_DADES,
  init,
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
