import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useDeskQuery, usePauseMutation, useResumeMutation, useResetMutation, useRemoveMutation, useRestoreMutation, api, ingest } from '../store';
import { useConfirm } from '../confirm';
import StrategyHelpBalloon from './StrategyHelpBalloon';
import { formatPaperMoney } from '../lib/localeFormat';
import { presetLabel } from '../presetNames';
import css from './ReportsPage.module.css';

function money(n, lng) {
  return formatPaperMoney(n, lng);
}

function pct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

function Spark({ values, up }) {
  const pts = values.length ? values : [0, 0];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const w = 120;
  const h = 36;
  const d = pts.map((v, i) => {
    const x = (i / Math.max(pts.length - 1, 1)) * w;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className={css.spark} viewBox={`0 0 ${w} ${h}`} width="120" height="36" aria-hidden="true">
      <path d={d} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BarCompare({ items, lng, label }) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <div className={css.bars} role="img" aria-label={label || 'PnL'}>
      {items.map((item) => (
        <div key={item.id} className={css.barRow}>
          <span className={css.barName}>{item.name}</span>
          <div className={css.barTrack}>
            <i
              className={item.value >= 0 ? css.barUp : css.barDown}
              style={{ width: `${Math.max(6, (Math.abs(item.value) / max) * 100)}%` }}
            />
          </div>
          <b className={item.value >= 0 ? css.up : css.down}>{money(item.value, lng)}</b>
        </div>
      ))}
    </div>
  );
}

function IconPlay() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
}
function IconPause() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>;
}
function IconReset() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
function IconX() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

function sparkFrom(s) {
  const series = Array.isArray(s.equitySeries)
    ? s.equitySeries.map(Number).filter((n) => Number.isFinite(n))
    : [];
  if (series.length >= 2) return series;
  return null;
}

function mareCopy(label, t) {
  if (label === 'BOA') return t('mareStatusGood');
  if (label === 'RUIM') return t('mareStatusBad');
  if (label === 'NEUTRA') return t('mareStatusNeutral');
  return t('mareStatusNeutral');
}

function ageLabel(iso, t) {
  const ts = Date.parse(iso || '');
  if (!Number.isFinite(ts)) return t('reportsAgeUnknown');
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 60) return t('reportsAgeMin', { n: Math.max(1, min) });
  const hours = Math.round(min / 60);
  if (hours < 48) return t('reportsAgeHours', { n: hours });
  return t('reportsAgeDays', { n: Math.round(hours / 24) });
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const live = useSelector((s) => s.desk);
  const { data, isLoading, isFetching, isError, refetch } = useDeskQuery(undefined, { pollingInterval: 5000 });
  const strategies = live.strategies.length ? live.strategies : (data?.strategies || []);
  const waiting = !strategies.length && (isLoading || (isFetching && !data)) && !isError;
  const mare = live.mare || data?.mare;
  const connection = live.connection || data?.connection;
  const dispatch = useDispatch();
  const ask = useConfirm();
  const [params, setParams] = useSearchParams();
  const kind = ['preset', 'recipe'].includes(params.get('kind')) ? params.get('kind') : 'all';
  const [pause] = usePauseMutation();
  const [resume] = useResumeMutation();
  const [reset] = useResetMutation();
  const [remove] = useRemoveMutation();
  const [restore, { isLoading: restoring }] = useRestoreMutation();
  const [restoreMsg, setRestoreMsg] = useState('');
  const [query, setQuery] = useState('');
  const [createdToast, setCreatedToast] = useState(null);
  const [verifiedToast, setVerifiedToast] = useState(Boolean(loc.state?.justVerified));

  useEffect(() => {
    const raw = loc.state?.strategyCreated;
    if (!raw) return undefined;
    const name = raw === true ? '' : String(raw).trim();
    setCreatedToast(name || t('strategyCreatedFallback'));
    nav(loc.pathname, { replace: true, state: {} });
    const timer = window.setTimeout(() => setCreatedToast(null), 5600);
    return () => window.clearTimeout(timer);
  }, [loc.state, loc.pathname, nav, t]);

  const bestPnl = strategies.reduce((a, s) => (!a || Number(s.pnl) > Number(a.pnl) ? s : a), null);
  const worstPnl = strategies.reduce((a, s) => (!a || Number(s.pnl) < Number(a.pnl) ? s : a), null);
  const mostTrades = strategies.reduce((a, s) => (!a || Number(s.nTrades) > Number(a.nTrades) ? s : a), null);
  const bestWr = strategies.filter((s) => Number(s.nTrades) > 0).reduce((a, s) => (!a || Number(s.winRate) > Number(a.winRate) ? s : a), null);
  const totalEquity = strategies.reduce((sum, s) => sum + Number(s.equity || 0), 0);
  const totalPnl = strategies.reduce((sum, s) => sum + Number(s.pnl || 0), 0);
  const totalTrades = strategies.reduce((sum, s) => sum + Number(s.nTrades || 0), 0);

  const q = query.trim().toLowerCase();
  const listed = [...strategies]
    .sort((a, b) => {
      const ta = Date.parse(a.createdAt || '') || 0;
      const tb = Date.parse(b.createdAt || '') || 0;
      return tb - ta;
    })
    .filter((s) => {
      if (kind === 'preset' && s.type === 'recipe') return false;
      if (kind === 'recipe' && s.type !== 'recipe') return false;
      if (!q) return true;
      const hay = [
        s.name,
        s.id,
        s.type === 'recipe' ? t('recipe') : t('preset'),
        s.paused ? t('paused') : '',
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });

  const running = strategies.filter((s) => !s.paused).length;
  const newest = [...strategies].sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0))[0] || null;
  const richest = strategies.reduce((a, s) => (!a || Number(s.equity) > Number(a.equity) ? s : a), null);
  const chartItems = useMemo(() => {
    const key = totalTrades > 0 ? 'pnl' : 'equity';
    return [...strategies]
      .sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))
      .slice(0, 6)
      .map((s) => ({ id: s.id, name: presetLabel(s.name, lng), value: Number(s[key] || 0) }));
  }, [strategies, totalTrades, lng]);

  const mareLabel = mare ? mareCopy(mare.label, t) : '…';

  function setKind(next) {
    const nextParams = new URLSearchParams(params);
    if (next === 'all') nextParams.delete('kind');
    else nextParams.set('kind', next);
    setParams(nextParams, { replace: true });
  }
  const connLabel = connection === 'live' ? t('connLive')
    : connection ? t('connDown')
      : '…';

  async function onRestore() {
    setRestoreMsg('');
    try {
      await restore().unwrap();
      try {
        const state = await dispatch(api.endpoints.desk.initiate(undefined, { subscribe: false, forceRefetch: true })).unwrap();
        dispatch(ingest({ type: 'snapshot', ...state }));
      } catch { /* ignore */ }
      setRestoreMsg(t('restoreDone'));
    } catch {
      setRestoreMsg('');
    }
  }

  return (
    <div className={`wrap ${css.page}`}>
      {createdToast && (
        <div className={css.toast} role="status" aria-live="polite">
          <span className={css.toastMark} aria-hidden="true">✓</span>
          <div className={css.toastBody}>
            <strong>{t('strategyCreatedTitle')}</strong>
            <p>{t('strategyCreatedBody', { name: createdToast })}</p>
          </div>
          <button className={css.toastClose} type="button" aria-label={t('labClose')} onClick={() => setCreatedToast(null)}>
            <IconX />
          </button>
        </div>
      )}
      <header className={css.head}>
        <div>
          <p className={css.kicker}>{t('simNav')}</p>
          <h1>{t('reportsT')}</h1>
          <p className={css.lede}>{t('reportsL')}</p>
          <p className={css.paperNote}>{t('reportsPaperNote')}</p>
        </div>
        <Link className={css.cta} to={`/${lng}/app/criar`}>{t('reportsNew')}</Link>
      </header>

      <div className={css.live}>
        <span className={css.pill}>{t('marketLive')}</span>
        <span className={css.pill}>{t('moodMarket')}: {mare ? `${mareLabel} · ${mare.upPct}%` : '…'}</span>
        <span
          className={`${css.conn} ${connection === 'live' ? css.liveOk : css.liveDown}`}
          title={t('connectionHint')}
        >
          <i />{t('connection')}: {connLabel}
        </span>
      </div>

      <section className={css.kpis}>
        <article>
          <span>{t('reportsKpiEquity')}</span>
          <strong>{money(totalEquity, lng)}</strong>
        </article>
        <article>
          <span>{t('reportsKpiPnl')}</span>
          <strong className={totalPnl >= 0 ? css.up : css.down}>{money(totalPnl, lng)}</strong>
        </article>
        <article>
          <span>{t('reportsKpiTrades')}</span>
          <strong>{totalTrades}</strong>
        </article>
        <article>
          <span>{t('reportsKpiCount')}</span>
          <strong>{strategies.length}</strong>
        </article>
      </section>

      {verifiedToast && (
        <div className={css.toast} role="status" aria-live="polite">
          <span className={css.toastMark} aria-hidden="true">✓</span>
          <div className={css.toastBody}>
            <strong>{t('justVerified')}</strong>
          </div>
          <button className={css.toastClose} type="button" aria-label={t('labClose')} onClick={() => setVerifiedToast(false)}>
            <IconX />
          </button>
        </div>
      )}
      {strategies.length > 0 && totalTrades === 0 && (
        <p className={css.scanNote} role="status">{t('reportsScanning')}</p>
      )}

      {strategies.length > 0 && (
        <section className={css.highlights}>
          {totalTrades > 0 ? (
            <>
              <article>
                <span>{t('reportsBestPnl')}</span>
                <strong>{bestPnl ? presetLabel(bestPnl.name, lng) : '—'}</strong>
                <b className={css.up}>{bestPnl ? money(bestPnl.pnl, lng) : '—'}</b>
                {bestPnl && sparkFrom(bestPnl) && <Spark values={sparkFrom(bestPnl)} up={Number(bestPnl.pnl) >= 0} />}
              </article>
              <article>
                <span>{t('reportsWorstPnl')}</span>
                <strong>{worstPnl ? presetLabel(worstPnl.name, lng) : '—'}</strong>
                <b className={css.down}>{worstPnl ? money(worstPnl.pnl, lng) : '—'}</b>
                {worstPnl && sparkFrom(worstPnl) && <Spark values={sparkFrom(worstPnl)} up={Number(worstPnl.pnl) >= 0} />}
              </article>
              <article>
                <span>{t('reportsMostTrades')}</span>
                <strong>{mostTrades ? presetLabel(mostTrades.name, lng) : '—'}</strong>
                <b>{mostTrades ? mostTrades.nTrades : '—'}</b>
                {mostTrades && sparkFrom(mostTrades) && <Spark values={sparkFrom(mostTrades)} up={Number(mostTrades.pnl) >= 0} />}
              </article>
              <article>
                <span>{t('reportsBestWr')}</span>
                <strong>{bestWr ? presetLabel(bestWr.name, lng) : '—'}</strong>
                <b className={css.up}>{bestWr ? pct(bestWr.winRate) : '—'}</b>
                {bestWr && sparkFrom(bestWr) && <Spark values={sparkFrom(bestWr)} up />}
              </article>
            </>
          ) : (
            <>
              <article>
                <span>{t('reportsRunning')}</span>
                <strong>{running}</strong>
                <b>{t('reportsRunningB', { n: strategies.length })}</b>
              </article>
              <article>
                <span>{t('reportsPausedN')}</span>
                <strong>{strategies.length - running}</strong>
                <b>{t('paused')}</b>
              </article>
              <article>
                <span>{t('reportsNewest')}</span>
                <strong>{newest ? presetLabel(newest.name, lng) : '—'}</strong>
                <b>{newest ? ageLabel(newest.createdAt, t) : '—'}</b>
              </article>
              <article>
                <span>{t('reportsKpiEquity')}</span>
                <strong>{richest ? presetLabel(richest.name, lng) : '—'}</strong>
                <b>{richest ? money(richest.equity, lng) : '—'}</b>
              </article>
            </>
          )}
        </section>
      )}

      {chartItems.length > 0 && (
        <section className={css.chartCard}>
          <div className={css.chartHead}>
            <h2>{totalTrades > 0 ? t('reportsChartT') : t('reportsChartEquityT')}</h2>
            <p>{totalTrades > 0 ? t('reportsChartL') : t('reportsChartEquityL')}</p>
          </div>
          <BarCompare items={chartItems} lng={lng} label={totalTrades > 0 ? t('reportsChartT') : t('reportsChartEquityT')} />
        </section>
      )}

      <section className={css.list}>
        <div className={css.listHead}>
          <h2>{t('reportsListT')}</h2>
          {strategies.length > 0 && (
            <div className={css.listTools}>
              <div className={css.filters} role="tablist" aria-label={t('reportsFilterAria')}>
                {[['all', 'reportsFilterAll'], ['preset', 'reportsFilterPreset'], ['recipe', 'reportsFilterMine']].map(([id, key]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={kind === id}
                    className={kind === id ? css.filterOn : css.filter}
                    onClick={() => setKind(id)}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
              <label className={css.search}>
                <span className={css.sr}>{t('reportsSearch')}</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('reportsSearchPh')}
                  aria-label={t('reportsSearch')}
                />
              </label>
            </div>
          )}
        </div>
        {waiting && (
          <div className={css.skeleton} role="status" aria-live="polite">
            <span className={css.sr}>{t('reportsLoading')}</span>
            <i /><i /><i />
          </div>
        )}
        {isError && !strategies.length && !waiting && (
          <div className={css.empty}>
            <h3>{t('reportsLoadFail')}</h3>
            <p>{t('reportsLoadFailB')}</p>
            <button className={css.cta} type="button" onClick={() => refetch()}>{t('reportsRetry')}</button>
          </div>
        )}
        {!waiting && !isError && !strategies.length && (
          <div className={css.empty}>
            <h3>{t('emptyStrategies')}</h3>
            <p>{t('emptyStrategiesB')}</p>
            <Link className={css.cta} to={`/${lng}/app/criar`}>{t('reportsNew')}</Link>
          </div>
        )}
        {strategies.length > 0 && !listed.length && <p className={css.muted}>{t('reportsSearchPh')}</p>}
        <div className={css.grid}>
          {listed.map((s) => (
            <article className={css.card} key={s.id}>
              <header>
                <div>
                  <p className={css.kind}>{s.type === 'recipe' ? t('recipe') : t('preset')}</p>
                  <h3><Link to={`/${lng}/app/strategies/${s.id}`}>{presetLabel(s.name, lng)}</Link></h3>
                </div>
                {sparkFrom(s) && <Spark values={sparkFrom(s)} up={Number(s.pnl) >= 0} />}
              </header>
              <div className={css.kpi}>
                <span>{t('equity')} <b>{money(s.equity, lng)}</b></span>
                <span className={Number(s.pnl) > 0 ? css.up : Number(s.pnl) < 0 ? css.down : ''}>{t('pnl')} <b>{money(s.pnl, lng)}</b></span>
                <span>{t('trades')} <b>{s.nTrades}</b></span>
                <span>{t('wr')} <b>{Number(s.nTrades) > 0 ? pct(s.winRate) : '—'}</b></span>
              </div>
              <div className={css.state}>
                {s.halted && <span className={`${css.pill} ${css.bad}`}>{t('halt')}</span>}
                {s.paused && <span className={css.pill}>{t('paused')}</span>}
                {s.position
                  ? <span className={css.up}>{s.position.symbol}</span>
                  : <span className={css.muted}>{t('flat')}</span>}
              </div>
              <div className={css.actions}>
                {s.paused
                  ? <button className={css.tiny} type="button" onClick={() => resume(s.id)}><IconPlay />{t('resume')}</button>
                  : <button className={css.tiny} type="button" onClick={() => pause(s.id)}><IconPause />{t('pause')}</button>}
                <button className={css.tiny} type="button" onClick={async () => {
                  const ok = await ask({ title: t('reset'), body: t('resetAsk'), confirmLabel: t('reset'), cancelLabel: t('dialogBack'), tone: 'danger', icon: 'reset' });
                  if (ok) reset(s.id);
                }}><IconReset />{t('reset')}</button>
                <button className={`${css.tiny} ${css.danger}`} type="button" onClick={async () => {
                  const ok = await ask({ title: t('remove'), body: t('removeAsk'), confirmLabel: t('remove'), cancelLabel: t('dialogBack'), tone: 'danger', icon: 'trash' });
                  if (ok) remove(s.id);
                }}><IconX />{t('remove')}</button>
                <Link className={`${css.tiny} ${css.prod}`} to={`/${lng}/app/strategies/${s.id}/producao`}>{t('toProd')}</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className={css.restore}>
        <button className={css.ghost} type="button" disabled={restoring} onClick={onRestore}>{restoring ? '…' : t('restore')}</button>
        {restoreMsg && <span>{restoreMsg}</span>}
      </div>

      <StrategyHelpBalloon strategies={strategies} />
    </div>
  );
}
