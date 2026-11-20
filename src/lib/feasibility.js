/**
 * Espelho de hasMarketTrigger em apis/src/feasibility.js.
 * Criação livre sem movimento, janela, par, indicador ou nível não segue.
 */

export function hasMarketTrigger(text) {
  const t = String(text || '');
  if (/(?:^|\n)\s*Entrada:\s*\S.{7,}/im.test(t)) return true;
  if (/\bBrief\./i.test(t) && t.length > 40) return true;
  if (/\d+(?:[.,]\d+)?\s*%/.test(t)) return true;
  if (/\b\d+\s*(?:m|min|h|d|s)\b/i.test(t)) return true;
  if (/\b\d+\s*-\s*(?:min(?:ute)?s?|horas?|hours?|velas?|candles?)\b/i.test(t)) return true;
  if (/\b\d+\s*(?:minutos?|mins?|horas?|hours?|minutes?|segundos?|seconds?|velas?|candles?|dias?|days?)\b/i.test(t)) return true;
  if (/\b(?:1m|3m|5m|15m|30m|1h|2h|4h|1d)\b/i.test(t)) return true;
  if (/\b(?:btc|eth|sol|bnb|xrp|doge|ada|avax|dot|link|usdt|usdc)\b/i.test(t)) return true;
  if (/\b[a-z0-9]{2,12}usdt\b/i.test(t)) return true;
  if (/\b(?:rsi|ema|sma|macd|vwap|bollinger|atr|estoc[aá]stico|stochastic|volume|livro|tape|obi|m[eé]dias?|bandas?|book)\b/i.test(t)) return true;
  if (/\b(?:subir|sobe|subiu|cair|caiu|queda|alta|romp\w*|cruz\w*|acima|abaixo|rebote|engolf\w*|break(?:out)?s?|cross(?:es|ed|ing)?|pump|dump|spike|retest\w*|revers\w*|momentum|tend[eê]ncia)\b/i.test(t)) return true;
  if (/\b(?:m[aá]xim[ao]s?|m[ií]nim[ao]s?|suporte|resist[eê]ncia|pre[cç]os?|prices?|n[ií]veis|topo|fundo|highs?|lows?|support|resistance)\b/i.test(t)) return true;
  return false;
}

export function triggerHint(locale) {
  if (/^en/i.test(locale || '')) {
    return 'Describe the trigger in one sentence: the move, the timeframe, and optionally stop and target.';
  }
  return 'Descreve o gatilho em uma frase: o movimento, a janela, e se quiser o stop e o alvo.';
}

/** true quando o botão de criar deve ficar desligado. */
export function promptNeedsTrigger(text) {
  const raw = String(text || '').trim();
  if (raw.length < 8) return true;
  return !hasMarketTrigger(raw);
}
