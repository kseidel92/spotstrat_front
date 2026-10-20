const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('/home/klaus/projects/tradeai/apis/node_modules/ws');

const PORT = 9333;

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.waiters = new Map();
    this.events = [];
    ws.on('message', (buf) => {
      const msg = JSON.parse(buf.toString());
      if (msg.id && this.waiters.has(msg.id)) {
        const { resolve, reject } = this.waiters.get(msg.id);
        this.waiters.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) this.events.push(msg);
    });
  }
  send(method, params = {}) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.waiters.set(id, { resolve, reject }));
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ' ' + (result.exceptionDetails.exception?.description || ''));
    return result.result.value;
  }
}

async function main() {
  const chrome = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/tradeai-chrome-ui', 'about:blank',
  ], { stdio: 'ignore' });
  let list;
  for (let i = 0; i < 30; i++) {
    try { list = await get(`http://127.0.0.1:${PORT}/json/list`); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.on('open', resolve));
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'window.__errs=[];addEventListener("error",e=>window.__errs.push(String(e.message)));addEventListener("unhandledrejection",e=>window.__errs.push(String(e.reason)));',
  });

  async function go(url) {
    await cdp.send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 800));
    for (let i = 0; i < 20; i++) {
      const ready = await cdp.eval('document.body && document.body.innerText.length > 40');
      if (ready) return;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('página vazia ' + url);
  }

  const fails = [];
  function check(name, cond) {
    console.log(cond ? `ok  ${name}` : `FAIL ${name}`);
    if (!cond) fails.push(name);
  }

  await go('http://127.0.0.1:5173/pt-BR');
  let text = '';
  for (let i = 0; i < 20; i++) {
    text = await cdp.eval('document.body.innerText');
    if (text.includes('Oscilação · 3 toques')) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  check('landing pt', text.includes('Automatize e aprimore') && text.includes('Criar conta') && text.includes('chave da Binance') && text.includes('EMA 9') && text.includes('engulfing bullish'));
  check('presets', text.includes('Oscilação · 3 toques') && text.includes('Liderança largo'));
  check('sem rodapé antigo', !text.includes('matching engine') && !text.includes('só long'));

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise((r) => setTimeout(r, 300));
  const mobile = await cdp.eval('document.body.scrollWidth <= 420');
  check('mobile sem overflow', mobile);
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  await cdp.eval(`document.querySelectorAll('.flags button')[1].click()`);
  await new Promise((r) => setTimeout(r, 400));
  text = await cdp.eval('document.body.innerText');
  check('flag en', locationOk(text) && text.includes('Create account'));

  await go('http://127.0.0.1:5173/en/precos');
  text = await cdp.eval('document.body.innerText');
  check('preços en', text.includes('$18.41') && text.includes('R$') && text.includes('93,33') && !text.includes('139,99'));
  await go('http://127.0.0.1:5173/pt-BR/precos');
  text = await cdp.eval('document.body.innerText');
  check('preços', text.includes('93,33') && text.includes('ilimitad') && text.includes('Um plano') && !text.includes('139,99'));

  await go('http://127.0.0.1:5173/pt-BR/register');
  const stamp = Date.now();
  const email = `ui${stamp}@tradeai.local`;
  const phone = `+55119${String(stamp).slice(-8)}`;
  await cdp.eval(`
    const set = (el, value) => {
      const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
      d.set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = [...document.querySelectorAll('form.auth input')];
    set(inputs[0], 'Klaus UI');
    set(inputs[1], ${JSON.stringify(email)});
    set(inputs[2], 'senha-forte');
    set(inputs[3], 'senha-forte');
    set(inputs[4], ${JSON.stringify(phone)});
    document.querySelector('button.solid').click();
  `);
  for (let i = 0; i < 30; i++) {
    const href = await cdp.eval('location.pathname');
    if (href.includes('/verify')) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  text = await cdp.eval('document.body.innerText');
  check('verify mostra códigos', /Código do e-mail \d{6}/.test(text) && /Código do celular \d{6}/.test(text));
  for (let i = 0; i < 30; i++) {
    const ready = await cdp.eval('document.querySelector("button.solid") && !document.querySelector("button.solid").disabled');
    if (ready) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const emailCode = (text.match(/Código do e-mail (\d{6})/) || [])[1];
  const phoneCode = (text.match(/Código do celular (\d{6})/) || [])[1];
  await cdp.eval(`(() => {
    const setNative = (el, value) => {
      const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
      d.set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = [...document.querySelectorAll('input')];
    setNative(inputs[0], ${JSON.stringify(emailCode)});
    setNative(inputs[1], ${JSON.stringify(phoneCode)});
    document.querySelector('button.solid').click();
  })()`);
  let onDesk = false;
  for (let i = 0; i < 40; i++) {
    const href = await cdp.eval('location.pathname');
    if (href.endsWith('/app')) { onDesk = true; break; }
    await new Promise((r) => setTimeout(r, 250));
  }
  text = '';
  if (onDesk) {
    for (let i = 0; i < 20; i++) {
      text = await cdp.eval('document.body.innerText');
      if ((text.match(/equity/g) || []).length >= 6) break;
      await new Promise((r) => setTimeout(r, 300));
    }
  } else {
    console.log('parado em', await cdp.eval('location.pathname'), (await cdp.eval('document.body.innerText')).slice(0, 500));
  }
  check('desk 6 presets', onDesk && (text.match(/equity/g) || []).length >= 6);
  check('alarmes no desk', text.includes('Alarmes') && text.includes('Só me avisar') && text.includes('Nenhum alarme armado'));
  check('radios de saída', text.includes('histórico de 18 meses') && text.includes('Eu informo o stop'));
  check('carteira', text.includes('Carteira') && text.includes('1000') && !text.includes('spike') && !/serra/i.test(text));
  const ph = await cdp.eval('document.querySelector("textarea").placeholder');
  check('placeholder paper', ph.includes('Crie uma estratégia') && ph.includes('EMA 9'));
  await cdp.eval(`[...document.querySelectorAll('.modes button')].find(b => b.textContent.includes('avisar')).click()`);
  await new Promise((r) => setTimeout(r, 200));
  const phAlarm = await cdp.eval('document.querySelector("textarea").placeholder');
  check('placeholder alarme', /avise/i.test(phAlarm) && ph.startsWith('Ex'));
  check('maré ou mercado', /BOA|RUIM|NEUTRA|mercado/.test(text));
  await cdp.eval(`[...document.querySelectorAll('.modes button')].find(b => b.textContent.includes('paper')).click()`);
  await new Promise((r) => setTimeout(r, 150));

  await cdp.eval(`(() => {
    const setNative = (el, value) => {
      const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
      d.set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setNative(document.querySelector('textarea'), 'Quero uma caixa de 4 horas com dois toques no piso, stop 1,6% e alvo 2,2%.');
    document.querySelector('form.panel button.solid').click();
  })()`);
  let appeared = false;
  for (let i = 0; i < 30; i++) {
    text = await cdp.eval('document.body.innerText');
    if (text.includes('Caixa de toques')) { appeared = true; break; }
    await new Promise((r) => setTimeout(r, 400));
  }
  check('prompt criou estratégia', appeared);

  await cdp.eval(`[...document.querySelectorAll('a')].find(a => a.textContent.includes('Caixa de toques')).click()`);
  await new Promise((r) => setTimeout(r, 800));
  text = await cdp.eval('document.body.innerText');
  check('explicação', text.includes('Tese') && text.includes('piso'));

  await cdp.eval(`[...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Laboratório').click()`);
  await new Promise((r) => setTimeout(r, 1000));
  text = await cdp.eval('document.body.innerText');
  check('histórico', text.includes('BTCUSDT') && text.includes('sem livro'));
  await cdp.eval(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('BTCUSDT')).click()`);
  let canvas = false;
  for (let i = 0; i < 40; i++) {
    canvas = await cdp.eval('!!document.querySelector(".chart canvas") || !!document.querySelector("canvas")');
    if (canvas) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  check('gráfico', canvas);

  await cdp.eval(`[...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Conta').click()`);
  await new Promise((r) => setTimeout(r, 600));
  text = await cdp.eval('document.body.innerText');
  check('conta', text.includes(email) && text.includes('Salvar') && !text.includes('Maré da conta'));

  const errs = await cdp.eval('window.__errs || []');
  check('sem erro de página', !errs.length);
  if (errs.length) console.log(errs);

  chrome.kill();
  ws.close();
  if (fails.length) {
    console.error('falhou:', fails.join(', '));
    process.exit(1);
  }
  console.log('ui ok', email);
}

function locationOk(text) {
  return text.includes('Automate and improve your trades');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
