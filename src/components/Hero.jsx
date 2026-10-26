import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './Hero.module.css';
import img1 from './img_1.jpg';
import img3 from './img_3.jpg';
import img4 from './img_4.png';

function Title({ text, accent }) {
  const mark = String(accent || '').trim();
  const index = mark ? text.toLowerCase().indexOf(mark.toLowerCase()) : -1;
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <span className={styles.accent}>{text.slice(index, index + mark.length)}</span>
      {text.slice(index + mark.length)}
    </>
  );
}

export default function Hero() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const title = t('hero');

  return (
    <section className={styles.hero}>
      <img className={styles.bg} src={img3} alt="" />
      <div className={styles.overlay} />
      <div className={styles.grid}>
        <div className={styles.copy}>
          <p className={styles.kicker}>{t('heroKicker')}</p>
          <h1 className={styles.title}>
            <Title text={title} accent={t('heroAccent')} />
          </h1>
          <p className={styles.subtitle}>{t('lede')}</p>
          <div className={styles.actions}>
            <Link className={styles.cta} to={`/${lng}/register`} aria-label={t('freeCta')}>{t('freeCta')}</Link>
            <p className={styles.note}>{t('freeNote')}</p>
          </div>
        </div>
        <div className={styles.visual}>
          <img className={styles.glow} src={img1} alt="" />
          <img className={styles.panel} src={img4} alt={title} />
        </div>
      </div>
    </section>
  );
}
