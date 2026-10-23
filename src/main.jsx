import { Component, StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createChart } from 'lightweight-charts';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { LOCALES, detectLocale, setLocaleCookie } from './i18n';
import {
  store, api, ingest, connectStream, focusStrategy, setSession, clearSession, setApiOnline, rememberOn, patchAlarmChannels,
  useRegisterMutation, useLoginMutation, useForgotMutation, useResetPasswordMutation, useGoogleMutation,
  useVerifyEmailMutation, useResendMutation,
  useLogoutMutation, useMeQuery, usePatchMeMutation, useDeleteMeMutation,
  useStrategiesQuery, useStrategyQuery, usePromptMutation, useStrategyHelpMutation, useSuggestGuideMutation, useEditPromptMutation,
  usePauseMutation, useResumeMutation, useResetMutation, useRemoveMutation, useRestoreMutation, usePatchStrategyMutation,
  useAlarmPauseMutation, useAlarmArmMutation, useAlarmRemoveMutation, useAlarmChannelsMutation,
  useDeskQuery, useJobQuery,
  useCheckoutMutation, useCancelPlanMutation, usePlansQuery, useStrategyProductionQuery, useBuyProductionMutation,
  useConfigQuery,
} from './store';
import './styles/variables.css';
import './styles.css';
import auth from './components/AuthScreen.module.css';
import authPanel from './components/img_3.jpg';
import Hero from './components/Hero';
import LabPage from './components/Lab';
import StatsBar from './components/StatsBar';
import OpportunityCard from './components/OpportunityCard';
import TestimonialCard from './components/TestimonialCard';
import Faq from './components/Faq';
import { ConfirmProvider, useConfirm } from './confirm';
import LaunchPrice from './components/LaunchPrice';
import GoogleButton, { resolveGoogleClientId } from './components/GoogleButton';
import Badge from './components/Badge';
import { legalFor } from './legal';
import alertShot from './components/img_5.jpg';
import deskShot from './components/img_6.jpg';
import tradesShot from './components/img_trades.png';

function lngOf(pathname) {
  const part = pathname.split('/')[1];
  return LOCALES.some((l) => l.id === part) ? part : null;
}

function Flags() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = lngOf(pathname) || i18n.language;
  return (
    <div className="flags">
      {LOCALES.map((lng) => (
        <button
          key={lng.id}
          className={current === lng.id ? 'on' : ''}
          type="button"
          onClick={() => {
            setLocaleCookie(lng.id);
            const rest = pathname.split('/').slice(2).join('/');
            navigate(`/${lng.id}${rest ? `/${rest}` : ''}`);
          }}
        >
          {lng.flag} <span className="flag-label">{lng.label}</span>
        </button>
      ))}
    </div>
  );
}

function useLang() {
  const { lng } = useParams();
  const { i18n: inst } = useTranslation();
  useEffect(() => {
    if (LOCALES.some((l) => l.id === lng) && inst.language !== lng) inst.changeLanguage(lng);
  }, [lng, inst]);
  return lng;
}

function LangRedirect() {
  const target = detectLocale();
  return <Navigate to={`/${target}`} replace />;
}

function Tip({ text }) {
  return (
    <span className="tip">
      <button type="button" className="tip-mark" aria-label={text}>?</button>
      <span className="tip-pop" role="tooltip">{text}</span>
    </span>
  );
}

function SessionBoot({ children }) {
  const dispatch = useDispatch();
  const token = useSelector((s) => s.auth.token);
  const [ready, setReady] = useState(!!token);
  useEffect(() => {
    if (token) return undefined;
    let cancel = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      ctrl.abort();
      if (!cancel) setReady(true);
    }, 2500);
    fetch('/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remember: rememberOn() }),
      signal: ctrl.signal,
    }).then(async (res) => {
      if (cancel) return null;
      if (res.status >= 500 || res.status === 502 || res.status === 503 || res.status === 504) {
        dispatch(setApiOnline(false));
        return null;
      }
      dispatch(setApiOnline(true));
      if (!res.ok) return null;
      return res.json();
    }).then((data) => {
      if (!cancel && data?.accessToken) {
        dispatch(setSession({ token: data.accessToken, user: data.user, remember: rememberOn() }));
      }
    }).catch(() => {
      if (!cancel) dispatch(setApiOnline(false));
    }).finally(() => {
      clearTimeout(timer);
      if (!cancel) setReady(true);
    });
    return () => { cancel = true; clearTimeout(timer); ctrl.abort(); };
  }, [dispatch, token]);
  if (!ready) {
    return (
      <div className="boot-shell">
        <p className="wrap boot-wait">{i18n.t('loadingApp')}</p>
      </div>
    );
  }
  return (
    <>
      <ApiOfflineBanner />
      {children}
    </>
  );
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="boot-shell">
          <div className="wrap offline-panel" role="alert">
            <h1>{i18n.t('appCrashT')}</h1>
            <p>{i18n.t('appCrashB')}</p>
            <button className="solid" type="button" onClick={() => window.location.reload()}>{i18n.t('apiRetry')}</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ApiOfflineBanner() {
  const { t } = useTranslation();
  const online = useSelector((s) => s.desk.apiOnline);
  if (online) return null;
  return (
    <div className="api-offline" role="status">
      <span>{t('apiOffline')}</span>
      <button type="button" className="tiny" onClick={() => window.location.reload()}>{t('apiRetry')}</button>
    </div>
  );
}

function Guard({ children }) {
  const lng = useLang();
  if (!LOCALES.some((l) => l.id === lng)) return <Navigate to={`/${detectLocale()}`} replace />;
  return children;
}

function errText(error, t) {
  const code = error?.data?.error;
  const map = {
    email_taken: t('errEmailTaken'),
    phone_taken: t('errPhoneTaken'),
    bad_credentials: t('errBadCredentials'),
    password_mismatch: t('passwordMismatch'),
    bad_code: t('errBadCode'),
    rate_limited: error?.data?.message,
    prompt_limit: error?.data?.message,
    trial_expired: t('expired'),
    unverified: t('unverified'),
    stripe_off: t('payOff'),
    nothing_to_cancel: t('cancelOnlyPaid'),
    google_off: t('errGoogleOff'),
    upstream_fail: t('errUpstream'),
  };
  return map[code] || error?.data?.message || t('errGeneric');
}

function scrollPageTop() {
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  window.scrollTo({ top: 0, behavior });
}

function goFromFooter(nav, pathname, to) {
  return (event) => {
    event.preventDefault();
    if (pathname !== to) nav(to);
    requestAnimationFrame(() => requestAnimationFrame(scrollPageTop));
  };
}

function SiteFooter() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const open = (to) => goFromFooter(nav, pathname, to);
  const home = `/${lng}`;
  return (
    <footer className="site">
      <div className="foot-brand">
        <Link className="brand" to={home} onClick={open(home)}>
          SpotStrat
        </Link>
        <p className="tag">{t('footerTag')}</p>
        <p className="copy">{t('footerCopy')}</p>
      </div>
      <nav className="foot-legal" aria-label={t('footerLegal')}>
        <Link to={`/${lng}/termos`} onClick={open(`/${lng}/termos`)}>{t('footerTerms')}</Link>
        <Link to={`/${lng}/privacy`} onClick={open(`/${lng}/privacy`)}>{t('footerPrivacy')}</Link>
        <Link to={`/${lng}/cookies`} onClick={open(`/${lng}/cookies`)}>{t('footerCookies')}</Link>
      </nav>
      <div className="foot-contact">
        <a href="mailto:support@spotstrat.com">{t('footerMail')}</a>
        <p className="risk">{t('footerRisk')}</p>
      </div>
    </footer>
  );
}

function ShieldNote() {
  const { t } = useTranslation();
  return (
    <section className="shield">
      <span className="shield-mark" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M12 3l7 3v6c0 4.2-2.8 7.4-7 8.5C7.8 19.4 5 16.2 5 12V6l7-3z" stroke="currentColor" strokeWidth="1.6" />
          <rect x="9" y="11" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 11V9.5a2 2 0 0 1 4 0V11" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </span>
      <div>
        <h2>{t('shieldT')}</h2>
        <p>{t('shieldB')}</p>
      </div>
    </section>
  );
}



const ENGULF_BARS = [
  [102.4, 103.1, 101.6, 101.9],
  [101.9, 102.6, 101.1, 101.4],
  [101.4, 101.8, 100.2, 100.6],
  [100.6, 101.1, 99.5, 99.8],
  [99.8, 100.2, 98.7, 99.1],
  [99.2, 99.5, 97.9, 98.2],
  [98.0, 101.8, 97.6, 101.4],
  [101.4, 102.6, 100.8, 102.2],
  [102.2, 103.2, 101.6, 102.8],
  [102.8, 103.4, 101.9, 102.4],
  [102.4, 103.0, 101.7, 102.7],
  [102.7, 104.1, 102.2, 103.6],
];
const EMA_BARS = [
  [100, 100.8, 99.2, 99.4],
  [99.4, 99.8, 98.1, 98.4],
  [98.4, 98.9, 97.4, 97.8],
  [97.8, 98.2, 96.8, 97.1],
  [97.1, 97.6, 96.2, 96.5],
  [96.5, 97.4, 96.1, 97.2],
  [97.2, 98.6, 97.0, 98.4],
  [98.4, 99.8, 98.2, 99.5],
  [99.5, 100.8, 99.2, 100.4],
  [100.4, 101.6, 100.1, 101.2],
  [101.2, 102.2, 100.6, 101.0],
  [101.0, 102.4, 100.8, 102.1],
];

function emaLine(bars, period) {
  const k = 2 / (period + 1);
  let sum = 0;
  let prev = null;
  const out = [];
  for (let i = 0; i < bars.length; i++) {
    const close = bars[i][3];
    if (i < period - 1) {
      sum += close;
      out.push(null);
    } else if (i === period - 1) {
      prev = (sum + close) / period;
      out.push(prev);
    } else {
      prev = close * k + prev * (1 - k);
      out.push(prev);
    }
  }
  return out;
}

function CandleChart({ title, bars, mark }) {
  const pad = 18;
  const w = 640;
  const h = 300;
  const min = Math.min(...bars.map((b) => b[2]));
  const max = Math.max(...bars.map((b) => b[1]));
  const span = max - min || 1;
  const slot = (w - pad * 2) / bars.length;
  const y = (v) => pad + ((max - v) / span) * (h - pad * 2);
  const fast = emaLine(bars, 3);
  const slow = emaLine(bars, 6);
  const pathOf = (series) => series.map((v, i) => (v == null ? null : `${i === 0 || series[i - 1] == null ? 'M' : 'L'} ${pad + i * slot + slot / 2} ${y(v)}`)).filter(Boolean).join(' ');
  return (
    <figure className="chart-card">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title}>
        <rect width={w} height={h} fill="#0b121b" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={pad} x2={w - pad} y1={pad + i * ((h - pad * 2) / 3)} y2={pad + i * ((h - pad * 2) / 3)} stroke="rgba(160,196,220,0.14)" />
        ))}
        <path d={pathOf(slow)} fill="none" stroke="#d7ff6a" strokeWidth="1.6" />
        <path d={pathOf(fast)} fill="none" stroke="#7ad7ff" strokeWidth="1.6" />
        {bars.map((b, i) => {
          const [o, hi, lo, c] = b;
          const up = c >= o;
          const x = pad + i * slot + slot * 0.22;
          const bw = Math.max(2, slot * 0.56);
          const color = up ? '#3ddc97' : '#ff6b6b';
          return (
            <g key={i}>
              {mark === i && <rect x={x - 6} y={pad - 6} width={bw + 12} height={h - pad} fill="rgba(122,215,255,0.1)" />}
              <line x1={x + bw / 2} x2={x + bw / 2} y1={y(hi)} y2={y(lo)} stroke={color} strokeWidth="1.5" />
              <rect x={x} y={y(Math.max(o, c))} width={bw} height={Math.max(2, Math.abs(y(o) - y(c)))} fill={color} />
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function AlertVisual({ src, alt }) {
  const ref = useRef(null);
  function move(e) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-py * 8).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(px * 10).toFixed(2)}deg`);
  }
  function leave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }
  return (
    <div className="path-alert" ref={ref} onMouseMove={move} onMouseLeave={leave}>
      <img className="path-shot alert" src={src} alt={alt} />
    </div>
  );
}

function PathShow() {
  const { t } = useTranslation();
  const steps = 5;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => setI((n) => (n + 1) % steps), 7000);
    return () => clearInterval(timer);
  }, [paused]);
  return (
    <section className="path" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="path-copy">
        <div className="path-text">
          <h2>{t(`path${i + 1}t`)}</h2>
          <p className="lede">{t(`path${i + 1}`)}</p>
        </div>
        <div className="path-nav">
          <button type="button" onClick={() => setI((n) => (n + steps - 1) % steps)} aria-label="prev">‹</button>
          {Array.from({ length: steps }, (_, n) => (
            <button key={n} type="button" className={i === n ? 'on' : ''} onClick={() => setI(n)}>{n + 1}</button>
          ))}
          <button type="button" onClick={() => setI((n) => (n + 1) % steps)} aria-label="next">›</button>
        </div>
      </div>
      <div className="path-visual">
        {i === 0 && (
          <div className="path-chat">
            <p>{t('ex1')}</p>
            <p>{t('ex2')}</p>
            <p>{t('ex4')}</p>
          </div>
        )}
        {i === 1 && <CandleChart title={t('chartEngulf')} bars={ENGULF_BARS} mark={6} />}
        {i === 2 && <img className="path-shot frame" src={tradesShot} alt={t('path3t')} />}
        {i === 3 && <AlertVisual src={alertShot} alt={t('path4t')} />}
        {i === 4 && <img className="path-shot frame" src={deskShot} alt={t('path5t')} />}
      </div>
    </section>
  );
}

function Landing() {
  useLang();
  const { t } = useTranslation();
  const { lng } = useParams();
  return (
    <div className="landing">
      <header className="topbar">
        <Link className="brand" to={`/${lng}`}>SpotStrat</Link>
        <div className="spacer" />
        <Flags />
        <nav className="menu">
          <Link to={`/${lng}/info`}>{t('infoNav')}</Link>
          <Link to={`/${lng}/precos`}>{t('pricesNav')}</Link>
          <Link to={`/${lng}/login`}>{t('enter')}</Link>
          <Link className="solid" to={`/${lng}/register`}>{t('lCta')}</Link>
        </nav>
      </header>
      <Hero />
      <StatsBar />
      <OpportunityCard />
      <ShieldNote />
      <PathShow />
      <section className="band">
        <h2>{t('sayT')}</h2>
        <p className="lede">{t('sayL')}</p>
        <Badge>{t('presetsBadge')}</Badge>
        <p className="lede">{t('presetsL')}</p>
        <TestimonialCard />
      </section>
      <section className="trial-band">
        <img src="/robot-desk.png" alt="" />
        <div>
          <h2>{t('trialT')}</h2>
          <p className="lede">{t('trialB')}</p>
          <Link className="solid free" to={`/${lng}/register`} aria-label={t('finalCta')}>{t('finalCta')}</Link>
          <p className="mono dim">{t('freeNote')}</p>
          <p>{t('cancelHome')}</p>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

function AuthFrame({ children }) {
  const { t } = useTranslation();
  const { lng } = useParams();
  return (
    <div className="landing auth-page">
      <header className="topbar">
        <Link className="brand" to={`/${lng}`}>SpotStrat</Link>
        <div className="spacer" />
        <Flags />
        <nav className="menu">
          <Link to={`/${lng}/info`}>{t('infoNav')}</Link>
          <Link to={`/${lng}/precos`}>{t('pricesNav')}</Link>
          <Link to={`/${lng}/login`}>{t('enter')}</Link>
          <Link className="solid" to={`/${lng}/register`}>{t('cta')}</Link>
        </nav>
      </header>
      <main className="auth-wrap">{children}</main>
      <SiteFooter />
    </div>
  );
}

function Legal({ page }) {
  const lng = useLang();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const home = `/${lng}`;
  const doc = legalFor(lng, page);
  return (
    <AuthFrame>
      <article className="legal">
        <p className="legal-back">
          <Link to={home} onClick={goFromFooter(nav, pathname, home)}>← {t('footerHome')}</Link>
        </p>
        <h1>{doc.title}</h1>
        <p className="mono dim">{doc.updated}</p>
        {doc.sections.map((section) => (
          <section key={section.h}>
            <h2>{section.h}</h2>
            {section.p.map((para) => <p key={para}>{para}</p>)}
          </section>
        ))}
      </article>
    </AuthFrame>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordStrength(password) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return 'weak';
  if (score === 2) return 'medium';
  return 'strong';
}

function Glyph({ children, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

function UserIcon() {
  return <Glyph><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" /></Glyph>;
}

function MailIcon() {
  return <Glyph><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 7 9-7" /></Glyph>;
}

function LockIcon() {
  return <Glyph><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Glyph>;
}

function ArrowIcon() {
  return <Glyph size={16}><path d="M19 12H5" /><path d="M11 18l-6-6 6-6" /></Glyph>;
}

function EyeIcon({ off }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 20,
    height: 20,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: 'false',
  };
  if (off) {
    return (
      <svg {...common}>
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.9 5.1A10.8 10.8 0 0 1 12 4.8c5.5 0 9.2 4.2 10.2 7.2a11.6 11.6 0 0 1-3.2 4.6" />
        <path d="M6.1 6.1C4.2 7.4 2.8 9.2 1.8 12c1 2.8 4.7 7.2 10.2 7.2 1.5 0 2.9-.3 4.1-.8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ConsentLine({ lng }) {
  const { t } = useTranslation();
  const parts = t('agree').split(/(\{terms\}|\{privacy\})/);
  return (
    <p className={auth.legal}>
      {parts.map((part, i) => {
        if (part === '{terms}') return <Link key={i} to={`/${lng}/terms`}>{t('footerTerms')}</Link>;
        if (part === '{privacy}') return <Link key={i} to={`/${lng}/privacy`}>{t('footerPrivacy')}</Link>;
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function AuthScreen({ children, social = false }) {
  const { t } = useTranslation();
  const { lng } = useParams();
  return (
    <div className={auth.screen}>
      <section className={auth.formCol}>
        <header className={auth.top}>
          <Link className={auth.back} to={`/${lng}`}><ArrowIcon />{t('authBack')}</Link>
          <Flags />
        </header>
        <div className={auth.center}>
          <Link className={auth.logo} to={`/${lng}`} aria-label="SpotStrat"><i />SpotStrat</Link>
          <div className={auth.card}>
            {social && (
              <>
                <div className={auth.social}><GoogleEntry /></div>
                <p className={auth.or}><span>{t('authOr')}</span></p>
              </>
            )}
            {children}
          </div>
        </div>
      </section>
      <aside className={auth.visual} aria-hidden="true">
        <img src={authPanel} alt="" />
        <span className={auth.overlay} />
      </aside>
    </div>
  );
}

function Register() {
  useLang();
  const { t } = useTranslation();
  const { lng } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', password2: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState('');
  const [register, { isLoading }] = useRegisterMutation();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const emailBad = form.email.length > 0 && !EMAIL_RE.test(form.email.trim());
  const mismatch = form.password2.length > 0 && form.password !== form.password2;
  const strength = passwordStrength(form.password);
  const strengthKey = { weak: 'pwWeak', medium: 'pwMedium', strong: 'pwStrong' };
  const strengthValue = { weak: 1, medium: 2, strong: 3 };

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!EMAIL_RE.test(form.email.trim()) || form.password !== form.password2) return;
    try {
      const res = await register({
        name: form.name,
        email: form.email.trim(),
        password: form.password,
        passwordConfirm: form.password2,
        locale: lng,
      }).unwrap();
      nav(`/${lng}/verify`, { state: { email: form.email.trim(), verification: res.verification, password: form.password } });
    } catch (error) { setErr(errText(error, t)); }
  }
  return (
    <AuthScreen social>
      <form className={auth.form} onSubmit={submit}>
        <h1 className={auth.title}>{t('registerT')}</h1>
        {err && <div className={auth.banner} role="alert">{err}</div>}
        <div className={auth.field}>
          <label htmlFor="reg-name">{t('name')}</label>
          <div className={auth.control}>
            <span className={auth.leadIcon}><UserIcon /></span>
            <input id="reg-name" className={`${auth.input} ${auth.withIcon}`} autoFocus autoComplete="name" required value={form.name} onChange={set('name')} />
          </div>
        </div>
        <div className={auth.field}>
          <label htmlFor="reg-email">{t('email')}</label>
          <div className={auth.control}>
            <span className={auth.leadIcon}><MailIcon /></span>
            <input
              id="reg-email"
              className={`${auth.input} ${auth.withIcon}${emailBad ? ` ${auth.invalid}` : ''}`}
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={emailBad || undefined}
              aria-describedby={emailBad ? 'reg-email-error' : undefined}
              value={form.email}
              onChange={set('email')}
            />
          </div>
          {emailBad && <p className={auth.fieldError} id="reg-email-error" role="alert">{t('emailInvalid')}</p>}
        </div>
        <div className={auth.field}>
          <label htmlFor="reg-password">{t('password')}</label>
          <div className={auth.control}>
            <span className={auth.leadIcon}><LockIcon /></span>
            <input
              id="reg-password"
              className={`${auth.input} ${auth.withIcon} ${auth.withToggle}`}
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              aria-describedby={strength ? 'reg-pw-strength' : undefined}
              value={form.password}
              onChange={set('password')}
            />
            <button
              className={auth.pwToggle}
              type="button"
              aria-label={showPassword ? t('pwHide') : t('pwShow')}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((open) => !open)}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
          {strength && (
            <>
              <div
                className={auth.meter}
                role="meter"
                aria-label={t('pwStrength')}
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={strengthValue[strength]}
                aria-valuetext={t(strengthKey[strength])}
              >
                <span className={strength} />
              </div>
              <p className={`${auth.pwLabel} ${strength}`} id="reg-pw-strength">{t(strengthKey[strength])}</p>
            </>
          )}
        </div>
        <div className={auth.field}>
          <label htmlFor="reg-password2">{t('password2')}</label>
          <div className={auth.control}>
            <span className={auth.leadIcon}><LockIcon /></span>
            <input
              id="reg-password2"
              className={`${auth.input} ${auth.withIcon}${mismatch ? ` ${auth.invalid}` : ''}`}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              aria-invalid={mismatch || undefined}
              aria-describedby={mismatch ? 'reg-pw2-error' : undefined}
              value={form.password2}
              onChange={set('password2')}
            />
          </div>
          {mismatch && <p className={auth.fieldError} id="reg-pw2-error" role="alert">{t('passwordMismatch')}</p>}
        </div>
        <button className={auth.submit} disabled={isLoading} type="submit" aria-busy={isLoading}>
          {isLoading && <span className={auth.spin} aria-hidden="true" />}
          {isLoading ? t('creatingAccount') : t('registerCta')}
        </button>
        <ConsentLine lng={lng} />
        <p className={auth.alt}><Link to={`/${lng}/login`}>{t('hasAccount')}</Link></p>
      </form>
    </AuthScreen>
  );
}

function routeForDesk(lng, user) {
  if (!user || user.desk === 'unverified' || user.desk === 'locked') return `/${lng}/verify`;
  if (user.desk === 'expired') return `/${lng}/app/account`;
  return `/${lng}/app`;
}

function GoogleEntry() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const nav = useNavigate();
  const dispatch = useDispatch();
  const onToken = useRef(() => { });
  const [err, setErr] = useState('');
  const [google] = useGoogleMutation();
  const config = useConfigQuery(undefined, { refetchOnMountOrArgChange: true });
  const clientId = config.isSuccess
    ? String(config.data?.googleClientId || '').trim()
    : (config.isError ? resolveGoogleClientId('') : '');
  const hl = lng === 'pt-BR' || lng === 'es-MX' ? lng : String(lng || 'en').slice(0, 2);
  onToken.current = async (credential) => {
    setErr('');
    try {
      const res = await google({ idToken: credential, remember: true }).unwrap();
      dispatch(setSession({ token: res.accessToken, user: res.user, remember: true }));
      nav(routeForDesk(lng, res.user));
    } catch (error) { setErr(errText(error, t)); }
  };
  return (
    <div className="google-box">
      {clientId ? (
        <GoogleButton
          clientId={clientId}
          locale={hl}
          onCredential={(credential) => onToken.current(credential)}
          onFail={() => setErr(t('errGoogle'))}
        />
      ) : (
        <div className="gsi" />
      )}
      {config.isSuccess && !clientId && <div className="error">{t('errGoogleOff')}</div>}
      {err && <div className="error">{err}</div>}
    </div>
  );
}

function Login() {
  useLang();
  const { t } = useTranslation();
  const { lng } = useParams();
  const nav = useNavigate();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(rememberOn);
  const [err, setErr] = useState('');
  const loc = useLocation();
  const [login, { isLoading }] = useLoginMutation();
  const token = useSelector((s) => s.auth.token);
  const me = useMeQuery(undefined, { skip: !token });
  useEffect(() => {
    const desk = me.data?.user?.desk;
    if (!desk) return;
    if (desk === 'unverified' || desk === 'locked') nav(`/${lng}/verify`);
    else nav(routeForDesk(lng, me.data.user));
  }, [me.data, lng]);
  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const res = await login({ email, password, remember }).unwrap();
      dispatch(setSession({ token: res.accessToken, user: res.user, remember }));
      nav(routeForDesk(lng, res.user));
    } catch (error) {
      if (error?.data?.error === 'bad_credentials' || error?.status === 401) setErr(t('errBadCredentials'));
      else setErr(errText(error, t));
    }
  }
  return (
    <AuthScreen social>
      <form className={auth.form} onSubmit={submit}>
        <h1 className={auth.title}>{t('loginT')}</h1>
        <p className={auth.lead}>{t('loginLead')}</p>
        {loc.state?.notice && <div className={auth.note} role="status">{loc.state.notice}</div>}
        <div className={auth.field}>
          <label htmlFor="login-email">{t('email')}</label>
          <div className={auth.control}>
            <span className={auth.leadIcon}><MailIcon /></span>
            <input id="login-email" className={`${auth.input} ${auth.withIcon}`} type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className={auth.field}>
          <label htmlFor="login-password">{t('password')}</label>
          <div className={auth.control}>
            <span className={auth.leadIcon}><LockIcon /></span>
            <input id="login-password" className={`${auth.input} ${auth.withIcon}`} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <p className={auth.forgot}>
          <Link to={`/${lng}/forgot-password`}>{t('forgot')}</Link>
        </p>
        <label className={auth.remember} htmlFor="login-remember"><input id="login-remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t('remember')}</label>
        {err && <div className={auth.banner} role="alert">{err}</div>}
        <button className={auth.submit} disabled={isLoading} type="submit" aria-busy={isLoading}>
          {isLoading && <span className={auth.spin} aria-hidden="true" />}
          {isLoading ? t('entering') : t('enter')}
        </button>
        <p className={auth.alt}><Link to={`/${lng}/register`}>{t('noAccount')}</Link></p>
      </form>
    </AuthScreen>
  );
}

function ForgotPassword() {
  useLang();
  const { t } = useTranslation();
  const { lng } = useParams();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState('');
  const [forgot, { isLoading: sending }] = useForgotMutation();
  const [resetPassword, { isLoading: saving }] = useResetPasswordMutation();
  const emailBad = email.length > 0 && !EMAIL_RE.test(email.trim());
  const mismatch = password2.length > 0 && password !== password2;
  const strength = passwordStrength(password);
  const strengthKey = { weak: 'pwWeak', medium: 'pwMedium', strong: 'pwStrong' };
  const strengthValue = { weak: 1, medium: 2, strong: 3 };

  async function askCode(e) {
    e.preventDefault();
    setErr('');
    if (!EMAIL_RE.test(email.trim())) return;
    try {
      await forgot({ email: email.trim(), locale: lng }).unwrap();
      setSent(true);
    } catch (error) { setErr(errText(error, t)); }
  }

  async function save(e) {
    e.preventDefault();
    setErr('');
    if (!EMAIL_RE.test(email.trim()) || password !== password2 || password.length < 8) return;
    try {
      await resetPassword({
        email: email.trim(),
        code: code.trim(),
        password,
        passwordConfirm: password2,
      }).unwrap();
      nav(`/${lng}/login`, { state: { notice: t('resetDone') } });
    } catch (error) { setErr(errText(error, t)); }
  }

  if (!sent) {
    return (
      <AuthScreen>
        <form className={auth.form} onSubmit={askCode}>
          <h1 className={auth.title}>{t('forgotT')}</h1>
          <p className={auth.lead}>{t('forgotLead')}</p>
          {err && <div className={auth.banner} role="alert">{err}</div>}
          <div className={auth.field}>
            <label htmlFor="forgot-email">{t('email')}</label>
            <div className={auth.control}>
              <span className={auth.leadIcon}><MailIcon /></span>
              <input
                id="forgot-email"
                className={`${auth.input} ${auth.withIcon}${emailBad ? ` ${auth.invalid}` : ''}`}
                type="email"
                required
                autoFocus
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={emailBad || undefined}
                aria-describedby={emailBad ? 'forgot-email-error' : undefined}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {emailBad && <p className={auth.fieldError} id="forgot-email-error" role="alert">{t('emailInvalid')}</p>}
          </div>
          <button className={auth.submit} disabled={sending} type="submit" aria-busy={sending}>
            {sending && <span className={auth.spin} aria-hidden="true" />}
            {sending ? t('forgotSending') : t('forgotSend')}
          </button>
          <p className={auth.alt}><Link to={`/${lng}/login`}>{t('backLogin')}</Link></p>
        </form>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <form className={auth.form} onSubmit={save}>
        <h1 className={auth.title}>{t('forgotT')}</h1>
        <p className={auth.lead}>{t('forgotSent')}</p>
        {err && <div className={auth.banner} role="alert">{err}</div>}
        <div className={auth.field}>
          <label htmlFor="forgot-code">{t('emailCode')}</label>
          <input id="forgot-code" className={auth.input} inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className={auth.field}>
          <label htmlFor="forgot-password">{t('forgotNew')}</label>
          <div className={auth.control}>
            <span className={auth.leadIcon}><LockIcon /></span>
            <input
              id="forgot-password"
              className={`${auth.input} ${auth.withIcon} ${auth.withToggle}`}
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              aria-describedby={strength ? 'forgot-pw-strength' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              className={auth.pwToggle}
              type="button"
              aria-label={showPassword ? t('pwHide') : t('pwShow')}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((open) => !open)}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
          {strength && (
            <>
              <div
                className={auth.meter}
                role="meter"
                aria-label={t('pwStrength')}
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={strengthValue[strength]}
                aria-valuetext={t(strengthKey[strength])}
              >
                <span className={strength} />
              </div>
              <p className={`${auth.pwLabel} ${strength}`} id="forgot-pw-strength">{t(strengthKey[strength])}</p>
            </>
          )}
        </div>
        <div className={auth.field}>
          <label htmlFor="forgot-password2">{t('password2')}</label>
          <div className={auth.control}>
            <span className={auth.leadIcon}><LockIcon /></span>
            <input
              id="forgot-password2"
              className={`${auth.input} ${auth.withIcon}${mismatch ? ` ${auth.invalid}` : ''}`}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              aria-invalid={mismatch || undefined}
              aria-describedby={mismatch ? 'forgot-pw2-error' : undefined}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </div>
          {mismatch && <p className={auth.fieldError} id="forgot-pw2-error" role="alert">{t('passwordMismatch')}</p>}
        </div>
        <button className={auth.submit} disabled={saving} type="submit" aria-busy={saving}>
          {saving && <span className={auth.spin} aria-hidden="true" />}
          {saving ? t('forgotSaving') : t('forgotSave')}
        </button>
        <button className={auth.ghost} type="button" disabled={sending} onClick={askCode}>{t('resendEmail')}</button>
        <p className={auth.alt}><Link to={`/${lng}/login`}>{t('backLogin')}</Link></p>
      </form>
    </AuthScreen>
  );
}

function Verify() {
  useLang();
  const { t } = useTranslation();
  const { lng } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const dispatch = useDispatch();
  const token = useSelector((s) => s.auth.token);
  const [codes, setCodes] = useState(loc.state?.verification || null);
  const [emailCode, setEmailCode] = useState('');
  const [err, setErr] = useState('');
  const [login] = useLoginMutation();
  const [verifyEmail] = useVerifyEmailMutation();
  const [resend] = useResendMutation();
  const { data } = useMeQuery(undefined, { skip: !token });
  const swapping = useRef(false);

  useEffect(() => {
    const email = loc.state?.email;
    const password = loc.state?.password;
    if (!email || !password || swapping.current) return;
    if (token && !data?.user) return;
    if (data?.user?.email === email) return;
    swapping.current = true;
    login({ email, password, remember: rememberOn() }).unwrap()
      .then((res) => {
        dispatch(api.util.resetApiState());
        dispatch(setSession({ token: res.accessToken, user: res.user, remember: rememberOn() }));
      })
      .catch((error) => setErr(errText(error, t)));
  }, [token, data, loc.state]);

  async function confirm(e) {
    e.preventDefault();
    setErr('');
    try {
      let user;
      if (emailCode) user = (await verifyEmail({ code: emailCode }).unwrap()).user;
      if (user) dispatch(setSession({ token: store.getState().auth.token, user }));
      if (user?.desk === 'trial' || user?.desk === 'active') nav(`/${lng}/app`);
      else setErr(t('unverified'));
    } catch (error) { setErr(errText(error, t)); }
  }
  async function resendChannel(channel) {
    setErr('');
    try {
      const res = await resend({ channel }).unwrap();
      setCodes((prev) => ({ ...(prev || {}), emailCode: res.code }));
    } catch (error) { setErr(errText(error, t)); }
  }
  return (
    <AuthScreen>
      <form className={auth.form} onSubmit={confirm}>
        <h1 className={auth.title}>{t('verifyT')}</h1>
        <p className={auth.lead}>{t('verifyLead')}</p>
        {codes?.emailCode && (
          <div className={auth.codes}>
            <div>{t('localNote')}</div>
            <strong>{t('emailCode')} {codes.emailCode}</strong>
          </div>
        )}
        {err && <div className={auth.banner} role="alert">{err}</div>}
        <div className={auth.field}>
          <label htmlFor="verify-email">{t('emailCode')}</label>
          <input id="verify-email" className={auth.input} inputMode="numeric" autoComplete="one-time-code" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} />
        </div>
        <button className={auth.submit} type="submit" disabled={!token || (!!loc.state?.password && data?.user?.email !== loc.state?.email)}>{t('confirm')}</button>
        <button className={auth.ghost} type="button" onClick={() => resendChannel('email')}>{t('resendEmail')}</button>
        <p className={auth.hint}>{data?.user?.email}</p>
      </form>
    </AuthScreen>
  );
}

function DeskBar() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();
  return (
    <header className="deskbar">
      <Link className="brand" to={`/${lng}/app`}>SpotStrat</Link>
      <nav className="menu">
        <Link to={`/${lng}/app`}>{t('strategiesNav')}</Link>
        <Link to={`/${lng}/app/alarmes`}>{t('alarmsT')}</Link>
        <Link to={`/${lng}/app/precos`}>{t('pricesNav')}</Link>
        <Link to={`/${lng}/app/laboratorio`}>{t('labNav')}</Link>
        <Link to={`/${lng}/app/info`}>{t('infoNav')}</Link>
        <Link to={`/${lng}/app/account`}>{t('account')}</Link>
      </nav>
      <div className="spacer" />
      <Flags />
      <button className="tiny" type="button" onClick={async () => { await logout(); dispatch(clearSession()); window.location.href = `/${lng}`; }}>{t('logout')}</button>
    </header>
  );
}

function RequireDesk({ children, allowExpired = false }) {
  const lng = useLang();
  const token = useSelector((s) => s.auth.token);
  const { data, isLoading, isFetching, error, isError, refetch } = useMeQuery();
  const [waited, setWaited] = useState(false);
  useEffect(() => { connectStream(); }, []);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 3000);
    return () => clearTimeout(timer);
  }, []);
  const known = ['trial', 'paper', 'pro', 'active', 'expired'].includes(data?.user?.desk);
  const stillBooting = (isLoading || isFetching) && !known && !data?.user && !isError && !waited;
  if (stillBooting) {
    return (
      <div className="desk">
        <DeskBar />
        <p className="wrap boot-wait">{i18n.t('loadingApp')}</p>
      </div>
    );
  }
  // TRAVA DE AUTENTICAÇÃO COMENTADA — o desk abre sem login. Voltar estes retornos.
  // if (!token) return <Navigate to={`/${lng}/login`} replace />;
  // if (error?.status === 401) return <Navigate to={`/${lng}/login`} replace />;
  // const desk = data?.user?.desk;
  // if (desk === 'unverified' || desk === 'locked') return <Navigate to={`/${lng}/verify`} replace />;
  // if (desk === 'expired' && !allowExpired) return <Navigate to={`/${lng}/app/account`} replace />;
  void token; void error; void allowExpired; void lng; void refetch;
  return (
    <div className="desk">
      <DeskBar />
      <AlarmWatcher />
      {children}
    </div>
  );
}

function cleanJobError(text, t) {
  if (!text || /stopPct|tpPct|maxHoldMin|entrada sem gatilho|primitivo|obrigat|R:R líquido/i.test(text)) return t('workingFail');
  return text;
}

function questionsOf(output) {
  const list = Array.isArray(output?.questions) ? output.questions.map((item) => String(item || '').trim()).filter(Boolean) : [];
  const ask = String(output?.ask || '').trim();
  const raw = (list.length ? list : (ask ? [ask] : [])).slice(0, 6);
  return raw.map((item) => (/Não achei o gatilho|Descreve o gatilho/.test(item)
    ? i18n.t('askTrigger')
    : item));
}

const GUIDE_SPEC = {
  touches: { entryType: 'pattern', sources: ['candles'], stop: '1.6', target: '2.2' },
  swings: { entryType: 'momentum', sources: ['candles'], stop: '4', target: '6' },
  dump: { entryType: 'momentum', sources: ['candles', 'trades', 'book'], stop: '1.3', target: '2.5' },
  lead: { entryType: 'momentum', sources: ['candles', 'book'], stop: '2.8', target: '6.5' },
  spike: { entryType: 'momentum', sources: ['candles', 'trades', 'book'], stop: '1.8', target: '3.2' },
  laggard: { entryType: 'momentum', sources: ['candles'], stop: '2.2', target: '4.2' },
  range: { entryType: 'breakout', sources: ['candles'], stop: '1.6', target: '2.4' },
  pattern: { entryType: 'pattern', sources: ['candles'], stop: '0.8', target: '1.2' },
  cross: { entryType: 'cross', sources: ['candles', 'ema'], stop: '0.8', target: '1.6' },
  breakout: { entryType: 'breakout', sources: ['candles'], stop: '1.2', target: '2.2' },
  momentum: { entryType: 'momentum', sources: ['candles', 'trades'], stop: '1', target: '1.8' },
};

function detectGuideKind(guide) {
  const text = String(guide?.entry || '').toLowerCase();
  if (/toque|caixa|piso/.test(text)) return 'touches';
  if (/serra|zigzag|oscil/.test(text)) return 'swings';
  if (/queda|dump|rebote|despenc/.test(text)) return 'dump';
  if (/lider|força|forca|rank/.test(text)) return 'lead';
  if (/spike|anomalia|explos/.test(text)) return 'spike';
  if (/maré|mare|caíd|caid|atrasad|fund[oa]/.test(text)) return 'laggard';
  if (/faixa|range/.test(text)) return 'range';
  if (/engulf|engolfo|engolfe|padrão de vela|padrao de vela/.test(text)) return 'pattern';
  if (/\bema\b|cruzamento|cruzar|cruza/.test(text)) return 'cross';
  if (/romp|breakout/.test(text)) return 'breakout';
  if (/sobe|subir|impulso|momentum/.test(text)) return 'momentum';
  if (GUIDE_SPEC[guide?.entryType]) return guide.entryType;
  return 'touches';
}

function fieldsFor(step, spec, t, kind, remote = {}) {
  if (step === 'entry') return { entry: t(`aiEntry_${kind}`) };
  if (step === 'entryType') return { entryType: spec.entryType, entryTypeText: '' };
  if (step === 'sources') {
    const sources = Array.isArray(remote.sources) && remote.sources.length
      ? remote.sources.slice()
      : spec.sources.slice();
    return { sources, sourcesOther: '' };
  }
  if (step === 'list') {
    const list = remote.list === 'yes' ? 'yes' : 'no';
    return { list, listText: list === 'yes' ? String(remote.listText || '') : '' };
  }
  if (step === 'exit') return { exitKind: 'numbers', stop: String(spec.stop), target: String(spec.target), exitText: '' };
  if (step === 'review') return { name: t(`aiName_${kind}`) };
  return {};
}

function IconPlay() {
  return (
    <svg className="ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <polygon points="8,5 19,12 8,19" fill="currentColor" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg className="ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M8 7l1 12h6l1-12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg className="ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

function Stepper({ count, index }) {
  return (
    <ol className="stepper" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={i < index ? 'done' : i === index ? 'current' : ''}>
          <span>{i < index ? '✔' : i + 1}</span>
        </li>
      ))}
    </ol>
  );
}

function DeskArea({ value, onChange, placeholder, disabled }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const text = String(value || '');
  const long = text.length > 160 || text.split('\n').length > 4;
  return (
    <div className={`field-box${open ? ' expanded' : ''}${long ? ' has-expand' : ''}`}>
      <textarea value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />
      {long && (
        <button className="expand" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? t('collapseField') : t('expandField')}
        </button>
      )}
    </div>
  );
}

function reasonBits(reason) {
  return String(reason || '').split(/\s+·\s+|\s+-\s+|\s+–\s+/).map((part) => part.trim()).filter(Boolean);
}

function whyTone(text) {
  const s = String(text || '').toLowerCase();
  if (/stop|preju|negativ|ruim|halt|sl\b/.test(s)) return 'down';
  if (/excesso|lead|obi|ob\d|tape|verde|alta|compra/.test(s)) return 'up';
  return 'warn';
}

function AskSteps({ questions, busy, onDone }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => questions.map(() => ''));
  const last = index >= questions.length - 1;
  function submit(e) {
    e.preventDefault();
    const value = answers[index].trim();
    if (!value || busy) return;
    if (!last) {
      setIndex(index + 1);
      return;
    }
    onDone(questions.map((question, i) => `${question}\n${answers[i].trim()}`).join('\n\n'));
  }
  return (
    <div className="steps">
      <p className="steps-kicker">{t('needMore')}</p>
      <Stepper count={questions.length} index={index} />
      <p className="steps-count">{t('stepOf', { n: index + 1, total: questions.length })}</p>
      <h3>{questions[index]}</h3>
      <input
        value={answers[index]}
        onChange={(e) => setAnswers(answers.map((item, i) => (i === index ? e.target.value : item)))}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(e); }}
        autoFocus
      />
      <div className="row step-actions">
        {index > 0 && <button className="tiny" type="button" onClick={() => setIndex(index - 1)}>{t('backStep')}</button>}
        <button
          className="ghost"
          type="button"
          disabled={busy}
          onClick={() => setAnswers(answers.map((item, i) => (i === index ? t('aiAnswer') : item)))}
        >
          {t('aiDecide')}
        </button>
        <button className="solid" type="button" onClick={submit} disabled={busy || !answers[index].trim()}>{last ? t('createNow') : t('nextStep')}</button>
      </div>
    </div>
  );
}

function PromptStatus({ busy, status, note, err, detail }) {
  const { t } = useTranslation();
  if (busy) {
    return (
      <div className="composer-status" role="status" aria-live="polite">
        <strong>{status === 'queued' ? t('workingQueued') : t('working')}</strong>
        <div className="composer-bar" aria-hidden="true"><i /></div>
        <span className="muted">{detail || t('workingSub')}</span>
      </div>
    );
  }
  if (err) return <div className="error">{err}</div>;
  if (note) return <p className="ask">{note}</p>;
  return null;
}

function px(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return '—';
  if (v >= 100) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return v.toPrecision(4);
}

function whenBrt(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function resultKey(tr) {
  if (!tr.closed_at) return 'open';
  if (tr.exit_type === 'tp') return 'tp';
  if (tr.exit_type === 'sl') return 'sl';
  if (tr.exit_type === 'time') return 'time';
  return tr.exit_type || 'time';
}

function resultLabel(key, t) {
  if (key === 'tp') return t('resTarget');
  if (key === 'sl') return t('resStop');
  if (key === 'open') return t('resOpen');
  return t('resTime');
}

function TradeBook({ trades, position }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const openRow = position ? [{
    id: 'open-live',
    symbol: position.symbol,
    side: 'LONG',
    opened_at: position.openedAt,
    closed_at: null,
    entry: position.entry,
    exit: null,
    qty: position.qty,
    pnl_usdt: position.upnl,
    raw: { stop: position.stop, tp: position.tp },
  }] : [];
  const closed = (trades || []).filter((tr) => tr.closed_at);
  const rows = [...openRow, ...closed];
  const shown = rows.filter((tr) => !filter || resultKey(tr) === filter);
  return (
    <div className="book">
      <div className="book-meta">
        <span>{t('nTrades', { n: shown.length })}</span>
        <label className="result-filter">
          <span>{t('thResult')}</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('thResult')}>
            <option value="">{t('allResults')}</option>
            <option value="tp">{t('resTarget')}</option>
            <option value="sl">{t('resStop')}</option>
            <option value="time">{t('resTime')}</option>
            <option value="open">{t('resOpen')}</option>
          </select>
        </label>
      </div>
      <div className="book-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('thBuy')}</th>
              <th>{t('thSell')}</th>
              <th>{t('thPair')}</th>
              <th>{t('thSide')}</th>
              <th>{t('thEntry')}</th>
              <th>{t('thOco')}</th>
              <th>{t('thExitPx')}</th>
              <th>{t('thResult')}</th>
              <th>{t('thPnl')}</th>
              <th>{t('thWhy')}</th>
            </tr>
          </thead>
          <tbody>
            {!shown.length && <tr><td className="empty" colSpan={10}>{t('emptyTrades')}</td></tr>}
            {shown.map((tr) => {
              const key = resultKey(tr);
              const raw = tr.raw || {};
              const pnl = tr.pnl_usdt == null ? null : Number(tr.pnl_usdt);
              const base = Number(tr.quote) || (Number(tr.entry) * Number(tr.qty)) || 0;
              const pct = pnl != null && base > 0 ? (pnl / base) * 100 : null;
              const oco = raw.stop && raw.tp ? `${px(raw.stop)} / ${px(raw.tp)}` : '—';
              const bits = reasonBits(raw.reason);
              return (
                <tr key={tr.id}>
                  <td className="when">{whenBrt(tr.opened_at)}</td>
                  <td className="when">{whenBrt(tr.closed_at)}</td>
                  <td>{tr.symbol}</td>
                  <td>{t('sideLong')}</td>
                  <td className="num">{px(tr.entry)}</td>
                  <td className="num">{oco}</td>
                  <td className="num">{tr.exit ? px(tr.exit) : '—'}</td>
                  <td className={`res ${key}`}><span className={`badge ${key}`}>{resultLabel(key, t)}</span></td>
                  <td className={pnl == null ? 'num' : pnl >= 0 ? 'num up' : 'num down'}>
                    {pnl == null ? '—' : `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}${pct == null ? '' : ` (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`}`}
                  </td>
                  <td className="why">
                    {bits.length
                      ? <span className="why-pills">{bits.map((bit) => <span key={bit} className={`why-pill ${whyTone(bit)}`}>{bit}</span>)}</span>
                      : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ENTRY_TYPES = ['pattern', 'cross', 'breakout', 'momentum', 'other'];

function entryTypeBrief(guide, t) {
  const labels = {
    pattern: t('typePattern'),
    cross: t('typeCross'),
    breakout: t('typeBreakout'),
    momentum: t('typeMomentum'),
    other: t('typeOther'),
  };
  if (guide.entryType === 'other') {
    const text = guide.entryTypeText.trim();
    return text ? `Tipo: ${text}` : `Tipo: ${labels.other}`;
  }
  if (guide.entryType && labels[guide.entryType]) return `Tipo: ${labels[guide.entryType]}`;
  return '';
}

function briefOf(guide, t) {
  const sourceText = {
    candles: 'velas fechadas',
    trades: 'aggTrades, buyerMaker true é venda agressiva',
    book: 'livro com até 10 níveis em ctx.book()',
    ema: 'as médias que o texto citar',
    other: guide.sourcesOther.trim() || 'outros (ver texto do gatilho)',
  };
  const exit = guide.exitKind === 'numbers'
    ? `Stop ${guide.stop}% e alvo ${guide.target}% a partir da entrada.`
    : guide.exitKind === 'standard'
      ? 'Stop 0.8% e alvo 1.2% a partir da entrada. Estes números são o padrão porque a saída não foi definida.'
      : guide.exitText.trim();
  return [
    'Brief.',
    guide.name.trim() ? `Nome: ${guide.name.trim()}` : '',
    entryTypeBrief(guide, t),
    `Entrada: ${guide.entry.trim()}`,
    'Tempos de candle: conforme descrito no gatilho (pode ser mais de um).',
    `Fontes disponíveis no ctx (só entram na compra ou saída se Entrada ou Saída descreverem a condição): ${guide.sources.map((id) => sourceText[id]).join('; ')}.`,
    guide.list === 'yes'
      ? `Lista: ${guide.listText.trim()} Grave o preço em ctx.memory.`
      : 'Lista: não grava preço. A compra acontece no próprio gatilho.',
    `Saída: ${exit}`,
  ].filter(Boolean).join('\n');
}

function Guide({ busy, onCreate }) {
  const { t } = useTranslation();
  const [suggestGuide] = useSuggestGuideMutation();
  const [step, setStep] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);
  const [guide, setGuide] = useState({
    sources: ['candles'],
    sourcesOther: '',
    entry: '',
    entryType: '',
    entryTypeText: '',
    list: 'no',
    listText: '',
    exitKind: 'describe',
    stop: '0.8',
    target: '1.2',
    exitText: '',
    name: '',
  });
  const ids = ['entry', 'entryType', 'sources', 'list', 'exit', 'review'];
  const current = ids[step];
  function patch(partial) { setGuide({ ...guide, ...partial }); }
  function toggleSource(id) {
    const sources = guide.sources.includes(id) ? guide.sources.filter((item) => item !== id) : [...guide.sources, id];
    if (sources.length) patch({ sources });
  }
  const blocked = (current === 'entry' && !guide.entry.trim())
    || (current === 'entryType' && (!guide.entryType || (guide.entryType === 'other' && !guide.entryTypeText.trim())))
    || (current === 'sources' && guide.sources.includes('other') && !guide.sourcesOther.trim())
    || (current === 'list' && guide.list === 'yes' && !guide.listText.trim())
    || (current === 'exit' && guide.exitKind === 'numbers' && !(Number(guide.stop) > 0 && Number(guide.target) > 0))
    || (current === 'exit' && guide.exitKind === 'describe' && !guide.exitText.trim());
  const last = step === ids.length - 1;
  const brief = briefOf(guide, t);
  async function decide() {
    if (aiBusy || busy) return;
    setAiBusy(true);
    let kind = detectGuideKind(guide);
    let spec = { ...GUIDE_SPEC[kind] };
    let remote = null;
    try {
      remote = await suggestGuide({ step: current, guide }).unwrap();
      if (remote?.kind && GUIDE_SPEC[remote.kind]) {
        kind = remote.kind;
        spec = {
          ...GUIDE_SPEC[kind],
          entryType: remote.entryType || GUIDE_SPEC[kind].entryType,
          sources: Array.isArray(remote.sources) && remote.sources.length ? remote.sources : GUIDE_SPEC[kind].sources,
          stop: remote.stop || GUIDE_SPEC[kind].stop,
          target: remote.target || GUIDE_SPEC[kind].target,
        };
      }
    } catch { /* o catálogo local cobre o desk sem sessão */ }
    patch(fieldsFor(current, spec, t, kind, remote || {}));
    setAiBusy(false);
  }
  return (
    <div className="steps">
      <p className="steps-kicker">{t('guideSteps')}</p>
      <Stepper count={ids.length} index={step} />
      <p className="steps-count">{t('stepOf', { n: step + 1, total: ids.length })}</p>
      {current === 'entry' && (
        <>
          <h3>{t('guideEntry')}</h3>
          <DeskArea value={guide.entry} onChange={(e) => patch({ entry: e.target.value })} placeholder={t('guideEntryPh')} />
          <p className="muted">{t('guideEntryHint')}</p>
        </>
      )}
      {current === 'entryType' && (
        <>
          <h3>{t('guideEntryType')}</h3>
          <div className="chips">
            {ENTRY_TYPES.map((id) => (
              <button
                key={id}
                type="button"
                className={guide.entryType === id ? 'on' : ''}
                aria-pressed={guide.entryType === id}
                onClick={() => patch({ entryType: id })}
              >
                {t(id === 'pattern' ? 'typePattern' : id === 'cross' ? 'typeCross' : id === 'breakout' ? 'typeBreakout' : id === 'momentum' ? 'typeMomentum' : 'typeOther')}
              </button>
            ))}
          </div>
          {guide.entryType === 'other' && (
            <DeskArea
              value={guide.entryTypeText}
              onChange={(e) => patch({ entryTypeText: e.target.value })}
              placeholder={t('guideEntryTypeOtherPh')}
            />
          )}
        </>
      )}
      {current === 'sources' && (
        <>
          <h3>{t('guideSources')}</h3>
          <div className="chips">
            {[['candles', 'srcCandles'], ['trades', 'srcTrades'], ['book', 'srcBook'], ['ema', 'srcEma'], ['other', 'srcOther']].map(([id, key]) => (
              <button key={id} type="button" className={guide.sources.includes(id) ? 'on' : ''} aria-pressed={guide.sources.includes(id)} onClick={() => toggleSource(id)}>{t(key)}</button>
            ))}
          </div>
          {guide.sources.includes('other') && (
            <DeskArea
              value={guide.sourcesOther}
              onChange={(e) => patch({ sourcesOther: e.target.value })}
              placeholder={t('guideSourcesOtherPh')}
            />
          )}
        </>
      )}
      {current === 'list' && (
        <>
          <h3>{t('guideList')}</h3>
          <div className="segment-track block">
            <button type="button" className={guide.list === 'no' ? 'on' : ''} aria-pressed={guide.list === 'no'} onClick={() => patch({ list: 'no' })}>{t('guideListNo')}</button>
            <button type="button" className={guide.list === 'yes' ? 'on' : ''} aria-pressed={guide.list === 'yes'} onClick={() => patch({ list: 'yes' })}>{t('guideListYes')}</button>
          </div>
          {guide.list === 'yes' && <DeskArea value={guide.listText} onChange={(e) => patch({ listText: e.target.value })} placeholder={t('guideListPh')} />}
        </>
      )}
      {current === 'exit' && (
        <>
          <h3>{t('guideExit')}</h3>
          <button type="button" className={`guide-choice ${guide.exitKind === 'numbers' ? 'on' : ''}`} aria-pressed={guide.exitKind === 'numbers'} onClick={() => patch({ exitKind: 'numbers' })}>{t('guideExitNumbers')}</button>
          {guide.exitKind === 'numbers' && (
            <div className="choice-fields">
              <label>{t('stopPct')}<input inputMode="decimal" value={guide.stop} onChange={(e) => patch({ stop: e.target.value })} /></label>
              <label>{t('tpPct')}<input inputMode="decimal" value={guide.target} onChange={(e) => patch({ target: e.target.value })} /></label>
            </div>
          )}
          <button type="button" className={`guide-choice ${guide.exitKind === 'describe' ? 'on' : ''}`} aria-pressed={guide.exitKind === 'describe'} onClick={() => patch({ exitKind: 'describe' })}>{t('guideExitDescribe')}</button>
          {guide.exitKind === 'describe' && <DeskArea value={guide.exitText} onChange={(e) => patch({ exitText: e.target.value })} placeholder={t('guideExitPh')} />}
          <button type="button" className={`guide-choice ${guide.exitKind === 'standard' ? 'on' : ''}`} aria-pressed={guide.exitKind === 'standard'} onClick={() => patch({ exitKind: 'standard' })}>{t('guideExitStandard')}</button>
          <p className="muted">{t('guideExitNote')}</p>
        </>
      )}
      {current === 'review' && (
        <>
          <h3>{t('guideReview')}</h3>
          <input value={guide.name} onChange={(e) => patch({ name: e.target.value })} placeholder={t('guideName')} />
          <pre className="strategy-code guide-brief">{brief}</pre>
        </>
      )}
      <div className="row step-actions">
        {step > 0 && <button className="tiny" type="button" onClick={() => setStep(step - 1)}>{t('backStep')}</button>}
        <button className="ghost" type="button" disabled={aiBusy || busy} onClick={decide}>{aiBusy ? t('aiDecideBusy') : t('aiDecide')}</button>
        {last
          ? <button className="solid" type="button" disabled={busy} onClick={() => onCreate(brief)}>{t('guideCreate')}</button>
          : <button className="solid" type="button" disabled={blocked} onClick={() => setStep(step + 1)}>{t('nextStep')}</button>}
      </div>
    </div>
  );
}

function money(n) {
  const v = Number(n || 0);
  return `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(2)}`;
}

const ALARM_SOUNDS = ['bell', 'harsh', 'vintage', 'digital', 'gentle', 'burst', 'beep', 'distant'];
const ALARM_SOUND_LEGACY = { pulse: 'burst', chime: 'gentle', siren: 'harsh' };
let currentAlarm = null;
let pendingAlarm = null;

function alarmKind(kind) {
  const id = ALARM_SOUND_LEGACY[kind] || kind;
  return ALARM_SOUNDS.includes(id) ? id : 'bell';
}

function alarmLevel(volume) {
  const level = Number(volume);
  if (!Number.isFinite(level)) return 0.85;
  return Math.min(1, Math.max(0.05, level));
}

function playAlarmSound(kind, volume) {
  const id = alarmKind(kind);
  if (currentAlarm) {
    currentAlarm.pause();
    currentAlarm.currentTime = 0;
  }
  const audio = new Audio(`/alarms/${id}.mp3`);
  audio.volume = alarmLevel(volume);
  currentAlarm = audio;
  pendingAlarm = null;
  const run = audio.play();
  if (run && run.catch) run.catch(() => { if (currentAlarm === audio) pendingAlarm = audio; });
}

function unlockAlarmSound() {
  const audio = pendingAlarm;
  if (!audio) return;
  pendingAlarm = null;
  audio.play().catch(() => { pendingAlarm = audio; });
}

function SoundPick({ kind, volume, onChange }) {
  const { t } = useTranslation();
  const safeKind = alarmKind(kind);
  const [picked, setPicked] = useState(safeKind);
  const [level, setLevel] = useState(alarmLevel(volume));
  const holdUntil = useRef(0);
  useEffect(() => {
    if (Date.now() < holdUntil.current) return;
    setPicked(alarmKind(kind));
  }, [kind]);
  useEffect(() => {
    if (Date.now() < holdUntil.current) return;
    setLevel(alarmLevel(volume));
  }, [volume]);
  function choose(id) {
    pendingAlarm = null;
    holdUntil.current = Date.now() + 1500;
    setPicked(id);
    playAlarmSound(id, level);
    onChange({ soundKind: id, volume: level });
  }
  function commitVolume(next) {
    const value = alarmLevel(next);
    holdUntil.current = Date.now() + 1500;
    setLevel(value);
    onChange({ soundKind: picked, volume: value });
  }
  return (
    <div className="alarm-sound">
      <p className="sound-label">{t('soundKind')}</p>
      <div className="sound-grid" role="listbox" aria-label={t('soundKind')}>
        {ALARM_SOUNDS.map((id) => (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={picked === id}
            className={picked === id ? 'on' : ''}
            onClick={() => choose(id)}
          >
            {t(`sound_${id}`)}
          </button>
        ))}
      </div>
      <div className="alarm-volume">
        <span>{t('soundVol')}</span>
        <input
          type="range"
          min="0.05"
          max="1"
          step="0.05"
          value={level}
          aria-label={t('soundVol')}
          onChange={(e) => setLevel(alarmLevel(e.target.value))}
          onPointerUp={(e) => commitVolume(e.target.value)}
          onKeyUp={(e) => commitVolume(e.target.value)}
        />
        <b>{Math.round(level * 100)}%</b>
      </div>
      <button className="sound-test" type="button" onClick={() => { pendingAlarm = null; playAlarmSound(picked, level); }}>{t('soundTest')}</button>
    </div>
  );
}

function ChannelToggles({ sound, email, disabled, onToggle }) {
  const { t } = useTranslation();
  const items = [
    ['sound', 'chSound', sound],
    ['email', 'chEmail', email],
  ];
  return (
    <div className="switches" role="group" aria-label={t('optCh')}>
      {items.map(([key, label, on]) => (
        <button
          key={key}
          type="button"
          role="switch"
          aria-checked={!!on}
          className={on ? 'on' : ''}
          disabled={disabled}
          onClick={() => onToggle(key)}
        >
          <span className="switch-ui" aria-hidden="true"><i /></span>
          <span>{t(label)}</span>
        </button>
      ))}
    </div>
  );
}

function AlarmWatcher() {
  const alarms = useSelector((s) => s.desk.alarms) || [];
  const heardRef = useRef(new Set());
  const quietRef = useRef(new Map());
  useEffect(() => {
    const onGesture = (event) => {
      if (event.target.closest && event.target.closest('.alarm-sound, .switches, .confirm-card')) return;
      unlockAlarmSound();
    };
    window.addEventListener('pointerdown', onGesture);
    return () => window.removeEventListener('pointerdown', onGesture);
  }, []);
  useEffect(() => {
    for (const alarm of alarms) {
      const firing = (alarm.symbols || []).length > 0;
      if (firing && alarm.channels?.sound !== false && !heardRef.current.has(alarm.id)) {
        heardRef.current.add(alarm.id);
        quietRef.current.delete(alarm.id);
        playAlarmSound(alarm.channels?.soundKind, alarm.channels?.volume);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const names = (alarm.symbols || []).map((item) => String(item.symbol || '').replace(/USDT$/, '')).join(', ');
          new Notification(alarm.name || 'SpotStrat', { body: names });
        }
      }
      if (firing) quietRef.current.delete(alarm.id);
      else if (heardRef.current.has(alarm.id)) {
        const since = quietRef.current.get(alarm.id) || Date.now();
        quietRef.current.set(alarm.id, since);
        if (Date.now() - since > 30000) {
          heardRef.current.delete(alarm.id);
          quietRef.current.delete(alarm.id);
        }
      }
    }
  }, [alarms]);
  return null;
}

function AlarmCard({ alarm }) {
  const { t } = useTranslation();
  const ask = useConfirm();
  const [alarmPause] = useAlarmPauseMutation();
  const [alarmArm] = useAlarmArmMutation();
  const [alarmRemove] = useAlarmRemoveMutation();
  const [alarmChannels] = useAlarmChannelsMutation();
  const [err, setErr] = useState('');
  const [sound, setSound] = useState(alarm.channels?.sound !== false);
  const [email, setEmail] = useState(!!alarm.channels?.email);
  const holdUntil = useRef(0);
  const kind = alarmKind(alarm.channels?.soundKind);
  const volume = alarmLevel(alarm.channels?.volume);
  const live = useRef({ sound, email });
  live.current = { sound, email };
  useEffect(() => {
    if (Date.now() < holdUntil.current) return;
    setSound(alarm.channels?.sound !== false);
    setEmail(!!alarm.channels?.email);
  }, [alarm.id, alarm.channels?.sound, alarm.channels?.email]);

  function persist(next) {
    const prev = live.current;
    holdUntil.current = Date.now() + 1500;
    setSound(next.sound);
    setEmail(next.email);
    setErr('');
    patchAlarmChannels(alarm.id, next);
    alarmChannels({ id: alarm.id, channels: next }).unwrap().catch((error) => {
      holdUntil.current = 0;
      setSound(prev.sound);
      setEmail(prev.email);
      setErr(errText(error, t));
    });
  }

  function toggle(key) {
    const next = {
      sound: key === 'sound' ? !sound : sound,
      email: key === 'email' ? !email : email,
      soundKind: kind,
      volume,
    };
    if (key === 'sound' && next.sound) unlockAlarmSound();
    persist(next);
  }

  const firing = (alarm.symbols || []).length > 0;
  const names = (alarm.symbols || []).slice(0, 8).map((item) => String(item.symbol || '').replace(/USDT$/, '')).join(', ');
  const extra = (alarm.symbols || []).length > 8 ? ` +${alarm.symbols.length - 8}` : '';
  return (
    <article className={firing ? 'firing' : ''}>
      <div className="alarm-head">
        <div>
          <strong>{alarm.name}</strong>
          {firing && <span className="firing-flag">{t('alarmFiring')}</span>}
          <p>{alarm.thesis}</p>
          {firing && <p className="firing-names">{names}{extra}</p>}
        </div>
      </div>
      <ChannelToggles sound={sound} email={email} onToggle={toggle} />
      {!sound && !email && <p className="muted">{t('chNeed')}</p>}
      {sound && (
        <SoundPick
          kind={kind}
          volume={volume}
          onChange={(patch) => {
            const cur = live.current;
            persist({
              sound: cur.sound,
              email: cur.email,
              soundKind: patch.soundKind || kind,
              volume: patch.volume ?? volume,
            });
          }}
        />
      )}
      {err && <div className="error">{err}</div>}
      <div className="actions">
        {alarm.status === 'armed'
          ? <button className="tiny" type="button" onClick={() => alarmPause(alarm.id)}>{t('alarmPause')}</button>
          : <button className="tiny" type="button" onClick={() => alarmArm(alarm.id)}>{t('alarmArm')}</button>}
        <button className="tiny danger" type="button" onClick={async () => {
          const ok = await ask({ title: t('remove'), body: t('alarmRemoveAsk'), confirmLabel: t('remove'), cancelLabel: t('dialogBack'), tone: 'danger', icon: 'trash' });
          if (ok) alarmRemove(alarm.id);
        }}>{t('remove')}</button>
      </div>
    </article>
  );
}

function AlarmsPage() {
  const { t } = useTranslation();
  const live = useSelector((s) => s.desk);
  const { data } = useDeskQuery(undefined, { pollingInterval: 5000 });
  const alarms = live.alarms ?? data?.alarms ?? [];
  const [channels, setChannels] = useState({ sound: true, email: false, soundKind: 'bell', volume: 0.85 });
  const [prompt, setPrompt] = useState('');
  const [threadId, setThreadId] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [steps, setSteps] = useState(null);
  const dispatch = useDispatch();
  const [sendPrompt, { isLoading }] = usePromptMutation();
  const job = useJobQuery(jobId, { skip: !jobId, pollingInterval: jobId ? 700 : 0 });
  const busy = isLoading || !!jobId;

  useEffect(() => {
    const status = job.data?.job?.status;
    if (!status || status === 'queued' || status === 'running') return;
    if (status === 'needs_user') {
      const questions = questionsOf(job.data.job.output);
      setSteps(questions.length ? { id: job.data.job.id, questions } : null);
      setNote(questions.length ? '' : (job.data.job.output?.ask || ''));
      setThreadId(job.data.job.thread_id || threadId);
    } else if (status === 'failed') setErr(cleanJobError(job.data.job.error, t));
    else {
      setNote(`${job.data.job.output?.name || ''} · ${t('modeAlarm')}`);
      setSteps(null);
      setPrompt('');
      setThreadId(null);
      dispatch(api.util.invalidateTags(['Desk', 'Strategies']));
    }
    setJobId(null);
  }, [job.data]);

  async function sendText(text) {
    setErr('');
    setSteps(null);
    if (!channels.sound && !channels.email) {
      setErr(t('chNeed'));
      return;
    }
    try {
      const res = await sendPrompt({
        prompt: text,
        threadId,
        mode: 'alarm',
        options: { channels, mareMode: 'any' },
      }).unwrap();
      setThreadId(res.threadId);
      setJobId(res.jobId);
    } catch (error) { setErr(errText(error, t)); }
  }

  return (
    <div className="wrap">
      <form className="panel composer-top" onSubmit={(e) => { e.preventDefault(); sendText(prompt); }} aria-busy={busy}>
        <h2>{t('alarmsT')}</h2>
        <DeskArea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('promptPhAlarm')} disabled={busy} />
        <fieldset className="choice" disabled={busy}>
          <legend>{t('optCh')}</legend>
          <ChannelToggles
            sound={channels.sound}
            email={channels.email}
            disabled={busy}
            onToggle={(key) => {
              setErr('');
              setChannels((prev) => {
                const next = { ...prev, [key]: !prev[key] };
                if (key === 'sound' && next.sound) unlockAlarmSound();
                return next;
              });
            }}
          />
          {!channels.sound && !channels.email && <p className="muted">{t('chNeed')}</p>}
          {channels.sound && (
            <SoundPick
              kind={channels.soundKind}
              volume={channels.volume}
              onChange={(patch) => setChannels((prev) => ({ ...prev, ...patch }))}
            />
          )}
          <p className="muted">{t('chHint')}</p>
        </fieldset>
        {steps && (
          <AskSteps
            key={steps.id}
            questions={steps.questions}
            busy={busy}
            onDone={(answer) => {
              setPrompt(answer);
              setSteps(null);
              sendText(answer);
            }}
          />
        )}
        <PromptStatus busy={busy} status={job.data?.job?.status} note={note} err={err} />
        <button className="solid" disabled={busy || !prompt.trim()} type="submit">{busy ? t('working') : t('send')}</button>
      </form>
      <section className="alarm-board">
        {!alarms.length && <p className="muted">{t('alarmEmpty')}</p>}
        <div className="alarm-list">
          {alarms.map((alarm) => <AlarmCard key={alarm.id} alarm={alarm} />)}
        </div>
      </section>
    </div>
  );
}

function StrategyHelpBalloon({ strategies }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [sendHelp, { isLoading }] = useStrategyHelpMutation();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const text = message.trim();
    if (text.length < 8) {
      setErr(t('helpShort'));
      return;
    }
    try {
      await sendHelp({
        message: text,
        strategyId: strategyId || undefined,
        locale: i18n.language,
      }).unwrap();
      setSent(true);
      setMessage('');
      setStrategyId('');
    } catch (error) {
      setErr(errText(error, t));
    }
  }

  return (
    <div className={`help-balloon ${open ? 'open' : ''}`}>
      {!open && (
        <button type="button" className="help-balloon-tab" onClick={() => { setOpen(true); setSent(false); setErr(''); }}>
          <span className="help-balloon-dot" aria-hidden="true" />
          <span>{t('helpTeaser')}</span>
        </button>
      )}
      {open && (
        <form className="help-balloon-panel" onSubmit={submit}>
          <header>
            <div>
              <p className="help-balloon-kicker">{t('helpTitle')}</p>
              <p className="help-balloon-lede">{t('helpLede')}</p>
            </div>
            <button type="button" className="help-balloon-close" aria-label={t('dialogBack')} onClick={() => setOpen(false)}>×</button>
          </header>
          {sent ? (
            <p className="help-balloon-ok" role="status">{t('helpSent')}</p>
          ) : (
            <>
              {strategies?.length > 0 && (
                <label className="help-balloon-label">
                  {t('helpStrategy')}
                  <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)} disabled={isLoading}>
                    <option value="">{t('helpStrategyAny')}</option>
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="help-balloon-label">
                {t('helpMessage')}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('helpPh')}
                  rows={10}
                  maxLength={20000}
                  disabled={isLoading}
                  required
                />
              </label>
              {err && <p className="help-balloon-err" role="alert">{err}</p>}
              <button className="solid" type="submit" disabled={isLoading || message.trim().length < 8}>
                {isLoading ? t('working') : t('helpSend')}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}

function DeskHome() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const live = useSelector((s) => s.desk);
  const { data } = useDeskQuery(undefined, { pollingInterval: 5000 });
  const strategies = live.strategies.length ? live.strategies : (data?.strategies || []);
  const mare = live.mare || data?.mare;
  const connection = live.connection || data?.connection;
  const [exitMode, setExitMode] = useState('history');
  const [stopPct, setStopPct] = useState('1.2');
  const [tpPct, setTpPct] = useState('1.8');
  const [timeExit, setTimeExit] = useState(false);
  const [timeMode, setTimeMode] = useState('history');
  const [holdMin, setHoldMin] = useState('60');
  const [variants, setVariants] = useState(false);
  const [wallet, setWallet] = useState('1000');
  const [mareMode, setMareMode] = useState('any');
  const [prompt, setPrompt] = useState('');
  const [compose, setCompose] = useState('guide');
  const [threadId, setThreadId] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [steps, setSteps] = useState(null);
  const dispatch = useDispatch();
  const [sendPrompt, { isLoading }] = usePromptMutation();
  const [pause] = usePauseMutation();
  const [resume] = useResumeMutation();
  const [reset] = useResetMutation();
  const [remove] = useRemoveMutation();
  const [restore, { isLoading: restoring }] = useRestoreMutation();
  const [patchStrategy] = usePatchStrategyMutation();
  const [restoreMsg, setRestoreMsg] = useState('');
  const ask = useConfirm();
  const job = useJobQuery(jobId, { skip: !jobId, pollingInterval: jobId ? 700 : 0 });

  useEffect(() => {
    const status = job.data?.job?.status;
    if (!status || status === 'queued' || status === 'running') return;
    if (status === 'needs_user') {
      const questions = questionsOf(job.data.job.output);
      setSteps(questions.length ? { id: job.data.job.id, questions } : null);
      setNote(questions.length ? '' : (job.data.job.output?.ask || ''));
      setThreadId(job.data.job.thread_id || threadId);
    } else if (status === 'failed') setErr(cleanJobError(job.data.job.error, t));
    else {
      const made = t('ready', { name: job.data.job.output?.name || '' });
      const filled = (job.data.job.output?.defaults || []).map((item) => `${item.label}: ${item.value}`).join(' · ');
      setNote(filled ? `${made} ${filled}` : made);
      setSteps(null);
      setPrompt('');
      setThreadId(null);
      dispatch(api.util.invalidateTags(['Desk', 'Strategies']));
    }
    setJobId(null);
  }, [job.data]);

  async function sendText(text) {
    setErr('');
    setSteps(null);
    const walletN = Number(wallet);
    if (!(walletN >= 100 && walletN <= 999000)) {
      setErr(t('walletBad'));
      return;
    }
    const guided = compose === 'guide';
    try {
      const res = await sendPrompt({
        prompt: text,
        threadId,
        mode: 'trade',
        options: {
          exit: exitMode,
          stopPct: Number(stopPct),
          tpPct: Number(tpPct),
          timeExit,
          time: timeMode,
          maxHoldMin: Number(holdMin),
          variants: variants && !guided,
          mareMode,
          wallet: walletN,
          guided,
        },
      }).unwrap();
      setThreadId(res.threadId);
      setJobId(res.jobId);
    } catch (error) { setErr(errText(error, t)); }
  }

  function submit(e) {
    e.preventDefault();
    if (compose === 'guide') return;
    sendText(prompt);
  }

  async function onRestore() {
    setRestoreMsg('');
    setErr('');
    try {
      await restore().unwrap();
      try {
        const state = await dispatch(api.endpoints.desk.initiate(undefined, { subscribe: false, forceRefetch: true })).unwrap();
        dispatch(ingest({ type: 'snapshot', ...state }));
      } catch { /* a invalidação da query ainda atualiza a lista */ }
      setRestoreMsg(t('restoreDone'));
    } catch (error) {
      setErr(errText(error, t));
    }
  }

  return (
    <div className="wrap">
      <form className="panel composer-top" onSubmit={submit} aria-busy={isLoading || !!jobId}>
        <div className="modes">
          <button type="button" className={compose === 'guide' ? 'on' : ''} onClick={() => setCompose('guide')}>{t('guideSteps')}</button>
          <button type="button" className={compose === 'paste' ? 'on' : ''} onClick={() => setCompose('paste')}>{t('guidePaste')}</button>
        </div>
        {compose === 'guide'
          ? <Guide busy={isLoading || !!jobId} onCreate={sendText} />
          : <DeskArea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('promptPhTrade')} disabled={isLoading || !!jobId} />}
        <div className="wallet-row">
          <label>{t('wallet')}
            <input inputMode="decimal" min="100" max="999000" value={wallet} onChange={(e) => setWallet(e.target.value)} disabled={isLoading || !!jobId} />
          </label>
          <small>{t('walletHint')}</small>
        </div>
        {compose !== 'guide' && <>
          <fieldset className="choice" disabled={isLoading || !!jobId}>
            <legend>{t('optExit')}</legend>
            <label className={exitMode === 'history' ? 'on' : ''}>
              <input type="radio" name="exitPick" checked={exitMode === 'history'} onChange={() => setExitMode('history')} />
              <span>{t('exitHist')}</span>
            </label>
            <label className={exitMode === 'manual' ? 'on' : ''}>
              <input type="radio" name="exitPick" checked={exitMode === 'manual'} onChange={() => setExitMode('manual')} />
              <span>{t('exitManual')}</span>
            </label>
            {exitMode === 'manual' && (
              <div className="choice-fields">
                <label>{t('stopPct')}<input inputMode="decimal" value={stopPct} onChange={(e) => setStopPct(e.target.value)} /></label>
                <label>{t('tpPct')}<input inputMode="decimal" value={tpPct} onChange={(e) => setTpPct(e.target.value)} /></label>
              </div>
            )}
          </fieldset>
          <fieldset className="choice" disabled={isLoading || !!jobId}>
            <legend>{t('optTime')}</legend>
            <label className={timeExit ? 'on' : ''}>
              <input type="checkbox" checked={timeExit} onChange={(e) => setTimeExit(e.target.checked)} />
              <span>{t('timeExit')}</span>
            </label>
            {timeExit && (
              <>
                <label className={timeMode === 'history' ? 'on' : ''}>
                  <input type="radio" name="timePick" checked={timeMode === 'history'} onChange={() => setTimeMode('history')} />
                  <span>{t('timeHist')}</span>
                </label>
                <label className={timeMode === 'manual' ? 'on' : ''}>
                  <input type="radio" name="timePick" checked={timeMode === 'manual'} onChange={() => setTimeMode('manual')} />
                  <span>{t('timeManual')}</span>
                </label>
                {timeMode === 'manual' && (
                  <div className="choice-fields">
                    <label>{t('holdMin')}<input inputMode="numeric" value={holdMin} onChange={(e) => setHoldMin(e.target.value)} /></label>
                  </div>
                )}
              </>
            )}
          </fieldset>
        </>}
        <div className="segment" role="radiogroup" aria-label={t('marePick')}>
          <span className="segment-label">{t('marePick')} <Tip text={t('mareTip')} /></span>
          <div className="segment-track">
            {[['any', 'mareAny'], ['good', 'mareGood'], ['not_bad', 'mareNotBad']].map(([id, key]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={mareMode === id}
                className={mareMode === id ? 'on' : ''}
                disabled={isLoading || !!jobId}
                onClick={() => setMareMode(id)}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>
        {compose === 'paste' && (
          <fieldset className="choice" disabled={isLoading || !!jobId}>
            <legend>{t('optVar')} <Tip text={t('varTip')} /></legend>
            <label className={variants ? 'on' : ''}>
              <input type="checkbox" checked={variants} onChange={(e) => setVariants(e.target.checked)} />
              <span>{t('variants')}</span>
            </label>
          </fieldset>
        )}
        {steps && (
          <AskSteps
            key={steps.id}
            questions={steps.questions}
            busy={isLoading || !!jobId}
            onDone={(answer) => {
              setPrompt(answer);
              setSteps(null);
              setErr('');
              sendPrompt({
                prompt: answer,
                threadId,
                mode: 'trade',
                options: {
                  exit: exitMode,
                  stopPct: Number(stopPct),
                  tpPct: Number(tpPct),
                  timeExit,
                  time: timeMode,
                  maxHoldMin: Number(holdMin),
                  variants,
                  mareMode,
                  wallet: Number(wallet),
                },
              }).unwrap().then((res) => {
                setThreadId(res.threadId);
                setJobId(res.jobId);
                setNote('');
              }).catch((error) => setErr(errText(error, t)));
            }}
          />
        )}
        <PromptStatus busy={isLoading || !!jobId} status={job.data?.job?.status} note={note} err={err} detail={compose !== 'guide' && (exitMode === 'history' || (timeExit && timeMode === 'history')) ? t('workingHist') : ''} />
        {compose !== 'guide' && <button className="solid" disabled={isLoading || !!jobId || !prompt.trim()} type="submit">{(isLoading || jobId) ? t('working') : t('send')}</button>}
      </form>
      <div className="mare">
        <span className={`pill ${mare?.label || ''}`}>{mare ? `${mare.label} · ${mare.upPct}% · ${mare.windowMin} min` : '…'} <Tip text={t('mareTip')} /></span>
        <span className={`conn ${connection === 'live' ? 'live' : 'down'}`}><i />{t('connection')}: {connection || 'connecting'}</span>
        <span className="muted">{(live.prices.length ? live.prices : data?.prices || []).slice(0, 4).map((p) => `${p.symbol.replace('USDT', '')} ${p.price}`).join(' · ')}</span>
      </div>
      <div className="strategies" style={{ marginTop: 14 }}>
        {strategies.map((s) => (
          <article className="strategy" key={s.id}>
            <header>
              <div>
                <p className="kind">{s.type === 'recipe' ? t('recipe') : t('preset')}</p>
                <h3><Link className="name" to={`/${lng}/app/strategies/${s.id}`}>{s.name}</Link></h3>
              </div>
              <Link className="open" to={`/${lng}/app/strategies/${s.id}`}>{t('open')}</Link>
            </header>
            <div className="kpi">
              <span>{t('equity')} <b>{money(s.equity)}</b></span>
              <span className={s.pnl > 0 ? 'up' : s.pnl < 0 ? 'down' : ''}>{t('pnl')} <b>{money(s.pnl)}</b></span>
              <span>{t('trades')} <b>{s.nTrades}</b></span>
              <span>{t('wr')} <b>{Math.round((s.winRate || 0) * 100)}%</b></span>
            </div>
            <div className="state-line">
              {s.halted && <span className="pill RUIM">{t('halt')}</span>}
              {s.paused && <span className="pill">{t('paused')}</span>}
              {s.position ? <span className="up">{s.position.symbol} @ {px(s.position.entry)}</span> : <span className="muted">{t('flat')}</span>}
            </div>
            <label className="mare-pick">{t('marePick')}
              <select value={s.mareMode || 'any'} onChange={(e) => patchStrategy({ id: s.id, mareMode: e.target.value })}>
                <option value="any">{t('mareAny')}</option>
                <option value="good">{t('mareGood')}</option>
                <option value="not_bad">{t('mareNotBad')}</option>
              </select>
            </label>
            <div className="actions">
              <Link className="tiny prod" to={`/${lng}/app/strategies/${s.id}/producao`}><IconPlay />{t('toProd')}</Link>
              {s.paused
                ? <button className="tiny" type="button" onClick={() => resume(s.id)}><IconPlay />{t('resume')}</button>
                : <button className="tiny" type="button" onClick={() => pause(s.id)}><IconPause />{t('pause')}</button>}
              <button className="tiny" type="button" onClick={async () => {
                const ok = await ask({ title: t('reset'), body: t('resetAsk'), confirmLabel: t('reset'), cancelLabel: t('dialogBack'), tone: 'danger', icon: 'reset' });
                if (ok) reset(s.id);
              }}><IconTrash />{t('reset')}</button>
              <button className="tiny danger" type="button" onClick={async () => {
                const ok = await ask({ title: t('remove'), body: t('removeAsk'), confirmLabel: t('remove'), cancelLabel: t('dialogBack'), tone: 'danger', icon: 'trash' });
                if (ok) remove(s.id);
              }}><IconX />{t('remove')}</button>
            </div>
          </article>
        ))}
      </div>
      <div className="restore-row">
        <button className="ghost" type="button" disabled={restoring} onClick={onRestore}>{restoring ? '…' : t('restore')}</button>
        {restoreMsg && <span className="restore-note">{restoreMsg}</span>}
      </div>
      <StrategyHelpBalloon strategies={strategies} />
    </div>
  );
}

function StrategyPage() {
  const { t } = useTranslation();
  const { lng, id } = useParams();
  const { data, refetch } = useStrategyQuery(id);
  const live = useSelector((s) => s.desk.strategies.find((s) => s.id === id));
  const scan = useSelector((s) => s.desk.scan[id]);
  const [prompt, setPrompt] = useState('');
  const [jobId, setJobId] = useState(null);
  const [err, setErr] = useState('');
  const [steps, setSteps] = useState(null);
  const [edit] = useEditPromptMutation();
  const job = useJobQuery(jobId, { skip: !jobId, pollingInterval: jobId ? 700 : 0 });
  useEffect(() => { focusStrategy(id); }, [id]);
  useEffect(() => {
    const status = job.data?.job?.status;
    if (!status || status === 'queued' || status === 'running') return;
    setJobId(null);
    if (status === 'failed') setErr(cleanJobError(job.data.job.error, t));
    else if (status === 'needs_user') {
      const questions = questionsOf(job.data.job.output);
      setSteps(questions.length ? { id: job.data.job.id, questions } : null);
      setErr(questions.length ? '' : (job.data.job.output?.ask || ''));
    } else { setPrompt(''); setSteps(null); refetch(); }
  }, [job.data]);
  const ex = data?.strategy?.explanation;
  const running = data?.strategy?.recipe?.plan?.kind === 'js' ? data.strategy.recipe.code : '';
  const assumed = data?.strategy?.recipe?.defaults || [];
  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      const res = await edit({ id, prompt, threadId: data?.threadId }).unwrap();
      setJobId(res.jobId);
    } catch (error) { setErr(errText(error, t)); }
  }
  return (
    <div className="wrap">
      <Link to={`/${lng}/app`}>{t('back')}</Link>
      <div className="row">
        <h2>{data?.strategy?.name}</h2>
        <Link className="solid" to={`/${lng}/app/strategies/${id}/producao`}>{t('toProd')}</Link>
      </div>
      <article className="panel composer-top" style={{ marginTop: 12 }}>
        <h3>{t('thread')}</h3>
        <div className="thread">
          {(data?.messages || []).map((m) => <div key={m.id} className={`bubble ${m.role}`}>{m.content}</div>)}
        </div>
        <form onSubmit={submit} aria-busy={!!jobId}>
          <DeskArea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('replyPh')} disabled={!!jobId} />
          {steps && (
            <AskSteps
              key={steps.id}
              questions={steps.questions}
              busy={!!jobId}
              onDone={(answer) => {
                setSteps(null);
                setErr('');
                edit({ id, prompt: answer, threadId: data?.threadId }).unwrap()
                  .then((res) => setJobId(res.jobId))
                  .catch((error) => setErr(errText(error, t)));
              }}
            />
          )}
          <PromptStatus busy={!!jobId} status={job.data?.job?.status} err={err} />
          <button className="solid" type="submit" disabled={!!jobId || !prompt.trim()}>{(jobId) ? t('working') : t('send')}</button>
        </form>
      </article>
      {live?.position && (
        <p className="up">{t('inPos')}: {live.position.symbol} · {t('thEntry')} {live.position.entry}{live.position.stop > 0 ? ` · ${t('resStop')} ${Number(live.position.stop).toPrecision(6)}` : ''}{live.position.tp > 0 ? ` · ${t('resTarget')} ${Number(live.position.tp).toPrecision(6)}` : ''} · uPnL {money(live.position.upnl)}</p>
      )}
      {running && (
        <article className="panel" style={{ marginTop: 12 }}>
          <h3>{t('runningCode')}</h3>
          <pre className="strategy-code">{running}</pre>
          {assumed.length > 0 && <p className="assumed">{t('assumed')} {assumed.map((item) => `${item.label}: ${item.value}`).join(' · ')}</p>}
        </article>
      )}
      {ex && (
        <div className="split explain-grid">
          <article className="panel explain">
            <h3>{t('thesis')}</h3><p>{ex.thesis}</p>
            <h3>{t('entry')}</h3><p>{ex.entry}</p>
            <h3>{t('exit')}</h3><p>{ex.exit}</p>
          </article>
          <article className="panel explain">
            <h3>{t('filters')}</h3><p>{ex.filters}</p>
            <h3>{t('risks')}</h3><p>{ex.risks}</p>
          </article>
        </div>
      )}
      <article className="panel" style={{ marginTop: 12 }}>
        <h3>{t('scan')}</h3>
        {(scan?.rows || []).length ? (
          <table className="scan">
            <tbody>
              {scan.rows.map((row) => (
                <tr key={row.symbol}>
                  <td>{row.symbol}</td>
                  <td>{row.passed}/{row.total}</td>
                  <td className="muted">{(row.checks || []).map((c) => c.detail).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <svg viewBox="0 0 48 48" width="42" height="42" aria-hidden="true">
              <circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M24 15v10l6 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p>{t('scanEmpty')}</p>
          </div>
        )}
      </article>
      <article className="panel" style={{ marginTop: 12 }}>
        <h3>{t('trades')}</h3>
        <TradeBook trades={data?.trades || []} position={live?.position} />
      </article>
    </div>
  );
}

function LabLegacyRedirect() {
  const { lng } = useParams();
  return <Navigate to={`/${lng}/app/laboratorio`} replace />;
}

function statusLabel(user, t) {
  if (!user) return '';
  if (user.desk === 'pro') return t('statusPro');
  if (user.desk === 'paper') return t('statusPaper');
  if (user.desk === 'trial' || user.desk === 'active') return t('statusTrial');
  if (user.desk === 'expired') return t('statusExpired');
  return user.desk;
}

function PlanPicker({ showBody = true }) {
  const { t } = useTranslation();
  const { lng } = useParams();
  const { data } = usePlansQuery();
  const terms = data?.terms || [
    { months: 1, off: 0, paper: { total: 93.33, monthly: 93.33 }, pro: { total: 139.99, monthly: 139.99 } },
    { months: 3, off: 0.1, paper: { total: 251.99, monthly: 84 }, pro: { total: 377.97, monthly: 125.99 } },
    { months: 6, off: 0.18, paper: { total: 459.18, monthly: 76.53 }, pro: { total: 688.75, monthly: 114.79 } },
    { months: 12, off: 0.28, paper: { total: 806.37, monthly: 67.2 }, pro: { total: 1209.51, monthly: 100.79 } },
  ];
  return (
    <div className="plan-board single">
      {['paper'].map((tier) => (
        <article key={tier} className={tier}>
          <h3>{t('planPaper')}</h3>
          {showBody && <p>{t('planPaperBody')}</p>}
          {terms.map((term) => {
            const quote = term.paper;
            const label = term.months === 12 ? t('termYear') : term.months === 1 ? t('termMonth') : t('termMonths', { n: term.months });
            return (
              <Link key={term.months} className="term" to={`/${lng}/app/checkout?tier=${tier}&months=${term.months}`}>
                <strong>{label}</strong>
                <span>{localMoney(lng, quote.monthly)} {t('perMonth')}</span>
                <b>{localMoney(lng, quote.total)}</b>
                {term.off > 0 && <em>{t('offLabel', { off: Math.round(term.off * 100) })}</em>}
              </Link>
            );
          })}
        </article>
      ))}
    </div>
  );
}

function Account() {
  useLang();
  const { t } = useTranslation();
  const ask = useConfirm();
  const { data } = useMeQuery();
  const user = data?.user;
  const [patch, { isLoading }] = usePatchMeMutation();
  const [remove] = useDeleteMeMutation();
  const [cancelPlan, { isLoading: canceling }] = useCancelPlanMutation();
  const dispatch = useDispatch();
  const { lng } = useParams();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState('');
  const [cancelErr, setCancelErr] = useState('');
  useEffect(() => {
    if (!user || ready) return;
    setName(user.name || '');
    setReady(true);
  }, [user, ready]);
  if (!ready) return <div className="wrap">…</div>;
  async function save(e) {
    e.preventDefault();
    const res = await patch({ name, locale: lng }).unwrap();
    dispatch(setSession({ token: store.getState().auth.token, user: res.user }));
    setMsg(t('save'));
  }
  const ends = user?.accessEndsAt || user?.trialEndsAt;
  const cancelPending = user?.refundStatus === 'pending';
  const paidOpen = user?.planStatus === 'active' && (user?.desk === 'paper' || user?.desk === 'pro');
  async function requestCancel() {
    const ok = await ask({ title: t('cancelTitle'), body: t('cancelConfirm'), confirmLabel: t('cancelCta'), cancelLabel: t('dialogBack'), tone: 'danger', icon: 'alert' });
    if (!ok) return;
    setCancelErr('');
    try {
      const res = await cancelPlan().unwrap();
      dispatch(setSession({ token: store.getState().auth.token, user: res.user }));
    } catch (error) {
      setCancelErr(errText(error, t));
    }
  }
  return (
    <div className="wrap account-page">
      <h2>{t('account')}</h2>
      <p>{user?.email}</p>
      <p className="plan-chip">{statusLabel(user, t)} · {t('accessUntil')} {ends ? new Date(ends).toLocaleString() : '—'} · {user?.daysLeft === 1 ? t('dayLeft') : t('daysLeft', { n: user?.daysLeft || 0 })}</p>
      {user?.expiring && <div className="warn">{t('expiring', { n: user.daysLeft })}</div>}
      {user?.desk === 'expired' && !cancelPending && <div className="error">{t('expired')}</div>}
      <form className="panel" onSubmit={save}>
        <label>{t('name')}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <div className="row"><button className="solid" disabled={isLoading} type="submit">{t('save')}</button></div>
        {msg && <p>{msg}</p>}
      </form>
      <article className="panel" style={{ marginTop: 12 }}>
        <h3>{t('pay')}</h3>
        <p>{t('payOff')}</p>
        <p className="muted">{t('paySim')}</p>
        <PlanPicker />
      </article>
      <article className="panel" style={{ marginTop: 12 }}>
        <h3>{t('cancelTitle')}</h3>
        <p>{t('cancelPolicy')}</p>
        {cancelPending ? <p className="ok">{t('cancelRequested')}</p> : paidOpen ? (
          <button className="danger" type="button" disabled={canceling} onClick={requestCancel}>
            {canceling ? t('canceling') : t('cancelCta')}
          </button>
        ) : (
          <p className="muted">{t('cancelOnlyPaid')}</p>
        )}
        {cancelErr && <div className="error">{cancelErr}</div>}
      </article>
      <div className="row">
        <button className="danger" type="button" onClick={async () => {
          const ok = await ask({ title: t('delete'), body: t('deleteAsk'), confirmLabel: t('delete'), cancelLabel: t('dialogBack'), tone: 'danger', icon: 'trash' });
          if (!ok) return;
          await remove();
          dispatch(clearSession());
          nav(`/${lng}`);
        }}>{t('delete')}</button>
      </div>
    </div>
  );
}

function Checkout() {
  useLang();
  const { t } = useTranslation();
  const { lng } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const dispatch = useDispatch();
  const tier = 'paper';
  const months = [1, 3, 6, 12].includes(Number(params.get('months'))) ? Number(params.get('months')) : 1;
  const { data } = usePlansQuery();
  const [pay, { isLoading }] = useCheckoutMutation();
  const [card, setCard] = useState({ name: '', number: '', exp: '', cvc: '' });
  const [err, setErr] = useState('');
  const quote = data?.terms?.find((term) => term.months === months)?.[tier];
  const set = (key) => (e) => setCard({ ...card, [key]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setErr('');
    const digits = card.number.replace(/\D/g, '');
    if (card.name.trim().length < 2 || digits.length < 13 || !/^\d{2}\/\d{2}$/.test(card.exp) || card.cvc.replace(/\D/g, '').length < 3) {
      setErr(t('cardHint'));
      return;
    }
    try {
      const res = await pay({ tier, months }).unwrap();
      dispatch(setSession({ token: store.getState().auth.token, user: res.user }));
      nav(`/${lng}/app/account`, { state: { paid: true } });
    } catch (error) { setErr(errText(error, t)); }
  }
  const label = months === 12 ? t('termYear') : months === 1 ? t('termMonth') : t('termMonths', { n: months });
  return (
    <div className="wrap" style={{ maxWidth: 560 }}>
      <h2 style={{ fontFamily: 'Fraunces, serif' }}>{t('checkoutT')}</h2>
      <p className="warn">{t('paySim')}</p>
      <p>{t('cancelPolicy')}</p>
      <p>{tier === 'pro' ? t('planPro') : t('planPaper')} · {label}</p>
      {quote && <p className="price-num">{localMoney(lng, quote.total)}</p>}
      <form className="panel" onSubmit={submit}>
        {err && <div className="error">{err}</div>}
        <label>{t('cardName')}</label>
        <input required autoComplete="cc-name" value={card.name} onChange={set('name')} />
        <label>{t('cardNumber')}</label>
        <input required inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={card.number} onChange={set('number')} />
        <div className="row">
          <label>{t('cardExp')}<input required autoComplete="cc-exp" placeholder="12/28" value={card.exp} onChange={set('exp')} /></label>
          <label>{t('cardCvc')}<input required inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={card.cvc} onChange={set('cvc')} /></label>
        </div>
        <p className="muted">{t('cardHint')}</p>
        <button className="solid" disabled={isLoading} type="submit">{t('payActivate')}</button>
      </form>
    </div>
  );
}

function StrategyProduction() {
  useLang();
  const { t } = useTranslation();
  const { lng, id } = useParams();
  const prod = useStrategyProductionQuery({ id, locale: lng });
  const [buy, { isLoading }] = useBuyProductionMutation();
  const [card, setCard] = useState({ name: '', number: '', exp: '', cvc: '' });
  const [err, setErr] = useState('');
  const [ip, setIp] = useState('');
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then((res) => res.json())
      .then((body) => setIp(body.ip || ''))
      .catch(() => setIp(''));
  }, []);
  const quote = prod.data?.quote;
  const order = prod.data?.order;
  const shown = quote
    ? new Intl.NumberFormat(PRICE_FX[lng]?.locale || 'en-US', { style: 'currency', currency: quote.currency }).format(quote.localAmount)
    : '';
  const set = (key) => (e) => setCard({ ...card, [key]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setErr('');
    const digits = card.number.replace(/\D/g, '');
    if (card.name.trim().length < 2 || digits.length < 13 || !/^\d{2}\/\d{2}$/.test(card.exp) || card.cvc.replace(/\D/g, '').length < 3) {
      setErr(t('cardHint'));
      return;
    }
    try { await buy({ id, locale: lng }).unwrap(); }
    catch (error) { setErr(errText(error, t)); }
  }
  return (
    <div className="wrap production">
      <Link to={`/${lng}/app/strategies/${id}`}>{prod.data?.strategy?.name || t('back')}</Link>
      <h2 style={{ fontFamily: 'Fraunces, serif' }}>{t('prodPageT')}</h2>
      <article className="panel warn-panel">
        <p>{t('prodAvg')}</p>
        <p>{t('prodHand')}</p>
        <p>{t('prodDeliver')}</p>
        <p>{t('prodYours')}</p>
        <p>{t('prodAhead')}</p>
      </article>
      {order ? (
        <p className="ok">{t('prodPaid')} · {new Date(order.readyBy).toLocaleDateString()}</p>
      ) : (
        <form className="panel" onSubmit={submit}>
          <p className="price-num">{shown}</p>
          {lng !== 'pt-BR' && <p className="muted">{t('prodEq', { brl: brlMoney(633.3) })}</p>}
          <p className="muted">{t('prodPay')}</p>
          {err && <div className="error">{err}</div>}
          <label>{t('cardName')}</label>
          <input required autoComplete="cc-name" value={card.name} onChange={set('name')} />
          <label>{t('cardNumber')}</label>
          <input required inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={card.number} onChange={set('number')} />
          <div className="row">
            <label>{t('cardExp')}<input required autoComplete="cc-exp" placeholder="12/28" value={card.exp} onChange={set('exp')} /></label>
            <label>{t('cardCvc')}<input required inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={card.cvc} onChange={set('cvc')} /></label>
          </div>
          <button className="solid" disabled={isLoading || !quote} type="submit">{t('buyProd')} · {shown}</button>
        </form>
      )}
      <section className="prep">
        <h2>{t('prodPrepare')}</h2>
        <article className="panel">
          <h3>{t('prodIpT')}</h3>
          <p>{t('prodIp')}</p>
          <p className="ip">{t('prodYourIp')}: <b>{ip || t('prodIpFail')}</b></p>
        </article>
        <article className="panel">
          <h3>{t('prodSafeT')}</h3>
          <p>{t('prodSafe')}</p>
        </article>
        <article className="panel">
          <h3>{t('prodStepsT')}</h3>
          <ol>
            {['prodS1', 'prodS2', 'prodS3', 'prodS4', 'prodS5'].map((key) => <li key={key}>{t(key)}</li>)}
          </ol>
          <p><a href="https://www.binance.com/pt/support/faq/how-to-create-api-keys-on-binance-360002502072" target="_blank" rel="noreferrer">{t('prodFaq')}</a></p>
        </article>
        <div className="binance-shots">
          <figure>
            <img src="/binance/api-create.svg" alt={t('prodS1')} />
            <figcaption>{t('prodS1')}</figcaption>
          </figure>
          <figure>
            <img src="/binance/api-permissions.svg" alt={t('prodS3')} />
            <figcaption>{t('prodS3')}</figcaption>
          </figure>
          <figure>
            <img src="/binance/api-ip.svg" alt={t('prodS4')} />
            <figcaption>{t('prodS4')}</figcaption>
          </figure>
        </div>
      </section>
    </div>
  );
}

const PRICE_FX = {
  'pt-BR': { currency: 'BRL', rate: 1, locale: 'pt-BR' },
  en: { currency: 'USD', rate: 0.19723, locale: 'en-US' },
  es: { currency: 'EUR', rate: 0.1756, locale: 'es-ES' },
  'es-MX': { currency: 'MXN', rate: 3.65, locale: 'es-MX' },
  fr: { currency: 'EUR', rate: 0.1756, locale: 'fr-FR' },
  de: { currency: 'EUR', rate: 0.1756, locale: 'de-DE' },
  ja: { currency: 'JPY', rate: 31.175, locale: 'ja-JP' },
};

function localMoney(lng, brl) {
  const fx = PRICE_FX[lng] || PRICE_FX.en;
  const value = fx.currency === 'JPY' ? Math.round(brl * fx.rate) : Math.round(brl * fx.rate * 100) / 100;
  return new Intl.NumberFormat(fx.locale, { style: 'currency', currency: fx.currency }).format(value);
}

function brlMoney(brl) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(brl);
}

function foldText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function InfoIcon({ d }) {
  return (
    <svg className="info-ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const INFO_PATH = {
  pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  brain: 'M12 3l1.6 4.2L18 9l-4.4 1.8L12 15l-1.6-4.2L6 9l4.4-1.8L12 3ZM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z',
  chart: 'M4 19V5M4 19h16M8 16l3-4 3 2 4-6',
  wallet: 'M3 8h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm0 0V6a2 2 0 0 1 2-2h12M16 14h.01',
  wave: 'M2 14c2 0 2-4 4-4s2 4 4 4 2-4 4-4 2 4 4 4 2-4 4-4M2 18c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3',
  scale: 'M12 3v18M8 21h8M12 6l-6 7h6l-6 0M12 6l6 7h-6M6 13a3 3 0 0 0 6 0M12 13a3 3 0 0 0 6 0',
  tape: 'M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21V3ZM9 8h6M9 12h6M9 16h4',
  link: 'M8 12a4 4 0 0 1 4-4h2M16 12a4 4 0 0 1-4 4h-2M9 12h6',
  list: 'M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01',
  risk: 'M12 3 4 7v6c0 5 3.4 7.6 8 9 4.6-1.4 8-4 8-9V7l-8-4Z',
  fee: 'M12 3v18M16 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H8',
  halt: 'M12 8v5M12 17h.01M10.3 4.8 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0Z',
  bell: 'M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9M10 20a2 2 0 0 0 4 0',
  chip: 'M7 7h10v10H7V7ZM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
};

function Info() {
  useLang();
  const { t } = useTranslation();
  const { data } = useDeskQuery(undefined, { pollingInterval: 15000 });
  const n = (data?.prices || []).length;
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('como');
  const [opened, setOpened] = useState({});
  const needle = foldText(query.trim());
  const steps = [
    ['pen', 'infoS1t', 'infoS1'],
    ['brain', 'infoS2t', 'infoS2'],
    ['chart', 'infoS3t', 'infoS3'],
    ['wallet', 'infoS4t', 'infoS4'],
  ];
  const openCards = [
    ['mare', 'wave', 'infoMare'],
    ['livro', 'scale', 'infoBook'],
    ['tape', 'tape', 'infoTape'],
    ['conexao', 'link', 'infoConn'],
  ];
  const drawers = [
    ['carteira', 'wallet', 'infoEquity'],
    ['pnl', 'chart', 'infoPnl'],
    ['trades', 'list', 'infoTrades'],
    ['risco', 'risk', 'infoRisk'],
    ['taxa', 'fee', 'infoFee'],
    ['trava', 'halt', 'infoHalt'],
    ['alarme', 'bell', 'infoAlarm'],
    ['pro', 'chip', 'infoPro'],
  ];
  const toc = [
    ['como', 'infoTocHow'],
    ['pares', 'infoTocPairs'],
    ...openCards.map(([id, , key]) => [id, `${key}T`]),
    ...drawers.map(([id, , key]) => [id, `${key}T`]),
  ];
  const blobs = useMemo(() => {
    const bag = {
      como: ['infoT', 'infoL', 'infoHowT', 'infoHow', ...steps.flatMap(([, title, body]) => [title, body])],
      pares: ['infoUniT', 'infoUni', 'infoInT', 'infoOutT', 'infoIn1', 'infoIn2', 'infoIn3', 'infoIn4', 'infoOut1', 'infoOut2', 'infoOut3', 'infoOut4', 'infoOut5', 'infoOut6'],
    };
    [...openCards, ...drawers].forEach(([id, , key]) => { bag[id] = [`${key}T`, key]; });
    return Object.fromEntries(Object.entries(bag).map(([id, keys]) => [id, foldText(keys.map((key) => t(key)).join(' '))]));
  }, [t]);
  const show = (id) => !needle || (blobs[id] || '').includes(needle);
  const any = toc.some(([id]) => show(id));

  useEffect(() => {
    const mark = () => {
      const line = 120;
      let current = '';
      for (const [id] of toc) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = id;
      }
      if (current) setActive(current);
    };
    mark();
    window.addEventListener('scroll', mark, { passive: true });
    return () => window.removeEventListener('scroll', mark);
  }, [needle]);

  useEffect(() => {
    if (needle.length < 2) return undefined;
    const hit = toc.find(([id]) => show(id));
    if (!hit) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      document.getElementById(hit[0])?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [needle]);

  function jump(id) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setActive(id);
  }

  function Top() {
    return <button className="info-top" type="button" onClick={scrollPageTop}>{t('infoTop')}</button>;
  }

  return (
    <div className="wrap info-wiki">
      <nav className="info-toc" aria-label={t('infoNav')}>
        {toc.map(([id, key]) => (
          <a key={id} href={`#${id}`} className={!show(id) ? 'off' : active === id ? 'on' : ''} onClick={(event) => { event.preventDefault(); if (show(id)) jump(id); }}>{t(key)}</a>
        ))}
      </nav>
      <div className="info-doc">
        <label className="info-search">
          <span>{t('infoSearch')}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('infoSearchPh')} />
        </label>
        {!any && <p className="info-empty">{t('infoSearchEmpty')}</p>}
        {show('como') && (
          <section id="como">
            <p className="kicker">{t('infoNav')}</p>
            <h2>{t('infoT')}</h2>
            <p className="info-lead">{t('infoL')}</p>
            <div className="info-flow">
              {steps.map(([icon, title, body], index) => (
                <article key={title}>
                  <InfoIcon d={INFO_PATH[icon]} />
                  <span>0{index + 1}</span>
                  <h3>{t(title)}</h3>
                  <p>{t(body)}</p>
                </article>
              ))}
            </div>
            <div className="info-chart">
              <CandleChart title={t('chartEma')} bars={EMA_BARS} mark={8} />
              <article className="info-card">
                <h3>{t('infoHowT')}</h3>
                <p>{t('infoHow')}</p>
              </article>
            </div>
            <Top />
          </section>
        )}
        {show('pares') && (
          <section id="pares">
            <h2>{t('infoUniT')}</h2>
            <p>{t('infoUni')}</p>
            {n > 0 && <p className="info-now">{t('infoUniNow', { n })}</p>}
            <div className="info-cols">
              <article className="info-card">
                <h3><InfoIcon d="M5 12.5 9.2 17 19 7" />{t('infoInT')}</h3>
                <ul className="info-list in">
                  {['infoIn1', 'infoIn2', 'infoIn3', 'infoIn4'].map((key) => <li key={key}>{t(key)}</li>)}
                </ul>
              </article>
              <article className="info-card">
                <h3><InfoIcon d="M6 6l12 12M18 6 6 18" />{t('infoOutT')}</h3>
                <ul className="info-list out">
                  {['infoOut1', 'infoOut2', 'infoOut3', 'infoOut4', 'infoOut5', 'infoOut6'].map((key) => <li key={key}>{t(key)}</li>)}
                </ul>
              </article>
            </div>
            <Top />
          </section>
        )}
        {openCards.map(([id, icon, key]) => show(id) && (
          <section id={id} key={id}>
            <article className="info-card info-meter">
              <div className={`info-mock ${id}`} aria-hidden="true"><InfoIcon d={INFO_PATH[icon]} /></div>
              <div>
                <h2>{t(`${key}T`)}</h2>
                <p>{t(key)}</p>
                <Top />
              </div>
            </article>
          </section>
        ))}
        {drawers.map(([id, icon, key]) => {
          if (!show(id)) return null;
          const expanded = !!needle || !!opened[id];
          return (
            <section id={id} key={id} className="info-fold">
              <button type="button" aria-expanded={expanded} onClick={() => setOpened((prev) => ({ ...prev, [id]: !prev[id] }))}>
                <InfoIcon d={INFO_PATH[icon]} />
                <span>{t(`${key}T`)}</span>
                <i className={expanded ? 'open' : ''} />
              </button>
              {expanded && (
                <>
                  <p>{t(key)}</p>
                  <Top />
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PricesBody({ showCta = false }) {
  const { t } = useTranslation();
  const { lng } = useParams();
  const plans = [
    { key: 'paper', amount: 93.33, title: t('planPaper') },
  ];
  return (
    <section className="band prices">
      <p className="kicker">{t('pricesNav')}</p>
      <h1>{t('pricesT')}</h1>
      <div className="price-split">
        <p><strong>{t('planIncludedLead')}</strong> {t('planIncludedBody')}</p>
        <p><strong>{t('planOptionalLead')}</strong> {t('planOptionalBody')}</p>
        <p><strong>{t('cancelTitle')}</strong> {t('cancelPolicy')}</p>
      </div>
      <div className="price-grid">
        {plans.map((plan) => (
          <article key={plan.key} className={plan.key}>
            <h2>{plan.title}</h2>
            <LaunchPrice />
            <p className="price-num">{localMoney(lng, plan.amount)}</p>
            <p className="plan-anchor">{t('planAnchor')}</p>
            {lng !== 'pt-BR' && <p className="mono dim">{t('planTable')} · {brlMoney(plan.amount)}</p>}
          </article>
        ))}
      </div>
      <PlanPicker showBody={false} />
      <p className="mono dim">{t('planFx')}</p>
      {showCta && <Link className="solid free" to={`/${lng}/register`} aria-label={t('freeCta')}>{t('freeCta')}</Link>}
      <Faq />
      <TestimonialCard />
    </section>
  );
}

function Prices() {
  useLang();
  const { t } = useTranslation();
  const { lng } = useParams();
  return (
    <div className="landing">
      <header className="topbar">
        <Link className="brand" to={`/${lng}`}>SpotStrat</Link>
        <div className="spacer" />
        <Flags />
        <nav className="menu">
          <Link to={`/${lng}/info`}>{t('infoNav')}</Link>
          <Link to={`/${lng}/precos`}>{t('pricesNav')}</Link>
          <Link to={`/${lng}/login`}>{t('enter')}</Link>
          <Link className="solid" to={`/${lng}/register`}>{t('lCta')}</Link>
        </nav>
      </header>
      <PricesBody showCta />
      <SiteFooter />
    </div>
  );
}

function DeskPrices() {
  useLang();
  return (
    <div className="landing desk-prices">
      <PricesBody />
    </div>
  );
}

function PublicInfo() {
  useLang();
  const { t } = useTranslation();
  const { lng } = useParams();
  return (
    <div className="landing">
      <header className="topbar">
        <Link className="brand" to={`/${lng}`}>SpotStrat</Link>
        <div className="spacer" />
        <Flags />
        <nav className="menu">
          <Link to={`/${lng}/info`}>{t('infoNav')}</Link>
          <Link to={`/${lng}/precos`}>{t('pricesNav')}</Link>
          <Link to={`/${lng}/login`}>{t('enter')}</Link>
          <Link className="solid" to={`/${lng}/register`}>{t('lCta')}</Link>
        </nav>
      </header>
      <div className="desk public-info">
        <Info />
      </div>
      <SiteFooter />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    scrollPageTop();
  }, [pathname]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppErrorBoundary>
        <SessionBoot>
          <Routes>
            <Route path="/" element={<LangRedirect />} />
            <Route path="/:lng" element={<Guard><Landing /></Guard>} />
            <Route path="/:lng/precos" element={<Guard><Prices /></Guard>} />
            <Route path="/:lng/info" element={<Guard><PublicInfo /></Guard>} />
            <Route path="/:lng/privacy" element={<Guard><Legal page="privacy" /></Guard>} />
            <Route path="/:lng/terms" element={<Guard><Legal page="terms" /></Guard>} />
            <Route path="/:lng/termos" element={<Guard><Legal page="terms" /></Guard>} />
            <Route path="/:lng/cookies" element={<Guard><Legal page="cookies" /></Guard>} />
            <Route path="/:lng/login" element={<Guard><Login /></Guard>} />
            <Route path="/:lng/forgot-password" element={<Guard><ForgotPassword /></Guard>} />
            <Route path="/:lng/register" element={<Guard><Register /></Guard>} />
            <Route path="/:lng/verify" element={<Guard><Verify /></Guard>} />
            <Route path="/:lng/app" element={<Guard><RequireDesk><DeskHome /></RequireDesk></Guard>} />
            <Route path="/:lng/app/alarmes" element={<Guard><RequireDesk><AlarmsPage /></RequireDesk></Guard>} />
            <Route path="/:lng/app/precos" element={<Guard><RequireDesk><DeskPrices /></RequireDesk></Guard>} />
            <Route path="/:lng/app/strategies/:id" element={<Guard><RequireDesk><StrategyPage /></RequireDesk></Guard>} />
            <Route path="/:lng/app/strategies/:id/producao" element={<Guard><RequireDesk><StrategyProduction /></RequireDesk></Guard>} />
            <Route path="/:lng/app/laboratorio" element={<Guard><RequireDesk><LabPage /></RequireDesk></Guard>} />
            <Route path="/:lng/app/historico" element={<Guard><RequireDesk><LabLegacyRedirect /></RequireDesk></Guard>} />
            <Route path="/:lng/app/info" element={<Guard><RequireDesk><Info /></RequireDesk></Guard>} />
            <Route path="/:lng/app/account" element={<Guard><RequireDesk allowExpired><Account /></RequireDesk></Guard>} />
            <Route path="/:lng/app/checkout" element={<Guard><RequireDesk allowExpired><Checkout /></RequireDesk></Guard>} />
            <Route path="*" element={<LangRedirect />} />
          </Routes>
        </SessionBoot>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </Provider>
  </StrictMode>,
);
