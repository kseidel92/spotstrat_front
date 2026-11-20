/** Espelha parseLocaleNumber em apis/src/shared.js. */

function decimalStyle(locale) {
  return /^(en|ja|es-MX)/i.test(String(locale || 'pt-BR')) ? 'dot' : 'comma';
}

export function parseLocaleNumber(value, locale = 'pt-BR') {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let raw = String(value ?? '').trim().replace(/\s/g, '');
  if (!raw) return null;
  if (!/^-?[\d.,]+$/.test(raw)) return null;
  const sign = raw.startsWith('-') ? -1 : 1;
  if (raw[0] === '-') raw = raw.slice(1);
  const commas = (raw.match(/,/g) || []).length;
  const dots = (raw.match(/\./g) || []).length;
  if ((commas > 1 && dots > 0) || (dots > 1 && commas > 0) || commas > 1 || dots > 1) {
    if (!(commas > 1 && dots === 0) && !(dots > 1 && commas === 0)) return null;
  }
  const commaStyle = decimalStyle(locale) !== 'dot';
  let normalized = raw;
  if (commas && dots) {
    const decimalSep = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? ',' : '.';
    const groupSep = decimalSep === ',' ? '.' : ',';
    const parts = raw.split(decimalSep);
    if (parts.length !== 2 || !/^\d+$/.test(parts[1])) return null;
    normalized = `${parts[0].split(groupSep).join('')}.${parts[1]}`;
  } else if (commaStyle && commas === 1) {
    normalized = raw.replace(',', '.');
  } else if (!commaStyle && dots === 1) {
    normalized = raw;
  } else if (commaStyle && dots > 0) {
    const parts = raw.split('.');
    normalized = parts.slice(1).every((part) => part.length === 3) ? parts.join('') : (dots === 1 ? raw : '');
  } else if (!commaStyle && commas > 0) {
    const parts = raw.split(',');
    normalized = parts.slice(1).every((part) => part.length === 3) ? parts.join('') : '';
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = sign * Number(normalized);
  return Number.isFinite(n) ? n : null;
}
