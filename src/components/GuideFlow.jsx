import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSuggestGuideMutation } from '../store';
import css from './GuideFlow.module.css';

const GUIDE_SPEC = {
  touches: { sources: ['candles'], stop: '1.6', target: '2.2' },
  swings: { sources: ['candles'], stop: '4', target: '6' },
  dump: { sources: ['candles', 'trades', 'book'], stop: '1.3', target: '2.5' },
  lead: { sources: ['candles', 'book'], stop: '2.8', target: '6.5' },
  spike: { sources: ['candles', 'trades', 'book'], stop: '1.8', target: '3.2' },
  laggard: { sources: ['candles'], stop: '2.2', target: '4.2' },
  range: { sources: ['candles'], stop: '1.6', target: '2.4' },
  pattern: { sources: ['candles'], stop: '0.8', target: '1.2' },
  cross: { sources: ['candles', 'ema'], stop: '0.8', target: '1.6' },
  breakout: { sources: ['candles'], stop: '1.2', target: '2.2' },
  momentum: { sources: ['candles', 'trades'], stop: '1', target: '1.8' },
  pressure: { sources: ['candles', 'trades', 'book'], stop: '0.9', target: '1.6' },
  recovery: { sources: ['candles', 'trades'], stop: '1.4', target: '2.4' },
  indicators: { sources: ['candles', 'ema'], stop: '1.0', target: '1.8' },
};

const TRIGGER_PRESETS = [
  { id: 'pressure', textKey: 'guideTrig_pressure_fill' },
  { id: 'recovery', textKey: 'guideTrig_recovery_fill' },
  { id: 'indicators', textKey: 'guideTrig_indicators_fill' },
  { id: 'breakout', textKey: 'guideTrig_breakout_fill' },
  { id: 'cross', textKey: 'guideTrig_cross_fill' },
];

const WATCH_OPTS = [
  { id: 'candles', tip: 'guideWatch_candles_tip' },
  { id: 'book', tip: 'guideWatch_book_tip' },
  { id: 'trades', tip: 'guideWatch_trades_tip' },
  { id: 'ema', tip: 'guideWatch_ema_tip' },
];

function detectKind(entry) {
  const text = String(entry || '').toLowerCase();
  if (/press[aã]o|fluxo|livro|tape|obi/.test(text)) return 'pressure';
  if (/recuper|caiu|queda|dump|rebote|despenc/.test(text)) return 'recovery';
  if (/indicador|rsi|macd|m[eé]dia|ema|cruz/.test(text)) return 'indicators';
  if (/toque|caixa|piso/.test(text)) return 'touches';
  if (/romp|breakout/.test(text)) return 'breakout';
  if (/engulf|engolfo|padr[aã]o|candle/.test(text)) return 'pattern';
  if (/sobe|subir|impulso|momentum/.test(text)) return 'momentum';
  return 'momentum';
}

function Tip({ text }) {
  return (
    <span className={css.tip}>
      <button type="button" className={css.tipMark} aria-label={text} title={text}>
        <span aria-hidden="true">?</span>
      </button>
      <span className={css.tipPop} role="tooltip">{text}</span>
    </span>
  );
}

function briefOf(guide, t) {
  const sourceText = {
    candles: t('guideBriefCandles'),
    trades: t('guideBriefTrades'),
    book: t('guideBriefBook'),
    ema: t('guideBriefEma'),
  };
  const exit = (guide.exitKind === 'numbers' || guide.exitKind === 'ai')
    ? `Stop ${guide.stop}% e alvo ${guide.target}% a partir da entrada.`
    : guide.exitText.trim();
  const list = guide.timing === 'confirm'
    ? `Lista: ${guide.timingText.trim() || t('guideBriefTimingConfirm')}`
    : 'Lista: não grava preço. A compra acontece no próprio gatilho.';
  const fontes = guide.sources.map((id) => sourceText[id] || id).filter(Boolean).join('; ');
  return [
    'Brief.',
    guide.name.trim() ? `Nome: ${guide.name.trim()}` : '',
    `Entrada: ${guide.entry.trim()}`,
    `Fontes: ${fontes}.`,
    list,
    `Saída: ${exit}`,
  ].filter(Boolean).join('\n');
}

export default function GuideFlow({ busy, onCreate }) {
  const { t } = useTranslation();
  const [suggestGuide] = useSuggestGuideMutation();
  const [step, setStep] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [guide, setGuide] = useState({
    entry: '',
    preset: '',
    sources: ['candles', 'book'],
    timing: 'now',
    timingText: '',
    exitKind: 'ai',
    stop: '0.8',
    target: '1.2',
    exitText: '',
    name: '',
    wallet: '1000',
  });

  const ids = ['trigger', 'watch', 'timing', 'exit', 'review'];
  const current = ids[step];
  const last = step === ids.length - 1;
  const patch = (partial) => setGuide((g) => ({ ...g, ...partial }));

  const blocked = (current === 'trigger' && !guide.entry.trim())
    || (current === 'watch' && !guide.sources.length)
    || (current === 'timing' && guide.timing === 'confirm' && !guide.timingText.trim())
    || (current === 'exit' && (guide.exitKind === 'numbers' || guide.exitKind === 'ai') && !(Number(guide.stop) > 0 && Number(guide.target) > 0))
    || (current === 'exit' && guide.exitKind === 'describe' && !guide.exitText.trim())
    || (current === 'review' && !(Number(guide.wallet) >= 100 && Number(guide.wallet) <= 999000));

  const summary = useMemo(() => ({
    entry: guide.entry.trim(),
    sources: guide.sources.map((id) => t(`guideWatch_${id}_t`)).join(' · '),
    timing: guide.timing === 'now' ? t('guideTiming_now_t') : t('guideTiming_confirm_t'),
    exit: guide.exitKind === 'ai'
      ? t('guideExit_ai_summary', { stop: guide.stop, target: guide.target })
      : guide.exitKind === 'numbers'
        ? t('guideExit_nums_summary', { stop: guide.stop, target: guide.target })
        : guide.exitText.trim(),
    wallet: guide.wallet,
  }), [guide, t]);

  function toggleSource(id) {
    const sources = guide.sources.includes(id)
      ? guide.sources.filter((item) => item !== id)
      : [...guide.sources, id];
    if (sources.length) patch({ sources });
  }

  function pickPreset(id) {
    const item = TRIGGER_PRESETS.find((p) => p.id === id);
    if (!item) return;
    const spec = GUIDE_SPEC[id] || {};
    patch({
      preset: id,
      entry: t(item.textKey),
      // Keep watch sources aligned with the catalog for this preset.
      sources: Array.isArray(spec.sources) && spec.sources.length ? [...spec.sources] : ['candles'],
    });
  }

  async function aiPickExit() {
    if (aiBusy || busy) return;
    setAiBusy(true);
    setAiNote('');
    const kind = detectKind(guide.entry);
    let spec = { ...GUIDE_SPEC[kind] };
    try {
      const remote = await suggestGuide({
        step: 'exit',
        guide: {
          entry: guide.entry,
          sources: guide.sources,
          list: guide.timing === 'confirm' ? 'yes' : 'no',
          listText: guide.timingText,
          exitKind: 'numbers',
        },
      }).unwrap();
      if (remote?.stop || remote?.target) {
        spec = {
          ...spec,
          stop: String(remote.stop || spec.stop),
          target: String(remote.target || spec.target),
          sources: Array.isArray(remote.sources) && remote.sources.length ? remote.sources : spec.sources,
        };
      }
    } catch { /* local catalog */ }
    patch({
      exitKind: 'ai',
      stop: String(spec.stop),
      target: String(spec.target),
      sources: guide.sources.length ? guide.sources : spec.sources,
    });
    setAiNote(t('guideExit_ai_done', { stop: spec.stop, target: spec.target, kind: t(`guideKind_${kind}`) }));
    setAiBusy(false);
  }

  function create() {
    const kind = detectKind(guide.entry);
    const catalog = GUIDE_SPEC[kind] || GUIDE_SPEC.momentum;
    const stop = guide.exitKind === 'ai' && !(Number(guide.stop) > 0) ? catalog.stop : guide.stop;
    const target = guide.exitKind === 'ai' && !(Number(guide.target) > 0) ? catalog.target : guide.target;
    const ready = { ...guide, stop, target };
    const brief = briefOf(ready, t);
    const manualExit = ready.exitKind === 'numbers' || ready.exitKind === 'ai';
    onCreate(brief, {
      guided: true,
      wallet: ready.wallet,
      exitMode: manualExit ? 'manual' : 'history',
      stopPct: stop,
      tpPct: target,
      mareMode: /mar[eé]|press[aã]o|bom/.test(ready.entry.toLowerCase()) ? 'good' : 'any',
    });
  }

  return (
    <div className={css.wrap}>
      <div className={css.progress}>
        <ol className={css.dots} aria-hidden="true">
          {ids.map((id, i) => (
            <li key={id} className={i === step ? css.on : i < step ? css.done : ''} />
          ))}
        </ol>
        <p>{t('stepOf', { n: step + 1, total: ids.length })}</p>
      </div>

      {current === 'trigger' && (
        <section className={css.section}>
          <h3>{t('guideTrigT')}</h3>
          <p className={css.lede}>{t('guideTrigL')}</p>
          <textarea
            className={css.area}
            value={guide.entry}
            onChange={(e) => patch({ entry: e.target.value, preset: '' })}
            placeholder={t('guideTrigPh')}
            rows={3}
          />
          <p className={css.sub}>{t('guideTrigPresets')}</p>
          <div className={css.cards}>
            {TRIGGER_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${css.card} ${guide.preset === item.id ? css.selected : ''}`}
                onClick={() => pickPreset(item.id)}
              >
                <strong>{t(`guideTrig_${item.id}_t`)}</strong>
                <span>{t(`guideTrig_${item.id}_b`)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {current === 'watch' && (
        <section className={css.section}>
          <h3>{t('guideWatchT')} <Tip text={t('guideWatchTip')} /></h3>
          <p className={css.lede}>{t('guideWatchL')}</p>
          <div className={css.cards}>
            {WATCH_OPTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${css.card} ${guide.sources.includes(item.id) ? css.selected : ''}`}
                onClick={() => toggleSource(item.id)}
                aria-pressed={guide.sources.includes(item.id)}
              >
                <strong>
                  {t(`guideWatch_${item.id}_t`)}
                  <Tip text={t(item.tip)} />
                </strong>
                <span>{t(`guideWatch_${item.id}_b`)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {current === 'timing' && (
        <section className={css.section}>
          <h3>{t('guideTimingT')} <Tip text={t('guideTimingTip')} /></h3>
          <p className={css.lede}>{t('guideTimingL')}</p>
          <div className={css.cards}>
            <button
              type="button"
              className={`${css.card} ${guide.timing === 'now' ? css.selected : ''}`}
              onClick={() => patch({ timing: 'now' })}
            >
              <strong>{t('guideTiming_now_t')}</strong>
              <span>{t('guideTiming_now_b')}</span>
              <em>{t('guideTiming_now_note')}</em>
            </button>
            <button
              type="button"
              className={`${css.card} ${guide.timing === 'confirm' ? css.selected : ''}`}
              onClick={() => patch({ timing: 'confirm' })}
            >
              <strong>{t('guideTiming_confirm_t')}</strong>
              <span>{t('guideTiming_confirm_b')}</span>
              <em>{t('guideTiming_confirm_note')}</em>
            </button>
          </div>
          {guide.timing === 'confirm' && (
            <textarea
              className={css.area}
              value={guide.timingText}
              onChange={(e) => patch({ timingText: e.target.value })}
              placeholder={t('guideTimingPh')}
              rows={2}
            />
          )}
        </section>
      )}

      {current === 'exit' && (
        <section className={css.section}>
          <h3>{t('guideExitT')} <Tip text={t('guideExitTip')} /></h3>
          <p className={css.lede}>{t('guideExitL')}</p>
          <div className={css.cards}>
            <button
              type="button"
              className={`${css.card} ${guide.exitKind === 'ai' ? css.selected : ''}`}
              onClick={() => { patch({ exitKind: 'ai' }); aiPickExit(); }}
            >
              <strong>{t('guideExit_ai_t')} <Tip text={t('guideExit_ai_tip')} /></strong>
              <span>{t('guideExit_ai_b')}</span>
              <em>{t('guideExit_ai_note')}</em>
            </button>
            <button
              type="button"
              className={`${css.card} ${guide.exitKind === 'numbers' ? css.selected : ''}`}
              onClick={() => patch({ exitKind: 'numbers' })}
            >
              <strong>{t('guideExit_nums_t')}</strong>
              <span>{t('guideExit_nums_b')}</span>
            </button>
            <button
              type="button"
              className={`${css.card} ${guide.exitKind === 'describe' ? css.selected : ''}`}
              onClick={() => patch({ exitKind: 'describe' })}
            >
              <strong>{t('guideExit_desc_t')}</strong>
              <span>{t('guideExit_desc_b')}</span>
            </button>
          </div>
          {(guide.exitKind === 'ai' || guide.exitKind === 'numbers') && (
            <div className={css.nums}>
              <label>
                {t('stopPct')}
                <input inputMode="decimal" value={guide.stop} onChange={(e) => patch({ stop: e.target.value, exitKind: guide.exitKind === 'ai' ? 'numbers' : guide.exitKind })} disabled={guide.exitKind === 'ai' && aiBusy} />
              </label>
              <label>
                {t('tpPct')}
                <input inputMode="decimal" value={guide.target} onChange={(e) => patch({ target: e.target.value, exitKind: guide.exitKind === 'ai' ? 'numbers' : guide.exitKind })} disabled={guide.exitKind === 'ai' && aiBusy} />
              </label>
              {guide.exitKind === 'ai' && (
                <button type="button" className={css.aiBtn} disabled={aiBusy || busy || !guide.entry.trim()} onClick={aiPickExit}>
                  {aiBusy ? t('aiDecideBusy') : t('guideExit_ai_recalc')}
                </button>
              )}
            </div>
          )}
          {aiNote && <p className={css.aiNote}>{aiNote}</p>}
          {guide.exitKind === 'describe' && (
            <textarea
              className={css.area}
              value={guide.exitText}
              onChange={(e) => patch({ exitText: e.target.value })}
              placeholder={t('guideExitPh')}
              rows={2}
            />
          )}
        </section>
      )}

      {current === 'review' && (
        <section className={css.section}>
          <h3>{t('guideReviewT')}</h3>
          <p className={css.lede}>{t('guideReviewL')}</p>
          <dl className={css.summary}>
            <div>
              <dt>{t('guideTrigT')}</dt>
              <dd>{summary.entry}</dd>
            </div>
            <div>
              <dt>{t('guideWatchT')}</dt>
              <dd>{summary.sources}</dd>
            </div>
            <div>
              <dt>{t('guideTimingT')}</dt>
              <dd>{summary.timing}{guide.timing === 'confirm' && guide.timingText ? ` — ${guide.timingText}` : ''}</dd>
            </div>
            <div>
              <dt>{t('guideExitT')}</dt>
              <dd>{summary.exit}</dd>
            </div>
          </dl>
          <div className={css.reviewExtras}>
            <label className={css.field}>
              {t('guideName')}
              <input value={guide.name} onChange={(e) => patch({ name: e.target.value })} placeholder={t('guideNamePh')} disabled={busy} />
            </label>
            <label className={css.field}>
              <span className={css.fieldLabel}>
                {t('wallet')}
                <Tip text={t('walletHint')} />
              </span>
              <input
                inputMode="decimal"
                min="100"
                max="999000"
                value={guide.wallet}
                onChange={(e) => patch({ wallet: e.target.value })}
                disabled={busy}
                aria-describedby="guide-wallet-hint"
              />
              <span id="guide-wallet-hint" className={css.fieldHint}>{t('walletHint')}</span>
            </label>
          </div>
          <p className={css.note}>{t('guideReviewNote')}</p>
        </section>
      )}

      <div className={css.actions}>
        {step > 0 && (
          <button type="button" className={css.ghost} disabled={busy} onClick={() => setStep((s) => s - 1)}>
            {t('backStep')}
          </button>
        )}
        {last ? (
          <button type="button" className={css.solid} disabled={busy || blocked} onClick={create}>
            {busy ? t('working') : t('guideCreate')}
          </button>
        ) : (
          <button
            type="button"
            className={css.solid}
            disabled={blocked || busy}
            onClick={() => {
              if (current === 'timing' && guide.exitKind === 'ai') aiPickExit();
              setStep((s) => s + 1);
            }}
          >
            {t('nextStep')}
          </button>
        )}
      </div>
    </div>
  );
}
