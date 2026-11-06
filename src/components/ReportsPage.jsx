import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useDeskQuery, usePauseMutation, useResumeMutation, useResetMutation, useRemoveMutation, useRestoreMutation, api, ingest } from '../store';
import { useConfirm } from '../confirm';
import StrategyHelpBalloon from './StrategyHelpBalloon';
import css from './ReportsPage.module.css';

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
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

function BarCompare({ items }) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <div className={css.bars} role="img" aria-label="PnL">
      {items.map((item) => (
        <div key={item.id} className={css.barRow}>
          <span className={css.barName}>{item.name}</span>
          <div className={css.barTrack}>
            <i
              className={item.value >= 0 ? css.barUp : css.barDown}
              style={{ width: `${Math.max(6, (Math.abs(item.value) / max) * 100)}%` }}
            />
          </div>
          <b className={item.value >= 0 ? css.up : css.down}>{money(item.value)}</b>
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
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>;
}
function IconX() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

function sparkFrom(s) {
  const base = Number(s.equity) - Number(s.pnl || 0);
  const pnl = Number(s.pnl || 0);
  return [base, base + pnl * 0.25, base + pnl * 0.55, base + pnl * 0.8, base + pnl];
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const live = useSelector((s) => s.desk);
  const { data } = useDeskQuery(undefined, { pollingInterval: 5000 });
  const strategies = live.strategies.length ? live.strategies : (data?.strategies || []);
  const mare = live.mare || data?.mare;
  const connection = live.connection || data?.connection;
  const dispatch = useDispatch();
  const ask = useConfirm();
  const [pause] = usePauseMutation();
  const [resume] = useResumeMutation();
  const [reset] = useResetMutation();
  const [remove] = useRemoveMutation();
  const [restore, { isLoading: restoring }] = useRestoreMutation();
  const [restoreMsg, setRestoreMsg] = useState('');

  const bestPnl = strategies.reduce((a, s) => (!a || Number(s.pnl) > Number(a.pnl) ? s : a), null);
  const worstPnl = strategies.reduce((a, s) => (!a || Number(s.pnl) < Number(a.pnl) ? s : a), null);
  const mostTrades = strategies.reduce((a, s) => (!a || Number(s.nTrades) > Number(a.nTrades) ? s : a), null);
  const bestWr = strategies.filter((s) => Number(s.nTrades) > 0).reduce((a, s) => (!a || Number(s.winRate) > Number(a.winRate) ? s : a), null);
  const totalEquity = strategies.reduce((sum, s) => sum + Number(s.equity || 0), 0);
  const totalPnl = strategies.reduce((sum, s) => sum + Number(s.pnl || 0), 0);
  const totalTrades = strategies.reduce((sum, s) => sum + Number(s.nTrades || 0), 0);

  const chartItems = [...strategies]
    .sort((a, b) => Number(b.pnl) - Number(a.pnl))
    .slice(0, 6)
    .map((s) => ({ id: s.id, name: s.name, value: Number(s.pnl || 0) }));

  const mareLabel = mare?.label === 'BOA' ? t('mareGood')
    : mare?.label === 'RUIM' ? t('mareNotBad')
      : (mare?.label || '…');

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
      <header className={css.head}>
        <div>
          <p className={css.kicker}>{t('reportsNav')}</p>
          <h1>{t('reportsT')}</h1>
          <p className={css.lede}>{t('reportsL')}</p>
        </div>
        <Link className={css.cta} to={`/${lng}/app`}>{t('reportsNew')}</Link>
      </header>

      <div className={css.live}>
        <span className={css.pill}>{t('marketLive')}</span>
        <span className={css.pill}>{t('moodMarket')}: {mare ? `${mareLabel} · ${mare.upPct}%` : '…'}</span>
        <span className={`${css.conn} ${connection === 'live' ? css.liveOk : css.liveDown}`}>
          <i />{t('connection')}: {connection || '…'}
        </span>
      </div>

      <section className={css.kpis}>
        <article>
          <span>{t('reportsKpiEquity')}</span>
          <strong>{money(totalEquity)}</strong>
        </article>
        <article>
          <span>{t('reportsKpiPnl')}</span>
          <strong className={totalPnl >= 0 ? css.up : css.down}>{money(totalPnl)}</strong>
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

      {strategies.length > 0 && (
        <section className={css.highlights}>
          <article>
            <span>{t('reportsBestPnl')}</span>
            <strong>{bestPnl?.name || '—'}</strong>
            <b className={css.up}>{bestPnl ? money(bestPnl.pnl) : '—'}</b>
            {bestPnl && <Spark values={sparkFrom(bestPnl)} up={Number(bestPnl.pnl) >= 0} />}
          </article>
          <article>
            <span>{t('reportsWorstPnl')}</span>
            <strong>{worstPnl?.name || '—'}</strong>
            <b className={css.down}>{worstPnl ? money(worstPnl.pnl) : '—'}</b>
            {worstPnl && <Spark values={sparkFrom(worstPnl)} up={Number(worstPnl.pnl) >= 0} />}
          </article>
          <article>
            <span>{t('reportsMostTrades')}</span>
            <strong>{mostTrades?.name || '—'}</strong>
            <b>{mostTrades ? mostTrades.nTrades : '—'}</b>
            {mostTrades && <Spark values={sparkFrom(mostTrades)} up={Number(mostTrades.pnl) >= 0} />}
          </article>
          <article>
            <span>{t('reportsBestWr')}</span>
            <strong>{bestWr?.name || '—'}</strong>
            <b className={css.up}>{bestWr ? pct(bestWr.winRate) : '—'}</b>
            {bestWr && <Spark values={sparkFrom(bestWr)} up />}
          </article>
        </section>
      )}

      {chartItems.length > 0 && (
        <section className={css.chartCard}>
          <div className={css.chartHead}>
            <h2>{t('reportsChartT')}</h2>
            <p>{t('reportsChartL')}</p>
          </div>
          <BarCompare items={chartItems} />
        </section>
      )}

      <section className={css.list}>
        <div className={css.listHead}>
          <h2>{t('reportsListT')}</h2>
        </div>
        {!strategies.length && (
          <div className={css.empty}>
            <h3>{t('emptyStrategies')}</h3>
            <p>{t('emptyStrategiesB')}</p>
            <Link className={css.cta} to={`/${lng}/app`}>{t('reportsNew')}</Link>
          </div>
        )}
        <div className={css.grid}>
          {strategies.map((s) => (
            <article className={css.card} key={s.id}>
              <header>
                <div>
                  <p className={css.kind}>{s.type === 'recipe' ? t('recipe') : t('preset')}</p>
                  <h3><Link to={`/${lng}/app/strategies/${s.id}`}>{s.name}</Link></h3>
                </div>
                <Spark values={sparkFrom(s)} up={Number(s.pnl) >= 0} />
              </header>
              <div className={css.kpi}>
                <span>{t('equity')} <b>{money(s.equity)}</b></span>
                <span className={Number(s.pnl) > 0 ? css.up : Number(s.pnl) < 0 ? css.down : ''}>{t('pnl')} <b>{money(s.pnl)}</b></span>
                <span>{t('trades')} <b>{s.nTrades}</b></span>
                <span>{t('wr')} <b>{pct(s.winRate)}</b></span>
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
                }}><IconTrash />{t('reset')}</button>
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
