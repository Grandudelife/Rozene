'use strict';
importScripts('core.js');
const R = globalThis.Rozane;
let serial = Promise.resolve();
let lastCheck = null;
let generation = 0;
function call(object, method, arg) {
  return new Promise((resolve, reject) => {
    object[method](arg, result => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error('API'));
      else resolve(result);
    });
  });
}
const proxyGet = () => call(chrome.proxy.settings, 'get', {incognito: false});
async function status() {
  const current = await proxyGet();
  const saved = await call(chrome.storage.local, 'get', {port: R.DEFAULT_PORT});
  let preferredPort;
  try { preferredPort = R.port(saved.port); } catch { preferredPort = R.DEFAULT_PORT; }
  const activePort = R.configuredPort(current);
  return {
    extension: 'Rozane Tor', version: '0.4.0', enabled: activePort !== null,
    port: activePort ?? preferredPort, levelOfControl: current.levelOfControl,
    endpoint: '127.0.0.1', scope: 'Google web domains + labs.google + Tor check',
    check: activePort !== null ? lastCheck : null,
    note: 'Tor check is not proof of successful Gemini / Flow / Notebook use; no prompts, cookies, URLs or IP addresses are collected.'
  };
}
async function badge() {
  const settings = await proxyGet();
  const active = R.configuredPort(settings) !== null;
  await chrome.action.setBadgeText({text: active ? 'TOR' : ''});
  await chrome.action.setBadgeBackgroundColor({color: '#087568'});
  await chrome.action.setTitle({title: active ? 'روزن: مسیر Tor تنظیم است؛ عملکرد سرویس را بررسی کنید' : 'روزن: خاموش'});
}
async function enable(value) {
  const p = R.port(value);
  const before = await proxyGet();
  if (!['controllable_by_this_extension', 'controlled_by_this_extension'].includes(before.levelOfControl)) throw new Error('CONTROL');
  await call(chrome.storage.local, 'set', {port: p});
  lastCheck = null;
  await call(chrome.proxy.settings, 'set', {value: R.config(p), scope: 'regular'});
  const after = await proxyGet();
  if (R.configuredPort(after) !== p) throw new Error('CONTROL');
  await badge();
  return status();
}
async function disable() {
  // Remove our preference, including a currently hidden lower-priority setting.
  // Never write a captured system/other-extension setting back into our scope.
  await call(chrome.proxy.settings, 'clear', {scope: 'regular'});
  lastCheck = null;
  await badge();
  return status();
}
async function checkTor() {
  const before = await proxyGet();
  const p = R.configuredPort(before);
  if (p === null) throw new Error('OFF');
  const revision = generation;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 18000);
  let result;
  try {
    const response = await fetch('https://check.torproject.org/api/ip', {
      credentials: 'omit', cache: 'no-store', redirect: 'error', signal: abort.signal
    });
    if (!response.ok) throw new Error('CHECK_HTTP');
    const data = await response.json();
    if (typeof data.IsTor !== 'boolean') throw new Error('CHECK_FORMAT');
    // Intentionally discard the API's IP field.
    result = {result: data.IsTor ? 'tor' : 'not-tor', at: new Date().toISOString()};
  } catch (error) {
    result = {result: 'unreachable', at: new Date().toISOString()};
  } finally { clearTimeout(timer); }
  const after = await proxyGet();
  if (generation !== revision || R.configuredPort(after) !== p) throw new Error('CHANGED');
  lastCheck = result;
  return status();
}
const codes = new Set(['PORT', 'CONTROL', 'OFF', 'CHANGED', 'API']);
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.tab || sender.url !== chrome.runtime.getURL('popup.html')) return false;
  const handlers = {status, enable: () => enable(message.port), disable, check: checkTor};
  if (!Object.prototype.hasOwnProperty.call(handlers, message?.type)) return false;
  serial = serial.catch(() => {}).then(async () => {
    try { reply({ok: true, state: await handlers[message.type]()}); }
    catch (error) { reply({ok: false, error: codes.has(error.message) ? error.message : 'API'}); }
  });
  return true;
});
chrome.proxy.settings.onChange.addListener(() => {
  generation++;
  lastCheck = null;
  badge().catch(() => {});
});
chrome.runtime.onInstalled.addListener(() => { badge().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { badge().catch(() => {}); });
