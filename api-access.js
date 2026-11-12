const API_ACCESS = { origins: ['https://api.openai.com/*'] };
export function hasApiAccess() { return chrome.permissions.contains(API_ACCESS); }
// Call synchronously from a click/submit handler so Chrome sees the user gesture.
export function requestApiAccess() { return chrome.permissions.request(API_ACCESS).catch(() => false); }
export async function requireApiAccess() {
  if (!await hasApiAccess()) throw new Error('Allow OpenAI API access using Refresh models in Settings.');
}
