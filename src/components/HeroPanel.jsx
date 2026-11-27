import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Hero.module.css';

const POSTER = '/hero/panel-poster.webp';
const VIDEO = '/hero/panel-loop.mp4';

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export default function HeroPanel() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const videoRef = useRef(null);
  const [usePosterOnly, setUsePosterOnly] = useState(reduced);

  useEffect(() => {
    setUsePosterOnly(reduced);
  }, [reduced]);

  useEffect(() => {
    if (usePosterOnly || !videoRef.current) return undefined;
    const el = videoRef.current;
    el.play().catch(() => setUsePosterOnly(true));
    return undefined;
  }, [usePosterOnly]);

  return (
    <div className={styles.panelShell}>
      <ul className={styles.panelSteps} aria-label={t('idealT')}>
        <li>{t('stepCreateT')}</li>
        <li>{t('stepSimT')}</li>
        <li>{t('stepLiveT')}</li>
      </ul>
      {usePosterOnly ? (
        <img
          className={styles.panel}
          src={POSTER}
          alt={t('heroShotAlt')}
          width={832}
          height={1104}
          decoding="async"
          fetchPriority="high"
        />
      ) : (
        <video
          ref={videoRef}
          className={styles.panel}
          src={VIDEO}
          poster={POSTER}
          width={832}
          height={1104}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={() => setUsePosterOnly(true)}
        />
      )}
      <span className={styles.srOnly}>{t('heroShotAlt')}</span>
    </div>
  );
}