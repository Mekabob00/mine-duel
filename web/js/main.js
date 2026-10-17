import { GameUI } from './ui.js';
import { BaseHtmlCacheRefresher } from './html-cache.js';

new GameUI();
const htmlCache = new BaseHtmlCacheRefresher();
void htmlCache.refresh();
window.addEventListener('online', () => { void htmlCache.refresh(); }, { once: true });
