import { useTranslation } from 'react-i18next';
import { LIVE } from '../stats';
import styles from './StatsBar.module.css';

export default function StatsBar() {
  const { t } = useTranslation();
  const line = t('liveLine', {
    production: LIVE.production,
    active: LIVE.activeTraders,
  });
  return (
    <section className={styles.wrap} aria-label={line}>
      <p className={styles.pill}>
        <span className={styles.dot} aria-hidden="true" />
        <strong>{line}</strong>
      </p>
    </section>
  );
}
