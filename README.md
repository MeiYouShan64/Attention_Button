# Attention button

Nouzová textová zpráva jedním stisknutím. Telefon **A** podrží velké červené
**Attention button** a na telefonu **B** se objeví předem nastavená zpráva –
jako hlasitá notifikace (i na zamčeném telefonu) a po klepnutí přes celou
obrazovku s tlačítkem **ROZUMÍM**. Telefon A pak vidí „Příjemce potvrdil“.

```
Telefon A (stránka)  ──POST──▶  ntfy.sh  ──▶  aplikace ntfy na B (notifikace, i zamčený telefon)
        ▲                          │
        │                          └──────▶  stránka na B (alarm přes celou obrazovku)
        └──── potvrzení „Rozumím“ ◀──────────  B
```

Aplikace je jen pár statických souborů – žádný vlastní server, žádné účty.
Zprávy přenáší bezplatná veřejná služba [ntfy.sh](https://ntfy.sh).

---

## 1. Zveřejnění zdarma (HTTPS)

Stránka musí běžet přes **HTTPS** (jinak ji telefony nenechají fungovat naplno).
Stačí jedna z možností:

### a) GitHub Pages

1. Na [github.com](https://github.com) vytvořte nový veřejný repozitář (např. `attention-button`).
2. Nahrajte do něj **obsah této složky** (`index.html`, `css/`, `js/`, `icon.svg`,
   `manifest.webmanifest`; složky `test/` a `docs/` nejsou potřeba, ale nevadí).
3. V repozitáři: **Settings → Pages → Branch: `main` / `(root)` → Save**.
4. Za minutu bude stránka na adrese `https://<váš-účet>.github.io/attention-button/`.

### b) Netlify Drop

1. Otevřete [app.netlify.com/drop](https://app.netlify.com/drop).
2. Přetáhněte do okna celou složku projektu.
3. Dostanete adresu `https://<něco>.netlify.app` (pro trvalé uložení se zaregistrujte).

---

## 2. Nastavení telefonu A (odesílatel)

1. Otevřete adresu stránky a zvolte **„Tento telefon ODESÍLÁ (A)“**.
2. Klepněte **„Poslat odkaz příjemci“** a pošlete odkaz (WhatsApp, SMS…) majiteli telefonu B.
3. Do pole **Text zprávy** napište, co se má na telefonu B zobrazit (uloží se samo).
4. Odeslání: **podržte Attention button 1 sekundu** (kolem tlačítka se vyplní kroužek).

> **iPhone a ikona na ploše:** stránka přidaná na plochu („Sdílet → Přidat na plochu“)
> má na iPhonu **oddělené úložiště** od Safari. Pokud ji chcete mít na ploše,
> **přidejte ji na plochu ještě před spárováním** a roli i odkaz příjemci nastavte
> až z ikony na ploše. Jinak by ikona na ploše vytvořila nový kód.

---

## 3. Nastavení telefonu B (příjemce)

1. Otevřete odkaz od odesílatele **v prohlížeči** (ne z ikony na ploše).
   Telefon se sám nastaví jako příjemce.
2. Aby zprávy chodily **i na zamčený telefon a bez otevřené stránky**, nainstalujte
   aplikaci **ntfy** (zdarma):
   [Google Play](https://play.google.com/store/apps/details?id=io.heckel.ntfy) ·
   [App Store](https://apps.apple.com/app/ntfy/id1625396347)
3. V ntfy klepněte **+** → **Subscribe to topic** → vložte kód kanálu (na stránce tlačítko
   **„Kopírovat kód“**). Server ponechte **ntfy.sh**.
4. **Android:** zapněte **Instant delivery in doze mode**, v nastavení aplikace
   **Keep alerting for highest priority** (zvoní, dokud zprávu nezrušíte) a povolte
   notifikacím ntfy přebít režim Nerušit (*Do Not Disturb override*).
5. **iPhone:** povolte notifikace pro ntfy.
6. Na stránce klepněte **„Vyzkoušet“** – měla by přijít zkušební notifikace.

Když přijde poplach: notifikace ntfy zazvoní → klepnutím se otevře stránka se zprávou
přes celou obrazovku → **ROZUMÍM** pošle potvrzení odesílateli. Na Androidu jde
potvrdit i tlačítkem **Rozumím** přímo v notifikaci.

---

## 4. Ruční test na skutečných telefonech

Automatické testy běží proti napodobenině ntfy, proto jednou vyzkoušejte skutečný provoz:

- [ ] A: „Poslat odkaz příjemci“ → B otevře odkaz → B ukazuje „● Připojeno – čekám na zprávy“.
- [ ] B: aplikace ntfy přihlášená ke kódu, tlačítko „Vyzkoušet“ → přijde notifikace.
- [ ] **B zamčený**, A podrží Attention button → na B zazvoní notifikace s textem zprávy.
- [ ] Na B klepnout na notifikaci → otevře se stránka se zprávou přes celou obrazovku.
- [ ] B: ROZUMÍM → na A se objeví „Příjemce potvrdil HH:MM“.
- [ ] B se stránkou otevřenou na obrazovce: klepnout „Povolit zvuk na této stránce“ → A pošle
      poplach → na B hraje siréna (Android: i vibrace).
- [ ] Android: tlačítko „Rozumím“ přímo v notifikaci → na A „Příjemce potvrdil“.
- [ ] A: „Odesláno …“ se ukáže do pár sekund. (Kdyby se místo toho ukázalo „Nepodařilo se
      odeslat“ i s funkčním internetem, ntfy.sh blokuje požadavky z prohlížeče – dejte vědět.)

### Test s jedním telefonem a počítačem

Počítač hraje roli telefonu A, takže otestujete úplně všechno včetně zamčeného telefonu.

1. Na počítači otevřete stránku a zvolte **„Tento telefon ODESÍLÁ (A)“**.
2. Odkaz z pole **„Odkaz pro příjemce“** si pošlete do telefonu (e-mailem, WhatsAppem…) a otevřete ho
   v telefonu → telefon je příjemce (B).
3. V telefonu nastavte aplikaci ntfy podle kapitoly 3.
4. Projděte seznam výše – „A“ je teď počítač. Attention button na počítači podržíte myší
   (nebo mezerníkem) 1 sekundu.

### Test jen s jedním telefonem

Telefon zastane obě role tak, že každá poběží v **jiném prohlížeči** (každý prohlížeč si
pamatuje svou roli zvlášť):

| | Telefon A (odesílatel) | Telefon B (příjemce) |
|---|---|---|
| Android | Firefox, Samsung Internet nebo anonymní karta Chrome | Chrome (výchozí prohlížeč) |
| iPhone | Chrome nebo Firefox | Safari (výchozí prohlížeč) |

**B musí být ve výchozím prohlížeči** – do něj se otevírají odkazy z notifikací ntfy.

1. V prohlížeči pro A otevřete stránku → **„Tento telefon ODESÍLÁ (A)“** → zkopírujte
   **„Odkaz pro příjemce“**.
2. Odkaz vložte do výchozího prohlížeče → stránka ukáže **„Příjem zpráv“** (role B).
3. Nastavte aplikaci ntfy podle kapitoly 3 a vyzkoušejte tlačítko **„Vyzkoušet“**.
4. Přepněte do prohlížeče A a **podržte Attention button** 1 sekundu → „Odesláno …“.
5. Během pár sekund přijde **notifikace ntfy** (na Androidu zvoní, dokud ji nezrušíte).
6. Klepněte na notifikaci → ve výchozím prohlížeči se otevře **zpráva přes celou obrazovku**.
7. Klepněte **ROZUMÍM**, přepněte zpět do prohlížeče A → **„Příjemce potvrdil HH:MM“**.
8. Android: pošlete další zprávu a potvrďte ji tentokrát tlačítkem **„Rozumím“ přímo v notifikaci**.

Pokud se po klepnutí na notifikaci objeví dotaz **„Přepnout ho na příjemce (B)?“**, otevřel se
odkaz v prohlížeči odesílatele – zvolte **Zrušit** a jako A použijte jiný prohlížeč než výchozí.

S jedním telefonem nejde vyzkoušet **zamčený telefon** (tlačítko A nepodržíte, když je telefon
zamčený) ani **sirénu na otevřené stránce B** (stránka B nesmí být na pozadí). Na to použijte
test s počítačem nebo se dvěma telefony.

---

## 5. Omezení a soukromí

- **Kód kanálu je jediné tajemství.** Kdo ho zná, může zprávy číst i posílat. Nesdílejte ho veřejně.
  Při podezření vytvořte na A **„Nový kód“** a pošlete příjemci nový odkaz.
- Zprávy jdou přes ntfy.sh **nešifrovaně** – provozovatel služby je technicky může vidět.
- ntfy.sh povoluje zdarma **250 zpráv denně** a drží zprávy cca **12 hodin**.
- **iPhone** neumí opakované zvonění a ztlumený telefon nezazvoní.
- **Bez aplikace ntfy** přijde zpráva jen tehdy, když má B stránku otevřenou na obrazovce
  (mobilní prohlížeče uspávají karty na pozadí a zamčeném telefonu).
- Zvuk sirény na stránce se pustí až po prvním klepnutí na stránku (pravidlo prohlížečů);
  notifikace ntfy zvoní vždy.

---

## 6. Vývoj

```bash
npm install
npm test               # jednotkové testy (Node 22)
npm run test:e2e       # end-to-end testy v Chromiu proti napodobenině ntfy
node test/serve.js     # lokálně: http://localhost:4173/?server=http://localhost:4174
```

Parametr `?server=<url>` přepne aplikaci na jiný ntfy server (např. vlastní).
Návrh: `docs/specs/2026-10-22-attention-button-design.md`, plán: `docs/plans/2026-10-22-attention-button.md`.
