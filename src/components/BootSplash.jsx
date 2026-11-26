import { useTranslation } from 'react-i18next';
import BrandLogo from './BrandLogo';
import styles from './BootSplash.module.css';

export default function BootSplash({ compact = false }) {
  const { t } = useTranslation();
  return (
    <div className={`${styles.shell} ${compact ? styles.compact : ''}`} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.inner}>
        <BrandLogo height={compact ? 34 : 44} className={styles.logo} />
        <div className={styles.bar} aria-hidden="true">
          <span className={styles.barFill} />
        </div>
        <p className={styles.line}>{t('loadingBootLine')}</p>
      </div>
    </div>
  );
}