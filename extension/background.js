import { run, follow } from './lib/core.js';

// Clicking the toolbar icon opens the side panel.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
});

// Keyboard shortcut: run the default play for this kind of page, no panel needed.
// The shortcut itself grants one-time access to the tab, so no extra permission is required.
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'send-current-page' || !tab) return;
  flash(tab.id, '…', '#9C9D9D');
  const started = await run(tab);
  if (!started.ok) return flash(tab.id, '!', '#E3353F', 5000, started.error);
  const done = await follow(started.runId);
  if (done.status === 'completed') flash(tab.id, '✓', '#49A77F', 4000, `${started.play.name} finished`);
  else if (done.status === 'running') flash(tab.id, '…', '#9C9D9D', 4000, `${started.play.name} is still running`);
  else flash(tab.id, '!', '#E3353F', 6000, done.error || `${started.play.name} ${done.status}`);
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
