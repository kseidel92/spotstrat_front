import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePromptMutation, useRestoreMutation } from '../store';
import styles from './Onboarding.module.css';

const CHIPS = [
  { key: 'chipRise', prompt: 'Quero comprar quando uma moeda subir 1% em 3 minutos.' },
  { key: 'chipCross', prompt: 'Compra quando a média rápida cruzar a lenta para cima.' },
  { key: 'chipReversal', prompt: 'Detecta um candle de virada no gráfico de 15 minutos e compra.' },
];

export default function Onboarding() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [restore] = useRestoreMutation();
  const [sendPrompt] = usePromptMutation();

  function finish() {
    try { localStorage.setItem('spotstrat.onboarded', '1'); } catch { /* ignore */ }
    navigate(`/${lng}/app`, { replace: true });
  }

  async function activateReady() {
    setBusy(true);
    setErr('');
    try {
      await restore().unwrap();
      finish();
    } catch (error) {
      setErr(error?.data?.message || t('workingFail'));
      setBusy(false);
    }
  }

  async function createWithAi(text) {
    const value = String(text || prompt).trim();
    if (value.length < 4) return;
    setBusy(true);
    setErr('');
    try {
      await sendPrompt({
        prompt: value,
        mode: 'trade',
        options: { autoFill: true, wallet: 1000, mareMode: 'any', exit: 'history' },
      }).unwrap();
      finish();
    } catch (error) {
      setErr(error?.data?.message || t('workingFail'));
      setBusy(false);
    }
  }

  return (
    <div className={`desk ${styles.page}`}>
      <div className={styles.card}>
        <p className={styles.brand}>SpotStrat</p>
        <h1>{t('onboardingT')}</h1>
        <p className={styles.lede}>{t('onboardingL')}</p>

        {!mode && (
          <div className={styles.choices}>
            <button type="button" className={styles.choice} onClick={() => setMode('ready')} disabled={busy}>
              <strong>{t('onboardingReady')}</strong>
              <span>{t('onboardingReadyB')}</span>
            </button>
            <button type="button" className={styles.choice} onClick={() => setMode('ai')} disabled={busy}>
              <strong>{t('onboardingAi')}</strong>
              <span>{t('onboardingAiB')}</span>
            </button>
            <button type="button" className={styles.skip} onClick={finish}>{t('onboardingSkip')}</button>
          </div>
        )}

        {mode === 'ready' && (
          <div className={styles.panel}>
            <p>{t('onboardingReadyB')}</p>
            <button className="solid" type="button" disabled={busy} onClick={activateReady}>
              {busy ? t('working') : t('onboardingReady')}
            </button>
            <button className="ghost" type="button" disabled={busy} onClick={() => setMode(null)}>{t('backStep')}</button>
          </div>
        )}

        {mode === 'ai' && (
          <div className={styles.panel}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('promptPhTrade')}
              rows={3}
              disabled={busy}
            />
            <div className={styles.chips}>
              {CHIPS.map((chip) => (
                <button key={chip.key} type="button" disabled={busy} onClick={() => { setPrompt(chip.prompt); createWithAi(chip.prompt); }}>
                  {t(chip.key)}
                </button>
              ))}
            </div>
            <button className="solid" type="button" disabled={busy || prompt.trim().length < 4} onClick={() => createWithAi()}>
              {busy ? t('working') : t('createNow')}
            </button>
            <button className="ghost" type="button" disabled={busy} onClick={() => setMode(null)}>{t('backStep')}</button>
          </div>
        )}

        {err && <p className={styles.err}>{err}</p>}
        <p className={styles.foot}>
          <Link to={`/${lng}/app`}>{t('onboardingSkip')}</Link>
        </p>
      </div>
    </div>
  );
}
