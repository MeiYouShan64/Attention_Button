export const NTFY = "http://localhost:4174";
export const APP = `http://localhost:4173/?server=${NTFY}`;

// Each phone gets its own browser context, so localStorage is not shared.
export async function newPhone(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  return context.newPage();
}

export async function pollTopic(request, topic) {
  const res = await request.get(`${NTFY}/${topic}/json?poll=1&since=all`);
  const text = await res.text();
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

export async function publishToMock(request, payload) {
  const res = await request.post(`${NTFY}/`, { data: JSON.stringify(payload) });
  return res.json();
}
