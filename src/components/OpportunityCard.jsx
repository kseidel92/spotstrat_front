import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LIVE } from '../stats';
import styles from './OpportunityCard.module.css';

export default function OpportunityCard() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const stats = [
    [LIVE.production, 'statProduction'],
    [LIVE.activeTraders, 'statActive'],
    [LIVE.created, 'statCreated'],
  ];
  return (
    <section className={styles.wrap} aria-labelledby="opp-title">
      <article className={styles.card}>
        <h2 id="opp-title">{t('oppTitle')}</h2>
        <dl className={styles.stats}>
          {stats.map(([value, key]) => (
            <div key={key}>
              <dt>{value}</dt>
              <dd>{t(key)}</dd>
            </div>
          ))}
        </dl>
        <p>{t('oppBody')}</p>
        <Link className={styles.cta} to={`/${lng}/register`} aria-label={t('freeCta')}>
          {t('freeCta')}
        </Link>
      </article>
    </section>
  );
}
