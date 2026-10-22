# Attention button – prováděcí plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cíl:** Statická webová aplikace: telefon A podrží „Attention button“ → telefon B dostane
nouzovou zprávu (notifikace ntfy na zamčeném telefonu + alarm přes celou obrazovku na stránce)
a může ji potvrdit.

**Architektura:** Čisté statické soubory (HTML/CSS/ES moduly, bez buildu). Přenos přes veřejné
HTTP API ntfy.sh: poplach do kanálu `<kód>`, potvrzení do `<kód>-ok`. Čistá logika v
`js/channel.js`, síť v `js/ntfy.js`, zvuk v `js/alarm.js`, UI v `js/app.js`.

**Tech stack:** Vanilla JS (ES moduly), Node 22 `node:test` (+ `--experimental-eventsource`),
`@playwright/test@1.56.1` (shoduje se s předinstalovaným Chromium v `/opt/pw-browsers`).

**Spec:** `docs/specs/2026-10-22-attention-button-design.md`

## Globální omezení

- Žádné závislosti v prohlížeči, žádný build; `package.json` jen pro testy (`"type": "module"`).
- Výchozí server `https://ntfy.sh`; přepsatelný `?server=<url>`.
- Kód kanálu: `att-` + 16 znaků z `[a-z2-7]` (80 bitů).
- Držení tlačítka: `HOLD_MS = 1000`.
- Text zprávy: `maxlength="500"`, výchozí „Potřebuji pomoc, zavolej mi!“.
- Poplach: `title "⚠️ ATTENTION"`, `priority 5`, `tags ["rotating_light"]`.
- localStorage klíče: `att.role`, `att.code`, `att.message`, `att.lastSentTime`, `att.activatedAt`, `att.ackedTime`.
- Text z ntfy vždy přes `textContent`.
- Publikace přes `fetch` **bez** hlavičky `Content-Type` (jednoduchý CORS požadavek bez preflightu).
- Veškeré texty UI česky, přesně podle spec (kap. 4 a 7) a tabulky ID níže.

## Review Focus

1. **Diakritika, emoji a HTML v textu zprávy** – B musí ukázat přesně „Příliš žluťoučký kůň 🚨 <b>x</b>“ jako text (test v Task 5).
2. **Dlouhá zpráva (500 znaků) na malém telefonu 360×640** – tlačítko ROZUMÍM musí být vidět bez posouvání (test v Task 4).
3. **Držení déle než 1 s (2,5 s)** – odejde přesně jedna zpráva (test v Task 5).
4. **Opětovné otevření odkazu z notifikace** – nesmí resetovat `activatedAt` a přeskočit čekající poplach (test v Task 4).
5. **Rozdíl hodin telefonu a serveru** – `receiverSince` odečítá 60 s rezervy (unit test v Task 1).

## DOM kontrakt (sdílí Task 3–5 a testy)

| Obrazovka | ID |
|---|---|
| sekce | `#screen-role`, `#screen-sender`, `#screen-receiver`, překryv `#alarm` (atribut `hidden`) |
| role | `#choose-sender`, `#choose-receiver`, `#manual-code` (input), `#manual-code-save`, `#role-error` |
| odesílatel | `#attention` (button, text „Attention button“), `#hold-hint`, `#message` (textarea), `#send-status`, `#retry`, `#code-sender`, `#receiver-link` (readonly input), `#share-link`, `#share-status`, `#new-code`, `#change-role-sender` |
| příjemce | `#conn-status`, `#enable-sound`, `#code-receiver`, `#copy-code`, `#send-test`, `#test-status`, `#ack-error`, `<details id="ntfy-guide">`, `#change-role-receiver` |
| alarm | `#alarm`, `#alarm-text`, `#alarm-time`, `#alarm-ack` |

Porty E2E: statické soubory `http://localhost:4173`, mock ntfy `http://localhost:4174`.
Stránka v testech: `http://localhost:4173/?server=http://localhost:4174`.

---

### Task 1: Kostra projektu + `js/channel.js`

**Files:**
- Create: `package.json`, `.gitignore` (`node_modules/`, `test-results/`, `playwright-report/`)
- Create: `js/channel.js`
- Test: `test/unit/channel.test.js`

**Interfaces – Produces (vše `export` z `js/channel.js`):**
- `generateCode(bytes = crypto.getRandomValues(new Uint8Array(10))): string`
- `isValidCode(code: string): boolean` – `/^att-[a-z2-7]{16}$/`
- `ackTopic(code): string` → `` `${code}-ok` ``
- `buildReceiverLink(pageUrl: string, code: string): string` – zahodí hash, zachová query, přidá `#k=<code>&r=b`
- `parseHash(hash: string): {code: string, role: "receiver"} | null` – jen pro `r=b` a platný kód
- `buildAlert({code, text, pageUrl, server}): object` – přesně JSON ze spec 6.1; `click` i `view` URL = `buildReceiverLink(pageUrl, code)`; `http` akce `url` = `` `${server}/${ackTopic(code)}` ``
- `buildAck(code): object` → `{topic: ackTopic(code), message: "Rozumím"}`
- `buildTest(code): object` → `{topic: code, title: "Test", message: "Zkušební zpráva – vše funguje", priority: 3, tags: ["test"]}`
- `isTestMessage(msg): boolean` – `tags` obsahuje `"test"`
- `pickAlertToShow(messages: object[], ackedTime: number): object | null` – nejnovější (`time`) ne-testová zpráva s `time > ackedTime`
- `receiverSince(ackedTime: number, activatedAt: number): number` → `Math.max(ackedTime, activatedAt - 60)`
- `formatTime(unixSeconds: number): string` → `"HH:MM"` (místní čas, 24h, dvoumístné)

- [ ] **Step 1: `package.json`**

```json
{
  "name": "attention-button",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --experimental-eventsource --test \"test/unit/*.test.js\"",
    "test:e2e": "playwright test"
  },
  "devDependencies": { "@playwright/test": "1.56.1" }
}
```

Run: `npm install` → Expected: bez chyb.

- [ ] **Step 2: Napsat padající testy `test/unit/channel.test.js`**

Testy (`node:test` + `node:assert/strict`):
- `generateCode` z `new Uint8Array(10)` (nuly) → `"att-aaaaaaaaaaaaaaaa"`; z `Uint8Array(10).fill(255)` → `"att-7777777777777777"`; bez argumentu dvakrát → různé a `isValidCode` true.
- `isValidCode`: true pro `"att-abcdefghijk23456"`; false pro `"att-ABC…"`, `"att-short"`, `""`, `"xyz-aaaaaaaaaaaaaaaa"`, `"att-aaaaaaaaaaaaaaa1"` (1 není v base32).
- `buildReceiverLink("https://x.cz/app/?server=http://l:4174#old", C)` → `"https://x.cz/app/?server=http://l:4174#k=" + C + "&r=b"`.
- `parseHash("#k=" + C + "&r=b")` → `{code: C, role: "receiver"}`; `parseHash("#k=bad&r=b")` → `null`; `parseHash("")` → `null`; `parseHash("#k=" + C)` → `null`.
- `buildAlert({code: C, text: "Pomoc", pageUrl: "https://x.cz/", server: "https://ntfy.sh"})` deepEqual celému JSON ze spec 6.1 (s `"https://x.cz/#k=" + C + "&r=b"` a `"https://ntfy.sh/" + C + "-ok"`).
- `buildAck(C)`, `buildTest(C)` deepEqual hodnotám z Interfaces.
- `pickAlertToShow`: `[{id:"a",time:100},{id:"b",time:200},{id:"t",time:300,tags:["test"]}]` s `ackedTime 0` → `id "b"`; s `ackedTime 200` → `null`; prázdné pole → `null`.
- **Review Focus 5:** `receiverSince(0, 1000)` → `940`; `receiverSince(5000, 1000)` → `5000`.
- `formatTime(new Date(2026, 0, 1, 7, 5).getTime() / 1000)` → `"07:05"`; `formatTime(new Date(2026, 0, 1, 23, 59).getTime() / 1000)` → `"23:59"`.

- [ ] **Step 3: Spustit** `npm test` → Expected: FAIL (modul neexistuje).

- [ ] **Step 4: Implementovat `js/channel.js`** – `generateCode`: base32 (RFC 4648, malá písmena) přes bitový buffer: 10 bajtů → přesně 16 znaků. Bez DOM, funguje v Node i v prohlížeči.

- [ ] **Step 5: Spustit** `npm test` → Expected: všechny PASS.

- [ ] **Step 6: Commit** `git add package.json package-lock.json .gitignore js/channel.js test/unit/channel.test.js && git commit -m "Add channel logic with unit tests"`

---

### Task 2: `js/ntfy.js` + mock ntfy server

**Files:**
- Create: `js/ntfy.js`, `test/mock-ntfy.js`, `test/serve.js`
- Test: `test/unit/ntfy.test.js`

**Interfaces:**
- Produces `js/ntfy.js`:
  - `publish(server: string, payload: object): Promise<object>` – `POST ${server}/`, body `JSON.stringify(payload)`, bez `Content-Type`; ne-2xx → `throw new Error("HTTP " + status)`; vrací JSON odpovědi.
  - `subscribe(server, topic, {since, onMessage, onStatus}): {close(): void}` – `new EventSource(`${server}/${topic}/sse?since=${since}`)`; `onopen` → `onStatus("open")`; `onerror` → `onStatus("reconnecting")`, a když `readyState === EventSource.CLOSED`, po 5000 ms nové spojení se `since` = poslední přijaté `id` (jinak původní `since`); `message` → `JSON.parse`, volá `onMessage` jen pro `event === "message"` a jen jednou na `id` (Set přes všechna znovupřipojení).
- Produces `test/mock-ntfy.js`:
  - `startMockNtfy({port = 0} = {}): Promise<{url: string, close(): Promise<void>}>`
  - Spuštění `node test/mock-ntfy.js 4174` poslouchá na portu z argumentu.
  - Chování: CORS `Access-Control-Allow-Origin: *` na všem + `OPTIONS` → 204 (povolit `POST, GET`, hlavičky `*`); `POST /` JSON → zpráva `{id (10 náhodných znaků), time: floor(now/1000), event:"message", topic, message, title, tags, priority, click, actions}` (nedefinovaná pole vynechat), uloží, rozešle SSE klientům topicu, odpoví 200 s JSON; chybí `topic` → 400. `POST /<topic>` s textovým tělem → zpráva s `message` = tělo. `GET /<topic>/sse?since=` → `text/event-stream`, nejdřív `event: open\ndata: {...}\n\n`, pak uložené zprávy podle `since` (`all`; číslo = `time >= since`; jiné = id → zprávy po něm; chybí → žádné), pak živé, každá jako `data: <json>\n\n`. `GET /<topic>/json?poll=1&since=all` → uložené zprávy jako NDJSON.
- Produces `test/serve.js`: `node test/serve.js` spustí statický server kořene projektu na 4173 (MIME pro `.html .js .css .svg .webmanifest`, `/` → `index.html`) a `startMockNtfy({port: 4174})`.

- [ ] **Step 1: Napsat padající testy `test/unit/ntfy.test.js`** (mock spuštěný v `before`, zavřený v `after`)
  - `publish vrací id a time`: `publish(url, {topic: "t1", message: "ahoj"})` → `typeof res.id === "string"`, `res.message === "ahoj"`.
  - `publish vyhodí při 400`: `publish(url, {message: "bez topicu"})` rejects s `/HTTP 400/`.
  - `subscribe dostane živou zprávu`: subscribe `t2` se `since` = aktuální unix čas, po `onStatus("open")` publish → `onMessage` dostane `message === "živě"` (UTF-8 zachováno).
  - `subscribe dostane uloženou zprávu přes since=all` a ignoruje cizí topic.
  - `subscribe nedoručí stejné id dvakrát`: uložená zpráva v `t4`, subscribe se `since=all`, po prvním doručení mock zavře spojení (`dropConnections()` – testovací hák v návratovém objektu `startMockNtfy`); EventSource se sám připojí znovu a mock zprávu pošle znovu → po dalším `onStatus("open")` + 500 ms je `onMessage` zavolaný pro to id právě jednou.

- [ ] **Step 2: Spustit** `npm test` → Expected: FAIL.
- [ ] **Step 3: Implementovat `test/mock-ntfy.js`** (jen `node:http`, `node:crypto`), včetně `dropConnections()`.
- [ ] **Step 4: Implementovat `js/ntfy.js`.**
- [ ] **Step 5: Implementovat `test/serve.js`.** Ověření: `node test/serve.js &` → `curl -s localhost:4174/x/json?poll=1` vrátí prázdno a `curl -sI localhost:4173/js/channel.js` vrátí `200` a `text/javascript`; server ukončit.
- [ ] **Step 6: Spustit** `npm test` → Expected: všechny PASS.
- [ ] **Step 7: Commit** `git commit -m "Add ntfy client and mock ntfy server"`

---

### Task 3: Kostra stránky, volba role a spárování

**Files:**
- Create: `index.html`, `css/style.css`, `js/app.js`, `manifest.webmanifest`, `icon.svg`, `playwright.config.js`
- Test: `test/e2e/pairing.spec.js`, `test/e2e/helpers.js`

**Interfaces:**
- Consumes: celý `js/channel.js` (Task 1), `test/serve.js` (Task 2).
- Produces (`js/app.js`, interní, používají Task 4–5):
  - `server` = `new URLSearchParams(location.search).get("server") || "https://ntfy.sh"`
  - `store.get(key)`, `store.set(key, value)` – obal localStorage s try/catch (prefix `att.` uvnitř)
  - `showScreen(name: "role" | "sender" | "receiver")`
  - `becomeSender()` – role `sender`; pokud není platný `att.code`, vygeneruje nový
  - `becomeReceiver(code)` – **jen pokud se role nebo kód liší**: uloží roli, kód, `activatedAt = floor(now/1000)`, `ackedTime = 0`; jinak nic nemění (Review Focus 4)
  - `initSender()` / `initReceiver()` – háky, které Task 5 / Task 4 naplní (zde jen vykreslí kód / odkaz)
- Produces `test/e2e/helpers.js`: `APP = "http://localhost:4173/?server=http://localhost:4174"`, `NTFY = "http://localhost:4174"`, `newPhone(browser): Promise<Page>` (nový context, viewport 390×844), `pollTopic(request, topic): Promise<object[]>`, `publishToMock(request, payload)`.

Stránka: `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`, `<link rel="manifest">`, `theme-color #c62828`, `<script type="module" src="js/app.js">`. Při načtení: `parseHash(location.hash)` → `becomeReceiver(code)` a `history.replaceState` bez hashe; jinak podle `att.role` obrazovka, bez role `#screen-role`. „Změnit roli“ → `#screen-role` (data nemaže). `#choose-receiver` ukáže pole `#manual-code`; neplatný kód → `#role-error` „Neplatný kód“. `#new-code` → `confirm("Vytvořit nový kód? Současný příjemce přestane dostávat zprávy, dokud mu nepošlete nový odkaz.")` → nový kód, smazat `att.lastSentTime`. `#share-link` → `navigator.share({title: "Attention button", text: "Otevři tento odkaz – budeš přijímat moje nouzové zprávy:", url})`, bez něj `navigator.clipboard.writeText(url)` a `#share-status` „Odkaz zkopírován – pošlete ho příjemci.“ Manifest: `name "Attention button"`, `short_name "Attention"`, `start_url "./"`, `display "standalone"`, `background_color "#111111"`, `theme_color "#c62828"`, ikona `icon.svg` (`sizes "any"`). Styl: tmavé pozadí, mobilní rozložení, okraje 16 px, bez vodorovného posouvání.

`playwright.config.js`: `testDir: "test/e2e"`, `use.browserName: "chromium"`, `webServer: {command: "node test/serve.js", url: "http://localhost:4173/", reuseExistingServer: false}`, `workers: 1`.

- [ ] **Step 1: Napsat padající testy `test/e2e/pairing.spec.js`**
  - `první spuštění ukáže volbu role`: `#screen-role` viditelná, `#choose-sender` text „Tento telefon ODESÍLÁ (A)“, `#choose-receiver` text „Tento telefon PŘIJÍMÁ (B)“.
  - `spárování přes odkaz`: A klikne `#choose-sender` → `#code-sender` odpovídá `/^att-[a-z2-7]{16}$/`; B otevře hodnotu `#receiver-link` → `#screen-receiver` viditelná, `#code-receiver` === kód A, URL B neobsahuje `#k=`.
  - `role přežije reload`: po reloadu A i B stejné obrazovky a kódy.
  - `ruční kód`: B klikne `#choose-receiver`, vyplní `"att-bad"` → `#role-error` „Neplatný kód“; vyplní platný kód → `#screen-receiver`.
  - `nový kód po potvrzení`: A přijme dialog (`page.once("dialog", d => d.accept())`) → `#code-sender` jiný než předtím.
- [ ] **Step 2: Spustit** `npx playwright test test/e2e/pairing.spec.js` → Expected: FAIL.
- [ ] **Step 3: Implementovat** `index.html`, `css/style.css`, `js/app.js` (část role/spárování), `manifest.webmanifest`, `icon.svg` (červený kruh s vykřičníkem).
- [ ] **Step 4: Spustit** testy → Expected: PASS; `npm test` stále PASS.
- [ ] **Step 5: Commit** `git commit -m "Add page shell, role selection and pairing"`

---

### Task 4: Příjemce (B) a alarm přes celou obrazovku

**Files:**
- Create: `js/alarm.js`
- Modify: `js/app.js` (`initReceiver`), `index.html`, `css/style.css`
- Test: `test/e2e/receiver.spec.js`

**Interfaces:**
- Consumes: `subscribe`, `publish` (Task 2); `pickAlertToShow`, `isTestMessage`, `receiverSince`, `buildAck`, `buildTest`, `formatTime` (Task 1); `store`, `server` (Task 3).
- Produces `js/alarm.js`: `unlockAudio(): void`, `startAlarm(): void`, `stopAlarm(): void` – siréna: oscilátor střídá 960 Hz / 770 Hz po 500 ms, gain 0.8; vibrace `navigator.vibrate([600, 300])` každých 900 ms; všechny výjimky tiše ignorovat; bez `AudioContext` ve stavu `running` jen vibrace.

Chování `initReceiver()`:
- `subscribe(server, code, {since: receiverSince(ackedTime, activatedAt), …})`; `#conn-status` „● Připojeno – čekám na zprávy“ / „Připojuji znovu…“.
- Zpráva: pokud `pickAlertToShow([current, msg].filter(Boolean), ackedTime)` vrátí jinou zprávu než `current` → zobrazit `#alarm` (`#alarm-text` = `message` přes `textContent`, `#alarm-time` = „Přijato “ + `formatTime(time)`, třída `long` na `#alarm-text` pro > 120 znaků), `startAlarm()`.
- `#alarm-ack` „ROZUMÍM“ → `stopAlarm()`, skrýt, `ackedTime = current.time`, `current = null`, `publish(server, buildAck(code))`; chyba → `#ack-error` „Potvrzení se nepodařilo odeslat – zkontrolujte internet.“
- `document` `pointerdown` (capture) → `unlockAudio()`; pokud je alarm aktivní, `startAlarm()`. `#enable-sound` „Povolit zvuk na této stránce“ → `unlockAudio()` a skrýt tlačítko.
- `visibilitychange` → `visible`: zavřít a znovu otevřít odběr.
- `#copy-code` „Kopírovat kód“ → clipboard, na 2 s „Zkopírováno ✓“. `#send-test` „Vyzkoušet“ → `publish(buildTest(code))` → `#test-status` „Zkušební zpráva odeslána – měla by přijít notifikace ntfy.“ / chyba „Nepodařilo se odeslat – zkontrolujte internet.“
- `#ntfy-guide`: kroky 1–4 ze spec 4.3 doslova, odkazy `https://play.google.com/store/apps/details?id=io.heckel.ntfy` a `https://apps.apple.com/app/ntfy/id1625396347`.
- Styl alarmu: `position: fixed; inset: 0; z-index` nad vším; flex sloupec; text `flex: 1; overflow: auto`, `font-size: clamp(28px, 9vw, 72px)`, `.long` → `clamp(18px, 5.5vw, 36px)`; pulzující pozadí `#c62828`↔`#6d0000` (1 s); `#alarm-ack` dole přes celou šířku, min. výška 72 px.

- [ ] **Step 1: Napsat padající testy `test/e2e/receiver.spec.js`** (B spárovaný otevřením `APP + "#k=" + C + "&r=b"`, poplach posílá test přes `publishToMock(request, buildAlert(...))` – import z `../../js/channel.js`)
  - `poplach se ukáže přes celou obrazovku`: `#alarm` viditelný, `boundingBox` = celý viewport, `#alarm-text` === text, `#alarm-time` začíná „Přijato “.
  - `ROZUMÍM zavře alarm a pošle potvrzení`: klik `#alarm-ack` → `#alarm` skrytý; `pollTopic(request, C + "-ok")` obsahuje zprávu `message === "Rozumím"`.
  - `zmeškaná zpráva + Review Focus 4`: B spárován, stránka zavřena; poplach odeslán; B znovu otevře **stejný odkaz** `#k=C&r=b` → alarm viditelný. Po ROZUMÍM a `reload()` → alarm skrytý (počkat 1,5 s).
  - `testovací zpráva se nezobrazí`: `publishToMock(buildTest(C))` → po 1,5 s `#alarm` skrytý.
  - `stav spojení`: `#conn-status` obsahuje „Připojeno“.
  - **Review Focus 2:** viewport 360×640, zpráva 500× „A“ → `#alarm-ack` `toBeInViewport()`.
- [ ] **Step 2: Spustit** `npx playwright test test/e2e/receiver.spec.js` → Expected: FAIL.
- [ ] **Step 3: Implementovat `js/alarm.js`.**
- [ ] **Step 4: Implementovat `initReceiver()` a markup/styl alarmu.**
- [ ] **Step 5: Spustit** `npx playwright test` a `npm test` → Expected: vše PASS.
- [ ] **Step 6: Commit** `git commit -m "Add receiver screen and full-screen alarm"`

---

### Task 5: Odesílatel (A) – Attention button, odeslání, potvrzení

**Files:**
- Modify: `js/app.js` (`initSender`), `index.html`, `css/style.css`
- Test: `test/e2e/sender.spec.js`

**Interfaces:**
- Consumes: `publish`, `subscribe` (Task 2); `buildAlert`, `ackTopic`, `formatTime`, `buildReceiverLink` (Task 1); `store`, `server` (Task 3).

Chování `initSender()`:
- `#message` (`maxlength="500"`) předvyplněn `att.message` nebo „Potřebuji pomoc, zavolej mi!“; `input` → uložit; prázdný (`trim()`) → `#attention` `disabled` a `#send-status` „Napište text zprávy“.
- `#attention`: `pointerdown` (a `keydown` Space/Enter bez `repeat`) → třída `holding` (CSS animace kroužku 1 s) + `setTimeout(fire, HOLD_MS)`; `pointerup`/`pointerleave`/`pointercancel`/`keyup` před vypršením → zrušit, `#hold-hint` „Držte 1 sekundu“. `fire` proběhne **nejvýš jednou na jedno stisknutí** a ne během běžícího odesílání (Review Focus 3). `contextmenu` → `preventDefault`; CSS `user-select: none; -webkit-touch-callout: none; touch-action: none`.
- `send()`: `#send-status` „Odesílám…“ → `publish(server, buildAlert({code, text, pageUrl: location.href, server}))` → `att.lastSentTime = res.time`, „Odesláno “ + `formatTime(res.time)`, `navigator.vibrate?.(200)`, skrýt `#retry`, znovu otevřít odběr potvrzení. Chyba → „Nepodařilo se odeslat – zkontrolujte internet.“ + viditelné `#retry` „Zkusit znovu“ (klik → `send()` bez držení).
- Odběr potvrzení: jen pokud existuje `lastSentTime`: `subscribe(server, ackTopic(code), {since: lastSentTime})`; zpráva s `time >= lastSentTime` → `#send-status` „Příjemce potvrdil “ + `formatTime(time)`. Při načtení s `lastSentTime` ukázat „Odesláno HH:MM“ a odebírat. `visibilitychange` → znovu otevřít.

- [ ] **Step 1: Napsat padající testy `test/e2e/sender.spec.js`** (dva telefony přes `newPhone`; držení = `#attention.hover()`, `mouse.down()`, `waitForTimeout(ms)`, `mouse.up()`)
  - `celý tok A → B → potvrzení` + **Review Focus 1**: A nastaví text „Příliš žluťoučký kůň 🚨 <b>x</b>“, podrží 1200 ms → `#send-status` „Odesláno …“; B `#alarm-text` `toHaveText` přesně ten řetězec a `#alarm-text b` má počet 0; B klikne ROZUMÍM → A `#send-status` obsahuje „Příjemce potvrdil“.
  - `krátký stisk nic neodešle`: držení 300 ms → po 1,5 s `pollTopic(C)` prázdné, `#hold-hint` „Držte 1 sekundu“.
  - **Review Focus 3:** držení 2500 ms → `pollTopic(C)` má přesně 1 zprávu.
  - `text se pamatuje`: změna textu, reload → `#message` má nový text.
  - `prázdný text`: vymazat → `#attention` disabled, `#send-status` „Napište text zprávy“.
  - `chyba odeslání`: `page.route(NTFY + "/", r => r.request().method() === "POST" ? r.fulfill({status: 500}) : r.continue())` → držení → „Nepodařilo se odeslat – zkontrolujte internet.“, `#retry` viditelné; `unroute`, klik `#retry` → „Odesláno …“.
  - `poplach obsahuje ntfy pole`: po odeslání `pollTopic(C)[0]` má `priority 5`, `title "⚠️ ATTENTION"`, `click` končí `#k=${C}&r=b`.
- [ ] **Step 2: Spustit** `npx playwright test test/e2e/sender.spec.js` → Expected: FAIL.
- [ ] **Step 3: Implementovat `initSender()` + markup/styl tlačítka** (kulaté, červené, průměr `min(70vw, 300px)`, SVG kroužek s `stroke-dashoffset` animací při `.holding`).
- [ ] **Step 4: Spustit** `npx playwright test` a `npm test` → Expected: vše PASS.
- [ ] **Step 5: Commit** `git commit -m "Add sender screen with Attention button"`

---

### Task 6: README a závěrečné ověření

**Files:**
- Create: `README.md` (česky)

Obsah README:
1. Co aplikace dělá (2–3 věty) + schéma A → ntfy.sh → B.
2. **Zveřejnění zdarma přes HTTPS:** (a) GitHub Pages – nový repozitář, nahrát soubory, Settings → Pages → Branch `main` / root; (b) Netlify Drop – přetáhnout složku na `app.netlify.com/drop`. Upozornění: stránka musí běžet přes HTTPS.
3. **Nastavení telefonu A:** otevřít stránku → „Tento telefon ODESÍLÁ (A)“ → „Poslat odkaz příjemci“. iPhone: pokud chcete stránku na ploše, **přidejte ji na plochu před spárováním** a spárujte z ikony na ploše (aplikace na ploše má na iPhonu oddělené úložiště od Safari).
4. **Nastavení telefonu B:** otevřít odkaz v prohlížeči (ne z plochy) + návod ntfy (kroky ze spec 4.3) + tlačítko „Vyzkoušet“.
5. **Ruční test na telefonech** (checklist): B zamčený → A podrží tlačítko → B zvoní; klepnutí → alarm přes celou obrazovku; ROZUMÍM → A „Příjemce potvrdil“; akce „Rozumím“ v notifikaci (Android); ověří i předpoklady CORS a akcí (spec kap. 11).
6. **Omezení a soukromí:** nešifrováno přes ntfy.sh; kód nesdílet; limit 250 zpráv/den; iPhone neumí opakované zvonění; bez aplikace ntfy funguje příjem jen při otevřené a aktivní stránce.
7. **Vývoj:** `npm install`, `npm test`, `npm run test:e2e`, lokální spuštění `node test/serve.js` → `http://localhost:4173/?server=http://localhost:4174`.

- [ ] **Step 1: Napsat `README.md`.**
- [ ] **Step 2: Spustit** `npm test && npx playwright test` → Expected: vše PASS (výstup uvést v předávce).
- [ ] **Step 3: Ruční kontrola** – Playwright screenshoty obrazovky A, B a alarmu ve viewportu 390×844 uložit do scratchpadu a prohlédnout (čitelnost, nic nepřetéká).
- [ ] **Step 4: Commit** `git commit -m "Add Czech README with deployment and setup guide"`
