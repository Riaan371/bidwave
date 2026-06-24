// Tracks user engagement (lots viewed, bids placed) so the install prompt
// can be triggered automatically at a moment the user is likely to say yes,
// instead of only sitting passively in a banner.
//
// Cadence: show immediately on a user's very first visit (full takeover —
// they haven't been asked yet, nothing to lose). After that, only show
// again once real engagement happens (2+ distinct lots viewed, or a bid
// placed) AND at least 14 days have passed since the last time we asked.

const VIEWED_KEY = 'wcp-lots-viewed';
const BID_KEY = 'wcp-has-bid';
const LAST_SHOWN_KEY = 'wcp-install-prompt-last-shown';
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function getViewedLots(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(VIEWED_KEY) ?? '[]'); } catch { return []; }
}

export function trackLotView(lotId: string) {
  if (typeof window === 'undefined') return;
  const viewed = new Set(getViewedLots());
  viewed.add(lotId);
  window.localStorage.setItem(VIEWED_KEY, JSON.stringify(Array.from(viewed).slice(-20)));
}

export function trackBidPlaced() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BID_KEY, '1');
}

export function shouldShowInstallPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  const lastShown = Number(window.localStorage.getItem(LAST_SHOWN_KEY) ?? '0');

  // Never asked before — first-visit takeover, no engagement bar to clear.
  if (!lastShown) return true;

  const cooldownPassed = Date.now() - lastShown > COOLDOWN_MS;
  if (!cooldownPassed) return false;

  const engaged = getViewedLots().length >= 2 || window.localStorage.getItem(BID_KEY) === '1';
  return engaged;
}

export function markInstallPromptShown() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
}
