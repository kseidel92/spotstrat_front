const NAMES = {
  'Compra no fundo da caixa': {
    en: 'Buy at the range floor',
    es: 'Compra en el suelo del rango',
    'es-MX': 'Compra en el suelo del rango',
    fr: 'Achat au bas du range',
    de: 'Kauf am unteren Rand der Spanne',
    ja: 'レンジ下限での買い',
  },
  'Compra quem está liderando': {
    en: 'Buy the leader',
    es: 'Compra al que lidera',
    'es-MX': 'Compra al que lidera',
    fr: 'Acheter le leader',
    de: 'Den Führenden kaufen',
    ja: '先頭を買う',
  },
  'Rebote depois da queda': {
    en: 'Bounce after the dip',
    es: 'Rebote después de la caída',
    'es-MX': 'Rebote después de la caída',
    fr: 'Rebond après la baisse',
    de: 'Erholung nach dem Rücksetzer',
    ja: '下落のあとの反発',
  },
  'Compra na recuperação do mercado': {
    en: 'Buy the market recovery',
    es: 'Compra en la recuperación del mercado',
    'es-MX': 'Compra en la recuperación del mercado',
    fr: 'Achat sur la reprise du marché',
    de: 'Kauf in der Markterholung',
    ja: '相場回復での買い',
  },
  'Pulo rápido de preço': {
    en: 'Quick price jump',
    es: 'Salto rápido de precio',
    'es-MX': 'Salto rápido de precio',
    fr: 'Saut rapide de prix',
    de: 'Schneller Preissprung',
    ja: '急な価格の跳ね',
  },
  'Sobe e desce com stop largo': {
    en: 'Up and down with a wide stop',
    es: 'Sube y baja con stop amplio',
    'es-MX': 'Sube y baja con stop amplio',
    fr: 'Hausse et baisse avec un stop large',
    de: 'Auf und ab mit weitem Stop',
    ja: '広い損切りの上下',
  },
};

export function presetLabel(name, lng) {
  const pack = NAMES[name];
  if (!pack || !lng || lng === 'pt-BR' || lng === 'pt') return name;
  return pack[lng] || pack.en || name;
}
