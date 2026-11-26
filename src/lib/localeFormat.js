import { LOCALES } from '../i18n';

export function localeTag(lng) {
  const id = String(lng || 'pt-BR');
  return LOCALES.some((l) => l.id === id) ? id : 'pt-BR';
}

/** Paper wallet / PnL — formatação local, moeda do simulador (USD). */
export function formatPaperMoney(value, lng) {
  const v = Number(value);
  if (!Number.isFinite(v)) return '—';
  try {
    return new Intl.NumberFormat(localeTag(lng), {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'code',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(2)}`;
  }
}

export function formatLocaleDateTime(value, lng, opts = {}) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(localeTag(lng), {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...opts,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

/** Nomes técnicos de varreduras / arquivos no laboratório. */
export function humanizeArtifactName(name) {
  let raw = String(name || '').trim();
  if (!raw) return '—';
  raw = raw.replace(/\s*\.?\s*json\s*$/i, '').replace(/[_-]+/g, ' ').trim();
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}