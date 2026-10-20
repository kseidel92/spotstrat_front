import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createChart } from 'lightweight-charts';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import i18n, { LOCALES, detectLocale, setLocaleCookie } from './i18n';
import {
  store, api, connectStream, focusStrategy, setSession, clearSession, rememberOn,
  usePresetsQuery, useRegisterMutation, useLoginMutation, useGoogleMutation,
  useVerifyEmailMutation, useVerifyPhoneMutation, useResendMutation, useSetPhoneMutation,
  useLogoutMutation, useMeQuery, usePatchMeMutation, useDeleteMeMutation,
  useStrategiesQuery, useStrategyQuery, usePromptMutation, useEditPromptMutation,
  usePauseMutation, useResumeMutation, useResetMutation, useRemoveMutation, useRestoreMutation, usePatchStrategyMutation,
  useAlarmPauseMutation, useAlarmArmMutation, useAlarmRemoveMutation, useAlarmSeenMutation, useAlarmChannelsMutation,
  useDeskQuery, useJobQuery, useManifestQuery, useSymbolsQuery, useKlinesQuery,
  useArtifactsQuery, useLabQueryMutation, useCheckoutMutation, usePlansQuery, useStrategyProductionQuery, useBuyProductionMutation,
} from './store';
import './styles.css';

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
    const timer = setTimeout(() => { if (!cancel) setReady(true); }, 4000);
    fetch('/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remember: rememberOn() }),
    }).then(async (res) => {
      if (!res.ok) return null;
      return res.json();
    }).then((data) => {
      if (!cancel && data?.accessToken) dispatch(setSession({ token: data.accessToken, user: data.user, remember: rememberOn() }));
    }).catch(() => {}).finally(() => {
      clearTimeout(timer);
      if (!cancel) setReady(true);
    });
    return () => { cancel = true; clearTimeout(timer); };
  }, [dispatch, token]);
  if (!ready) return <p className="wrap">…</p>;
  return children;
}

function Guard({ children }) {
  const lng = useLang();
  if (!LOCALES.some((l) => l.id === lng)) return <Navigate to={`/${detectLocale()}`} replace />;
  return children;
}

function errText(error, t) {
  const code = error?.data?.error;
  const map = {
    email_taken: 'Este e-mail já tem conta.',
    phone_taken: 'Este celular já está em uso.',
    bad_credentials: 'E-mail ou senha não conferem.',
    password_mismatch: t('passwordMismatch'),
    bad_code: 'Código inválido ou vencido.',
    rate_limited: error?.data?.message,
    prompt_limit: error?.data?.message,
    trial_expired: t('expired'),
    unverified: t('unverified'),
    stripe_off: t('payOff'),
  };
  return map[code] || error?.data?.message || 'Erro.';
}

function PaperShell({ children }) {
  const { t } = useTranslation();
  const { lng } = useParams();
  return (
    <>
      <header className="topbar">
        <Link className="brand" to={`/${lng}`}><i />SpotStrat</Link>
        <div className="spacer" />
        <Flags />
        <nav className="menu">
          <Link to={`/${lng}/precos`}>{t('pricesNav')}</Link>
          <Link to={`/${lng}/login`}>{t('enter')}</Link>
          <Link className="solid" to={`/${lng}/register`}>{t('cta')}</Link>
        </nav>
      </header>
      {children}
    </>
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
const RISE_BARS = [
  [80, 80.4, 79.6, 80.1],
  [80.1, 80.5, 79.8, 80.0],
  [80.0, 80.3, 79.7, 80.2],
  [80.2, 80.6, 79.9, 80.1],
  [80.1, 80.4, 79.8, 80.0],
  [80.0, 81.2, 79.9, 80.9],
  [80.0, 80.2, 79.4, 79.6],
  [79.6, 81.1, 79.5, 80.8],
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

function PathShow() {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => setI((n) => (n + 1) % 4), 7000);
    return () => clearInterval(timer);
  }, [paused]);
  return (
    <section className="path" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="path-copy">
        <p className="kicker">0{i + 1}</p>
        <h2>{t(`path${i + 1}t`)}</h2>
        <p className="lede">{t(`path${i + 1}`)}</p>
        <div className="path-nav">
          <button type="button" onClick={() => setI((n) => (n + 3) % 4)} aria-label="prev">‹</button>
          {[0, 1, 2, 3].map((n) => (
            <button key={n} type="button" className={i === n ? 'on' : ''} onClick={() => setI(n)}>{n + 1}</button>
          ))}
          <button type="button" onClick={() => setI((n) => (n + 1) % 4)} aria-label="next">›</button>
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
        {i === 1 && <CandleChart title={t('chartEma')} bars={EMA_BARS} mark={8} />}
        {i === 2 && (
          <div className="path-live">
            <div className="path-meters">
              <article><span>{t('infoMareT')}</span><strong>BOA</strong></article>
              <article><span>{t('infoBookT')}</span><strong>62%</strong></article>
              <article><span>{t('infoTapeT')}</span><strong>↑</strong></article>
            </div>
            <CandleChart title={t('chartRise')} bars={RISE_BARS} mark={7} />
          </div>
        )}
        {i === 3 && <CandleChart title={t('chartEngulf')} bars={ENGULF_BARS} mark={6} />}
      </div>
    </section>
  );
}

function Landing() {
  useLang();
  const { t } = useTranslation();
  const { lng } = useParams();
  const { data } = usePresetsQuery(lng);
  return (
    <div className="landing">
      <header className="topbar">
        <Link className="brand" to={`/${lng}`}><i />SpotStrat</Link>
        <span className="mono rail">{t('rail')}</span>
        <div className="spacer" />
        <Flags />
        <nav className="menu">
          <Link to={`/${lng}/precos`}>{t('pricesNav')}</Link>
          <Link to={`/${lng}/login`}>{t('enter')}</Link>
          <Link className="solid" to={`/${lng}/register`}>{t('lCta')}</Link>
        </nav>
      </header>
      <section className="stage">
        <div>
          <p className="kicker">{t('kicker')}</p>
          <h1>{t('hero')}</h1>
          <p className="lede">{t('lede')}</p>
          <div className="row">
            <Link className="solid free" to={`/${lng}/register`}>{t('freeCta')}</Link>
            <Link className="ghost" to={`/${lng}/login`}>{t('enter')}</Link>
          </div>
          <p className="mono dim">{t('freeNote')}</p>
        </div>
        <CandleChart title={t('chartEngulf')} bars={ENGULF_BARS} mark={6} />
      </section>
      <PathShow />
      <section className="band">
        <h2>{t('sayT')}</h2>
        <p className="lede">{t('sayL')}</p>
        <div className="says">
          <p>{t('ex1')}</p>
          <p>{t('ex2')}</p>
          <p>{t('ex3')}</p>
          <p>{t('ex4')}</p>
        </div>
        <h2 className="later">{t('presetsT')}</h2>
        <p className="lede">{t('presetsL')}</p>
        <p className="preset-names">{(data?.presets || []).map((p) => p.name).join(' · ')}</p>
      </section>
      <section className="trial-band">
        <img src="/robot-desk.png" alt="" />
        <div>
          <h2>{t('trialT')}</h2>
          <p className="lede">{t('trialB')}</p>
          <Link className="solid free" to={`/${lng}/register`}>{t('freeCta')}</Link>
          <p className="mono dim">{t('freeNote')}</p>
        </div>
      </section>
      <footer className="site">
        <Link to={`/${lng}/privacy`}>{t('privacy')}</Link>
      </footer>
    </div>
  );
}

function AuthFrame({ children }) {
  const { t } = useTranslation();
  const { lng } = useParams();
  return (
    <div className="landing auth-page">
      <header className="topbar">
        <Link className="brand" to={`/${lng}`}><i />SpotStrat</Link>
        <div className="spacer" />
        <Flags />
        <nav className="menu">
          <Link to={`/${lng}/precos`}>{t('pricesNav')}</Link>
          <Link to={`/${lng}/login`}>{t('enter')}</Link>
          <Link className="solid" to={`/${lng}/register`}>{t('cta')}</Link>
        </nav>
      </header>
      <main className="auth-wrap">{children}</main>
    </div>
  );
}

function Privacy() {
  useLang();
  const { t } = useTranslation();
  return <AuthFrame><section className="band"><h1>{t('privacy')}</h1><p className="lede">{t('privacyBody')}</p></section></AuthFrame>;
}

function Register() {
  useLang();
  const { t } = useTranslation();
  const { lng } = useParams();
  const nav = useNavigate();
  const dispatch = useDispatch();
  const [form, setForm] = useState({ name: '', email: '', password: '', password2: '', phone: '+55' });
  const [err, setErr] = useState('');
  const [register, { isLoading }] = useRegisterMutation();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (form.password !== form.password2) {
      setErr(t('passwordMismatch'));
      return;
    }
    try {
      const { password2, ...body } = form;
      const res = await register({ ...body, passwordConfirm: password2, locale: lng }).unwrap();
      nav(`/${lng}/verify`, { state: { email: form.email, verification: res.verification, password: form.password } });
    } catch (error) { setErr(errText(error, t)); }
  }
  return (
    <AuthFrame>
      <GoogleEntry />
      <form className="auth card" onSubmit={submit}>
        <h2>{t('registerT')}</h2>
        {err && <div className="error">{err}</div>}
        <label>{t('name')}</label><input autoComplete="name" value={form.name} onChange={set('name')} />
        <label>{t('email')}</label><input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        <label>{t('password')}</label><input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
        <label>{t('password2')}</label><input type="password" required minLength={8} autoComplete="new-password" value={form.password2} onChange={set('password2')} />
        <label>{t('phone')}</label><input required autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="+5511999998888" />
        <p className="muted">{t('phoneHint')}</p>
        <div className="row"><button className="solid" disabled={isLoading} type="submit">{t('cta')}</button></div>
        <p><Link to={`/${lng}/login`}>{t('hasAccount')}</Link></p>
      </form>
    </AuthFrame>
  );
}

function routeForDesk(lng, user) {
  if (!user || user.desk === 'unverified' || user.desk === 'locked') return `/${lng}/verify`;
  if (user.desk === 'expired') return `/${lng}/app/account`;
  return `/${lng}/app`;
}

const GOOGLE_CLIENT_ID = '98371392821-ca4oqqttpoje9uc952it3arfd47f2a2s.apps.googleusercontent.com';

function GoogleEntry() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const nav = useNavigate();
  const dispatch = useDispatch();
  const onToken = useRef(() => {});
  const [err, setErr] = useState('');
  const [google] = useGoogleMutation();
  const hl = lng === 'pt-BR' ? 'pt-BR' : String(lng || 'en').slice(0, 2);
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
      <div className="gsi">
        <GoogleLogin
          onSuccess={(resp) => { if (resp?.credential) onToken.current(resp.credential); }}
          onError={() => setErr('Não foi possível entrar com o Google.')}
          theme="outline"
          size="large"
          text="continue_with"
          shape="rectangular"
          logo_alignment="left"
          width="360"
          locale={hl}
        />
      </div>
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
  const [login] = useLoginMutation();
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
    } catch (error) { setErr(errText(error, t)); }
  }
  return (
    <AuthFrame>
      <GoogleEntry />
      <form className="auth card" onSubmit={submit}>
        <h2>{t('loginT')}</h2>
        {err && <div className="error">{err}</div>}
        <label>{t('email')}</label><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>{t('password')}</label><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <label className="remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t('remember')}</label>
        <div className="row"><button className="solid" type="submit">{t('enter')}</button></div>
        <p><Link to={`/${lng}/register`}>{t('noAccount')}</Link></p>
      </form>
    </AuthFrame>
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
  const [phoneCode, setPhoneCode] = useState('');
  const [phone, setPhone] = useState('+55');
  const [err, setErr] = useState('');
  const [login] = useLoginMutation();
  const [verifyEmail] = useVerifyEmailMutation();
  const [verifyPhone] = useVerifyPhoneMutation();
  const [resend] = useResendMutation();
  const [setPhoneApi] = useSetPhoneMutation();
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
      if (phoneCode) user = (await verifyPhone({ code: phoneCode }).unwrap()).user;
      if (user) dispatch(setSession({ token: store.getState().auth.token, user }));
      if (user?.desk === 'trial' || user?.desk === 'active') nav(`/${lng}/app`);
      else setErr(t('unverified'));
    } catch (error) { setErr(errText(error, t)); }
  }
  async function resendChannel(channel) {
    setErr('');
    try {
      const res = await resend({ channel }).unwrap();
      setCodes((prev) => ({ ...(prev || {}), [channel === 'sms' ? 'phoneCode' : 'emailCode']: res.code }));
    } catch (error) { setErr(errText(error, t)); }
  }
  async function savePhone(e) {
    e.preventDefault();
    try {
      const res = await setPhoneApi({ phone }).unwrap();
      setCodes((prev) => ({ ...(prev || {}), phoneCode: res.verification?.phoneCode }));
    } catch (error) { setErr(errText(error, t)); }
  }
  return (
    <AuthFrame>
      <form className="auth card" onSubmit={confirm}>
        <h2>{t('verifyT')}</h2>
        {codes && (
          <div className="codes">
            <div>{t('localNote')}</div>
            {codes.emailCode && <strong>{t('emailCode')} {codes.emailCode}</strong>}
            {codes.phoneCode && <strong>{t('phoneCode')} {codes.phoneCode}</strong>}
          </div>
        )}
        {err && <div className="error">{err}</div>}
        <label>{t('emailCode')}</label>
        <input inputMode="numeric" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} />
        <label>{t('phoneCode')}</label>
        <input inputMode="numeric" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} />
        <div className="row"><button className="solid" type="submit" disabled={!token || (!!loc.state?.password && data?.user?.email !== loc.state?.email)}>{t('confirm')}</button></div>
        <div className="row">
          <button className="tiny" type="button" onClick={() => resendChannel('email')}>{t('resendEmail')}</button>
          <button className="tiny" type="button" onClick={() => resendChannel('sms')}>{t('resendPhone')}</button>
        </div>
        {(loc.state?.needsPhone || (data && !data.user.phone)) && (
          <>
            <label>{t('phone')}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className="ghost" type="button" onClick={savePhone}>{t('savePhone')}</button>
          </>
        )}
        <p className="muted">{data?.user?.email}</p>
      </form>
    </AuthFrame>
  );
}

function DeskBar() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();
  const me = useMeQuery();
  const user = me.data?.user;
  return (
    <header className="deskbar">
      <Link className="brand" to={`/${lng}/app`}><i />SpotStrat</Link>
      <nav className="menu">
        <Link to={`/${lng}/app`}>{t('desk')}</Link>
        <Link to={`/${lng}/precos`}>{t('pricesNav')}</Link>
        <Link to={`/${lng}/app/historico`}>{t('history')}</Link>
        <Link to={`/${lng}/app/info`}>{t('infoNav')}</Link>
        <Link to={`/${lng}/app/account`}>{t('account')}</Link>
      </nav>
      {user?.expiring && <span className="expiring">{user.daysLeft === 1 ? t('expiringOne') : t('expiring', { n: user.daysLeft })}</span>}
      <div className="spacer" />
      <Flags />
      <button className="tiny" type="button" onClick={async () => { await logout(); dispatch(clearSession()); window.location.href = `/${lng}`; }}>{t('logout')}</button>
    </header>
  );
}

function RequireDesk({ children, allowExpired = false }) {
  const lng = useLang();
  const token = useSelector((s) => s.auth.token);
  const { data, isLoading, isFetching, error } = useMeQuery(undefined, { skip: !token });
  useEffect(() => { if (token) connectStream(); }, [token]);
  if (!token) return <Navigate to={`/${lng}/login`} replace />;
  const known = ['trial', 'paper', 'pro', 'active', 'expired'].includes(data?.user?.desk);
  if ((isLoading || isFetching) && !known) {
    return <div className="desk"><DeskBar /><p className="wrap">…</p></div>;
  }
  if (error?.status === 401) return <Navigate to={`/${lng}/login`} replace />;
  const desk = data?.user?.desk;
  if (desk === 'unverified' || desk === 'locked') return <Navigate to={`/${lng}/verify`} replace />;
  if (desk === 'expired' && !allowExpired) return <Navigate to={`/${lng}/app/account`} replace />;
  return <div className="desk"><DeskBar />{children}</div>;
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
    ? 'Qual é o gatilho de entrada, com a porcentagem e o tempo?'
    : item));
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
      <div className="step-dots" aria-hidden="true">
        {questions.map((question, i) => <i key={question} className={i <= index ? 'on' : ''} />)}
      </div>
      <p className="steps-count">{t('stepOf', { n: index + 1, total: questions.length })}</p>
      <h3>{questions[index]}</h3>
      <input
        value={answers[index]}
        onChange={(e) => setAnswers(answers.map((item, i) => (i === index ? e.target.value : item)))}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(e); }}
        autoFocus
      />
      <div className="row">
        {index > 0 && <button className="tiny" type="button" onClick={() => setIndex(index - 1)}>{t('backStep')}</button>}
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
        <label>
          {t('thResult')}
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
              return (
                <tr key={tr.id}>
                  <td className="when">{whenBrt(tr.opened_at)}</td>
                  <td className="when">{whenBrt(tr.closed_at)}</td>
                  <td>{tr.symbol}</td>
                  <td>{t('sideLong')}</td>
                  <td className="num">{px(tr.entry)}</td>
                  <td className="num">{oco}</td>
                  <td className="num">{tr.exit ? px(tr.exit) : '—'}</td>
                  <td><span className={`badge ${key}`}>{resultLabel(key, t)}</span></td>
                  <td className={pnl == null ? 'num' : pnl >= 0 ? 'num up' : 'num down'}>
                    {pnl == null ? '—' : `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}${pct == null ? '' : ` (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`}`}
                  </td>
                  <td className="why">{raw.reason || ''}</td>
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
    `Fontes: ${guide.sources.map((id) => sourceText[id]).join('; ')}.`,
    guide.list === 'yes'
      ? `Lista: ${guide.listText.trim()} Grave o preço em ctx.memory.`
      : 'Lista: não grava preço. A compra acontece no próprio gatilho.',
    `Saída: ${exit}`,
  ].filter(Boolean).join('\n');
}

function Guide({ busy, onCreate }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
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
  return (
    <div className="steps">
      <p className="steps-kicker">{t('guideSteps')}</p>
      <div className="step-dots" aria-hidden="true">
        {ids.map((id, index) => <i key={id} className={index <= step ? 'on' : ''} />)}
      </div>
      <p className="steps-count">{t('stepOf', { n: step + 1, total: ids.length })}</p>
      {current === 'entry' && (
        <>
          <h3>{t('guideEntry')}</h3>
          <textarea value={guide.entry} onChange={(e) => patch({ entry: e.target.value })} placeholder={t('guideEntryPh')} />
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
                onClick={() => patch({ entryType: id })}
              >
                {t(id === 'pattern' ? 'typePattern' : id === 'cross' ? 'typeCross' : id === 'breakout' ? 'typeBreakout' : id === 'momentum' ? 'typeMomentum' : 'typeOther')}
              </button>
            ))}
          </div>
          {guide.entryType === 'other' && (
            <textarea
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
              <button key={id} type="button" className={guide.sources.includes(id) ? 'on' : ''} onClick={() => toggleSource(id)}>{t(key)}</button>
            ))}
          </div>
          {guide.sources.includes('other') && (
            <textarea
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
          <button type="button" className={`guide-choice ${guide.list === 'no' ? 'on' : ''}`} onClick={() => patch({ list: 'no' })}>{t('guideListNo')}</button>
          <button type="button" className={`guide-choice ${guide.list === 'yes' ? 'on' : ''}`} onClick={() => patch({ list: 'yes' })}>{t('guideListYes')}</button>
          {guide.list === 'yes' && <textarea value={guide.listText} onChange={(e) => patch({ listText: e.target.value })} placeholder={t('guideListPh')} />}
        </>
      )}
      {current === 'exit' && (
        <>
          <h3>{t('guideExit')}</h3>
          <button type="button" className={`guide-choice ${guide.exitKind === 'numbers' ? 'on' : ''}`} onClick={() => patch({ exitKind: 'numbers' })}>{t('guideExitNumbers')}</button>
          {guide.exitKind === 'numbers' && (
            <div className="choice-fields">
              <label>{t('stopPct')}<input inputMode="decimal" value={guide.stop} onChange={(e) => patch({ stop: e.target.value })} /></label>
              <label>{t('tpPct')}<input inputMode="decimal" value={guide.target} onChange={(e) => patch({ target: e.target.value })} /></label>
            </div>
          )}
          <button type="button" className={`guide-choice ${guide.exitKind === 'describe' ? 'on' : ''}`} onClick={() => patch({ exitKind: 'describe' })}>{t('guideExitDescribe')}</button>
          {guide.exitKind === 'describe' && <textarea value={guide.exitText} onChange={(e) => patch({ exitText: e.target.value })} placeholder={t('guideExitPh')} />}
          <button type="button" className={`guide-choice ${guide.exitKind === 'standard' ? 'on' : ''}`} onClick={() => patch({ exitKind: 'standard' })}>{t('guideExitStandard')}</button>
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
      <div className="row">
        {step > 0 && <button className="tiny" type="button" onClick={() => setStep(step - 1)}>{t('backStep')}</button>}
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

function DeskHome() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const live = useSelector((s) => s.desk);
  const { data } = useDeskQuery(undefined, { pollingInterval: 5000 });
  const strategies = live.strategies.length ? live.strategies : (data?.strategies || []);
  const mare = live.mare || data?.mare;
  const connection = live.connection || data?.connection;
  const alarms = live.alarms ?? data?.alarms ?? [];
  const hits = live.hits ?? data?.hits ?? [];
  const [mode, setMode] = useState('trade');
  const [exitMode, setExitMode] = useState('history');
  const [stopPct, setStopPct] = useState('1.2');
  const [tpPct, setTpPct] = useState('1.8');
  const [timeExit, setTimeExit] = useState(false);
  const [timeMode, setTimeMode] = useState('history');
  const [holdMin, setHoldMin] = useState('60');
  const [variants, setVariants] = useState(false);
  const [wallet, setWallet] = useState('1000');
  const [mareMode, setMareMode] = useState('any');
  const [channels, setChannels] = useState({ sound: true, email: false, sms: false });
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
  const [restore] = useRestoreMutation();
  const [patchStrategy] = usePatchStrategyMutation();
  const [alarmPause] = useAlarmPauseMutation();
  const [alarmArm] = useAlarmArmMutation();
  const [alarmRemove] = useAlarmRemoveMutation();
  const [alarmSeen] = useAlarmSeenMutation();
  const [alarmChannels] = useAlarmChannelsMutation();
  const audioRef = useRef(null);
  const playedRef = useRef(new Set());
  const job = useJobQuery(jobId, { skip: !jobId, pollingInterval: jobId ? 700 : 0 });

  function armAudio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioRef.current) audioRef.current = new Ctx();
    if (audioRef.current.state === 'suspended') audioRef.current.resume();
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }

  function beep() {
    const ctx = audioRef.current;
    if (!ctx) return;
    const tone = (freq, at) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.42);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.45);
    };
    tone(880, 0);
    tone(1175, 0.16);
  }

  useEffect(() => {
    for (const hit of hits) {
      if (!hit || hit.seen || playedRef.current.has(hit.id)) continue;
      playedRef.current.add(hit.id);
      const sound = !hit.channels || hit.channels.sound !== false;
      if (!sound) continue;
      beep();
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const note = `${hit.name || ''} · stop ${Number(hit.stop).toFixed(4)} · alvo ${Number(hit.tp).toFixed(4)}`;
        new Notification(hit.symbol || 'SpotStrat', { body: note });
      }
    }
  }, [hits]);

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
      const made = job.data.job.output?.mode === 'alarm' ? t('modeAlarm') : t('ready', { name: job.data.job.output?.name || '' });
      const filled = (job.data.job.output?.defaults || []).map((item) => `${item.label}: ${item.value}`).join(' · ');
      setNote(job.data.job.output?.mode === 'alarm' ? `${job.data.job.output?.name || ''} · ${made}` : (filled ? `${made} ${filled}` : made));
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
    if (mode === 'trade' && !(walletN >= 100 && walletN <= 999000)) {
      setErr(t('walletBad'));
      return;
    }
    const guided = mode === 'trade' && compose === 'guide';
    try {
      const res = await sendPrompt({
        prompt: text,
        threadId,
        mode,
        options: {
          exit: exitMode,
          stopPct: Number(stopPct),
          tpPct: Number(tpPct),
          timeExit,
          time: timeMode,
          maxHoldMin: Number(holdMin),
          variants: mode === 'trade' && variants && !guided,
          mareMode: mode === 'trade' ? mareMode : 'any',
          channels,
          wallet: mode === 'trade' ? walletN : undefined,
        },
      }).unwrap();
      setThreadId(res.threadId);
      setJobId(res.jobId);
    } catch (error) { setErr(errText(error, t)); }
  }

  function submit(e) {
    e.preventDefault();
    if (mode === 'trade' && compose === 'guide') return;
    sendText(prompt);
  }

  return (
    <div className="wrap">
      <div className="mare">
        <span className={`pill ${mare?.label || ''}`}>{mare ? `${mare.label} · ${mare.upPct}% · ${mare.windowMin} min` : '…'} <Tip text={t('mareTip')} /></span>
        <span className="muted">{t('connection')}: {connection}</span>
        <span className="muted">{(live.prices.length ? live.prices : data?.prices || []).slice(0, 4).map((p) => `${p.symbol.replace('USDT', '')} ${p.price}`).join(' · ')}</span>
      </div>
      <form className="panel" onSubmit={submit} aria-busy={isLoading || !!jobId}>
        <div className="modes">
          <button type="button" className={mode === 'trade' ? 'on' : ''} onClick={() => setMode('trade')}>{t('modeTrade')}</button>
          <button type="button" className={mode === 'alarm' ? 'on' : ''} onClick={() => setMode('alarm')}>{t('modeAlarm')}</button>
        </div>
        {mode === 'trade' && (
          <div className="modes">
            <button type="button" className={compose === 'guide' ? 'on' : ''} onClick={() => setCompose('guide')}>{t('guideSteps')}</button>
            <button type="button" className={compose === 'paste' ? 'on' : ''} onClick={() => setCompose('paste')}>{t('guidePaste')}</button>
          </div>
        )}
        {mode === 'trade' && compose === 'guide'
          ? <Guide busy={isLoading || !!jobId} onCreate={sendText} />
          : <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={mode === 'trade' ? t('promptPhTrade') : t('promptPhAlarm')} disabled={isLoading || !!jobId} />}
        {mode === 'trade' && (
          <div className="wallet-row">
            <label>{t('wallet')}
              <input inputMode="decimal" min="100" max="999000" value={wallet} onChange={(e) => setWallet(e.target.value)} disabled={isLoading || !!jobId} />
            </label>
            <small>{t('walletHint')}</small>
          </div>
        )}
        {!(mode === 'trade' && compose === 'guide') && <>
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
        {mode === 'trade' && (
          <fieldset className="choice" disabled={isLoading || !!jobId}>
            <legend>{t('marePick')} <Tip text={t('mareTip')} /></legend>
            <label className={mareMode === 'any' ? 'on' : ''}>
              <input type="radio" name="marePick" checked={mareMode === 'any'} onChange={() => setMareMode('any')} />
              <span>{t('mareAny')}</span>
            </label>
            <label className={mareMode === 'good' ? 'on' : ''}>
              <input type="radio" name="marePick" checked={mareMode === 'good'} onChange={() => setMareMode('good')} />
              <span>{t('mareGood')}</span>
            </label>
            <label className={mareMode === 'not_bad' ? 'on' : ''}>
              <input type="radio" name="marePick" checked={mareMode === 'not_bad'} onChange={() => setMareMode('not_bad')} />
              <span>{t('mareNotBad')}</span>
            </label>
          </fieldset>
        )}
        {mode === 'trade' && compose === 'paste' && (
          <fieldset className="choice" disabled={isLoading || !!jobId}>
            <legend>{t('optVar')} <Tip text={t('varTip')} /></legend>
            <label className={variants ? 'on' : ''}>
              <input type="checkbox" checked={variants} onChange={(e) => setVariants(e.target.checked)} />
              <span>{t('variants')}</span>
            </label>
          </fieldset>
        )}
        {mode === 'alarm' && (
          <fieldset className="choice" disabled={isLoading || !!jobId}>
            <legend>{t('optCh')}</legend>
            <label className={channels.sound ? 'on' : ''}>
              <input type="checkbox" checked={channels.sound} onChange={(e) => { setChannels({ ...channels, sound: e.target.checked }); if (e.target.checked) armAudio(); }} />
              <span>{t('chSound')}</span>
            </label>
            <label className={channels.email ? 'on' : ''}>
              <input type="checkbox" checked={channels.email} onChange={(e) => setChannels({ ...channels, email: e.target.checked })} />
              <span>{t('chEmail')}</span>
            </label>
            <label className={channels.sms ? 'on' : ''}>
              <input type="checkbox" checked={channels.sms} onChange={(e) => setChannels({ ...channels, sms: e.target.checked })} />
              <span>{t('chSms')}</span>
            </label>
            <p className="muted">{t('chHint')}</p>
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
                mode,
                options: {
                  exit: exitMode,
                  stopPct: Number(stopPct),
                  tpPct: Number(tpPct),
                  timeExit,
                  time: timeMode,
                  maxHoldMin: Number(holdMin),
                  variants: mode === 'trade' && variants,
                  mareMode: mode === 'trade' ? mareMode : 'any',
                  channels,
                  wallet: mode === 'trade' ? Number(wallet) : undefined,
                },
              }).unwrap().then((res) => {
                setThreadId(res.threadId);
                setJobId(res.jobId);
                setNote('');
              }).catch((error) => setErr(errText(error, t)));
            }}
          />
        )}
        <PromptStatus busy={isLoading || !!jobId} status={job.data?.job?.status} note={note} err={err} detail={!(mode === 'trade' && compose === 'guide') && (exitMode === 'history' || (timeExit && timeMode === 'history')) ? t('workingHist') : ''} />
        {!(mode === 'trade' && compose === 'guide') && <button className="solid" disabled={isLoading || !!jobId || !prompt.trim()} type="submit">{(isLoading || jobId) ? t('working') : t('send')}</button>}
      </form>
      <section className="alarm-board">
        <header>
          <h2>{t('alarmsT')}</h2>
          <p className="muted">{t('alarmsL')}</p>
        </header>
        {hits.filter((hit) => !hit.seen).map((hit) => (
          <article className="alarm-hit" key={hit.id}>
            <div>
              <strong>{hit.symbol}</strong>
              <span className="muted"> · {hit.name}</span>
              <p>{t('thEntry')} {px(hit.price)} · {t('resStop')} {px(hit.stop)} ({Number(hit.stopPct).toFixed(2)}%) · {t('resTarget')} {px(hit.tp)} ({Number(hit.tpPct).toFixed(2)}%)</p>
              {(hit.deliveries || []).filter((item) => item.channel !== 'sound').map((item) => (
                <p className="muted" key={item.channel}>{item.channel === 'email' ? t('chEmail') : t('chSms')} · {item.to || '—'} · {item.status === 'sent' ? 'ok' : t('chHint')}</p>
              ))}
            </div>
            <button className="tiny" type="button" onClick={() => alarmSeen(hit.id)}>{t('alarmSeen')}</button>
          </article>
        ))}
        {!alarms.length && <p className="muted">{t('alarmEmpty')}</p>}
        <div className="alarm-list">
          {alarms.map((alarm) => (
            <article key={alarm.id}>
              <div>
                <strong>{alarm.name}</strong>
                <p>{alarm.thesis}</p>
                <span className="muted">{t('resStop')} {alarm.stopPct}% · {t('resTarget')} {alarm.tpPct}%</span>
              </div>
              <div className="actions">
                <label className="check"><input type="checkbox" checked={alarm.channels?.sound !== false} onChange={(e) => { alarmChannels({ id: alarm.id, channels: { ...(alarm.channels || {}), sound: e.target.checked } }); if (e.target.checked) armAudio(); }} /> {t('chSound')}</label>
                <label className="check"><input type="checkbox" checked={!!alarm.channels?.email} onChange={(e) => alarmChannels({ id: alarm.id, channels: { sound: alarm.channels?.sound !== false, email: e.target.checked, sms: !!alarm.channels?.sms } })} /> {t('chEmail')}</label>
                <label className="check"><input type="checkbox" checked={!!alarm.channels?.sms} onChange={(e) => alarmChannels({ id: alarm.id, channels: { sound: alarm.channels?.sound !== false, email: !!alarm.channels?.email, sms: e.target.checked } })} /> {t('chSms')}</label>
                {alarm.status === 'armed'
                  ? <button className="tiny" type="button" onClick={() => alarmPause(alarm.id)}>{t('alarmPause')}</button>
                  : <button className="tiny" type="button" onClick={() => alarmArm(alarm.id)}>{t('alarmArm')}</button>}
                <button className="tiny danger" type="button" onClick={() => alarmRemove(alarm.id)}>{t('remove')}</button>
              </div>
            </article>
          ))}
        </div>
      </section>
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
              <span className={s.pnl >= 0 ? 'up' : 'down'}>{t('pnl')} <b>{money(s.pnl)}</b></span>
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
              <Link className="tiny" to={`/${lng}/app/strategies/${s.id}/producao`}>{t('toProd')}</Link>
              {s.paused
                ? <button className="tiny" type="button" onClick={() => resume(s.id)}>{t('resume')}</button>
                : <button className="tiny" type="button" onClick={() => pause(s.id)}>{t('pause')}</button>}
              <button className="tiny" type="button" onClick={() => { if (confirm(t('reset'))) reset(s.id); }}>{t('reset')}</button>
              <button className="tiny danger" type="button" onClick={() => { if (confirm(t('remove'))) remove(s.id); }}>{t('remove')}</button>
            </div>
          </article>
        ))}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="tiny" type="button" onClick={() => restore()}>{t('restore')}</button>
      </div>
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
        <h2 style={{ fontFamily: 'Fraunces, serif' }}>{data?.strategy?.name}</h2>
        <Link className="solid" to={`/${lng}/app/strategies/${id}/producao`}>{t('toProd')}</Link>
      </div>
      {live?.position && (
        <p className="up">{t('inPos')}: {live.position.symbol} · entrada {live.position.entry}{live.position.stop > 0 ? ` · stop ${Number(live.position.stop).toPrecision(6)}` : ''}{live.position.tp > 0 ? ` · alvo ${Number(live.position.tp).toPrecision(6)}` : ''} · uPnL {money(live.position.upnl)}</p>
      )}
      {running && (
        <article className="panel" style={{ marginTop: 12 }}>
          <h3>{t('runningCode')}</h3>
          <pre className="strategy-code">{running}</pre>
          {assumed.length > 0 && <p className="assumed">{t('assumed')} {assumed.map((item) => `${item.label}: ${item.value}`).join(' · ')}</p>}
        </article>
      )}
      {ex && (
        <div className="split">
          <article className="panel">
            <h3>{t('thesis')}</h3><p>{ex.thesis}</p>
            <h3>{t('entry')}</h3><p>{ex.entry}</p>
            <h3>{t('exit')}</h3><p>{ex.exit}</p>
          </article>
          <article className="panel">
            <h3>{t('filters')}</h3><p>{ex.filters}</p>
            <h3>{t('risks')}</h3><p>{ex.risks}</p>
          </article>
        </div>
      )}
      <article className="panel" style={{ marginTop: 12 }}>
        <h3>{t('scan')}</h3>
        <table className="scan">
          <tbody>
            {(scan?.rows || []).map((row) => (
              <tr key={row.symbol}>
                <td>{row.symbol}</td>
                <td>{row.passed}/{row.total}</td>
                <td className="muted">{(row.checks || []).map((c) => c.detail).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <article className="panel" style={{ marginTop: 12 }}>
        <h3>{t('thread')}</h3>
        <div className="thread">
          {(data?.messages || []).map((m) => <div key={m.id} className={`bubble ${m.role}`}>{m.content}</div>)}
        </div>
        <form onSubmit={submit} aria-busy={!!jobId}>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('replyPh')} disabled={!!jobId} />
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
      <article className="panel" style={{ marginTop: 12 }}>
        <h3>{t('trades')}</h3>
        <TradeBook trades={data?.trades || []} position={live?.position} />
      </article>
    </div>
  );
}

function Candle({ symbol }) {
  const ref = useRef(null);
  const { data, isFetching } = useKlinesQuery({ symbol, interval: '1h', limit: 500 }, { skip: !symbol });
  const { t } = useTranslation();
  useEffect(() => {
    if (!ref.current || !data?.bars?.length) return undefined;
    const chart = createChart(ref.current, {
      height: 380,
      layout: { background: { color: '#181e25' }, textColor: '#ebe4d6' },
      grid: { vertLines: { color: '#313a45' }, horzLines: { color: '#313a45' } },
      timeScale: { timeVisible: true },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#3ecf8e', downColor: '#ff6d5a', borderVisible: false, wickUpColor: '#3ecf8e', wickDownColor: '#ff6d5a',
    });
    series.setData(data.bars);
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [data]);
  if (!symbol) return null;
  return <div>{isFetching && <p>{t('loading')}</p>}<div className="chart" ref={ref} /></div>;
}

function History() {
  const { t } = useTranslation();
  const manifest = useManifestQuery();
  const symbols = useSymbolsQuery();
  const artifacts = useArtifactsQuery();
  const [q, setQ] = useState('');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [ask] = useLabQueryMutation();
  const job = useJobQuery(jobId, { skip: !jobId, pollingInterval: jobId ? 700 : 0 });
  useEffect(() => {
    if (job.data?.job?.status === 'done') {
      setAnswer(job.data.job.output?.payload);
      setJobId(null);
    }
  }, [job.data]);
  const list = useMemo(() => {
    const all = symbols.data?.symbols || [];
    const query = q.trim().toUpperCase();
    return all.filter((s) => !query || s.symbol.includes(query)).slice(0, 24);
  }, [symbols.data, q]);
  return (
    <div className="wrap">
      <h2 style={{ fontFamily: 'Fraunces, serif' }}>{t('labT')}</h2>
      <p className="muted">{manifest.data ? `${manifest.data.start || ''} → ${manifest.data.end || ''} · ${manifest.data.symbols} pares · ${t('labNote')}` : ''}</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} />
      <div className="symbols" style={{ margin: '12px 0' }}>
        {list.map((s) => (
          <button type="button" key={s.symbol} className={symbol === s.symbol ? 'on' : ''} onClick={() => setSymbol(s.symbol)}>
            <strong>{s.symbol}</strong>
            <div className={s.changePct >= 0 ? 'up' : 'down'}>{Number(s.changePct).toFixed(1)}%</div>
          </button>
        ))}
      </div>
      <Candle symbol={symbol} />
      <div className="split" style={{ marginTop: 16 }}>
        <article className="panel">
          <h3>{t('sweeps')}</h3>
          {(artifacts.data?.artifacts || []).slice(0, 12).map((a) => (
            <p key={a.id}><strong>{a.name}</strong><br /><span className="muted">{a.summary}</span></p>
          ))}
        </article>
        <form className="panel" onSubmit={async (e) => {
          e.preventDefault();
          const res = await ask({ prompt }).unwrap();
          setJobId(res.jobId);
        }}>
          <h3>{t('askLab')}</h3>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button className="solid" type="submit">{t('send')}</button>
          {answer && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(answer.symbol || answer.note, null, 2)}</pre>}
        </form>
      </div>
    </div>
  );
}

function statusLabel(user, t) {
  if (!user) return '';
  if (user.desk === 'pro') return t('statusPro');
  if (user.desk === 'paper') return t('statusPaper');
  if (user.desk === 'trial' || user.desk === 'active') return t('statusTrial');
  if (user.desk === 'expired') return t('statusExpired');
  return user.desk;
}

function PlanPicker() {
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
          <p>{t('planPaperBody')}</p>
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
  const { data } = useMeQuery();
  const user = data?.user;
  const [patch, { isLoading }] = usePatchMeMutation();
  const [remove] = useDeleteMeMutation();
  const dispatch = useDispatch();
  const { lng } = useParams();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState('');
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
  return (
    <div className="wrap account-page">
      <h2 style={{ fontFamily: 'Fraunces, serif' }}>{t('account')}</h2>
      <p>{user?.email}</p>
      <p className="plan-chip">{statusLabel(user, t)} · {t('accessUntil')} {ends ? new Date(ends).toLocaleString() : '—'} · {user?.daysLeft === 1 ? t('dayLeft') : t('daysLeft', { n: user?.daysLeft || 0 })}</p>
      {user?.expiring && <div className="warn">{t('expiring', { n: user.daysLeft })}</div>}
      {user?.desk === 'expired' && <div className="error">{t('expired')}</div>}
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
      <div className="row">
        <button className="danger" type="button" onClick={async () => {
          if (!confirm(t('delete'))) return;
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

function Info() {
  useLang();
  const { t } = useTranslation();
  const { data } = useDeskQuery(undefined, { pollingInterval: 15000 });
  const n = (data?.prices || []).length;
  const steps = [
    ['01', 'infoS1t', 'infoS1'],
    ['02', 'infoS2t', 'infoS2'],
    ['03', 'infoS3t', 'infoS3'],
    ['04', 'infoS4t', 'infoS4'],
  ];
  const meters = ['infoMare', 'infoBook', 'infoTape', 'infoEquity', 'infoPnl', 'infoTrades', 'infoConn', 'infoRisk', 'infoFee', 'infoHalt', 'infoAlarm', 'infoPro'];
  return (
    <div className="wrap info-page">
      <section className="info-hero">
        <div>
          <p className="kicker">{t('infoNav')}</p>
          <h2>{t('infoT')}</h2>
          <p>{t('infoL')}</p>
        </div>
        <img src="/robot-desk.png" alt="" />
      </section>
      <section className="info-steps">
        {steps.map(([num, title, body]) => (
          <article key={num}>
            <span>{num}</span>
            <h3>{t(title)}</h3>
            <p>{t(body)}</p>
          </article>
        ))}
      </section>
      <section className="info-split">
        <CandleChart title={t('chartEma')} bars={EMA_BARS} mark={8} />
        <article className="panel">
          <h3>{t('infoHowT')}</h3>
          <p>{t('infoHow')}</p>
        </article>
      </section>
      <section className="info-uni">
        <h2>{t('infoUniT')}</h2>
        <p>{t('infoUni')}</p>
        {n > 0 && <p className="info-now">{t('infoUniNow', { n })}</p>}
        <div className="info-cols">
          <article>
            <h3>{t('infoInT')}</h3>
            <ul>
              {['infoIn1', 'infoIn2', 'infoIn3', 'infoIn4'].map((key) => <li key={key}>{t(key)}</li>)}
            </ul>
          </article>
          <article>
            <h3>{t('infoOutT')}</h3>
            <ul>
              {['infoOut1', 'infoOut2', 'infoOut3', 'infoOut4', 'infoOut5', 'infoOut6'].map((key) => <li key={key}>{t(key)}</li>)}
            </ul>
          </article>
        </div>
      </section>
      <section className="info-grid">
        {meters.map((key) => (
          <article className="panel" key={key}>
            <h3>{t(`${key}T`)}</h3>
            <p>{t(key)}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function Prices() {
  useLang();
  const { t } = useTranslation();
  const { lng } = useParams();
  const plans = [
    { key: 'paper', amount: 93.33, title: t('planPaper'), body: t('planPaperBody') },
  ];
  return (
    <div className="landing">
      <header className="topbar">
        <Link className="brand" to={`/${lng}`}><i />SpotStrat</Link>
        <span className="mono rail">{t('rail')}</span>
        <div className="spacer" />
        <Flags />
        <nav className="menu">
          <Link to={`/${lng}/precos`}>{t('pricesNav')}</Link>
          <Link to={`/${lng}/login`}>{t('enter')}</Link>
          <Link className="solid" to={`/${lng}/register`}>{t('lCta')}</Link>
        </nav>
      </header>
      <section className="band prices">
        <p className="kicker">{t('pricesNav')}</p>
        <h1>{t('pricesT')}</h1>
        <p className="lede">{t('pricesL')}</p>
        <div className="price-grid">
          {plans.map((plan) => (
            <article key={plan.key} className={plan.key}>
              <h2>{plan.title}</h2>
              <p className="price-num">{localMoney(lng, plan.amount)}</p>
              {lng !== 'pt-BR' && <p className="mono dim">{t('planTable')} · {brlMoney(plan.amount)}</p>}
            </article>
          ))}
        </div>
        <PlanPicker />
        <p className="mono dim">{t('planFx')}</p>
        <Link className="solid free" to={`/${lng}/register`}>{t('freeCta')}</Link>
      </section>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <SessionBoot>
      <Routes>
        <Route path="/" element={<LangRedirect />} />
        <Route path="/:lng" element={<Guard><Landing /></Guard>} />
        <Route path="/:lng/precos" element={<Guard><Prices /></Guard>} />
        <Route path="/:lng/privacy" element={<Guard><Privacy /></Guard>} />
        <Route path="/:lng/login" element={<Guard><Login /></Guard>} />
        <Route path="/:lng/register" element={<Guard><Register /></Guard>} />
        <Route path="/:lng/verify" element={<Guard><Verify /></Guard>} />
        <Route path="/:lng/app" element={<Guard><RequireDesk><DeskHome /></RequireDesk></Guard>} />
        <Route path="/:lng/app/strategies/:id" element={<Guard><RequireDesk><StrategyPage /></RequireDesk></Guard>} />
        <Route path="/:lng/app/strategies/:id/producao" element={<Guard><RequireDesk><StrategyProduction /></RequireDesk></Guard>} />
        <Route path="/:lng/app/historico" element={<Guard><RequireDesk><History /></RequireDesk></Guard>} />
        <Route path="/:lng/app/info" element={<Guard><RequireDesk><Info /></RequireDesk></Guard>} />
        <Route path="/:lng/app/account" element={<Guard><RequireDesk allowExpired><Account /></RequireDesk></Guard>} />
        <Route path="/:lng/app/checkout" element={<Guard><RequireDesk allowExpired><Checkout /></RequireDesk></Guard>} />
        <Route path="*" element={<LangRedirect />} />
      </Routes>
      </SessionBoot>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </Provider>
  </StrictMode>,
);
