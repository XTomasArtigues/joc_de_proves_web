// Fórmula de qualificació del Joc de Proves (fixada per la professora).
//
// Només s'aplica a les EVIDÈNCIES (elements avaluables). Els REPTES de
// classe (pràctica) no tenen cap fórmula: només es compten els intents.
//
// Regles per a evidències (2026-10-22, ampliades el mateix dia):
// - Superat al 1r intent = 10. Cada intent fallit abans de superar-ho resta
//   2 punts (2n=8, 3r=6, 4t=4, 5è=2 — mínim de 2 des del 5è intent, encara
//   que se superi més tard).
// - +1 de bonus (fins a 10 com a màxim) per ser el/la primer/a de la classe
//   a superar-ho.
// - Màxim 6 intents en total. Si un alumne esgota els 6 intents sense
//   superar-ho mai: la nota queda en 2 just després del 5è intent fallit, i
//   baixa a 1 (nota final) després del 6è intent fallit — a partir d'aquí
//   l'aplicació ja no li deixa tornar a entregar ("bloquejat").
const MAX_INTENTS_EVIDENCIA = 6;

function notaBase(intentSuperat) {
  return Math.max(2, 10 - 2 * (intentSuperat - 1));
}

// `usuari` és l'identificador únic (el nom d'usuari amb què s'ha autenticat
// l'alumne/a) i és la clau de `estat.alumnes`. `nom` és el nom que es
// mostra (el que la professora li hagi posat en crear el compte, o el
// mateix usuari si no se n'ha indicat cap) — es manté sempre actualitzat
// per si la professora el canvia més endavant.
function aplicaEntregaEvidencia({ estat, usuari, nom, totesOk }) {
  estat.alumnes = estat.alumnes || {};
  const alumne = estat.alumnes[usuari] || {
    nom: nom || usuari,
    intents: 0,
    superat: false,
    intentSuperat: null,
    nota: null,
    primer: false,
    bloquejat: false,
  };
  alumne.nom = nom || alumne.nom || usuari;

  alumne.intents += 1;
  let primerCop = false;

  if (totesOk) {
    alumne.superat = true;
    alumne.intentSuperat = alumne.intents;
    alumne.nota = notaBase(alumne.intentSuperat);
    alumne.bloquejat = false;
    if (!estat.primerSuperat) {
      estat.primerSuperat = alumne.nom;
      alumne.primer = true;
      alumne.nota = Math.min(10, alumne.nota + 1);
      primerCop = true;
    }
  } else if (alumne.intents >= MAX_INTENTS_EVIDENCIA) {
    // 6è intent fallit: nota final, es bloqueja (no pot tornar a entregar).
    alumne.nota = 1;
    alumne.bloquejat = true;
  } else if (alumne.intents >= MAX_INTENTS_EVIDENCIA - 1) {
    // 5è intent fallit: nota provisional de 2 (encara li queda un intent).
    alumne.nota = 2;
  }

  estat.alumnes[usuari] = alumne;
  return { alumne, primerCop };
}

// Reptes de classe: només pràctica, sense nota ni límit d'intents. Es
// guarda igualment amb quin intent es va superar per primer cop (per
// mostrar-ho a l'alumnat i a la professora), però es pot seguir entregant
// després de superar-ho, per si es vol repetir.
function aplicaEntregaRepte({ estat, usuari, nom, totesOk }) {
  estat.alumnes = estat.alumnes || {};
  const alumne = estat.alumnes[usuari] || { nom: nom || usuari, intents: 0, superat: false, intentSuperat: null };
  alumne.nom = nom || alumne.nom || usuari;
  alumne.intents += 1;
  if (totesOk && !alumne.superat) {
    alumne.superat = true;
    alumne.intentSuperat = alumne.intents;
  }
  estat.alumnes[usuari] = alumne;
  return { alumne };
}

module.exports = { notaBase, aplicaEntregaEvidencia, aplicaEntregaRepte, MAX_INTENTS_EVIDENCIA };
