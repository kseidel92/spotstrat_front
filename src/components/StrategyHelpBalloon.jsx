import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStrategyHelpMutation } from '../store';

function errText(error, t) {
  return error?.data?.message || error?.error || t('workingFail');
}

export default function StrategyHelpBalloon({ strategies }) {
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
                {isLoading ? t('helpSending') : t('helpSend')}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
