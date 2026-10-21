import { resultLines } from './result.js';
import { OnlineClient } from './online-client.js';
import { ot } from './online-i18n.js';
import { VERSION } from './config.js';
import { loadLanguage, saveLanguage } from './i18n.js';
let boardReview = false, reviewGameId = null;
let storage; try { storage = localStorage; } catch {}
let lang = loadLanguage(storage) || 'ko', mode = 'explore', lastPhase = '', lastTurn = '', leaving = false, flash = '', pendingEntry = null;
const invitation = new URL(location.href).searchParams.get('room') || '';
const $ = id => document.getElementById(id), t = key => ot(lang, key);
const cells = Array.from({ length: 64 }, (_, i) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.index = i;
  b.addEventListener('click', () => { flash = ''; client.send('action', mode, i); }); $('online-board').append(b); return b; });
const client = new OnlineClient(render);
const phaseKeys = { 'opening-reveal': 'phaseOpeningReveal', 'opening-mine': 'phaseOpeningMine', explore: 'phaseExplore', 'place-mine': 'phaseMine', 'end-turn': 'phaseEnd' };
function render() {
  document.documentElement.lang = lang; $('online-language').value = lang; $('online-language').setAttribute('aria-label', ['한국어','日本語','English','简体中文'].join(' / '));
  document.querySelectorAll('[data-ot]').forEach(e => { e.textContent = t(e.dataset.ot); });
  const s = client.state, g = s?.game, ended = Boolean(g?.result), connected = client.status === 'connected';
  if (g?.id !== reviewGameId) { reviewGameId = g?.id; boardReview = false; }
  if (leaving && ended) {
    leaving = false; const entry = pendingEntry; pendingEntry = null; client.forget();
    if (entry) void enter(entry); else location.assign('./index.html'); return;
  }
  const modal = Boolean(document.querySelector('dialog[open]'));
  const mine = s && g?.current === s.seat, active = connected && client.storage && !client.pending && s?.status === 'playing' && mine && !modal && Date.now() + (client.offset || 0) < g.deadline;
  if (g && (g.phase !== lastPhase || g.turnId !== lastTurn)) { mode = g.phase.includes('mine') ? 'mine' : 'explore'; lastPhase = g.phase; lastTurn = g.turnId; }
  $('online-version').textContent = `v${VERSION}`;
  $('online-lobby').hidden = Boolean(client.session) && (!invitation || invitation === client.session.code);
  $('room-input').setAttribute('aria-label', t('code')); $('online-board').setAttribute('aria-label', t('online'));
  $('online-room-code').textContent = client.session ? `${t('code')}: ${client.session.code}` : '';
  const outcome = ended ? g.result.reason === 'bothDisconnected' ? 'void' : g.result.winner === null ? 'draw' : g.result.winner === s.seat ? 'win' : 'loss' : null;
  $('online-turn').textContent = ended ? t(outcome) : s?.status === 'playing' ? t(mine ? 'yourTurn' : 'theirTurn') : t('waiting');
  $('online-phase').textContent = ended ? t(g.result.reason) : phaseKeys[g?.phase] ? t(phaseKeys[g.phase]) : '';
  $('online-counts').textContent = g ? `${t('mine')} — ${t('me')}: ${g.counts[s.seat]} / ${t('opponent')}: ${g.counts[1-s.seat]} · ${t('marker')}: ${Math.max(0,1-g.markersUsed)}` : '';
  $('online-clock').textContent = g?.deadline ? `${Math.max(0, Math.ceil((g.deadline - Date.now() - (client.offset || 0)) / 1000))}s` : '';
  $('online-presence').textContent = s ? s.seats.map((p, i) => `${t(i === s.seat ? 'me' : 'opponent')}: ${p ? t(p.connected ? 'connected' : 'disconnected') + (p.ready ? ` · ${t('ready')}` : '') + (p.rematch ? ` · ${t('rematch')}` : '') : t('waitingPeer')}`).join(' / ') : '';
  $('online-feedback').textContent = flash ? t(flash) : client.error ? t(client.error) : client.pending ? t('pending') : client.session ? t(client.status) : !client.endpoint ? t('NOT_CONFIGURED') : !client.storage ? t('STORAGE_REQUIRED') : t('waiting');
  $('online-legend').textContent = t(ended ? 'revealLegend' : 'legend');
  cells.forEach((b, i) => {
    const c = g?.cells[i]; b.disabled = !active; b.className = 'cell'; b.textContent = '';
    if (c) {
      if (c.revealed) { b.classList.add(c.revealedBy === s.seat ? 'revealed-player' : 'revealed-cpu'); b.textContent = String(c.number); }
      else if (ended && c.owners) b.textContent = c.owners === 3 ? '◆' : c.ownMine ? '✹' : '◇';
      else if (c.ownMine) { b.textContent = '✹'; b.classList.add('own-mine'); }
      if (c.marker !== null) { const flag = document.createElement('span'); flag.className = 'online-flag ' + (c.marker === s.seat ? 'mine-flag' : 'their-flag'); flag.textContent = '⚑' + (ended ? c.markerCorrect ? '✓' : '×' : ''); b.append(flag); }
      if (g.result?.exploded === i) b.classList.add('exploded');
    }
    b.setAttribute('aria-label', `${Math.floor(i / 8) + 1}, ${i % 8 + 1}: ${b.textContent || '·'}`);
  });
  const enabled = { explore: ['explore', 'opening-reveal'].includes(g?.phase), mine: ['place-mine', 'opening-mine'].includes(g?.phase), marker: ['explore', 'place-mine', 'end-turn'].includes(g?.phase) && g?.markersUsed < 1, remove: ['explore', 'place-mine', 'end-turn'].includes(g?.phase) && g?.cells.some(c => c.marker === s?.seat) };
  document.querySelectorAll('[data-online-mode]').forEach(b => { b.disabled = !active || !enabled[b.dataset.onlineMode]; b.classList.toggle('selected', mode === b.dataset.onlineMode); b.setAttribute('aria-pressed', String(mode === b.dataset.onlineMode)); });
  $('online-end').disabled = !active || g?.phase !== 'end-turn';
  $('online-ready').hidden = s?.status !== 'waiting'; $('online-ready').disabled = !connected || Boolean(client.pending) || s?.seats[s.seat]?.ready;
  $('online-rematch').hidden = !ended; $('online-rematch').disabled = !connected || Boolean(client.pending) || s?.seats[s.seat]?.rematch;
  $('online-reconnect').hidden = !client.session || connected; $('online-leave').hidden = !client.session; $('copy-invite').hidden = !client.session;
  $('online-confirm-leave').disabled = (s?.status === 'playing' && !connected) || Boolean(client.pending);
  $('online-result').hidden = !ended || boardReview;
  $('online-view-results').hidden = !ended || !boardReview;
  if (ended && boardReview) $('online-rematch').hidden = true;
  if (ended) {
    const result = g.result; $('online-result-title').textContent = t(result.reason === 'bothDisconnected' ? 'void' : result.winner === null ? 'draw' : result.winner === s.seat ? 'win' : 'loss');
    $('online-result-reason').textContent = t(result.reason);
    const outcome = result.reason === 'bothDisconnected' ? 'void' : result.winner === null ? 'draw' : result.winner === s.seat ? 'win' : 'loss';
    const lines = resultLines(result.record, outcome, (key,params) => Object.entries(params || {}).reduce((text,[k,v]) => text.replaceAll(`{${k}}`,String(v)), t(key)));
    $('online-result-turns').textContent = lines[0]; $('online-result-time').textContent = lines[1];
    $('online-result-score').textContent = result.scores ? `${t('score')} — ${result.scores.map((v, i) => `${t(i === s.seat ? 'me' : 'opponent')}: ${v.score} / ${v.correct} / ${v.incorrect}`).join(' · ')}` : '';
  }
}
async function enter(kind) {
  if (client.session && !client.state) return;
  if (client.state?.status === 'playing') { pendingEntry = kind; $('online-leave-dialog').showModal(); render(); return; }
  try { flash = ''; await client.enter(kind, $('room-input').value); } catch (e) { client.error = e.message; render(); }
}
$('online-view-board').addEventListener('click', () => { boardReview = true; render(); $('online-view-results').focus(); $('online-board').scrollIntoView({block:'center'}); });
$('online-view-results').addEventListener('click', () => { boardReview = false; render(); $('online-view-board').focus(); });
$('create-room').addEventListener('click', () => enter('create'));
$('join-room').addEventListener('click', () => enter('join'));
$('online-ready').addEventListener('click', () => client.send('ready'));
$('online-rematch').addEventListener('click', () => client.send('rematch'));
$('online-end').addEventListener('click', () => client.send('action', 'end'));
$('online-reconnect').addEventListener('click', () => client.bootstrap().catch(e => { client.error = e.message; render(); }));
$('online-language').addEventListener('change', e => { lang = e.target.value; saveLanguage(storage, lang); render(); });
document.querySelectorAll('[data-online-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.onlineMode; render(); }));
function leave() { if (client.session) { $('online-leave-dialog').showModal(); render(); } else location.assign('./index.html'); }
$('online-leave').addEventListener('click', leave); $('online-back').addEventListener('click', leave);
$('online-confirm-leave').addEventListener('click', () => {
  if (client.state?.status !== 'playing') { client.forget(); location.assign('./index.html'); return; }
  if (client.status !== 'connected') return;
  leaving = true; client.send('resign'); $('online-leave-dialog').close(); render();
});
$('online-rules').addEventListener('click', () => { $('online-rules-dialog').showModal(); render(); });
document.querySelectorAll('[data-online-close]').forEach(b => b.addEventListener('click', () => { b.closest('dialog').close(); render(); }));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('close', () => { if (d.id === 'online-leave-dialog' && !leaving) pendingEntry = null; render(); }));
$('copy-invite').addEventListener('click', async () => { const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('room', client.session.code); $('invite-url').textContent = url.href; try { await navigator.clipboard.writeText(url.href); flash = 'copied'; } catch { flash = 'copyFailed'; } render(); });
$('room-input').value = invitation;
setInterval(render, 250); render();
if (client.session) client.bootstrap().catch(e => { client.error = e.message; render(); });
