import styles from './Badge.module.css';

export default function Badge({ children }) {
  return (
    <p className={styles.badge}>
      <span aria-hidden="true">🎁</span>
      {children}
    </p>
  );
}
