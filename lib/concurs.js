// Lògica d'un "Concurs": una competició entre equips, a l'estil d'un
// concurs de programació tipus ICPC (el format en què es basa Programa'm).
// Normativa fixada per la professora (2026-10-27):
//
// 1. Com es guanyen punts
//    - Cada problema val els punts que la professora li assigna en
//      afegir-lo al concurs — no té relació amb la dificultat ni amb la
//      quantitat de codi escrit.
//    - La puntuació de l'equip és la suma dels punts dels problemes que ha
//      resolt correctament. Guanya l'equip amb més punts.
//    - En cas d'empat a punts, guanya l'equip amb menys temps total
//      acumulat (vegeu el punt 2).
//
// 2. Penalitzacions
//    - Per cada problema que l'equip acaba resolent, es compta el temps
//      transcorregut des de l'inici del concurs fins que envia la solució
//      correcta.
//    - S'hi afegeixen 20 minuts (1.200 segons) per cada entrega incorrecta
//      anterior d'aquell mateix problema.
//    - Els problemes que l'equip NO arriba a resoldre no sumen cap temps de
//      penalització, per molts intents que s'hi hagin fet.
//    - Un cop un equip ha resolt un problema, no es pot tornar a entregar
//      (no té cap efecte en la puntuació ni en el temps).
//
// 3. Marcador
//    - Verd: problema resolt. Verd fosc ("primer"): a més, el primer equip
//      de tots a resoldre'l. Vermell: intentat, encara no resolt. Blanc:
//      encara no intentat.
//    - Es mostra, per a cada problema resolt, els intents fets i el temps
//      comptabilitzat (temps fins a l'encert + penalització), per exemple
//      "3 (25+40)" = 3 intents, 25 min fins a l'encert, 40 min de
//      penalització acumulada (2 intents fallits previs × 20 min).
//
// 4. Bonificació pel primer a resoldre (2026-10-27, opcional per concurs)
//    - Cada concurs pot tenir un `bonusPrimer` (punts extra, el mateix
//      valor per a tots els problemes del concurs): l'equip que sigui el
//      primer de tots a resoldre un problema concret suma aquests punts
//      extra, a banda dels punts normals del problema. Si `bonusPrimer` no
//      està definit (concursos creats abans d'aquest canvi), es tracta com
//      a 0 — cap bonificació, cap canvi de comportament.

const MINUTS_PENALITZACIO_PER_INTENT_FALLIT = 20;

function entradaEquip(estatConcurs, equip) {
  estatConcurs.equips = estatConcurs.equips || {};
  estatConcurs.equips[equip] = estatConcurs.equips[equip] || { problemes: {} };
  return estatConcurs.equips[equip];
}

function entradaProblema(entrada, codiProblema) {
  entrada.problemes = entrada.problemes || {};
  entrada.problemes[codiProblema] = entrada.problemes[codiProblema] || {
    intents: 0,
    superat: false,
    primerCorrecteISO: null,
    historial: [], // [{ ts, ok }] — un registre per cada entrega
  };
  return entrada.problemes[codiProblema];
}

// Aplica una entrega d'un equip a un problema concret de l'estat (en
// memòria) d'un concurs. Si l'equip ja l'havia resolt abans, llança un
// error amb `.public = true` (missatge segur de mostrar tal qual).
function aplicaEntregaConcurs({ estatConcurs, equip, codiProblema, totesOk }) {
  const entrada = entradaEquip(estatConcurs, equip);
  const pr = entradaProblema(entrada, codiProblema);
  if (pr.superat) {
    const err = new Error("El vostre equip ja ha resolt aquest problema; no cal tornar a entregar-lo.");
    err.public = true;
    throw err;
  }
  const araISO = new Date().toISOString();
  pr.intents += 1;
  pr.historial.push({ ts: araISO, ok: !!totesOk });
  if (totesOk) {
    pr.superat = true;
    pr.primerCorrecteISO = araISO;
  }
  return { intents: pr.intents, superat: pr.superat };
}

function minutsEntre(isoInici, isoFinal) {
  return Math.max(0, Math.round((new Date(isoFinal).getTime() - new Date(isoInici).getTime()) / 60000));
}

// Calcula el marcador complet d'un concurs: una fila per cada equip (encara
// que no hagi entregat res), amb el detall de cada problema i els totals,
// ja ordenat segons la normativa (més punts primer; en cas d'empat, menys
// temps acumulat).
function calculaMarcador({ concurs, estatConcurs }) {
  const problemes = concurs.problemes || [];
  const equipsIds = concurs.equips || [];
  const estats = estatConcurs && estatConcurs.equips ? estatConcurs.equips : {};
  const bonusPrimer = concurs.bonusPrimer || 0;

  // Primer equip a resoldre cada problema (per al "verd fosc" del marcador).
  const primerPerProblema = {};
  problemes.forEach((pr) => {
    let millor = null;
    equipsIds.forEach((eqUsuari) => {
      const p = estats[eqUsuari] && estats[eqUsuari].problemes && estats[eqUsuari].problemes[pr.codi];
      if (p && p.superat && p.primerCorrecteISO) {
        if (!millor || new Date(p.primerCorrecteISO) < new Date(millor.ts)) millor = { equip: eqUsuari, ts: p.primerCorrecteISO };
      }
    });
    primerPerProblema[pr.codi] = millor ? millor.equip : null;
  });

  const files = equipsIds.map((eqUsuari) => {
    const estatEquip = estats[eqUsuari];
    let punts = 0;
    let temps = 0;
    const celles = problemes.map((pr) => {
      const p = estatEquip && estatEquip.problemes && estatEquip.problemes[pr.codi];
      if (!p || p.intents === 0) {
        return { codi: pr.codi, estat: "blanc", intents: 0 };
      }
      if (p.superat) {
        const intentsAbans = p.intents - 1;
        const tempsResolucio = minutsEntre(concurs.dataInici, p.primerCorrecteISO);
        const penalitzacio = intentsAbans * MINUTS_PENALITZACIO_PER_INTENT_FALLIT;
        const esPrimer = primerPerProblema[pr.codi] === eqUsuari;
        const bonus = esPrimer ? bonusPrimer : 0;
        punts += (pr.punts || 0) + bonus;
        temps += tempsResolucio + penalitzacio;
        return {
          codi: pr.codi,
          estat: esPrimer ? "primer" : "verd",
          intents: p.intents,
          tempsResolucio,
          penalitzacio,
          bonus,
        };
      }
      return { codi: pr.codi, estat: "vermell", intents: p.intents };
    });
    return { equip: eqUsuari, punts, temps, celles };
  });

  files.sort((a, b) => (b.punts !== a.punts ? b.punts - a.punts : a.temps - b.temps));
  return files;
}

module.exports = { aplicaEntregaConcurs, calculaMarcador, MINUTS_PENALITZACIO_PER_INTENT_FALLIT };
