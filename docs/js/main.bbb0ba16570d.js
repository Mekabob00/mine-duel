import { GameUI } from './ui.d84bc167beeb.js';
import { BaseHtmlCacheRefresher } from './html-cache.b52c11505ec3.js';
import { ot } from './online-i18n.4bd740d1a3b8.js';

new GameUI();
const onlineButton = document.createElement('button'); onlineButton.className = 'secondary'; onlineButton.id = 'online-menu';
onlineButton.addEventListener('click', () => location.assign('./online.html'));
document.querySelector('#menu-dialog .menu-options').append(onlineButton);
const onlineLabel = () => { onlineButton.textContent = ot(document.documentElement.lang, 'online'); };
new MutationObserver(onlineLabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); onlineLabel();
const htmlCache = new BaseHtmlCacheRefresher();
void htmlCache.refresh();
window.addEventListener('online', () => { void htmlCache.refresh(); }, { once: true });
