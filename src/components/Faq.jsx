import { useTranslation } from 'react-i18next';
import styles from './Faq.module.css';

const ITEMS = [
  ['faq1q', 'faq1a'],
  ['faq2q', 'faq2a'],
  ['faq3q', 'faq3a'],
];

export default function Faq() {
  const { t } = useTranslation();
  return (
    <section className={styles.faq} aria-labelledby="faq-title">
      <h2 id="faq-title">{t('faqT')}</h2>
      {ITEMS.map(([q, a]) => (
        <article key={q}>
          <h3>{t(q)}</h3>
          <p>{t(a)}</p>
        </article>
      ))}
    </section>
  );
}
