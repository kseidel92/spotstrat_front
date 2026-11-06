import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './LandingJourney.module.css';

const STEPS = [
  { t: 'stepCreateT', b: 'stepCreate', n: '01' },
  { t: 'stepSimT', b: 'stepSim', n: '02' },
  { t: 'stepLiveT', b: 'stepLive', n: '03' },
];

export default function LandingJourney({ examples = [] }) {
  const { t } = useTranslation();
  const { lng } = useParams();
  return (
    <section className={styles.wrap} aria-labelledby="journey-title">
      <div className={styles.inner}>
        <p className={styles.kicker}>{t('idealK')}</p>
        <h2 id="journey-title" className={styles.title}>{t('idealT')}</h2>
        <p className={styles.lede}>{t('idealL')}</p>
        <ol className={styles.steps}>
          {STEPS.map((step) => (
            <li key={step.n} className={styles.step}>
              <span className={styles.num}>{step.n}</span>
              <h3>{t(step.t)}</h3>
              <p>{t(step.b)}</p>
            </li>
          ))}
        </ol>
        {!!examples.length && (
          <div className={styles.chips}>
            {examples.map((ex) => <span key={ex} className={styles.chip}>{ex}</span>)}
          </div>
        )}
        <div className={styles.cta}>
          <Link className={styles.btn} to={`/${lng}/register`}>{t('freeCta')}</Link>
          <p className={styles.note}>{t('freeNote')}</p>
        </div>
      </div>
    </section>
  );
}
