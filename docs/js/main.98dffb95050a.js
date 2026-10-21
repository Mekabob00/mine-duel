import { GameUI } from './ui.ca5f36cabf9f.js';
import { BaseHtmlCacheRefresher } from './html-cache.2b7b3697d197.js';
import { ot } from './online-i18n.d7a81b985727.js';

new GameUI();
const onlineButton = document.createElement('button'); onlineButton.className = 'secondary'; onlineButton.id = 'online-menu';
onlineButton.addEventListener('click', () => location.assign('./online.html'));
document.querySelector('#menu-dialog .menu-options').append(onlineButton);
const onlineLabel = () => { onlineButton.textContent = ot(document.documentElement.lang, 'online'); };
new MutationObserver(onlineLabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); onlineLabel();
const htmlCache = new BaseHtmlCacheRefresher();
void htmlCache.refresh();
window.addEventListener('online', () => { void htmlCache.refresh(); }, { once: true });
