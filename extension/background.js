import { send } from './lib/core.js';

// Clicking the toolbar icon opens the side panel.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
});

// Keyboard shortcut: send the current page to its default workflow, no panel needed.
// The shortcut itself grants one-time access to the tab, so no extra permission is required.
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'send-current-page' || !tab) return;
  flash(tab.id, '…', '#9C9D9D');
  const result = await send(tab);
  if (result.ok) flash(tab.id, '✓', '#49A77F', 2500);
  else flash(tab.id, '!', '#E3353F', 4000, result.error);
});

async function flash(tabId, text, color, ms, title) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setBadgeText({ tabId, text });
    if (title) await chrome.action.setTitle({ tabId, title: `Send to Freckle: ${title}` });
    if (ms) setTimeout(() => {
      chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
      chrome.action.setTitle({ tabId, title: 'Send to Freckle' }).catch(() => {});
    }, ms);
  } catch { /* tab closed */ }
}
