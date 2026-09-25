document.getElementById('open').addEventListener('click', async () => {
  const win = await chrome.windows.getCurrent();
  chrome.sidePanel.open({ windowId: win.id });
});
chrome.commands.getAll().then((cmds) => {
  const c = cmds.find((x) => x.name === 'send-current-page');
  if (c?.shortcut) document.getElementById('sc').textContent = c.shortcut;
});
