import { useEffect, useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { LOCALES } from '../i18n';
import { useContactMutation, useMeQuery } from '../store';
import styles from './HelpWidget.module.css';

function localeFromPath(pathname) {
  const first = String(pathname || '').split('/').filter(Boolean)[0] || '';
  return LOCALES.some((l) => l.id === first) ? first : 'pt-BR';
}

export default function HelpWidget() {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const lng = localeFromPath(pathname);
  const token = useSelector((s) => s.auth.token);
  const { data: me } = useMeQuery(undefined, { skip: !token });
  const [send, { isLoading }] = useContactMutation();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!me?.user) return;
    setName((prev) => prev || me.user.name || '');
    setContact((prev) => prev || me.user.email || me.user.phone || '');
  }, [me]);

  useEffect(() => {
    if (LOCALES.some((l) => l.id === lng) && i18n.language !== lng) i18n.changeLanguage(lng);
  }, [lng, i18n]);

  useEffect(() => {
    setOk(false);
    setErr('');
  }, [pathname]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setOk(false);
    try {
      await send({
        name,
        contact,
        message,
        locale: lng || 'pt-BR',
        pagePath: pathname,
      }).unwrap();
      setOk(true);
      setMessage('');
    } catch (error) {
      setErr(error?.data?.message || t('helpFail'));
    }
  }

  return (
    <div className={styles.root}>
      {open ? (
        <section className={styles.panel} role="dialog" aria-labelledby={titleId}>
          <header className={styles.head}>
            <div>
              <p id={titleId} className={styles.title}>{t('helpTitle')}</p>
              <p className={styles.lead}>{t('helpLead')}</p>
            </div>
            <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label={t('helpClose')}>
              ×
            </button>
          </header>
          {ok ? (
            <div className={styles.okBlock}>
              <p className={styles.ok}>{t('helpOk')}</p>
              <p className={styles.discord}>
                <a href="https://discord.gg/TmytNbTZn" target="_blank" rel="noopener noreferrer">{t('footerDiscord')}</a>
              </p>
            </div>
          ) : (
            <form className={styles.form} onSubmit={onSubmit}>
              <label>
                <span>{t('helpName')}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={120} />
              </label>
              <label>
                <span>{t('helpContact')}</span>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  autoComplete="email"
                  required
                  maxLength={200}
                  placeholder={t('helpContactPh')}
                />
              </label>
              <label>
                <span>{t('helpMessage')}</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  minLength={8}
                  maxLength={5000}
                  rows={4}
                  placeholder={t('helpMessagePh')}
                />
              </label>
              {err ? <p className={styles.err}>{err}</p> : null}
              <button className={styles.send} type="submit" disabled={isLoading}>
                {isLoading ? t('helpSending') : t('helpSend')}
              </button>
            </form>
          )}
        </section>
      ) : null}
      {!open ? (
        <button
          type="button"
          className={styles.fab}
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          {t('helpFab')}
        </button>
      ) : null}
    </div>
  );
}
