'use strict';
importScripts('core.js');
const R = globalThis.Rozaneh;
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
  const saved = await call(chrome.storage.local, 'get', {port: R.DEFAULT_PORT, kind: 'tor'});
  let preferredPort;
  try { preferredPort = R.port(saved.port); } catch { preferredPort = R.DEFAULT_PORT; }
  const active = R.configuredConnection(current);
  let preferredKind;
  try { preferredKind = R.kind(saved.kind); } catch { preferredKind = 'tor'; }
  return {
    extension: 'Rozaneh', version: R.VERSION, enabled: active !== null,
    port: active?.port ?? preferredPort, kind: active?.kind ?? preferredKind, levelOfControl: current.levelOfControl,
    endpoint: '127.0.0.1', scope: 'Google web domains + labs.google + Tor check',
    check: active !== null ? lastCheck : null,
    note: 'Connectivity check is not proof of successful Gemini / Flow / AI Studio / Notebook use; no prompts, cookies, URLs or IP addresses are collected.'
  };
}
async function badge() {
  const settings = await proxyGet();
  const active = R.configuredPort(settings) !== null;
  await chrome.action.setBadgeText({text: active ? (R.configuredConnection(settings).kind === 'tor' ? 'TOR' : 'ON') : ''});
  await chrome.action.setBadgeBackgroundColor({color: '#087568'});
  await chrome.action.setTitle({title: active ? 'روزنه: مسیر اتصال تنظیم است؛ عملکرد سرویس را بررسی کنید' : 'روزنه: خاموش'});
}
async function enable(value, type) {
  const k = R.kind(type);
  const p = R.port(value);
  const before = await proxyGet();
  if (!['controllable_by_this_extension', 'controlled_by_this_extension'].includes(before.levelOfControl)) throw new Error('CONTROL');
  await call(chrome.storage.local, 'set', {port: p, kind: k});
  lastCheck = null;
  await call(chrome.proxy.settings, 'set', {value: R.config(p, k), scope: 'regular'});
  const after = await proxyGet();
  if (R.configuredPort(after) !== p || R.configuredConnection(after)?.kind !== k) throw new Error('CONTROL');
  await badge();
  return status();
}
async function openService(service, value, type) {
  if (!Object.prototype.hasOwnProperty.call(R.SERVICES, service)) throw new Error('SERVICE');
  let state = await status();
  // Establish and verify ownership before any Google tab can make a request.
  if (!state.enabled) state = await enable(value ?? state.port, type ?? state.kind);
  const verified = R.configuredConnection(await proxyGet());
  if (verified?.port !== state.port || verified?.kind !== state.kind) throw new Error('CONTROL');
  await call(chrome.tabs, 'create', {url: R.SERVICES[service]});
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
  const connection = R.configuredConnection(before);
  const p = connection?.port ?? null;
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
    result = {result: data.IsTor ? 'tor' : connection.kind === 'tor' ? 'not-tor' : 'proxy', at: new Date().toISOString()};
  } catch (error) {
    result = {result: 'unreachable', at: new Date().toISOString()};
  } finally { clearTimeout(timer); }
  const after = await proxyGet();
  if (generation !== revision || R.configuredPort(after) !== p || R.configuredConnection(after)?.kind !== connection.kind) throw new Error('CHANGED');
  lastCheck = result;
  return status();
}
const codes = new Set(['PORT', 'CONTROL', 'OFF', 'CHANGED', 'SERVICE', 'PROXY_TYPE', 'API']);
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || sender.tab || sender.url !== chrome.runtime.getURL('popup.html')) return false;
  const handlers = {status, enable: () => enable(message.port, message.kind), disable, check: checkTor, open: () => openService(message.service, message.port, message.kind)};
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
