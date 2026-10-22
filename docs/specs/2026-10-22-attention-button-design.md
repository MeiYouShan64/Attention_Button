# Attention button – návrh (spec)

Datum: 2026-10-22 · Stav: ke schválení

## 1. Cíl

Telefon **A** (odesílatel) má velké tlačítko **„Attention button“**. Po jeho stisku
se na telefonu **B** (příjemce) objeví předem nastavená textová zpráva – jako
„nouzová textová zpráva“, kterou nejde přehlédnout. Telefony patří různým lidem
(rodina, kamarád) a mohou být kdekoliv s připojením k internetu.

**Hotovo znamená:**

1. A podrží Attention button → do pár sekund B dostane zprávu, **i když je B zamčený**
   a nemá otevřený prohlížeč (přes aplikaci ntfy).
2. Klepnutím na notifikaci (nebo při otevřené stránce okamžitě) B uvidí zprávu
   **přes celou obrazovku** s tlačítkem **ROZUMÍM**.
3. Po ROZUMÍM se na A zobrazí „Příjemce potvrdil HH:MM“.
4. Text zprávy si A nastaví libovolně a zůstane uložený.
5. Funguje na Androidu i iPhonu (A i B).

## 2. Rozhodnutí z brainstormingu

| Otázka | Rozhodnutí |
|---|---|
| Platforma | Webová aplikace (Android + iPhone), žádná instalace z obchodu pro A |
| Přenos zpráv | Veřejná bezplatná služba **ntfy.sh** (žádný vlastní server) |
| Zamčený telefon B | **Aplikace ntfy na B je povinná.** Karta prohlížeče na pozadí / zamčeném telefonu je mobilními OS uspávána, web se nemůže zobrazit přes zamčenou obrazovku. |
| Hlavní tlačítko | Text „Attention button“, odeslání po **podržení 1 s** (ochrana proti omylu) |
| Potvrzení | B potvrdí „ROZUMÍM“ → A vidí potvrzení |

## 3. Mimo rozsah (YAGNI)

- Vlastní server, účty, přihlašování.
- Více odesílatelů/příjemců se zvláštní správou (technicky funguje: kdo má kód, je v kanálu).
- End-to-end šifrování zpráv.
- Udržování rozsvíceného displeje (Wake Lock) – zamčený stav řeší aplikace ntfy.
- Service worker / offline režim.
- Historie zpráv.

## 4. Uživatelské rozhraní

Jedna stránka `index.html`, obrazovky se přepínají podle role uložené v telefonu.

### 4.1 Volba role (první spuštění)

- Nadpis „Attention button“, dvě velká tlačítka:
  **„Tento telefon ODESÍLÁ (A)“** a **„Tento telefon PŘIJÍMÁ (B)“**.
- Pokud stránka přišla s odkazem `#k=<kód>&r=b`, volba se přeskočí:
  telefon se rovnou nastaví jako příjemce s daným kódem. Je-li telefon už
  nastavený jako odesílatel, nejdřív se zeptá („Tento telefon je nastavený jako
  ODESÍLATEL (A). Přepnout ho na příjemce (B)?“) – aby si A klepnutím na vlastní
  odkaz omylem nezrušil Attention button.
- Příjemce bez odkazu zadá kód ručně (pole + „Uložit“).

### 4.2 Odesílatel (A)

- Velké kulaté červené tlačítko **„Attention button“**. Podržení 1 s – kolem tlačítka
  se plní kroužek; puštění dřív = nic se neodešle (text „Držte 1 sekundu“).
- Pole **„Text zprávy“** (víceřádkové, max. 500 znaků), ukládá se při psaní.
  Výchozí: „Potřebuji pomoc, zavolej mi!“. Prázdný text nelze odeslat.
- Stavový řádek:
  - „Odesílám…“ → „Odesláno 14:32“ → „Příjemce potvrdil 14:33“;
  - chyba: „Nepodařilo se odeslat – zkontrolujte internet.“ + tlačítko „Zkusit znovu“.
- Sekce **„Spárovat příjemce“**: kód kanálu, tlačítko **„Poslat odkaz příjemci“**
  (Web Share API; bez něj zkopíruje odkaz do schránky), tlačítko „Nový kód“
  (s potvrzením – starý příjemce přestane dostávat zprávy).
- Odkaz „Změnit roli“ (vrátí na volbu role).

### 4.3 Příjemce (B)

- Stav spojení: „● Připojeno – čekám na zprávy“ / „Připojuji znovu…“.
- Tlačítko **„Povolit zvuk na této stránce“** (prohlížeče pustí zvuk až po klepnutí);
  po klepnutí zmizí.
- **Návod pro zamčený telefon** (vždy viditelný, sbalitelný):
  1. Nainstalujte aplikaci **ntfy** (odkazy Google Play / App Store).
  2. V ntfy klepněte **+** → **Subscribe to topic** → vložte kód (tlačítko „Kopírovat kód“).
     Server ponechte ntfy.sh.
  3. Android: zapněte **Instant delivery in doze mode**, v nastavení aplikace
     **Keep alerting for highest priority**; povolte notifikacím ntfy přebít
     režim Nerušit (Do Not Disturb override).
  4. iPhone: povolte notifikace pro ntfy. (iOS neumí opakované zvonění;
     ztlumený telefon nezazvoní.)
  5. Tlačítko **„Vyzkoušet“** – pošle zkušební zprávu jen sám sobě (text
     „Zkušební zpráva – vše funguje“), aby si B ověřil notifikaci.
- Odkaz „Změnit roli“.

### 4.4 Alarm přes celou obrazovku (B)

- Překryv přes celé okno (`position: fixed; inset: 0`), pulzující červená/tmavě
  červená, text zprávy obřím písmem (automaticky zmenšený podle délky),
  pod ním „Přijato 14:32“.
- Siréna (WebAudio, střídání dvou tónů) a vibrace (Android) – jen pokud to
  prohlížeč dovolí; když ne, nic se neděje (notifikace ntfy už zazvonila).
- Tlačítko **ROZUMÍM** přes celou šířku dole → zastaví zvuk, skryje překryv,
  pošle potvrzení.
- Přijde-li další zpráva během zobrazení, text se nahradí nejnovější.

## 5. Architektura

Čistě statické soubory, žádný build, žádné závislosti v prohlížeči.

```
attention-button/
  index.html              obrazovky (role, odesílatel, příjemce, alarm)
  css/style.css
  js/channel.js           čistá logika (bez DOM) – testovatelná v Node
  js/ntfy.js              publish() + subscribe() nad ntfy HTTP API
  js/alarm.js             siréna (WebAudio) + vibrace
  js/app.js               UI, stav, localStorage
  manifest.webmanifest    „Přidat na plochu“ (display: standalone)
  icon.svg
  README.md               česky: nasazení + návod pro příjemce + omezení
  test/unit/*.test.js     node:test
  test/e2e/*.spec.js      Playwright (předinstalované Chromium)
  test/mock-ntfy.js       lokální napodobenina ntfy pro testy
  package.json            jen dev skripty/závislosti pro testy
```

Moduly jsou ES moduly (`<script type="module">`).

### 5.1 `js/channel.js` (čisté funkce)

- `generateCode(randomBytes)` → `"att-" + 16 znaků base32 (a–z, 2–7)` (80 bitů).
- `isValidCode(s)` → `/^att-[a-z2-7]{16}$/`.
- `ackTopic(code)` → `code + "-ok"`.
- `buildReceiverLink(pageUrl, code)` → `<pageUrl bez hash>#k=<code>&r=b`.
- `parseHash(hash)` → `{code, role}` nebo `null` (neplatný kód = `null`).
- `buildAlert({code, text, pageUrl, server})` → JSON pro ntfy (viz 6.1).
- `buildAck(code)` → JSON pro ntfy (viz 6.2).
- `pickAlertToShow(messages, ackedTime)` → nejnovější zpráva s `time > ackedTime`,
  která nemá tag `test` (nebo `null`).

### 5.2 `js/ntfy.js`

- `publish(server, payload)` → `fetch(server + "/", {method: "POST", body: JSON})`;
  vrací rozparsovaný JSON odpovědi (`{id, time, …}`), při ne-2xx / síťové chybě vyhodí.
- `subscribe(server, topic, {since, onMessage, onStatus})` →
  `EventSource(server/topic/sse?since=…)`; volá `onMessage(msg)` jen pro
  `event === "message"`, `onStatus("open" | "reconnecting")`; vrací `close()`.
  Duplicitní `id` (po obnovení spojení) se ignorují.

### 5.3 `js/alarm.js`

- `unlockAudio()` – vytvoří/obnoví `AudioContext` (volat z klepnutí).
- `startAlarm()` / `stopAlarm()` – siréna + `navigator.vibrate([…])` ve smyčce;
  všechny chyby tiše ignoruje.

### 5.4 `js/app.js`

- Čte/píše localStorage (klíče níže), přepíná obrazovky, obsluhuje tlačítka,
  zapíná odběry. Text zpráv vkládá vždy přes `textContent`.
- Adresa ntfy serveru: výchozí `https://ntfy.sh`, přepsatelná parametrem
  `?server=<url>` (testy, vlastní ntfy server).

**localStorage (prefix `att.`):**

| Klíč | Kdo | Obsah |
|---|---|---|
| `att.role` | oba | `"sender"` / `"receiver"` |
| `att.code` | oba | kód kanálu |
| `att.message` | A | text zprávy |
| `att.lastSentTime` | A | unix čas posledního odeslání (od něj se čeká na potvrzení) |
| `att.activatedAt` | B | unix čas nastavení role příjemce – mění se **jen při změně kódu nebo role**, ne při každém otevření odkazu (jinak by klepnutí na notifikaci přeskočilo právě ten poplach) |
| `att.ackedTime` | B | unix čas nejnovější potvrzené zprávy |

## 6. Tok zpráv (ntfy)

Dva kanály (topics): **`<kód>`** pro poplach (odebírá ho aplikace ntfy na B
i stránka B) a **`<kód>-ok`** pro potvrzení (odebírá stránka A) – oddělené, aby
potvrzení nezvonilo na B.

### 6.1 Poplach (A → B)

`POST https://ntfy.sh/` s JSON:

```json
{
  "topic": "<kód>",
  "title": "⚠️ ATTENTION",
  "message": "<text zprávy>",
  "priority": 5,
  "tags": ["rotating_light"],
  "click": "<URL stránky>#k=<kód>&r=b&t=<čas odeslání>",
  "actions": [
    { "action": "view", "label": "Otevřít", "url": "<URL stránky>#k=<kód>&r=b&t=<čas odeslání>" },
    { "action": "http", "label": "Rozumím", "url": "https://ntfy.sh/<kód>-ok",
      "method": "POST", "body": "Rozumím", "clear": true }
  ]
}
```

`t` = unix čas odeslání podle hodin A. Prohlížeč B, který spárování ztratil
(iOS maže úložiště nenavštěvovaných webů) nebo ho nikdy neměl, si podle něj
`activatedAt` sníží na `t`, takže poplach, kvůli kterému se otevřel, nepřeskočí.

Po úspěšné odpovědi A uloží `att.lastSentTime = response.time` a ukáže „Odesláno“.
Během odesílání a po neúspěchu A potvrzení **neodebírá** a neúspěch si pamatuje
(`att.sendFailed`) – i po návratu na stránku nebo reloadu ukazuje chybu
a „Zkusit znovu“, nikdy starší „Příjemce potvrdil“.

### 6.2 Potvrzení (B → A)

Ze stránky: `POST https://ntfy.sh/` s `{"topic": "<kód>-ok", "message": "Rozumím"}`.
Z notifikace ntfy: akce „Rozumím“ (viz výše) – kde ji aplikace ntfy podporuje.

A odebírá `<kód>-ok` se `since = att.lastSentTime` (jen pokud už něco odeslal;
po každém novém odeslání se odběr otevře znovu a stav potvrzení se vynuluje);
první zpráva s `time >= lastSentTime` → „Příjemce potvrdil HH:MM“. (Potvrzení se nepáruje podle ID,
protože akce v notifikaci ID poplachu nezná; A drží 1 s, takže dva poplachy se
nepřekryjí.)

### 6.3 Příjem na stránce B

- Odběr `<kód>` se `since = max(att.ackedTime, att.activatedAt − 60)` (unix čas;
  ntfy.sh drží zprávy cca 12 h). Rezerva 60 s pokrývá rozdíl hodin telefonu
  a serveru (`activatedAt` je čas telefonu, `ackedTime` čas serveru).
- B čte i kanál `<kód>-ok` (potvrzení může přijít i z tlačítka v notifikaci):
  nejdřív jednorázově stáhne (`/json?poll=1`) potvrzení od `since`, pak odebírá
  oba kanály jedním spojením (`/<kód>,<kód>-ok/sse`). Potvrzení v čase T
  nastaví `ackedTime = max(ackedTime, T)` a zavře zobrazený alarm s `time <= T`.
- Každá přijatá zpráva s `time > att.ackedTime` → zobrazit alarm (nejnovější).
- ROZUMÍM → `att.ackedTime = time zobrazené zprávy`, odeslat potvrzení.
- Při návratu na stránku (`visibilitychange` → visible) se odběr znovu otevře,
  aby se dohnaly zprávy z doby uspání.
- Zkušební zpráva z tlačítka „Vyzkoušet“ jde do kanálu `<kód>` s
  `title: "Test"`, priority 3 a tagem `test` – stránka B ji jako alarm nezobrazí
  (filtr `tags` obsahuje `test`).

## 7. Chyby a okrajové stavy

| Situace | Chování |
|---|---|
| Odeslání selže (offline, 4xx/5xx, limit ntfy) | Červená hláška + „Zkusit znovu“; „Odesláno“ jen po úspěchu |
| Server neodpovídá (slabý signál) | Po 10 s se požadavek ukončí → stejná chyba a „Zkusit znovu“ |
| Potvrzení z B se neodešle | Alarm se i tak zavře, na B hláška „Potvrzení se nepodařilo odeslat – zkontrolujte internet.“ |
| Spojení B spadne | „Připojuji znovu…“, EventSource se obnovuje sám; duplicity ignorovány |
| Neplatný kód v odkazu / ručně | Hláška „Neplatný kód“, role se nenastaví |
| Prohlížeč blokuje zvuk/vibrace | Tichý alarm, bez chyby; zvuk se odemyká na `pointerup`/`click`/`keydown` (dotykový `pointerdown` prohlížeče za aktivaci uživatele nepovažují) |
| Prázdný text | Attention button neaktivní, hláška „Napište text zprávy“ |
| Text > 500 znaků | Pole nedovolí víc (`maxlength`) |
| Limit ntfy.sh (250 zpráv/den) | Spadá pod „odeslání selže“ |

## 8. Bezpečnost a soukromí

- Kód kanálu = jediné tajemství (80 bitů náhody, nelze uhodnout). Kdo ho zná, může
  zprávy číst i posílat → nesdílet veřejně.
- Kód je v části URL za `#`, která se neposílá na server hostující stránku.
- Zprávy jdou přes ntfy.sh **nešifrovaně** – provozovatel je technicky vidí. Uvedeno v README.
- Veškerý text z ntfy se vykresluje jako prostý text (`textContent`), nikdy jako HTML.

## 9. Testování

- **Jednotkové testy** (`node --test`) pro `channel.js`: formát/validita kódu,
  odkaz tam a zpět, tvar JSON poplachu a potvrzení, `pickAlertToShow`.
- **E2E** (Playwright, Chromium z `/opt/pw-browsers`) proti `test/mock-ntfy.js`
  (lokální HTTP server: `POST /` uloží a rozešle zprávu, `GET /<topic>/sse?since=`
  vrací uložené + živé zprávy, CORS `*`). Stránka se spustí s `?server=<mock>`.
  Scénáře:
  1. Spárování: A vytvoří kód → odkaz → B otevře odkaz → B je příjemce se stejným kódem.
  2. Poplach: A změní text, podrží tlačítko 1 s → B ukáže přes celou obrazovku přesně ten text.
  3. Krátký stisk (< 1 s) nic neodešle.
  4. Potvrzení: B klepne ROZUMÍM → alarm zmizí → A ukáže „Příjemce potvrdil“.
  5. Zmeškaná zpráva: poplach odeslán, když B nemá stránku otevřenou → po otevření se alarm ukáže; po potvrzení a znovunačtení se už neukáže.
  6. Chyba odeslání: mock vrátí 500 → A ukáže chybu a „Zkusit znovu“.
- **Ruční test na skutečných telefonech** (dělá uživatel – prostředí vývoje se na
  ntfy.sh nedostane): postup v README. Ověří i předpoklady níže.

## 10. Nasazení

Stránka musí běžet přes **HTTPS** (statický hosting zdarma: GitHub Pages nebo
Netlify Drop). README obsahuje oba postupy krok za krokem.

## 11. Předpoklady k ověření ručním testem

- ntfy.sh povoluje CORS z libovolné domény (výchozí `Access-Control-Allow-Origin: *`).
- Akce „Rozumím“ (`http`) v notifikaci funguje v aplikaci ntfy na Androidu;
  na iPhonu nemusí být podporovaná – potvrzení pak jde přes stránku.
