import { useTranslation } from 'react-i18next';
import { EARLY_ACCESS } from '../stats';
import styles from './StatsBar.module.css';

export default function StatsBar() {
  const { t } = useTranslation();
  return (
    <section className={styles.wrap} aria-label={t('earlyLabel')}>
      <p className={styles.pill}>
        <span className={styles.dot} aria-hidden="true" />
        <strong>{t('earlyLabel')}:</strong>
        <span>
          {t('earlyLine', {
            production: EARLY_ACCESS.production,
            beta: EARLY_ACCESS.betaTraders,
          })}
        </span>
      </p>
      <p className={styles.sub}>{t('earlySub')}</p>
    </section>
  );
}
