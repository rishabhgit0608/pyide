export const MEMBER_COLORS = ["#7c6af7", "#4ade80", "#fb923c", "#a78bfa", "#f87171"];
export const SESSION_KEY = "pyide_session";
export const SESSION_TTL = 24 * 60 * 60 * 1000; // 24h

export function memberColor(idx) {
  return MEMBER_COLORS[idx % MEMBER_COLORS.length];
}

export function initials(email) {
  return (email || "?")[0].toUpperCase();
}

export function formatDate(iso) {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return "";
  }
}

export function isValidEmail(e) {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(e);
}

export function saveSession(email) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email, ts: Date.now() }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { email, ts } = JSON.parse(raw);
    if (Date.now() - ts > SESSION_TTL) {
      clearSession();
      return null;
    }
    return email;
  } catch {
    return null;
  }
}
