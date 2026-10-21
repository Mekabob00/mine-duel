import { GameUI } from './ui.d5aa218e5336.js';
import { BaseHtmlCacheRefresher } from './html-cache.b52c11505ec3.js';
import { ot } from './online-i18n.fb0e9eb3e3e2.js';

new GameUI();
const onlineButton = document.createElement('button'); onlineButton.className = 'secondary'; onlineButton.id = 'online-menu';
onlineButton.addEventListener('click', () => location.assign('./online.html'));
document.querySelector('#menu-dialog .menu-options').append(onlineButton);
const onlineLabel = () => { onlineButton.textContent = ot(document.documentElement.lang, 'online'); };
new MutationObserver(onlineLabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); onlineLabel();
const htmlCache = new BaseHtmlCacheRefresher();
void htmlCache.refresh();
window.addEventListener('online', () => { void htmlCache.refresh(); }, { once: true });
