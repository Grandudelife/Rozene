(function (root) {
  'use strict';
  const VERSION = '0.5.0';
  const DEFAULT_PORT = 9150;
  const SERVICES = Object.freeze({gemini: 'https://gemini.google.com/app', flow: 'https://flow.google.com/', studio: 'https://aistudio.google.com/', notebook: 'https://notebook.google.com/'});
  const ROOTS = Object.freeze(['google.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com', 'ggpht.com']);
  const EXACT = Object.freeze(['accounts.youtube.com', 'check.torproject.org', 'labs.google']);
  function port(value) {
    if (!/^[0-9]{1,5}$/.test(String(value))) throw new Error('PORT');
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1024 || n > 65535) throw new Error('PORT');
    return n;
  }
  function kind(value = 'tor') {
    if (!['tor', 'socks5', 'http'].includes(value)) throw new Error('PROXY_TYPE');
    return value;
  }
  function pac(value, type = 'tor') {
    const k = kind(type);
    const p = port(value);
    return '// Rozaneh ' + {tor: 'Tor', socks5: 'SOCKS5', http: 'HTTP'}[k] + ' v0.5.0\n' +
      'function FindProxyForURL(url, host) {\n' +
      '  host = host.toLowerCase().replace(/\\.$/, "");\n' +
      '  var roots = ' + JSON.stringify(ROOTS) + ';\n' +
      '  var exact = ' + JSON.stringify(EXACT) + ';\n' +
      '  var proxy = "' + (k === 'http' ? 'PROXY' : 'SOCKS5') + ' 127.0.0.1:' + p + '";\n' +
      '  for (var i = 0; i < roots.length; i++) {\n' +
      '    var suffix = "." + roots[i];\n' +
      '    if (host === roots[i] || host.slice(-suffix.length) === suffix) return proxy;\n' +
      '  }\n' +
      '  for (var j = 0; j < exact.length; j++) if (host === exact[j]) return proxy;\n' +
      '  return "DIRECT";\n' +
      '}';
  }
  function config(value, type = 'tor') { return {mode: 'pac_script', pacScript: {mandatory: true, data: pac(value, type)}}; }
  function configuredConnection(settings) {
    if (settings.levelOfControl !== 'controlled_by_this_extension' || settings.value?.mode !== 'pac_script') return null;
    const data = settings.value.pacScript?.data;
    if (typeof data !== 'string') return null;
    const match = data.match(/(?:SOCKS5|PROXY) 127\.0\.0\.1:(\d{4,5})/);
    if (!match) return null;
    try {
      const p = port(match[1]);
      if (settings.value.pacScript.mandatory !== true) return null;
      for (const k of ['tor', 'socks5', 'http']) if (data === pac(p, k)) return {port: p, kind: k};
      if (data === pac(p).replace('v0.5.0', 'v0.4.1')) return {port: p, kind: 'tor'};
      return null;
    } catch { return null; }
  }
  function configuredPort(settings) { return configuredConnection(settings)?.port ?? null; }
  const api = {VERSION, SERVICES, DEFAULT_PORT, ROOTS, EXACT, port, kind, pac, config, configuredConnection, configuredPort};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Rozaneh = api;
})(globalThis);
