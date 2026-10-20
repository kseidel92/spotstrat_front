import { useTranslation } from 'react-i18next';
import styles from './LaunchPrice.module.css';

export default function LaunchPrice() {
  const { t } = useTranslation();
  return (
    <div className={styles.block}>
      <p className={styles.badge}>{t('betaPrice')}</p>
      <p className={styles.note}>{t('betaPriceNote')}</p>
    </div>
  );
}
