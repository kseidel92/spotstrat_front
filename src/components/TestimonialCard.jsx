import { useTranslation } from 'react-i18next';
import styles from './TestimonialCard.module.css';

export default function TestimonialCard() {
  const { t } = useTranslation();
  const name = t('quoteName');
  return (
    <figure className={styles.card}>
      <span className={styles.mark} aria-hidden="true">“</span>
      <blockquote>
        <p>{t('quote')}</p>
      </blockquote>
      <figcaption>
        <span className={styles.avatar} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M5.5 19.2c1.2-3 3.4-4.4 6.5-4.4s5.3 1.4 6.5 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <span>
          <strong>{name}</strong>
          <span className={styles.role}>{t('quoteRole')}</span>
        </span>
      </figcaption>
    </figure>
  );
}
