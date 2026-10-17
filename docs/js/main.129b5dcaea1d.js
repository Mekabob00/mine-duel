import { GameUI } from './ui.840ce8cc7504.js';
import { BaseHtmlCacheRefresher } from './html-cache.63c05e197797.js';

new GameUI();
const htmlCache = new BaseHtmlCacheRefresher();
void htmlCache.refresh();
window.addEventListener('online', () => { void htmlCache.refresh(); }, { once: true });
