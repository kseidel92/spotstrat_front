import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';

const stripeCache = new Map();

function stripePromiseFor(key) {
  if (!key) return null;
  if (!stripeCache.has(key)) stripeCache.set(key, loadStripe(key));
  return stripeCache.get(key);
}

export default function StripeCheckout({
  clientSecret,
  publishableKey,
  onClose,
  title,
}) {
  const stripePromise = useMemo(() => stripePromiseFor(publishableKey), [publishableKey]);
  const options = useMemo(() => ({ clientSecret }), [clientSecret]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!clientSecret || !publishableKey) return undefined;
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, [clientSecret, publishableKey]);

  const onKey = useCallback((e) => {
    if (e.key === 'Escape' && onClose) onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  if (!clientSecret || !publishableKey || !stripePromise || !ready) return null;

  return (
    <div className="stripe-modal" role="dialog" aria-modal="true" aria-label={title || 'Checkout'}>
      <button type="button" className="stripe-modal-backdrop" aria-label="Fechar" onClick={onClose} />
      <div className="stripe-modal-panel">
        <div className="stripe-modal-head">
          <strong>{title || 'Checkout'}</strong>
          {onClose ? (
            <button type="button" className="tiny" onClick={onClose}>×</button>
          ) : null}
        </div>
        <div className="stripe-modal-body">
          <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
}
