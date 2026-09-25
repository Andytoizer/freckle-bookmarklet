// sidePanel.open must run synchronously inside the click, so look up the window first.
let windowId;
chrome.windows.getCurrent().then((w) => { windowId = w.id; });
document.getElementById('open').addEventListener('click', () => {
  if (windowId !== undefined) chrome.sidePanel.open({ windowId });
});
chrome.commands.getAll().then((cmds) => {
  const c = cmds.find((x) => x.name === 'send-current-page');
  if (c?.shortcut) document.getElementById('sc').textContent = c.shortcut;
});
