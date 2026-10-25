# Joc de Proves — PTD I (aplicació web estil Programame)

Aplicació web perquè l'alumnat entregui els seus scripts i es corregeixin
automàticament contra un joc de proves, com en un concurs de programació.
Inclou un panell d'administració perquè la professora pugui crear
evidències i reptes, carregar-hi els seus jocs de proves i veure l'estat de
la classe — sense tocar cap fitxer a mà.

L'aplicació té **dues seccions**:
- **📋 Evidències**: avaluables, amb nota segons l'intent en què se
  superen i un màxim de 6 intents (vegeu "Com funciona la nota").
- **🎯 Reptes de classe**: només per practicar, sense cap nota — només es
  mostren els intents que ha necessitat cada alumne/a — i amb intents
  il·limitats.

**No té cap dependència externa**: només necessites tenir **Node.js**
instal·lat. No cal `npm install`.

## Com posar-la en marxa

```
node server.js
```

Per defecte escolta al port 3000. La primera vegada que s'executa, et dirà
per pantalla la contrasenya d'administració actual:

```
Joc de Proves escoltant a http://localhost:3000
Contrasenya d'administració actual: ptd1-2026
```

**Canvia aquesta contrasenya** des del panell d'administració abans d'usar
l'eina amb l'alumnat de debò (botó "Canviar contrasenya" al dashboard).

## Accés

- **Alumnat**: obre `http://localhost:3000/` (o la IP del teu ordinador si
  altres ordinadors de l'aula hi han d'accedir per la xarxa local — vegeu
  "Ús a l'aula" més avall). **Cal iniciar sessió amb un usuari i una
  contrasenya** que els hagis donat tu des del panell d'administració
  (vegeu "Comptes de l'alumnat" més avall) — sense compte no es pot
  entregar res. Un cop dins, veuran la llista d'evidències i reptes, podran
  llegir l'enunciat, escriure el seu script i entregar-lo, i podran canviar
  la seva pròpia contrasenya quan vulguin (botó "Canvia la contrasenya").
- **Professora (administració)**: `http://localhost:3000/admin.html`
  (contrasenya separada de la de l'alumnat). Des d'aquí pots:
  - Crear un element nou, triant si és una **evidència avaluable** o un
    **repte de classe** (codi, títol i enunciat).
  - Afegir-hi proves (el joc de proves pròpiament dit): cada prova té un
    nom, una entrada opcional (per si el script fa servir `promptSync` /
    `readline`) i una o més sortides acceptades que ha d'aparèixer.
  - Veure, per a cada element, l'estat de tots els lliuraments: intents, si
    l'ha superat, a quin intent, i (només a les evidències) la nota.
  - Esborrar l'historial d'un element per tornar a començar.
  - Crear i gestionar els **comptes de l'alumnat** (botó "👤 Alumnat").
  - Canviar la contrasenya d'administració.

## Comptes de l'alumnat (usuari i contrasenya)

Des del panell d'administració → **"👤 Alumnat"** pots:
- **Crear un compte individual**: usuari, contrasenya inicial (mínim 4
  caràcters) i, si vols, el nom complet (es farà servir als rànquings i a
  l'estat dels lliuraments; si no en poses cap, es mostrarà l'usuari).
- **Crear-ne molts a la vegada**: enganxa una llista, una línia per
  alumne/a, amb el format `usuari,contrasenya,Nom Complet` (el nom és
  opcional; pots separar els camps amb coma, punt i coma o tabulador, així
  que també serveix si ho copies d'un full de càlcul).
- **Reiniciar la contrasenya** d'un alumne/a concret (per exemple, si l'ha
  oblidat) — li tornes a donar tu una contrasenya nova i, a partir d'aquí,
  l'aplicació li recorda que encara té "la contrasenya inicial" fins que la
  canviï ell/a mateix/a.
- **Eliminar un compte** — es conserva l'historial de notes que ja tingués
  a cada evidència (queda guardat amb el seu nom), però ja no podrà tornar
  a entrar.

**Com li dónes l'usuari i la contrasenya a cada alumne/a?** Tu els tries
(per exemple, el seu usuari habitual del centre, o `nom.cognom`) i els els
comuniques fora de l'aplicació — en paper, de paraula a classe, etc. Un cop
hagin entrat per primer cop, l'aplicació els recomana canviar-la (hi ha un
avís a la pantalla fins que ho facin), i a partir d'aquí la contrasenya és
només seva: ni tu ni ningú més la pot veure (vegeu "Seguretat").

Recorda fer servir la **"⬇️ Còpia de seguretat"** (vegeu més avall)
després de crear l'alumnat — ara també inclou els comptes, no només les
evidències.

## Ús a l'aula (que hi accedeixi tot l'alumnat)

Si vols que l'alumnat hi accedeixi des dels seus propis ordinadors a la
mateixa xarxa (per exemple, la wifi del centre — una wifi és igualment una
xarxa local, no cal cable), arrenca el servidor des del teu ordinador i
dona'ls la teva adreça IP a la xarxa local en lloc de `localhost`, per
exemple `http://192.168.1.23:3000`. Pots trobar la teva IP local amb
`ipconfig` (Windows) o `ifconfig` / `ip addr` (Mac/Linux). El servidor ha
d'estar engegat durant tota la sessió de classe.

**Com saber si funcionarà abans de confiar-hi a classe**: amb el servidor
engegat al teu ordinador i connectat a la wifi del centre, demana a un
alumne que connecti el seu dispositiu a la mateixa wifi i obri
`http://<la-teva-IP>:3000` al navegador. Si hi arriba, ja ho tens. Si li
surt un error de connexió (tot i estar a la mateixa xarxa), és molt
probable que la wifi tingui activat l'**"aïllament de clients" (AP/client
isolation)** — una mesura de seguretat habitual en xarxes de centres
educatius que impedeix que els dispositius connectats es vegin entre ells.
En aquest cas, passa al "Pla B" següent.

### Pla B — si la wifi del centre té aïllament de clients

**Opció ràpida, sense dependre de ningú: comparteix la connexió des del
teu mòbil.** Activa el "Punt d'accés Wi-Fi" / "Compartir connexió" al teu
telèfon, connecta-hi el teu ordinador (amb el servidor engegat) i els
ordinadors de l'alumnat. Com que el punt d'accés el controles tu, no hi ha
aïllament de clients i funcionarà igual que la xarxa local. L'inconvenient
és que depens de les dades mòbils del teu telèfon i de la seva bateria —
vàlid per a una sessió puntual, no per a un ús diari.

**Opció permanent: allotjar l'aplicació a internet (recomanat si ho faràs
servir sovint).** Així l'alumnat hi accedeix per una URL pública des
d'internet (que la wifi del centre normalment sí que permet, encara que
bloquegi les connexions entre dispositius), sense dependre del teu
ordinador ni de cap configuració de xarxa. Una opció gratuïta i senzilla és
[Render](https://render.com) (hi ha altres alternatives similars, com
Railway o Fly.io, si ja en coneixes alguna):

1. Crea un compte gratuït a render.com.
2. Puja el contingut d'aquesta carpeta a un repositori de GitHub (si no en
   tens, Render també explica com fer-ho des de la seva pròpia pàgina).
3. A Render, tria "New +" → "Web Service", connecta el repositori.
4. Configuració: *Build command*: `npm install` (no instal·la res, ja que
   l'app no té dependències, però Render no deixa aquest camp en blanc),
   *Start command*: `node server.js`.
5. Un cop desplegat, Render et dona una URL pública (per exemple
   `https://joc-de-proves-ptd1.onrender.com`) — aquesta és la que dones a
   l'alumnat, i `/admin.html` per a tu.

**Avís important sobre el pla gratuït**: el disc on es guarden els fitxers
de `data/` (evidències, intents, notes, comptes) **no és permanent** — es
pot esborrar quan el servei es reinicia (per exemple, després d'un període
d'inactivitat, o en cada nou desplegament). Si l'alumnat ha de poder entrar
des de casa en qualsevol moment sense perdre el que ja tenia fet, cal
activar un **disc persistent** (secció següent) — en cas contrari, fes
servir sempre la còpia de seguretat manual:
- Fes servir el botó **"⬇️ Còpia de seguretat"** del panell d'administració
  sovint, sobretot al final de cada sessió de classe — et descarrega un
  fitxer `.json` amb totes les evidències, jocs de proves, intents, notes
  i també els comptes de l'alumnat (les contrasenyes hi van xifrades, no
  en clar — vegeu "Seguretat").
- Si mai veus que les dades han desaparegut (per exemple, en tornar un
  altre dia), fes servir **"⬆️ Restaura còpia"** amb l'últim fitxer que et
  vas descarregar.

### Fer que les dades siguin permanents: disc persistent a Render (recomanat)

Perquè l'alumnat pugui treballar des de casa a qualsevol hora sense perdre
mai res (sense haver de fer còpies de seguretat manuals cada dia), cal
passar del pla gratuït de Render a un pla de pagament que admeti un
**"Disk" (disc persistent)** — al voltant de 7-8$/mes pel servei més bàsic,
més uns 0,25$/mes per 1 GB de disc (molt més que suficient per a les dades
d'aquesta app). Un cop fet, les dades sobreviuen tant als reinicis per
inactivitat com als nous desplegaments.

Passos a Render (es fan un sol cop):
1. Al teu servei, vés a **Settings** i canvia l'"Instance Type" del pla
   gratuït a un de pagament (el més bàsic ja serveix).
2. Encara a Settings, busca la secció **"Disks"** → "Add Disk". Posa-li un
   nom (per exemple `dades`), una mida (1 GB és de sobres) i, el camp
   important, el **"Mount Path"**: escriu-hi `/var/data`.
3. Vés a **Environment** (variables d'entorn) i afegeix-ne una de nova:
   clau `DATA_DIR`, valor `/var/data` (exactament el mateix camí que has
   posat al "Mount Path" del disc).
4. Guarda els canvis; Render tornarà a desplegar el servei automàticament.

**No cal tornar a introduir l'evidència d'exemple ni la contrasenya a mà**:
la primera vegada que l'aplicació arrenca amb el disc nou (buit), ella
mateixa hi copia l'evidència E011 i la contrasenya d'administració inicial
que porta el projecte. A partir d'aquí, tot el que es creï o es canviï des
del panell (noves evidències, comptes de l'alumnat, intents, contrasenyes)
es queda al disc i ja no es perd mai, encara que Render reinicïi o
redesplegui el servei.

Demana-m'ho si vols que t'ajudi amb algun d'aquests passos quan arribi el
moment, o si prefereixes una alternativa gratuïta (una base de dades
externa gratuïta en lloc del disc de pagament) — és possible, però requereix
reescriure la part de l'aplicació que desa les dades.

## Com funciona la nota a les evidències (regles donades per la professora, 2026-10-22)

Això només s'aplica a les **evidències** (📋). Els **reptes de classe** (🎯)
no tenen nota — vegeu la secció següent.

- Si superes el joc de proves al **1r intent**: nota = **10**.
- Cada intent que NO el supera resta **2 punts** a la nota final (2n intent
  superat = 8, 3r = 6, 4t = 4, 5è = 2).
- Si ets la **primera o el primer de la classe** a superar el joc de
  proves d'una evidència concreta, guanyes **+1 punt de bonus** (la nota
  mai supera el 10).
- **Màxim 6 intents en total.** Si un alumne no arriba a superar-lo mai:
  la nota queda en **2** just després del 5è intent fallit, i baixa a
  **1** (nota final) després del 6è intent fallit. A partir d'aquí
  l'aplicació ja no deixa tornar a entregar aquella evidència — queda
  bloquejada amb la nota 1.
- Un alumne que ja ha superat una evidència tampoc pot tornar a
  entregar-la (no cal, ja té la nota feta).

## Reptes de classe: només pràctica, sense nota

Els elements marcats com a **repte** (🎯) són per practicar: l'alumnat pot
entregar el seu script **tants cops com vulgui**, fins i tot després
d'haver-lo superat (per exemple, per seguir practicant). No hi ha cap
fórmula de nota ni límit d'intents — només es mostra, per a cada alumne/a,
quants intents ha fet i (si l'ha superat) a quin intent ho va aconseguir.
Útil per preparar-se abans d'una evidència avaluable, o simplement per
practicar sense pressió de nota.

## Com es comprova cada prova

Cada prova del joc consisteix en: executar l'script de l'alumnat (donant-li
l'«entrada» configurada, si n'hi ha, com si l'escrivís per teclat) i mirar
si la seva sortida (`console.log`) compleix la condició:

- **"Que la sortida contingui aquest text"** (mode per defecte): cerca el
  valor esperat dins de tota la sortida. Si el valor esperat és un número
  (per exemple `6.5`), es comprova com a valor sencer, no com a tros d'un
  número més llarg — és a dir, `6.5` NO es dona per bo si la sortida és
  `16.5` o `-6.5`.
- **"Que la sortida sigui exactament aquest text"**: tota la sortida
  (sense espais sobrants al principi/final) ha de coincidir exactament amb
  el valor esperat. Útil quan vols una comprovació molt estricta.

Si una evidència encara no té cap prova configurada, l'alumnat la veurà a
la llista però no podrà entregar-hi res fins que n'hi afegeixis almenys
una.

### Una prova amb més d'una sortida correcta

De vegades un mateix enunciat admet més d'un resultat vàlid, perquè la
manera de plantejar l'script hi influeix — per exemple, una condició com
`edat <= 16` pot donar `true` o `false` segons com l'alumnat hagi definit
la variable o la comparació, i totes dues poden ser correctes.

A "Sortida(es) esperada(es)", tant en afegir una prova nova com en editar-ne
una d'existent (botó "Edita"), pots prémer **"+ Afegeix una sortida
alternativa"** per indicar-ne més d'una. Amb que la sortida de l'script
coincideixi amb **qualsevol** de les que hagis posat (sempre amb el mateix
mode conté/exacta), la prova es considera superada. Pots afegir-ne i
treure'n ("✕") les que calguin.

## Estructura del projecte

```
server.js            — servidor HTTP i totes les rutes (API + fitxers estàtics)
lib/
  store.js            — llegeix/escriu les dades (evidencies.json, estat/*.json, alumnes.json, config.json)
  corrector.js         — executa l'script de l'alumnat i comprova les proves
  nota.js              — fórmula de qualificació (intents, bonus de primer/a)
  credencials.js        — hash de contrasenyes de l'alumnat (scrypt + sal, sense dependències)
public/
  index.html, app.js    — vista de l'alumnat (login, llista, entrega, canvi de contrasenya)
  admin.html, admin.js  — panell d'administració (evidències, reptes, alumnat)
  style.css             — estils compartits
data/
  evidencies.json      — totes les evidències i els seus jocs de proves (editable des de l'admin)
  alumnes.json          — comptes de l'alumnat: usuari, nom, i la contrasenya ja xifrada (mai en clar)
  config.json           — contrasenya d'administració i port
  estat/<CODI>.json     — intents, notes i rànquing de cada evidència (es crea sol)
  tmp/                  — fitxers temporals dels scripts mentre s'executen (es netegen sols)
```

**Fer-ne còpia de seguretat**: tot el que importa viu dins de `data/` —
val la pena copiar aquesta carpeta de tant en tant si la fas servir de
debò, perquè és l'única "base de dades" de l'eina.

## Seguretat — llegeix-ho abans d'usar-la amb més gent

- Els scripts de l'alumnat s'executen **directament amb Node.js**, amb un
  límit de 5 segons per evitar bucles infinits, però **sense cap altre
  aïllament** (no corren dins d'un contenidor ni d'un entorn restringit).
  Per a un ús de classe, amb l'alumnat conegut i sota supervisió, el risc
  és baix.
  - Si fas servir l'opció "en local al teu ordinador" o per xarxa
    local/wifi (secció anterior), **no exposis mai aquest servidor a
    internet obert** directament des de casa teva — fes-lo servir només
    dins la xarxa local de l'aula/centre.
  - Si optes pel "Pla B" d'allotjar-ho al núvol (Render o similar), els
    scripts ja no corren al teu ordinador sinó dins del contenidor aïllat
    d'aquell servei — això redueix el risc per a tu, però la URL pública
    sí que permet que qualsevol que la conegui hi enviï codi. No la
    publiquis enlloc obert (xarxes socials, pàgines web indexades): dona-
    la només a la teva classe, com si fos una contrasenya més.
- La contrasenya d'administració és l'únic que protegeix el panell; tria'n
  una que no sigui fàcil d'endevinar i no la comparteixis amb l'alumnat.
- **Les contrasenyes de l'alumnat es desen xifrades** (amb `scrypt` i una
  sal diferent per a cada compte — la mateixa tècnica que fan servir
  moltes aplicacions reals), mai en text clar: ni tu ni ningú amb accés al
  fitxer `data/alumnes.json` les pot llegir, només reiniciar-les per unes
  de noves. Les sessions de l'alumnat (igual que la teva d'administració)
  es guarden al navegador amb `sessionStorage`, que es tanca sol en
  tancar la pestanya — important perquè els ordinadors de l'aula solen ser
  compartits entre grups diferents durant el dia.
- El **rànquing de cada evidència/repte** (la taula amb noms i notes de
  tota la classe) només es pot veure si has iniciat sessió com a
  alumne/a — no és visible per a ningú que no tingui un compte, important
  perquè un cop l'aplicació estigui penjada a internet amb una URL pública
  no n'hi hagi prou amb l'enllaç per veure les notes de tothom.
- La comprovació de sortida és "lleugera": no analitza si el codi ha
  calculat el valor de debò o l'ha escrit directament; és un compromís
  raonable per a un instrument formatiu de baix risc com aquest.
- **Abans de penjar l'aplicació a un servidor extern (Render o similar)**,
  crea els comptes de tot l'alumnat des del panell i fes una còpia de
  seguretat: així, si mai cal recuperar les dades, els comptes també hi
  són (vegeu "Comptes de l'alumnat" i "Pla B" més amunt).

## Pendents (decisions que falten per concretar)

- Encara només hi ha el joc de proves d'**E011**, ja carregat per defecte.
  La resta d'evidències amb Tasca d'evidència (E012 en endavant) les pots
  anar afegint tu mateixa des del panell d'administració, o demanar-m'ho.
- Encara no hi ha cap compte d'alumnat creat per defecte: crea'ls des de
  "👤 Alumnat" abans de fer-la servir amb la classe.
