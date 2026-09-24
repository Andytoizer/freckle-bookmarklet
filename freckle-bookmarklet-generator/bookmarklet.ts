const RELAY_URL = 'https://yellow-truth-5279.andy-815.workers.dev';

// Webhooks copied from the app (next.freckle.io) must be sent to the API host (next-api.freckle.io).
export const normalizeWebhook = (webhookUrl: string): string =>
  webhookUrl.trim().replace(/^(https?:\/\/)next\.freckle\.io\//i, '$1next-api.freckle.io/');

// On a Sales Navigator lead page, sends the lead's linkedin.com/in/ URL instead of the Sales Nav URL.
// It reads a profile link already on the page, or opens the "..." menu to reveal "View LinkedIn profile".
// Every other page sends its own URL.
export const buildBookmarklet = (webhookUrl: string): string => {
  const webhook = normalizeWebhook(webhookUrl).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `javascript:(async function(){var W='${webhook}';var f=function(){var a=document.querySelector('a[href*="linkedin.com/in/"]');return a?a.href.split('?')[0].replace(/\\/$/,''):null};var u=location.href;if(/linkedin\\.com\\/sales\\/lead\\//.test(u)){var p=f();if(!p){var b=document.querySelector('[data-x--lead-actions-bar-overflow-menu],button[aria-label="Open actions overflow menu"]');if(b){b.click();for(var i=0;i<20&&!p;i++){await new Promise(function(r){setTimeout(r,100)});p=f()}b.click()}}if(!p){alert('Could not find the LinkedIn profile URL on this page');return}u=p}var w=window.open('${RELAY_URL}?url='+encodeURIComponent(u)+'&webhook='+encodeURIComponent(W),'_blank','width=400,height=200');setTimeout(function(){w&&w.close()},1000)})();`;
};
