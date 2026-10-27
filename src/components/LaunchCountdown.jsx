import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSiteQuery } from '../store';
import styles from './LaunchCountdown.module.css';

/** 18 Nov 2026, 15:00 Brasília (GMT−3, sem horário de verão). */
export const LAUNCH_AT = Date.UTC(2026, 10, 18, 18, 0, 0);

function partsOf(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export default function LaunchCountdown() {
  const { t } = useTranslation();
  const { data } = useSiteQuery(undefined, { pollingInterval: 60000 });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const left = LAUNCH_AT - now;
  const launched = left <= 0;
  const parts = partsOf(left);
  const accounts = data?.accounts;

  const units = [
    [parts.days, 'launchDays'],
    [pad(parts.hours), 'launchHours'],
    [pad(parts.minutes), 'launchMinutes'],
    [pad(parts.seconds), 'launchSeconds'],
  ];

  return (
    <section className={styles.wrap} aria-labelledby="launch-title">
      <article className={styles.card}>
        {launched ? (
          <h2 id="launch-title">{t('launchDone')}</h2>
        ) : (
          <>
            <p className={styles.kicker}>{t('launchTestEnds')}</p>
            <h2 id="launch-title">{t('launchOfficial')}</h2>
            <dl className={styles.clock} aria-live="polite">
              {units.map(([value, key]) => (
                <div key={key}>
                  <dt>{value}</dt>
                  <dd>{t(key)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <p className={styles.accounts}>
          <strong>{accounts == null ? '…' : accounts}</strong>
          <span>{t('launchAccounts')}</span>
        </p>
      </article>
    </section>
  );
}
