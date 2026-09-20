'use strict';
const el = id => document.getElementById(id);
let current = null;
let busy = false;
const errors = {
  PORT: 'درگاه باید یک عدد صحیح بین ۱۰۲۴ و ۶۵۵۳۵ باشد.',
  CONTROL: 'یک افزونهٔ دیگر یا سیاست مدیریتی، پروکسی کروم را کنترل می‌کند. VeePN و افزونه‌های پروکسی دیگر را غیرفعال کنید.',
  OFF: 'ابتدا مسیر Tor را فعال کنید.',
  CHANGED: 'تنظیم مسیر هنگام آزمایش تغییر کرد؛ دوباره آزمایش کنید.',
  API: 'کروم نتوانست این کار را انجام دهد. پنجرهٔ افزونه را دوباره باز کنید و گزارش را بررسی کنید.'
};
function feedback(text = '', error = false) { el('feedback').textContent = text; el('feedback').dataset.error = String(error); }
function controls() {
  el('toggle').disabled = busy || !current;
  el('check').disabled = busy || !current?.enabled;
  el('port').disabled = busy || !!current?.enabled;
  el('copy').disabled = busy || !current;
}
function render(state) {
  current = state;
  el('port').value = state.port;
  el('toggle').textContent = state.enabled ? 'خاموش‌کردن مسیر Tor' : 'فعال‌کردن مسیر Tor';
  let title = 'روزنه خاموش است', description = 'Tor را متصل نگه دارید، سپس مسیر را فعال و آزمایش کنید.', error = false;
  if (state.enabled) {
    title = 'مسیر Tor تنظیم شد';
    description = 'اکنون «آزمایش اتصال Tor» را بزنید. تنظیم مسیر به‌تنهایی اتصال را تأیید نمی‌کند.';
    if (state.check?.result === 'tor') {
      title = 'اتصال آزمایشی از Tor عبور کرد';
      description = 'سرویس موردنظر را باز کنید. ورود و دریافت پاسخ یا تولید محتوا باید در همان سرویس بررسی شود.';
    } else if (state.check?.result === 'not-tor') {
      title = 'خروجی Tor تأیید نشد';
      description = 'سرویس بررسی، این اتصال را Tor تشخیص نداد. تداخل پروکسی و تنظیم Tor را بررسی کنید.'; error = true;
    } else if (state.check?.result === 'unreachable') {
      title = 'آزمایش اتصال کامل نشد';
      description = 'Tor باید باز و متصل باشد. درگاه محلی یا سرویس بررسی ممکن است در دسترس نباشد؛ راهنمای نصب را ببینید.'; error = true;
    }
  } else if (['controlled_by_other_extensions', 'not_controllable'].includes(state.levelOfControl)) {
    title = 'کنترل پروکسی در اختیار روزنه نیست'; description = errors.CONTROL; error = true;
  }
  el('title').textContent = title; el('description').textContent = description;
  document.querySelector('.status').dataset.state = error ? 'error' : 'normal'; controls();
}
async function command(type, extra = {}) {
  if (busy) return;
  busy = true; controls(); feedback(type === 'check' ? 'در حال آزمایش؛ حداکثر حدود ۲۰ ثانیه…' : '');
  try {
    const result = await chrome.runtime.sendMessage({type, ...extra});
    if (!result?.ok) throw new Error(result?.error || 'API');
    render(result.state); feedback();
  } catch (error) { feedback(errors[error.message] || errors.API, true); }
  finally { busy = false; controls(); }
}
el('toggle').addEventListener('click', () => command(current?.enabled ? 'disable' : 'enable', {port: el('port').value}));
el('check').addEventListener('click', () => command('check'));
el('open').addEventListener('click', () => chrome.tabs.create({url: 'https://gemini.google.com/app'}));
el('flow').addEventListener('click', () => chrome.tabs.create({url: 'https://flow.google.com/'}));
el('notebook').addEventListener('click', () => chrome.tabs.create({url: 'https://notebook.google.com/'}));
el('guide').addEventListener('click', () => chrome.tabs.create({url: chrome.runtime.getURL('guide.html')}));
el('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(JSON.stringify(current, null, 2)); feedback('گزارش کپی شد؛ شامل متن گفتگو، کوکی یا IP نیست.'); }
  catch { feedback('کپی انجام نشد؛ از وضعیت افزونه تصویر بفرستید.', true); }
});
command('status');
