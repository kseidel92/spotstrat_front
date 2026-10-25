import { configureStore } from '@reduxjs/toolkit';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { createSlice } from '@reduxjs/toolkit';

export function rememberOn() {
  try { return localStorage.getItem('tradeai_remember') !== '0'; } catch { return true; }
}

function readToken() {
  try {
    if (!rememberOn()) return sessionStorage.getItem('tradeai_token') || '';
    return localStorage.getItem('tradeai_token') || sessionStorage.getItem('tradeai_token') || '';
  } catch { return ''; }
}

function writeToken(token, remember) {
  try {
    if (remember === true) localStorage.setItem('tradeai_remember', '1');
    if (remember === false) localStorage.setItem('tradeai_remember', '0');
    localStorage.removeItem('tradeai_token');
    sessionStorage.removeItem('tradeai_token');
    if (!token) return;
    if (rememberOn()) localStorage.setItem('tradeai_token', token);
    else sessionStorage.setItem('tradeai_token', token);
  } catch { /* private mode */ }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: readToken(),
    user: null,
  },
  reducers: {
    setSession(state, action) {
      state.token = action.payload.token || '';
      state.user = action.payload.user || state.user;
      writeToken(state.token, action.payload.remember);
    },
    clearSession(state) {
      state.token = '';
      state.user = null;
      writeToken('', undefined);
    },
  },
});

export const { setSession, clearSession } = authSlice.actions;

const apiRoot = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const FETCH_MS = 8000;

function withTimeoutSignal(extra) {
  const outer = extra?.signal;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  if (outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return {
    signal: ctrl.signal,
    clear: () => clearTimeout(timer),
  };
}

const rawBase = fetchBaseQuery({
  baseUrl: apiRoot ? `${apiRoot}/v1` : '/v1',
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
  fetchFn: async (input, init) => {
    const timed = withTimeoutSignal({ signal: init?.signal });
    try {
      return await fetch(input, { ...init, signal: timed.signal });
    } catch (err) {
      if (err?.name === 'AbortError') {
        const timeout = new Error('timeout');
        timeout.name = 'TimeoutError';
        timeout.status = 'TIMEOUT_ERROR';
        throw timeout;
      }
      throw err;
    } finally {
      timed.clear();
    }
  },
});

const baseQuery = async (args, apiApi, extra) => {
  let result = await rawBase(args, apiApi, extra);
  if (result.error) {
    const status = result.error.status;
    if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR' || status === 502 || status === 503 || status === 504) {
      apiApi.dispatch({ type: 'desk/setApiOnline', payload: false });
    }
  } else {
    apiApi.dispatch({ type: 'desk/setApiOnline', payload: true });
  }
  if (result.error?.status === 401 && !(typeof args === 'object' && args.url?.includes('/auth/'))) {
    const refresh = await rawBase({ url: '/auth/refresh', method: 'POST', body: { remember: rememberOn() } }, apiApi, extra);
    if (refresh.data?.accessToken) {
      apiApi.dispatch(setSession({ token: refresh.data.accessToken, user: refresh.data.user }));
      result = await rawBase(args, apiApi, extra);
    } else {
      apiApi.dispatch(clearSession());
    }
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Me', 'Strategies', 'Desk', 'Lab', 'Job', 'Plans', 'Production'],
  endpoints: (build) => ({
    presets: build.query({ query: (locale) => `/presets?locale=${locale}` }),
    me: build.query({ query: () => '/me', providesTags: ['Me'] }),
    register: build.mutation({ query: (body) => ({ url: '/auth/register', method: 'POST', body }) }),
    login: build.mutation({ query: (body) => ({ url: '/auth/login', method: 'POST', body }) }),
    forgot: build.mutation({ query: (body) => ({ url: '/auth/forgot', method: 'POST', body }) }),
    resetPassword: build.mutation({ query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }) }),
    google: build.mutation({ query: (body) => ({ url: '/auth/google', method: 'POST', body }) }),
    verifyEmail: build.mutation({ query: (body) => ({ url: '/auth/verify-email', method: 'POST', body }), invalidatesTags: ['Me'] }),
    verifyPhone: build.mutation({ query: (body) => ({ url: '/auth/verify-phone', method: 'POST', body }), invalidatesTags: ['Me'] }),
    resend: build.mutation({ query: (body) => ({ url: '/auth/resend', method: 'POST', body }) }),
    setPhone: build.mutation({ query: (body) => ({ url: '/auth/phone', method: 'POST', body }) }),
    logout: build.mutation({ query: () => ({ url: '/auth/logout', method: 'POST' }) }),
    patchMe: build.mutation({ query: (body) => ({ url: '/me', method: 'PATCH', body }), invalidatesTags: ['Me', 'Desk'] }),
    deleteMe: build.mutation({ query: () => ({ url: '/me', method: 'DELETE' }) }),
    strategies: build.query({ query: () => '/strategies', providesTags: ['Strategies'] }),
    strategy: build.query({ query: (id) => `/strategies/${id}` }),
    prompt: build.mutation({ query: (body) => ({ url: '/strategies/prompt', method: 'POST', body }) }),
    strategyHelp: build.mutation({ query: (body) => ({ url: '/strategies/help', method: 'POST', body }) }),
    suggestGuide: build.mutation({ query: (body) => ({ url: '/strategies/guide-suggest', method: 'POST', body }) }),
    alarmChannels: build.mutation({ query: ({ id, channels }) => ({ url: `/alarms/${id}/channels`, method: 'POST', body: { channels } }) }),
    alarmPause: build.mutation({ query: (id) => ({ url: `/alarms/${id}/pause`, method: 'POST' }) }),
    alarmArm: build.mutation({ query: (id) => ({ url: `/alarms/${id}/arm`, method: 'POST' }) }),
    alarmRemove: build.mutation({ query: (id) => ({ url: `/alarms/${id}`, method: 'DELETE' }) }),
    alarmSeen: build.mutation({ query: (id) => ({ url: `/alarms/hits/${id}/seen`, method: 'POST' }) }),
    editPrompt: build.mutation({ query: ({ id, ...body }) => ({ url: `/strategies/${id}/prompt`, method: 'POST', body }) }),
    pause: build.mutation({ query: (id) => ({ url: `/strategies/${id}/pause`, method: 'POST' }), invalidatesTags: ['Strategies', 'Desk'] }),
    resume: build.mutation({ query: (id) => ({ url: `/strategies/${id}/resume`, method: 'POST' }), invalidatesTags: ['Strategies', 'Desk'] }),
    reset: build.mutation({ query: (id) => ({ url: `/strategies/${id}/reset`, method: 'POST' }), invalidatesTags: ['Strategies', 'Desk'] }),
    remove: build.mutation({ query: (id) => ({ url: `/strategies/${id}`, method: 'DELETE' }), invalidatesTags: ['Strategies', 'Desk'] }),
    restore: build.mutation({ query: () => ({ url: '/strategies/restore-presets', method: 'POST' }), invalidatesTags: ['Strategies', 'Desk'] }),
    patchStrategy: build.mutation({ query: ({ id, ...body }) => ({ url: `/strategies/${id}`, method: 'PATCH', body }), invalidatesTags: ['Strategies'] }),
    job: build.query({ query: (id) => `/jobs/${id}` }),
    desk: build.query({ query: () => '/desk/state', providesTags: ['Desk'] }),
    manifest: build.query({ query: () => '/lab/manifest' }),
    symbols: build.query({ query: () => '/lab/symbols' }),
    klines: build.query({ query: ({ symbol, interval, limit }) => `/lab/klines/${symbol}?interval=${interval}&limit=${limit}` }),
    artifacts: build.query({ query: () => '/lab/artifacts' }),
    labQuery: build.mutation({ query: (body) => ({ url: '/lab/query', method: 'POST', body }) }),
    config: build.query({ query: () => '/config' }),
    billing: build.query({ query: () => '/billing/status' }),
    plans: build.query({ query: () => '/billing/plans', providesTags: ['Plans'] }),
    checkout: build.mutation({ query: (body) => ({ url: '/billing/checkout', method: 'POST', body }), invalidatesTags: ['Me', 'Desk'] }),
    confirmSession: build.mutation({
      query: (sessionId) => ({ url: `/billing/session/${sessionId}`, method: 'GET' }),
      invalidatesTags: ['Me', 'Desk', 'Production'],
    }),
    cancelPlan: build.mutation({ query: () => ({ url: '/billing/cancel', method: 'POST' }), invalidatesTags: ['Me', 'Desk'] }),
    strategyProduction: build.query({
      query: ({ id, locale }) => `/strategies/${id}/production?locale=${locale}`,
      providesTags: ['Production'],
    }),
    buyProduction: build.mutation({
      query: ({ id, locale }) => ({ url: `/strategies/${id}/production?locale=${locale}`, method: 'POST', body: { locale } }),
      invalidatesTags: ['Production'],
    }),
  }),
});

export const {
  usePresetsQuery, useMeQuery, useRegisterMutation, useLoginMutation, useForgotMutation, useResetPasswordMutation, useGoogleMutation,
  useVerifyEmailMutation, useVerifyPhoneMutation, useResendMutation, useSetPhoneMutation,
  useLogoutMutation, usePatchMeMutation, useDeleteMeMutation, useStrategiesQuery, useStrategyQuery,
  usePromptMutation, useStrategyHelpMutation, useSuggestGuideMutation, useEditPromptMutation, useAlarmPauseMutation, useAlarmArmMutation, useAlarmRemoveMutation, useAlarmSeenMutation, useAlarmChannelsMutation, usePauseMutation, useResumeMutation, useResetMutation,
  useRemoveMutation, useRestoreMutation, usePatchStrategyMutation, useJobQuery, useDeskQuery,
  useManifestQuery, useSymbolsQuery, useKlinesQuery, useArtifactsQuery, useLabQueryMutation,
  useConfigQuery, useBillingQuery, usePlansQuery, useCheckoutMutation, useConfirmSessionMutation, useCancelPlanMutation, useStrategyProductionQuery, useBuyProductionMutation,
} = api;

const deskSlice = createSlice({
  name: 'desk',
  initialState: {
    mare: null,
    connection: 'connecting',
    prices: [],
    strategies: [],
    alarms: null,
    hits: null,
    scan: {},
    lastJob: null,
    apiOnline: true,
  },
  reducers: {
    setApiOnline(state, action) {
      state.apiOnline = !!action.payload;
    },
    ingest(state, action) {
      const msg = action.payload;
      if (msg.type === 'snapshot') {
        state.mare = msg.mare;
        state.connection = msg.connection;
        state.prices = msg.prices || [];
        state.strategies = msg.strategies || [];
        state.alarms = msg.alarms || [];
        state.hits = msg.hits || [];
        state.apiOnline = true;
      } else if (msg.type === 'prices') {
        state.prices = msg.prices || state.prices;
        state.connection = msg.connection || state.connection;
      } else if (msg.type === 'mare') {
        state.mare = msg.mare;
      } else if (msg.type === 'scan') {
        state.scan[msg.strategyId] = msg;
      } else if (msg.type === 'alarm') {
        const row = (state.alarms || []).find((item) => item.id === msg.alarmId);
        if (row) row.symbols = msg.symbols || [];
      } else if (msg.type === 'alarmChannels') {
        const row = (state.alarms || []).find((item) => item.id === msg.alarmId);
        if (row) row.channels = { ...(row.channels || {}), ...(msg.channels || {}) };
      } else if (msg.type === 'job') {
        state.lastJob = msg.job;
      } else if (msg.type === 'position' || msg.type === 'trade') {
        const row = state.strategies.find((s) => s.id === msg.strategyId);
        if (row) {
          row.position = msg.position;
          if (msg.equity != null) row.equity = msg.equity;
        }
      }
    },
  },
});

export const { ingest, setApiOnline } = deskSlice.actions;

export function patchAlarmChannels(alarmId, channels) {
  store.dispatch(ingest({ type: 'alarmChannels', alarmId, channels }));
}

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    desk: deskSlice.reducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware),
});

let socket;
let streamGen = 0;
let streamBackoffMs = 2000;
let cachedWsOrigin = (import.meta.env.VITE_WS_ORIGIN || '').replace(/\/$/, '');
let wsOriginPromise;

async function resolveWsOrigin({ force = false } = {}) {
  if (!force && wsOriginPromise) return wsOriginPromise;
  wsOriginPromise = fetch('/relay/meta', { credentials: 'omit' })
    .then(async (res) => (res.ok ? res.json() : null))
    .then((data) => {
      const origin = String(data?.wsOrigin || '').replace(/\/$/, '');
      if (origin) cachedWsOrigin = origin;
      return cachedWsOrigin || (import.meta.env.VITE_WS_ORIGIN || '').replace(/\/$/, '');
    })
    .catch(() => cachedWsOrigin || (import.meta.env.VITE_WS_ORIGIN || '').replace(/\/$/, ''))
    .finally(() => { wsOriginPromise = null; });
  return wsOriginPromise;
}

export function refreshWsOrigin(origin) {
  const next = String(origin || '').replace(/\/$/, '');
  if (next) cachedWsOrigin = next;
}

export async function connectStream() {
  const token = store.getState().auth.token || '';
  // TRAVA DE AUTENTICAÇÃO COMENTADA — o stream liga mesmo sem sessão.
  // if (!token) return;
  const mine = ++streamGen;
  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    socket.close();
  }
  const wsBase = (await resolveWsOrigin({ force: streamBackoffMs > 2000 })) || cachedWsOrigin;
  if (mine !== streamGen) return;
  const streamUrl = wsBase
    ? `${wsBase}/v1/stream?token=${encodeURIComponent(token)}`
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/v1/stream?token=${encodeURIComponent(token)}`;
  try {
    socket = new WebSocket(streamUrl);
  } catch {
    store.dispatch({ type: 'desk/setApiOnline', payload: false });
    scheduleReconnect(mine);
    return;
  }
  socket.onopen = () => {
    streamBackoffMs = 2000;
    store.dispatch({ type: 'desk/setApiOnline', payload: true });
  };
  socket.onmessage = (ev) => {
    try { store.dispatch(ingest(JSON.parse(ev.data))); } catch { /* ignore */ }
  };
  socket.onerror = () => {
    store.dispatch({ type: 'desk/setApiOnline', payload: false });
  };
  socket.onclose = () => {
    store.dispatch({ type: 'desk/setApiOnline', payload: false });
    scheduleReconnect(mine);
  };
}

function scheduleReconnect(mine) {
  if (mine !== streamGen) return;
  const wait = streamBackoffMs;
  streamBackoffMs = Math.min(streamBackoffMs * 1.6, 30000);
  setTimeout(() => {
    if (mine === streamGen) connectStream();
  }, wait);
}

export function focusStrategy(strategyId) {
  if (socket && socket.readyState === 1) {
    socket.send(JSON.stringify({ type: 'focus', strategyId }));
  }
}
