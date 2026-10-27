import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { useTranslation } from 'react-i18next';
import {
  useArtifactsQuery, useJobQuery, useKlinesQuery, useLabQueryMutation, useManifestQuery, useMeQuery, useSymbolsQuery,
} from '../store';
import css from './Lab.module.css';
import { useConfirm } from '../confirm';

const LabCtx = createContext(null);

function Icon({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const icon = {
  plus: 'M12 5v14M5 12h14',
  pencil: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  trash: 'M4 7h16M9 7V5h6v2M8 7l1 13h6l1-13',
  send: 'M22 2 11 13M22 2 15 22l-4-9-9-4Z',
  info: 'M12 16v-4M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  chart: 'M4 19V5M4 19h16M8 16l3-4 3 2 4-6',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8ZM14 3v5h5',
};

function storageKey(userId) {
  return userId ? `spotstrat.lab.threads.${userId}` : 'spotstrat.lab.threads';
}

function readStore(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) || 'null');
    if (!parsed || !Array.isArray(parsed.threads)) return { threads: [], activeId: null };
    return { threads: parsed.threads, activeId: parsed.activeId || null };
  } catch {
    return { threads: [], activeId: null };
  }
}

function uid() {
  return `lab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function titleFromPrompt(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > 52 ? `${clean.slice(0, 52).trim()}…` : clean;
}

function titleFromReply(reply) {
  const line = String(reply || '').split('\n').map((item) => item.trim()).find(Boolean) || '';
  const bold = /^\*\*(.+)\*\*$/.exec(line);
  const value = (bold ? bold[1] : line).replace(/\*\*/g, '').trim();
  if (value.length < 8 || value.length > 72) return '';
  return value;
}

function reducer(state, action) {
  if (action.type === 'hydrate') return action.state;
  if (action.type === 'new') {
    const thread = {
      id: action.id,
      title: action.title,
      renamed: false,
      messages: [],
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    return { threads: [thread, ...state.threads], activeId: thread.id };
  }
  if (action.type === 'select') return { ...state, activeId: action.id };
  if (action.type === 'rename') {
    const title = String(action.title || '').trim();
    if (!title) return state;
    return {
      ...state,
      threads: state.threads.map((thread) => (
        thread.id === action.id ? { ...thread, title, renamed: true, updatedAt: Date.now() } : thread
      )),
    };
  }
  if (action.type === 'remove') {
    const threads = state.threads.filter((thread) => thread.id !== action.id);
    return { threads, activeId: state.activeId === action.id ? (threads[0]?.id || null) : state.activeId };
  }
  if (action.type === 'append') {
    return {
      ...state,
      threads: state.threads.map((thread) => {
        if (thread.id !== action.id) return thread;
        const messages = [...thread.messages, action.message];
        let title = thread.title;
        if (!thread.renamed && action.message.role === 'user' && thread.messages.length === 0) {
          title = titleFromPrompt(action.message.content) || title;
        }
        if (!thread.renamed && action.message.role === 'assistant') {
          const fromReply = titleFromReply(action.message.content);
          const prior = thread.messages.filter((item) => item.role === 'assistant').length;
          if (fromReply && prior === 0) title = fromReply;
        }
        return { ...thread, messages, title, updatedAt: Date.now() };
      }),
    };
  }
  return state;
}

function seedFlag(userId) {
  return userId ? `spotstrat.lab.seeded.${userId}` : 'spotstrat.lab.seeded';
}

function LabThreads({ userId, children }) {
  const [state, dispatch] = useReducer(reducer, userId, readStore);
  const seeding = useRef(false);
  useEffect(() => {
    dispatch({ type: 'hydrate', state: readStore(userId) });
  }, [userId]);
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const current = readStore(userId);
        if (current.threads.length > 0) {
          localStorage.setItem(seedFlag(userId), '1');
          return;
        }
        seeding.current = true;
        const res = await fetch(`/lab-seed.json?t=${Date.now()}`);
        if (!res.ok) return;
        const seed = await res.json();
        const incoming = Array.isArray(seed?.threads) ? seed.threads : [];
        if (!incoming.length || cancelled) return;
        const next = {
          threads: incoming,
          activeId: incoming[0].id,
        };
        localStorage.setItem(storageKey(userId), JSON.stringify(next));
        localStorage.setItem(seedFlag(userId), '1');
        if (!cancelled) dispatch({ type: 'hydrate', state: next });
      } catch { /* ignore */ }
      finally { seeding.current = false; }
    })();
    return () => { cancelled = true; };
  }, [userId]);
  useEffect(() => {
    if (seeding.current && state.threads.length === 0) return;
    try { localStorage.setItem(storageKey(userId), JSON.stringify(state)); } catch { /* private mode */ }
  }, [state, userId]);
  const api = useMemo(() => ({
    threads: state.threads,
    activeId: state.activeId,
    active: state.threads.find((thread) => thread.id === state.activeId) || null,
    create: (title) => {
      const empty = state.threads.find((thread) => thread.messages.length === 0);
      if (empty) {
        dispatch({ type: 'select', id: empty.id });
        return empty.id;
      }
      const id = uid();
      dispatch({ type: 'new', id, title });
      return id;
    },
    select: (id) => dispatch({ type: 'select', id }),
    rename: (id, title) => dispatch({ type: 'rename', id, title }),
    remove: (id) => dispatch({ type: 'remove', id }),
    append: (id, message) => dispatch({ type: 'append', id, message }),
  }), [state]);
  return <LabCtx.Provider value={api}>{children}</LabCtx.Provider>;
}

function useLabThreads() {
  return useContext(LabCtx);
}

function friendlyWhen(iso, locale, t) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t('labToday', { time });
  if (date.toDateString() === yesterday.toDateString()) return t('labYesterday', { time });
  const day = date.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  return `${day} · ${time}`;
}

function LabMessage({ role, content }) {
  const blocks = String(content || '').split('\n');
  return (
    <div className={`${css.bubble} ${role === 'user' ? css.user : css.assistant}`}>
      {blocks.map((line, i) => {
        const bold = /^\*\*(.+)\*\*$/.exec(line.trim());
        if (bold) return <strong key={i}>{bold[1]}</strong>;
        if (!line.trim()) return <br key={i} />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i}>
            {parts.map((part, j) => {
              const mark = /^\*\*(.+)\*\*$/.exec(part);
              return mark ? <strong key={j}>{mark[1]}</strong> : part;
            })}
          </p>
        );
      })}
    </div>
  );
}

function Candle({ symbol }) {
  const ref = useRef(null);
  const { data, isFetching } = useKlinesQuery({ symbol, interval: '1h', limit: 500 }, { skip: !symbol });
  const { t } = useTranslation();
  useEffect(() => {
    if (!ref.current || !data?.bars?.length) return undefined;
    const chart = createChart(ref.current, {
      height: 380,
      layout: { background: { color: '#10141b' }, textColor: '#e8eaef' },
      grid: { vertLines: { color: '#2a2f3a' }, horzLines: { color: '#2a2f3a' } },
      timeScale: { timeVisible: true },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#06b6d4', downColor: '#ff6d5a', borderVisible: false, wickUpColor: '#06b6d4', wickDownColor: '#ff6d5a',
    });
    series.setData(data.bars);
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [data]);
  if (!symbol) return null;
  return <div>{isFetching && <p>{t('loading')}</p>}<div ref={ref} /></div>;
}

function LabScreen() {
  const { t, i18n } = useTranslation();
  const confirmAsk = useConfirm();
  const lab = useLabThreads();
  const manifest = useManifestQuery();
  const symbols = useSymbolsQuery();
  const artifacts = useArtifactsQuery();
  const [ask] = useLabQueryMutation();
  const [prompt, setPrompt] = useState('');
  const [err, setErr] = useState('');
  const [jobId, setJobId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 861px)').matches);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const job = useJobQuery(jobId, { skip: !jobId, pollingInterval: jobId ? 700 : 0 });
  const endRef = useRef(null);
  const boxRef = useRef(null);
  const pendingThread = useRef(null);
  const handledJob = useRef(null);
  const promptRef = useRef('');
  const busy = !!jobId;
  const messages = lab.active?.messages || [];

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(180, Math.max(48, el.scrollHeight))}px`;
  }, [prompt]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  useEffect(() => {
    const status = job.data?.job?.status;
    const id = job.data?.job?.id;
    if (!status || status === 'queued' || status === 'running' || !id || handledJob.current === id) return;
    handledJob.current = id;
    const threadId = pendingThread.current;
    setJobId(null);
    if (!threadId) return;
    if (status === 'done') {
      const pay = job.data.job.output?.payload || {};
      const reply = job.data.job.output?.reply || pay.reply || '';
      lab.append(threadId, { role: 'assistant', content: reply, refs: pay.refs });
      setErr('');
    } else {
      lab.append(threadId, { role: 'assistant', content: job.data.job.error || t('labError') });
    }
  }, [job.data, lab, t]);

  const list = useMemo(() => {
    const all = symbols.data?.symbols || [];
    const query = q.trim().toUpperCase();
    return all.filter((item) => !query || item.symbol.includes(query)).slice(0, 24);
  }, [symbols.data, q]);

  const when = friendlyWhen(manifest.data?.end, i18n.language, t);
  const pairs = manifest.data?.symbols;

  function insertLead(lead) {
    setBox(promptRef.current.startsWith(lead) ? promptRef.current : `${lead}${promptRef.current}`);
    boxRef.current?.focus();
  }

  function setBox(value) {
    promptRef.current = value;
    setPrompt(value);
  }

  async function submit(event) {
    event?.preventDefault();
    const text = promptRef.current.trim();
    if (!text || busy) return;
    setErr('');
    const thread = lab.active;
    const history = (thread?.messages || []).map(({ role, content }) => ({ role, content }));
    const threadId = thread?.id || lab.create(t('labNew'));
    pendingThread.current = threadId;
    lab.append(threadId, { role: 'user', content: text });
    setBox('');
    try {
      const res = await ask({ prompt: text, history, locale: i18n.language }).unwrap();
      setJobId(res.jobId);
    } catch (error) {
      setErr(error?.data?.message || t('labError'));
    }
  }

  function pickThread(id) {
    lab.select(id);
    if (window.matchMedia('(max-width: 860px)').matches) setSidebarOpen(false);
  }

  return (
    <div className={`${css.page} ${sidebarOpen ? '' : css.pageCollapsed}`}>
      {sidebarOpen && window.matchMedia('(max-width: 860px)').matches && (
        <button className={css.backdrop} type="button" aria-label={t('labClose')} onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`${css.sidebar} ${sidebarOpen ? css.sidebarOpen : ''}`}>
        <div className={css.sideHead}>
          <strong>{t('labThreads')}</strong>
          <button className={`${css.iconBtn} ${css.closeSide}`} type="button" aria-label={t('labClose')} onClick={() => setSidebarOpen(false)}>
            <Icon d={icon.close} />
          </button>
        </div>
        <ul className={css.sideList}>
          {lab.threads.map((thread) => (
            <li key={thread.id} className={css.threadRow}>
              {editing === thread.id ? (
                <input
                  className={css.rename}
                  value={draft}
                  autoFocus
                  aria-label={t('labRename')}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => { lab.rename(thread.id, draft); setEditing(null); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { lab.rename(thread.id, draft); setEditing(null); }
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <button type="button" className={`${css.threadBtn} ${thread.id === lab.activeId ? css.threadOn : ''}`} onClick={() => pickThread(thread.id)}>
                  <span>{thread.title}</span>
                  <small>{new Date(thread.updatedAt).toLocaleString(i18n.language, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                </button>
              )}
              <div className={css.threadTools}>
                <button className={css.iconBtn} type="button" aria-label={t('labRename')} onClick={() => { setEditing(thread.id); setDraft(thread.title); }}>
                  <Icon d={icon.pencil} />
                </button>
                <button className={css.iconBtn} type="button" aria-label={t('labDelete')} onClick={async () => {
                  const ok = await confirmAsk({ title: t('labDelete'), body: t('labDeleteAsk'), confirmLabel: t('labDelete'), cancelLabel: t('dialogBack'), tone: 'danger', icon: 'trash' });
                  if (ok) lab.remove(thread.id);
                }}>
                  <Icon d={icon.trash} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <div className={css.main}>
        <header className={css.head}>
          <div className={css.titleBlock}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className={css.menuBtn} type="button" aria-label={t('labMenu')} onClick={() => setSidebarOpen((open) => !open)}>
                <Icon d={icon.menu} />
              </button>
              <h2 className={css.title}>{t('labNav')}</h2>
            </div>
            <p className={css.meta}>
              {when ? t('labUpdated', { when }) : t('labNote')}
              {pairs ? ` · ${t('labPairs', { n: pairs })}` : ''}
            </p>
          </div>
          <button className={css.newBtn} type="button" onClick={() => { lab.create(t('labNew')); if (window.matchMedia('(max-width: 860px)').matches) setSidebarOpen(false); }}>
            <Icon d={icon.plus} />
            {t('labNew')}
          </button>
        </header>
        <p className={css.banner}>
          <Icon d={icon.info} />
          <span>{t('labChatHint')}</span>
        </p>
        <section className={css.chat} aria-busy={busy}>
          <div className={css.stream}>
            {!messages.length && <p className={css.empty}>{t('labEmptyChat')}</p>}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={css.turn}>
                <LabMessage role={message.role} content={message.content} />
                {message.refs?.length > 0 && (
                  <details className={css.refs}>
                    <summary>{t('labRefs')}</summary>
                    <ul>
                      {message.refs.map((ref) => <li key={ref.id || ref.name}><strong>{ref.name}</strong> — {ref.summary}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            ))}
            {busy && (
              <div className={css.typing} aria-label={t('labThinking')}>
                <i /><i /><i />
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form className={css.dock} onSubmit={submit}>
            <div className={css.chips}>
              <button className={css.chip} type="button" onClick={() => insertLead(t('labChipStopLead'))}>{t('labChipStop')}</button>
              <button className={css.chip} type="button" onClick={() => insertLead(t('labChipRiskLead'))}>{t('labChipRisk')}</button>
              <button className={css.chip} type="button" onClick={() => insertLead(t('labChipSimLead'))}>{t('labChipSim')}</button>
            </div>
            <div className={css.composer}>
              <div className={css.toolCol}>
                <button className={css.iconBtn} type="button" title={t('labUsePair')} aria-label={t('labUsePair')} onClick={() => insertLead(t('labPairLead', { symbol }))}>
                  <Icon d={icon.chart} />
                </button>
                <button className={css.iconBtn} type="button" title={t('labUseFile')} aria-label={t('labUseFile')} onClick={() => insertLead(t('labFileLead'))}>
                  <Icon d={icon.file} />
                </button>
              </div>
              <textarea
                ref={boxRef}
                value={prompt}
                rows={1}
                placeholder={t('labPlaceholder')}
                disabled={busy}
                onChange={(e) => setBox(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); }
                }}
              />
              <div className={css.sendCol}>
                <button className={css.send} type="submit" disabled={busy || !prompt.trim()} aria-label={t('send')}>
                  <Icon d={icon.send} />
                </button>
              </div>
            </div>
            {err && <p className={css.err}>{err}</p>}
          </form>
        </section>
        <details className={css.data}>
          <summary>{t('labDataTitle')}</summary>
          <input className={css.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} />
          <div className="symbols" style={{ margin: '12px 0' }}>
            {list.map((item) => (
              <button type="button" key={item.symbol} className={symbol === item.symbol ? 'on' : ''} onClick={() => setSymbol(item.symbol)}>
                <strong>{item.symbol}</strong>
                <div className={item.changePct >= 0 ? 'up' : 'down'}>{Number(item.changePct).toFixed(1)}%</div>
              </button>
            ))}
          </div>
          <Candle symbol={symbol} />
          <h3>{t('sweeps')}</h3>
          {(artifacts.data?.artifacts || []).slice(0, 12).map((item) => (
            <p key={item.id}><strong>{item.name}</strong><br /><span className="muted">{item.summary}</span></p>
          ))}
        </details>
      </div>
    </div>
  );
}

export default function LabPage() {
  const me = useMeQuery();
  return (
    <LabThreads userId={me.data?.user?.id || ''}>
      <LabScreen />
    </LabThreads>
  );
}
