import { PublicError } from "@/lib/errors";

// Account display names are user-editable and shown to other workspace members,
// so they run through this shared filter before being saved. It normalizes the
// input, blocks control/zero-width tricks and links, restricts the character set
// to name-like characters, and rejects a small set of obviously offensive words.

const MIN_LENGTH = 2;
const MAX_LENGTH = 80;

// Leet-speak substitutions so "sh1t" / "f_u_c_k" style evasions still match. Kept
// deliberately small; this is a lightweight guardrail, not exhaustive moderation.
const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "!": "i",
  "|": "i",
  "3": "e",
  "4": "a",
  "@": "a",
  "5": "s",
  "$": "s",
  "7": "t",
  "8": "b",
};

const PROFANITY = new Set([
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "dick",
  "bastard",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "whore",
  "slut",
  "rape",
  "rapist",
]);

// True for C0/C1 control characters, the soft hyphen, and zero-width / invisible
// formatting characters that can smuggle content past filters or spoof how a name
// renders. Matched by code point so no invisible literals live in the source.
function isInvisibleCodePoint(code: number) {
  return (
    code <= 0x1f ||
    code === 0x7f ||
    code === 0xad ||
    (code >= 0x200b && code <= 0x200f) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x2060 ||
    code === 0xfeff
  );
}

// Reduces a single token to bare letters after applying leet substitutions, so
// profanity checks compare like-for-like against the word list.
function canonicalizeToken(token: string) {
  return token
    .toLowerCase()
    .split("")
    .map((char) => LEET[char] ?? char)
    .join("")
    .replace(/[^a-z]/g, "");
}

// Trims, unifies unicode width/compat forms, strips control + zero-width
// characters, and collapses runs of whitespace to a single space.
export function normalizeDisplayName(raw: string) {
  const stripped = Array.from(raw.normalize("NFKC"))
    .filter((char) => !isInvisibleCodePoint(char.codePointAt(0) ?? 0))
    .join("");
  return stripped.replace(/\s+/g, " ").trim();
}

// Flags a name when any whitespace-separated token canonicalizes to a listed
// slur. Token-level matching (rather than substring) avoids the "Scunthorpe"
// problem where clean names contain a banned sequence.
export function containsProfanity(value: string) {
  return value.split(/\s+/).some((token) => {
    const canonical = canonicalizeToken(token);
    return canonical.length > 0 && PROFANITY.has(canonical);
  });
}

// Display-name changes are throttled to a small number per rolling window so a
// name can't be churned endlessly (impersonation, notification spam). The window
// is a product rule, not abuse throttling, so it lives on user_profiles rather
// than the short-lived security_rate_limits table.
export const MAX_NAME_CHANGES = 2;
export const NAME_CHANGE_WINDOW_MONTHS = 3;

// Adds whole calendar months, clamping day overflow (e.g. Jan 31 + 1mo -> Feb 28).
export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  return result;
}

export interface NameChangeStatus {
  used: number;
  remaining: number;
  // When the current window resets and the count returns to zero; null when no
  // active window is running (the next change starts a fresh one).
  resetAt: Date | null;
}

// Given the stored change count and window start, reports how many changes remain
// right now. An expired window reports a full allowance. Shared by the update flow
// (to allow/deny) and the account page (to show usage), so they never disagree.
export function nameChangeStatus(count: number, windowStartIso?: string | null, now = new Date()): NameChangeStatus {
  if (!windowStartIso) {
    return { used: 0, remaining: MAX_NAME_CHANGES, resetAt: null };
  }
  const resetAt = addMonths(new Date(windowStartIso), NAME_CHANGE_WINDOW_MONTHS);
  if (now.getTime() >= resetAt.getTime()) {
    return { used: 0, remaining: MAX_NAME_CHANGES, resetAt: null };
  }
  const used = Math.max(count, 0);
  return { used, remaining: Math.max(MAX_NAME_CHANGES - used, 0), resetAt };
}

// Validates and returns a clean display name, or throws a user-facing PublicError
// describing what to fix. Used by the account name update flow.
export function assertCleanDisplayName(raw: string) {
  const name = normalizeDisplayName(raw);

  if (name.length < MIN_LENGTH) {
    throw new PublicError("Enter a name with at least 2 characters.");
  }
  if (name.length > MAX_LENGTH) {
    throw new PublicError("Keep your name under 80 characters.");
  }
  if (/https?:\/\/|www\./i.test(name)) {
    throw new PublicError("Names can't contain links.");
  }
  if (!/^[\p{L}\p{M}][\p{L}\p{M}0-9 .,'-]*$/u.test(name)) {
    throw new PublicError("Use letters, numbers, spaces, and basic punctuation only.");
  }
  if (containsProfanity(name)) {
    throw new PublicError("Choose a different name.");
  }

  return name;
}
