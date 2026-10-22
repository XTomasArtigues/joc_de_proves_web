// Hash de contrasenyes de l'alumnat (sense dependències externes: només el
// mòdul natiu `crypto` de Node, amb scrypt + sal aleatòria per compte).
// Mai es desa cap contrasenya en clar, ni tan sols per a la professora.
const crypto = require("crypto");

function generaHash(contrasenya) {
  const sal = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(contrasenya, sal, 64).toString("hex");
  return { sal, hash };
}

function comprovaContrasenya(contrasenya, sal, hashDesat) {
  const hashCalculat = crypto.scryptSync(contrasenya, sal, 64).toString("hex");
  const a = Buffer.from(hashCalculat, "hex");
  const b = Buffer.from(hashDesat, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { generaHash, comprovaContrasenya };
