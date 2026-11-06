import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import css from './ScratchWizard.module.css';

const STYLES = ['safe', 'balanced', 'momentum', 'patient'];
const TEMPOS = ['calm', 'steady', 'active'];
const MARES = ['good', 'not_bad', 'any'];
const EXITS = ['protect', 'balanced', 'trail'];

export default function ScratchWizard({ busy, onCreate }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [style, setStyle] = useState('safe');
  const [tempo, setTempo] = useState('calm');
  const [mare, setMare] = useState('good');
  const [exit, setExit] = useState('protect');

  const steps = ['style', 'tempo', 'mare', 'exit', 'review'];
  const current = steps[step];
  const last = step === steps.length - 1;

  const summary = useMemo(() => ({
    style: t(`scratchStyle_${style}_t`),
    tempo: t(`scratchTempo_${tempo}_t`),
    mare: t(`scratchMare_${mare}_t`),
    exit: t(`scratchExit_${exit}_t`),
  }), [t, style, tempo, mare, exit]);

  function buildPrompt() {
    return [
      t('scratchPromptLead'),
      t(`scratchStyle_${style}_prompt`),
      t(`scratchTempo_${tempo}_prompt`),
      t(`scratchMare_${mare}_prompt`),
      t(`scratchExit_${exit}_prompt`),
      t('scratchPromptTail'),
    ].join('\n');
  }

  function next() {
    if (last) {
      onCreate(buildPrompt(), {
        mareMode: mare,
        guided: true,
        exitMode: exit === 'protect' ? 'manual' : 'history',
        stopPct: exit === 'protect' ? '0.6' : exit === 'balanced' ? '0.8' : '1.0',
        tpPct: exit === 'protect' ? '1.0' : exit === 'balanced' ? '1.4' : '2.0',
      });
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  return (
    <div className={css.wrap}>
      <div className={css.top}>
        <p className={css.progress}>{t('scratchStep', { n: step + 1, total: steps.length })}</p>
      </div>
      <ol className={css.dots} aria-hidden="true">
        {steps.map((id, i) => <li key={id} className={i === step ? css.on : i < step ? css.done : ''} />)}
      </ol>

      {current === 'style' && (
        <section className={css.section}>
          <h2>{t('scratchStyleT')}</h2>
          <p className={css.lede}>{t('scratchStyleL')}</p>
          <div className={css.cards}>
            {STYLES.map((id) => (
              <button
                key={id}
                type="button"
                className={`${css.card} ${style === id ? css.selected : ''}`}
                onClick={() => setStyle(id)}
                disabled={busy}
              >
                {id === 'safe' && <span className={css.badge}>{t('scratchRecommended')}</span>}
                <strong>{t(`scratchStyle_${id}_t`)}</strong>
                <span>{t(`scratchStyle_${id}_b`)}</span>
                <em>{t(`scratchStyle_${id}_note`)}</em>
                <ul className={css.pros}>
                  <li>{t(`scratchStyle_${id}_pro1`)}</li>
                  <li>{t(`scratchStyle_${id}_pro2`)}</li>
                </ul>
                <ul className={css.cons}>
                  <li>{t(`scratchStyle_${id}_con1`)}</li>
                </ul>
              </button>
            ))}
          </div>
        </section>
      )}

      {current === 'tempo' && (
        <section className={css.section}>
          <h2>{t('scratchTempoT')}</h2>
          <p className={css.lede}>{t('scratchTempoL')}</p>
          <div className={css.cards}>
            {TEMPOS.map((id) => (
              <button
                key={id}
                type="button"
                className={`${css.card} ${tempo === id ? css.selected : ''}`}
                onClick={() => setTempo(id)}
                disabled={busy}
              >
                <strong>{t(`scratchTempo_${id}_t`)}</strong>
                <span>{t(`scratchTempo_${id}_b`)}</span>
                <em>{t(`scratchTempo_${id}_note`)}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      {current === 'mare' && (
        <section className={css.section}>
          <h2>{t('scratchMareT')}</h2>
          <p className={css.lede}>{t('scratchMareL')}</p>
          <div className={css.cards}>
            {MARES.map((id) => (
              <button
                key={id}
                type="button"
                className={`${css.card} ${mare === id ? css.selected : ''}`}
                onClick={() => setMare(id)}
                disabled={busy}
              >
                {id === 'good' && <span className={css.badge}>{t('scratchSafer')}</span>}
                <strong>{t(`scratchMare_${id}_t`)}</strong>
                <span>{t(`scratchMare_${id}_b`)}</span>
                <em>{t(`scratchMare_${id}_note`)}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      {current === 'exit' && (
        <section className={css.section}>
          <h2>{t('scratchExitT')}</h2>
          <p className={css.lede}>{t('scratchExitL')}</p>
          <div className={css.cards}>
            {EXITS.map((id) => (
              <button
                key={id}
                type="button"
                className={`${css.card} ${exit === id ? css.selected : ''}`}
                onClick={() => setExit(id)}
                disabled={busy}
              >
                <strong>{t(`scratchExit_${id}_t`)}</strong>
                <span>{t(`scratchExit_${id}_b`)}</span>
                <em>{t(`scratchExit_${id}_note`)}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      {current === 'review' && (
        <section className={css.section}>
          <h2>{t('scratchReviewT')}</h2>
          <p className={css.lede}>{t('scratchReviewL')}</p>
          <dl className={css.summary}>
            <div><dt>{t('scratchStyleT')}</dt><dd>{summary.style}</dd></div>
            <div><dt>{t('scratchTempoT')}</dt><dd>{summary.tempo}</dd></div>
            <div><dt>{t('scratchMareT')}</dt><dd>{summary.mare}</dd></div>
            <div><dt>{t('scratchExitT')}</dt><dd>{summary.exit}</dd></div>
          </dl>
          <p className={css.note}>{t('scratchReviewNote')}</p>
        </section>
      )}

      <div className={css.actions}>
        {step > 0 && (
          <button type="button" className={css.ghost} disabled={busy} onClick={() => setStep((s) => s - 1)}>
            {t('scratchPrev')}
          </button>
        )}
        <button type="button" className={css.solid} disabled={busy} onClick={next}>
          {busy ? t('working') : last ? t('scratchCreate') : t('scratchNext')}
        </button>
      </div>
    </div>
  );
}
