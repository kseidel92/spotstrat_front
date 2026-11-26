import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LOCALES } from '../i18n';

const SITE = 'https://www.spotstrat.com';
const DEFAULT_IMAGE = `${SITE}/og.png`;

const PAGE = {
  home: {
    title: {
      'pt-BR': 'SpotStrat — Robô de crypto com IA | Simulador Binance',
      en: 'SpotStrat — AI crypto trading robot | Binance simulator',
      es: 'SpotStrat — Robot de crypto con IA | Simulador Binance',
      'es-MX': 'SpotStrat — Robot de crypto con IA | Simulador Binance',
      fr: 'SpotStrat — Robot crypto avec IA | Simulateur Binance',
      de: 'SpotStrat — KI-Krypto-Roboter | Binance-Simulator',
      ja: 'SpotStrat — AI暗号ロボ | Binanceシミュレーター',
    },
    description: {
      'pt-BR': 'Crie estratégias de trading de criptomoedas com IA, teste no simulador com dados reais da Binance sem gastar e opere na sua máquina — a chave fica com você.',
      en: 'Build crypto trading strategies with AI, test on a live Binance simulator without spending, then run production on your machine — your keys stay with you.',
      es: 'Crea estrategias de trading crypto con IA, simula con datos reales de Binance sin gastar y opera en tu máquina — la clave queda contigo.',
      'es-MX': 'Crea estrategias de trading crypto con IA, simula con datos reales de Binance sin gastar y opera en tu máquina — la clave queda contigo.',
      fr: 'Créez des stratégies crypto avec l’IA, simulez sur Binance sans dépenser, puis opérez sur votre machine — la clé reste chez vous.',
      de: 'Erstellen Sie Krypto-Strategien mit KI, testen Sie sie im Binance-Simulator ohne Risiko und betreiben Sie sie auf Ihrem Rechner — der Schlüssel bleibt bei Ihnen.',
      ja: 'AIで暗号トレード戦略を作り、Binanceの実データで無料シミュレーション。本番は自分のPCで——キーはあなたのもとに。',
    },
  },
  prices: {
    title: {
      'pt-BR': 'Preços | SpotStrat',
      en: 'Pricing | SpotStrat',
      es: 'Precios | SpotStrat',
      'es-MX': 'Precios | SpotStrat',
      fr: 'Tarifs | SpotStrat',
      de: 'Preise | SpotStrat',
      ja: '料金 | SpotStrat',
    },
    description: {
      'pt-BR': 'Planos do SpotStrat: desk com IA e simulador Binance. Produção à parte, pagamento único.',
      en: 'SpotStrat plans: AI desk and Binance simulator. Production is a separate one-time fee.',
      es: 'Planes de SpotStrat: desk con IA y simulador Binance. Producción aparte, pago único.',
      'es-MX': 'Planes de SpotStrat: desk con IA y simulador Binance. Producción aparte, pago único.',
      fr: 'Tarifs SpotStrat : desk IA et simulateur Binance. Production en paiement unique séparé.',
      de: 'SpotStrat-Preise: KI-Desk und Binance-Simulator. Produktion als einmalige Extra-Gebühr.',
      ja: 'SpotStratの料金。AIデスクとBinanceシミュレーター。本番は別途一回払い。',
    },
  },
  info: {
    title: {
      'pt-BR': 'Como funciona | SpotStrat',
      en: 'How it works | SpotStrat',
      es: 'Cómo funciona | SpotStrat',
      'es-MX': 'Cómo funciona | SpotStrat',
      fr: 'Comment ça marche | SpotStrat',
      de: 'So funktioniert’s | SpotStrat',
      ja: '仕組み | SpotStrat',
    },
    description: {
      'pt-BR': 'Crie com a IA, simule sem custo e opere na sua máquina. Entenda o fluxo SpotStrat.',
      en: 'Create with AI, simulate at no cost, run on your machine. How SpotStrat works.',
      es: 'Crea con IA, simula sin costo y opera en tu máquina. Cómo funciona SpotStrat.',
      'es-MX': 'Crea con IA, simula sin costo y opera en tu máquina. Cómo funciona SpotStrat.',
      fr: 'Créez avec l’IA, simulez sans coût, opérez sur votre machine. Le parcours SpotStrat.',
      de: 'Mit KI erstellen, kostenlos simulieren, auf dem eigenen Rechner betreiben.',
      ja: 'AIで作成、無料でシミュレーション、自分のPCで運用。SpotStratの流れ。',
    },
  },
  legal: {
    title: {
      'pt-BR': 'Documentos legais | SpotStrat',
      en: 'Legal | SpotStrat',
      es: 'Legal | SpotStrat',
      'es-MX': 'Legal | SpotStrat',
      fr: 'Mentions légales | SpotStrat',
      de: 'Rechtliches | SpotStrat',
      ja: '法務 | SpotStrat',
    },
    description: {
      'pt-BR': 'Termos, privacidade e cookies do SpotStrat.',
      en: 'SpotStrat terms, privacy and cookies.',
      es: 'Términos, privacidad y cookies de SpotStrat.',
      'es-MX': 'Términos, privacidad y cookies de SpotStrat.',
      fr: 'Conditions, confidentialité et cookies SpotStrat.',
      de: 'AGB, Datenschutz und Cookies von SpotStrat.',
      ja: 'SpotStratの利用規約・プライバシー・Cookie。',
    },
  },
};

function pick(map, lng) {
  return map[lng] || map.en || map['pt-BR'];
}

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href, extra = {}) {
  const sel = Object.entries({ rel, ...extra })
    .map(([k, v]) => `[${k}="${v}"]`)
    .join('');
  let el = document.head.querySelector(`link${sel}`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    Object.entries(extra).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

const AUTH_PAGES = {
  login: {
    title: {
      'pt-BR': 'Entrar | SpotStrat',
      en: 'Log in | SpotStrat',
      es: 'Entrar | SpotStrat',
      'es-MX': 'Entrar | SpotStrat',
      fr: 'Connexion | SpotStrat',
      de: 'Anmelden | SpotStrat',
      ja: 'ログイン | SpotStrat',
    },
    description: {
      'pt-BR': 'Entre na sua conta SpotStrat e continue de onde parou.',
      en: 'Log in to SpotStrat and pick up where you left off.',
      es: 'Entra en SpotStrat y sigue donde lo dejaste.',
      'es-MX': 'Entra en SpotStrat y sigue donde lo dejaste.',
      fr: 'Connectez-vous à SpotStrat et reprenez où vous en étiez.',
      de: 'Bei SpotStrat anmelden und dort weitermachen, wo Sie aufgehört haben.',
      ja: 'SpotStratにログインして続きから。',
    },
  },
  register: {
    title: {
      'pt-BR': 'Criar conta | SpotStrat',
      en: 'Create account | SpotStrat',
      es: 'Crear cuenta | SpotStrat',
      'es-MX': 'Crear cuenta | SpotStrat',
      fr: 'Créer un compte | SpotStrat',
      de: 'Konto erstellen | SpotStrat',
      ja: 'アカウント作成 | SpotStrat',
    },
    description: {
      'pt-BR': 'Crie sua conta e teste estratégias com IA no simulador Binance.',
      en: 'Create your account and test AI strategies on the Binance simulator.',
      es: 'Crea tu cuenta y prueba estrategias con IA en el simulador Binance.',
      'es-MX': 'Crea tu cuenta y prueba estrategias con IA en el simulador Binance.',
      fr: 'Créez votre compte et testez des stratégies IA sur le simulateur Binance.',
      de: 'Konto erstellen und KI-Strategien im Binance-Simulator testen.',
      ja: 'アカウントを作り、BinanceシミュレーターでAI戦略を試す。',
    },
  },
  verify: {
    title: {
      'pt-BR': 'Confirmar e-mail | SpotStrat',
      en: 'Verify email | SpotStrat',
      es: 'Confirmar correo | SpotStrat',
      'es-MX': 'Confirmar correo | SpotStrat',
      fr: 'Confirmer l’e-mail | SpotStrat',
      de: 'E-Mail bestätigen | SpotStrat',
      ja: 'メール確認 | SpotStrat',
    },
    description: {
      'pt-BR': 'Digite o código enviado ao seu e-mail para ativar o SpotStrat.',
      en: 'Enter the code sent to your email to activate SpotStrat.',
      es: 'Introduce el código enviado a tu correo para activar SpotStrat.',
      'es-MX': 'Introduce el código enviado a tu correo para activar SpotStrat.',
      fr: 'Saisissez le code envoyé par e-mail pour activer SpotStrat.',
      de: 'Geben Sie den per E-Mail gesendeten Code ein, um SpotStrat zu aktivieren.',
      ja: 'メールのコードを入力してSpotStratを有効化。',
    },
  },
  'forgot-password': {
    title: {
      'pt-BR': 'Recuperar senha | SpotStrat',
      en: 'Reset password | SpotStrat',
      es: 'Recuperar contraseña | SpotStrat',
      'es-MX': 'Recuperar contraseña | SpotStrat',
      fr: 'Mot de passe oublié | SpotStrat',
      de: 'Passwort zurücksetzen | SpotStrat',
      ja: 'パスワード再設定 | SpotStrat',
    },
    description: {
      'pt-BR': 'Receba um código por e-mail para definir uma nova senha.',
      en: 'Get a code by email to set a new password.',
      es: 'Recibe un código por correo para una nueva contraseña.',
      'es-MX': 'Recibe un código por correo para una nueva contraseña.',
      fr: 'Recevez un code par e-mail pour un nouveau mot de passe.',
      de: 'Code per E-Mail erhalten, um ein neues Passwort zu setzen.',
      ja: 'メールのコードで新しいパスワードを設定。',
    },
  },
  app: {
    title: {
      'pt-BR': 'Painel | SpotStrat',
      en: 'Dashboard | SpotStrat',
      es: 'Panel | SpotStrat',
      'es-MX': 'Panel | SpotStrat',
      fr: 'Tableau de bord | SpotStrat',
      de: 'Dashboard | SpotStrat',
      ja: 'ダッシュボード | SpotStrat',
    },
    description: {
      'pt-BR': 'Crie, simule e acompanhe estratégias de crypto com IA.',
      en: 'Create, simulate and track crypto strategies with AI.',
      es: 'Crea, simula y sigue estrategias crypto con IA.',
      'es-MX': 'Crea, simula y sigue estrategias crypto con IA.',
      fr: 'Créez, simulez et suivez des stratégies crypto avec l’IA.',
      de: 'Krypto-Strategien mit KI erstellen, simulieren und verfolgen.',
      ja: 'AIで暗号戦略を作成・シミュレート・追跡。',
    },
  },
};

function authPageKey(pathname) {
  if (/\/login(\/|$)/.test(pathname)) return 'login';
  if (/\/register(\/|$)/.test(pathname)) return 'register';
  if (/\/verify(\/|$)/.test(pathname)) return 'verify';
  if (/\/forgot-password(\/|$)/.test(pathname)) return 'forgot-password';
  if (/\/app(\/|$)/.test(pathname)) return 'app';
  return '';
}

function pageKey(pathname) {
  if (/\/(precos)(\/|$)/.test(pathname)) return 'prices';
  if (/\/(info|ajuda)(\/|$)/.test(pathname)) return 'info';
  if (/\/(termos|terms|privacy|cookies)(\/|$)/.test(pathname)) return 'legal';
  if (authPageKey(pathname)) return 'auth';
  return 'home';
}

export default function Seo() {
  const { pathname } = useLocation();
  const { lng: paramLng } = useParams();
  const { i18n } = useTranslation();
  const first = String(pathname || '').split('/').filter(Boolean)[0] || '';
  const lng = LOCALES.some((l) => l.id === first)
    ? first
    : (LOCALES.some((l) => l.id === paramLng) ? paramLng : (i18n.language || 'pt-BR'));

  useEffect(() => {
    const key = pageKey(pathname);
    const authKey = authPageKey(pathname);
    const privatePage = key === 'auth';
    const authPack = authKey ? AUTH_PAGES[authKey] : null;
    const pack = PAGE[key] || PAGE.home;
    const title = authPack
      ? pick(authPack.title, lng)
      : pick(pack.title, lng);
    const description = authPack
      ? pick(authPack.description, lng)
      : pick(pack.description, lng);
    const path = pathname === '/' ? `/${lng}` : pathname;
    const url = `${SITE}${path.startsWith('/') ? path : `/${path}`}`;

    document.title = title;
    document.documentElement.lang = lng;

    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', privatePage
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', DEFAULT_IMAGE);
    upsertMeta('property', 'og:locale', lng.replace('-', '_'));
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', DEFAULT_IMAGE);
    upsertLink('canonical', privatePage ? `${SITE}/${lng}` : url);

    LOCALES.forEach((locale) => {
      const altPath = pathname.replace(/^\/[^/]+/, `/${locale.id}`) || `/${locale.id}`;
      upsertLink('alternate', `${SITE}${altPath}`, { hreflang: locale.id });
    });
    upsertLink('alternate', `${SITE}/pt-BR`, { hreflang: 'x-default' });
  }, [pathname, lng]);

  return null;
}
