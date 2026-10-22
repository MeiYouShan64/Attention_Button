import {
  generateCode,
  isValidCode,
  parseHash,
  buildReceiverLink,
  buildAlert,
  buildAck,
  buildTest,
  ackTopic,
  pickAlertToShow,
  receiverSince,
  formatTime,
} from "./channel.js";
import { publish, subscribe, poll } from "./ntfy.js";
import { unlockAudio, startAlarm, stopAlarm } from "./alarm.js";

const server = new URLSearchParams(location.search).get("server") || "https://ntfy.sh";

// localStorage can throw (private mode, blocked storage), so every access is guarded.
const store = {
  get(key) {
    try {
      return localStorage.getItem("att." + key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null || value === undefined) localStorage.removeItem("att." + key);
      else localStorage.setItem("att." + key, String(value));
    } catch {
      // Storage unavailable: the app still works for this page load.
    }
  },
};

const $ = (id) => document.getElementById(id);
const now = () => Math.floor(Date.now() / 1000);
const num = (key) => Number(store.get(key)) || 0;

// One live ntfy subscription at a time; `reconnect` reopens it when the page becomes visible again.
let activeSub = null;
let reconnect = null;

function listen(topic, options) {
  activeSub?.close();
  activeSub = subscribe(server, topic, options);
}

let connectToken = 0;

function teardown() {
  connectToken++;
  activeSub?.close();
  activeSub = null;
  reconnect = null;
  hideAlarm();
}

function showScreen(name) {
  for (const screen of ["role", "sender", "receiver"]) {
    $("screen-" + screen).hidden = screen !== name;
  }
}

function becomeSender() {
  store.set("role", "sender");
  if (!isValidCode(store.get("code"))) store.set("code", generateCode());
  initSender();
}

// Re-opening the same receiver link (e.g. from a notification) must not reset activatedAt,
// otherwise the alert that triggered the notification would be skipped.
// sentAt (from a notification link) makes sure the alert that link was sent for is fetched,
// even in a browser that lost or never had the pairing (iOS clears storage of unvisited sites).
function becomeReceiver(code, sentAt = null) {
  if (store.get("role") !== "receiver" || store.get("code") !== code) {
    store.set("role", "receiver");
    store.set("code", code);
    store.set("activatedAt", now());
    store.set("ackedTime", 0);
  }
  if (sentAt !== null && sentAt < num("activatedAt")) store.set("activatedAt", sentAt);
  initReceiver();
}

function showRoleScreen() {
  teardown();
  $("manual-code-box").hidden = true;
  $("role-error").textContent = "";
  showScreen("role");
}

// ---------- Sender (A) ----------

const HOLD_MS = 1000;
const DEFAULT_MESSAGE = "Potřebuji pomoc, zavolej mi!";
const HOLD_HINT = "Pro odeslání podržte 1 sekundu";
const EMPTY_TEXT = "Napište text zprávy";
const SEND_ERROR = "Nepodařilo se odeslat – zkontrolujte internet.";

let holdTimer = null;
let sending = false;

function initSender() {
  teardown();
  const code = store.get("code");
  $("code-sender").textContent = code;
  $("receiver-link").value = buildReceiverLink(location.href, code);
  $("share-status").textContent = "";
  $("message").value = store.get("message") ?? DEFAULT_MESSAGE;
  setHint(HOLD_HINT, false);
  const failed = Boolean(store.get("sendFailed"));
  const lastSent = num("lastSentTime");
  $("retry").hidden = !failed;
  if (failed) setSendStatus(SEND_ERROR, "err");
  else setSendStatus(lastSent ? "Odesláno " + formatTime(lastSent) : "", "ok");
  onMessageInput();
  showScreen("sender");
  reconnect = connectAcks;
  connectAcks();
}

function setHint(text, warn) {
  $("hold-hint").textContent = text;
  $("hold-hint").classList.toggle("warn", warn);
}

function setSendStatus(text, kind) {
  const el = $("send-status");
  el.textContent = text;
  el.className = "status-line " + kind;
}

function onMessageInput() {
  store.set("message", $("message").value);
  const empty = !$("message").value.trim();
  $("attention").disabled = empty;
  if (empty) setSendStatus(EMPTY_TEXT, "err");
  else if ($("send-status").textContent === EMPTY_TEXT) setSendStatus("", "");
}

// The timer fires at most once per press: after it fires holdTimer is null, so releasing
// late does nothing, and a new press is ignored while a send is in flight.
function startHold() {
  if ($("attention").disabled || holdTimer || sending) return;
  $("attention").classList.add("holding");
  setHint(HOLD_HINT, false);
  holdTimer = setTimeout(() => {
    holdTimer = null;
    $("attention").classList.remove("holding");
    send();
  }, HOLD_MS);
}

function endHold() {
  if (!holdTimer) return;
  clearTimeout(holdTimer);
  holdTimer = null;
  $("attention").classList.remove("holding");
  setHint("Držte 1 sekundu", true);
}

async function send() {
  const text = $("message").value.trim();
  if (!text || sending) return;
  sending = true;
  // Stop listening for acks of the previous alert: they must not look like a reply to this one.
  activeSub?.close();
  activeSub = null;
  $("retry").hidden = true;
  setSendStatus("Odesílám…", "");
  try {
    const code = store.get("code");
    const alert = buildAlert({ code, text, pageUrl: location.href, server, sentAt: now() });
    const res = await publish(server, alert);
    store.set("sendFailed", null);
    store.set("lastSentTime", res.time);
    setSendStatus("Odesláno " + formatTime(res.time), "ok");
    try {
      navigator.vibrate?.(200);
    } catch {
      // Vibration is only feedback.
    }
  } catch {
    store.set("sendFailed", 1);
    setSendStatus(SEND_ERROR, "err");
    $("retry").hidden = false;
  } finally {
    sending = false;
  }
  connectAcks();
}

function connectAcks() {
  const since = num("lastSentTime");
  if (!since || sending || store.get("sendFailed")) return;
  listen(ackTopic(store.get("code")), {
    since,
    onMessage: (msg) => {
      if (msg.time >= num("lastSentTime")) {
        setSendStatus("Příjemce potvrdil " + formatTime(msg.time), "ok");
      }
    },
  });
}

async function shareLink() {
  const url = buildReceiverLink(location.href, store.get("code"));
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Attention button",
        text: "Otevři tento odkaz – budeš přijímat moje nouzové zprávy:",
        url,
      });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    $("share-status").textContent = "Odkaz zkopírován – pošlete ho příjemci.";
  } catch {
    $("receiver-link").select();
    $("share-status").textContent = "Zkopírujte odkaz výše a pošlete ho příjemci.";
  }
}

function newCode() {
  const ok = confirm(
    "Vytvořit nový kód? Současný příjemce přestane dostávat zprávy, dokud mu nepošlete nový odkaz.",
  );
  if (!ok) return;
  store.set("code", generateCode());
  store.set("lastSentTime", null);
  store.set("sendFailed", null);
  initSender();
}

// ---------- Receiver (B) ----------

let current = null; // alert currently on screen
let soundEnabled = false;

function initReceiver() {
  teardown();
  $("code-receiver").textContent = store.get("code");
  $("guide-server").textContent = server.replace(/^https?:\/\//, "");
  $("enable-sound").hidden = soundEnabled;
  $("ack-error").textContent = "";
  $("test-status").textContent = "";
  $("conn-status").textContent = "Připojuji…";
  $("conn-status").classList.remove("ok");
  showScreen("receiver");
  reconnect = connectReceiver;
  connectReceiver();
}

function setConnected(open) {
  const el = $("conn-status");
  el.textContent = open ? "● Připojeno – čekám na zprávy" : "Připojuji znovu…";
  el.classList.toggle("ok", open);
}

// Acks may also come from the "Rozumím" button in the ntfy notification. Read the ones already
// sent before subscribing, so an alert acknowledged there is never replayed on this page.
async function connectReceiver() {
  const token = connectToken;
  const code = store.get("code");
  const since = receiverSince(num("ackedTime"), num("activatedAt"));
  try {
    for (const ack of await poll(server, ackTopic(code), since)) noteAck(ack);
  } catch {
    // Offline: the live subscription below still delivers acks once connected.
  }
  if (token !== connectToken) return;
  listen(`${code},${ackTopic(code)}`, {
    since,
    onStatus: (status) => setConnected(status === "open"),
    onMessage: (msg) => (msg.topic === ackTopic(code) ? noteAck(msg) : onAlert(msg)),
  });
}

function onAlert(msg) {
  const next = pickAlertToShow([current, msg].filter(Boolean), num("ackedTime"));
  if (next && next.id !== current?.id) showAlarm(next);
}

// An ack at time T acknowledges every alert sent up to T.
function noteAck(msg) {
  if (msg.time > num("ackedTime")) store.set("ackedTime", msg.time);
  if (current && current.time <= msg.time) hideAlarm();
}

function showAlarm(msg) {
  current = msg;
  const text = $("alarm-text");
  text.textContent = msg.message;
  text.classList.toggle("long", msg.message.length > 120);
  $("alarm-time").textContent = "Přijato " + formatTime(msg.time);
  $("alarm").hidden = false;
  startAlarm();
}

function hideAlarm() {
  stopAlarm();
  $("alarm").hidden = true;
  current = null;
}

async function acknowledge() {
  if (!current) return;
  store.set("ackedTime", current.time);
  hideAlarm();
  $("ack-error").textContent = "";
  try {
    await publish(server, buildAck(store.get("code")));
  } catch {
    $("ack-error").textContent = "Potvrzení se nepodařilo odeslat – zkontrolujte internet.";
  }
}

async function copyCode() {
  const button = $("copy-code");
  try {
    await navigator.clipboard.writeText(store.get("code"));
    button.textContent = "Zkopírováno ✓";
    setTimeout(() => (button.textContent = "Kopírovat kód"), 2000);
  } catch {
    const range = document.createRange();
    range.selectNodeContents($("code-receiver"));
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  }
}

async function sendTest() {
  const status = $("test-status");
  status.textContent = "Odesílám…";
  try {
    await publish(server, buildTest(store.get("code")));
    status.textContent = "Zkušební zpráva odeslána – měla by přijít notifikace ntfy.";
  } catch {
    status.textContent = "Nepodařilo se odeslat – zkontrolujte internet.";
  }
}

// ---------- Wiring ----------

$("choose-sender").addEventListener("click", becomeSender);
$("choose-receiver").addEventListener("click", () => {
  $("manual-code-box").hidden = false;
  $("manual-code").focus();
});
$("manual-code-save").addEventListener("click", () => {
  const code = $("manual-code").value.trim().toLowerCase();
  if (!isValidCode(code)) {
    $("role-error").textContent = "Neplatný kód";
    return;
  }
  $("role-error").textContent = "";
  becomeReceiver(code);
});
const attention = $("attention");
attention.addEventListener("pointerdown", startHold);
for (const type of ["pointerup", "pointerleave", "pointercancel"]) attention.addEventListener(type, endHold);
attention.addEventListener("contextmenu", (e) => e.preventDefault());
attention.addEventListener("keydown", (e) => {
  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
    e.preventDefault();
    startHold();
  }
});
attention.addEventListener("keyup", (e) => {
  if (e.key === " " || e.key === "Enter") endHold();
});
$("message").addEventListener("input", onMessageInput);
$("retry").addEventListener("click", send);
$("share-link").addEventListener("click", shareLink);
$("new-code").addEventListener("click", newCode);
$("change-role-sender").addEventListener("click", showRoleScreen);
$("change-role-receiver").addEventListener("click", showRoleScreen);
$("alarm-ack").addEventListener("click", acknowledge);
$("copy-code").addEventListener("click", copyCode);
$("send-test").addEventListener("click", sendTest);
$("enable-sound").addEventListener("click", async () => {
  if (await unlockAudio()) {
    soundEnabled = true;
    $("enable-sound").hidden = true;
  }
});

// Browsers allow sound only after a user activation (on touch screens: pointerup/click, not
// pointerdown); any tap or key unlocks it and resumes a waiting siren.
for (const type of ["pointerup", "click", "keydown"]) {
  document.addEventListener(
    type,
    () => {
      unlockAudio();
      if (current) startAlarm();
    },
    true,
  );
}

// Mobile browsers suspend background tabs; reconnect to catch up on anything missed.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && reconnect) reconnect();
});

function start() {
  const fromLink = parseHash(location.hash);
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  if (fromLink) {
    const switchRole =
      store.get("role") !== "sender" ||
      !isValidCode(store.get("code")) ||
      confirm("Tento telefon je nastavený jako ODESÍLATEL (A). Přepnout ho na příjemce (B)?");
    if (switchRole) return becomeReceiver(fromLink.code, fromLink.sentAt);
  }

  const role = store.get("role");
  if (!isValidCode(store.get("code"))) return showRoleScreen();
  if (role === "sender") return initSender();
  if (role === "receiver") return initReceiver();
  showRoleScreen();
}

start();
