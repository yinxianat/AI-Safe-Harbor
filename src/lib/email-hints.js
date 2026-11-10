// A magic-link flow gives no feedback when the address is wrong: the link is
// sent to whatever was typed, nothing arrives, and the user blames the app.
// Catching a likely typo before sending is the only chance to prevent that.

const COMMON_DOMAINS = [
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "yahoo.com", "icloud.com", "me.com", "proton.me", "protonmail.com",
  "aol.com", "msn.com", "qq.com", "163.com", "126.com",
];

// Deliberately permissive. Rejecting valid-but-unusual addresses is a worse
// failure than accepting a bad one, which simply never arrives.
const SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function validateEmailShape(value) {
  const email = String(value || "").trim();

  if (email.length === 0) return { ok: false, message: "Enter your email address." };
  if (email.length > 320) return { ok: false, message: "That address is too long." };
  if (!email.includes("@")) {
    return { ok: false, message: "That needs an @ — for example you@example.com" };
  }
  if ((email.match(/@/g) || []).length > 1) {
    return { ok: false, message: "That has more than one @." };
  }

  const [local, domain] = email.split("@");
  if (!local) return { ok: false, message: "Add the part before the @." };
  if (!domain) return { ok: false, message: "Add the part after the @, like gmail.com" };
  if (!domain.includes(".")) {
    return { ok: false, message: "The part after @ needs a dot, like gmail.com" };
  }
  if (!SHAPE.test(email)) {
    return { ok: false, message: "That does not look like an email address." };
  }

  return { ok: true, email: email.toLowerCase() };
}

function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return rows[a.length][b.length];
}

// Returns a corrected address only for a near-miss on a well-known domain —
// "gmial.com" yes, an unfamiliar company domain no. A wrong suggestion is
// worse than none, so the threshold is tight.
export function suggestCorrection(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email.includes("@")) return null;

  const [local, domain] = email.split("@");
  if (!local || !domain || COMMON_DOMAINS.includes(domain)) return null;

  for (const candidate of COMMON_DOMAINS) {
    const distance = editDistance(domain, candidate);
    const closeEnough = candidate.length > 8 ? distance <= 2 : distance === 1;
    if (distance > 0 && closeEnough) {
      return `${local}@${candidate}`;
    }
  }
  return null;
}
