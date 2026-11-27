import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './Hero.module.css';
import img1 from './img_1.jpg';
import img3 from './img_3.jpg';
import HeroPanel from './HeroPanel';

function Title({ text, accent }) {
  const mark = String(accent || '').trim();
  const index = mark ? text.toLowerCase().indexOf(mark.toLowerCase()) : -1;
  if (index < 0) return text;
  let end = index + mark.length;
  if (text[end] === '.') end += 1;
  const head = text.slice(0, index);
  const accentChunk = text.slice(index, end);
  const tail = text.slice(end).trimStart();
  return (
    <>
      {head}
      <span className={styles.accent}>{accentChunk}</span>
      {tail ? ` ${tail}` : null}
    </>
  );
}

export default function Hero() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const title = t('hero');

  return (
    <section className={styles.hero}>
      <img className={styles.bg} src={img3} alt="" aria-hidden="true" />
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
          </div>
          <ol className={styles.rail}>
            <li><span>1</span>{t('stepCreateT')}</li>
            <li><span>2</span>{t('stepSimT')}</li>
            <li><span>3</span>{t('stepLiveT')}</li>
          </ol>
        </div>
        <div className={styles.visual}>
          <span className={styles.visualGlow} aria-hidden="true" />
          <img className={styles.glow} src={img1} alt="" aria-hidden="true" />
          <div className={styles.frame}>
            <HeroPanel />
          </div>
        </div>
      </div>
    </section>
  );
}
