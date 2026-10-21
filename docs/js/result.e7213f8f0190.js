// Presentation only. Final counts and durations come from the game model/server.
export function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return null;
  const seconds = Math.floor(milliseconds / 1000), hours = Math.floor(seconds / 3600);
  const parts = [Math.floor(seconds / 60) % 60, seconds % 60];
  if (hours) parts.unshift(hours);
  return parts.map(n => String(n).padStart(2, '0')).join(':');
}
export function localizedDuration(milliseconds, t) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return null;
  const total = Math.floor(milliseconds / 1000);
  const params = { hours: Math.floor(total / 3600), minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
  return t(params.hours ? 'durationHours' : params.minutes ? 'durationMinutes' : 'durationSeconds', params);
}
export function resultLines(record, outcome, t) {
  if (!record) return [t('recordUnavailable'), t('recordUnavailable')];
  const time = localizedDuration(record.durationMs, t);
  return [t(outcome === 'win' ? 'winTurns' : outcome === 'loss' ? 'lossTurns' : 'totalTurns', { turns: record.turns }),
    time === null ? t('recordUnavailable') : t(outcome === 'win' ? 'winTime' : 'matchTime', { time })];
}
