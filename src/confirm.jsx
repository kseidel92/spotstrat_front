import { createContext, useContext, useEffect, useState } from 'react';

const ConfirmContext = createContext(null);

export function useConfirm() {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error('confirm');
  return ask;
}

function Icon({ kind }) {
  if (kind === 'reset') {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
      </svg>
    );
  }
  if (kind === 'alert') {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 4.8 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0Z" />
      </svg>
    );
  }
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M8 7l1 13h6l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function ConfirmProvider({ children }) {
  const [ask, setAsk] = useState(null);

  function open(opts) {
    return new Promise((resolve) => {
      setAsk({
        title: opts.title || '',
        body: opts.body || '',
        tone: opts.tone || 'danger',
        icon: opts.icon || 'trash',
        confirmLabel: opts.confirmLabel || 'OK',
        cancelLabel: opts.cancelLabel || 'Cancelar',
        resolve,
      });
    });
  }

  function close(value) {
    setAsk((current) => {
      current?.resolve(value);
      return null;
    });
  }

  useEffect(() => {
    if (!ask) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ask]);

  return (
    <ConfirmContext.Provider value={open}>
      {children}
      {ask && (
        <div className="confirm-back" role="presentation" onMouseDown={() => close(false)}>
          <div
            className="confirm-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={`confirm-icon ${ask.tone}`}><Icon kind={ask.icon} /></div>
            <h3 id="confirm-title">{ask.title}</h3>
            <p>{ask.body}</p>
            <div className="confirm-actions">
              <button className="ghost" type="button" onClick={() => close(false)}>{ask.cancelLabel}</button>
              <button className={ask.tone === 'danger' ? 'danger' : 'solid'} type="button" onClick={() => close(true)}>{ask.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
