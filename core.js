(function (root) {
  'use strict';
  const DEFAULT_PORT = 9150;
  const ROOTS = Object.freeze(['google.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com', 'ggpht.com']);
  const EXACT = Object.freeze(['accounts.youtube.com', 'check.torproject.org', 'labs.google']);
  function port(value) {
    if (!/^[0-9]{1,5}$/.test(String(value))) throw new Error('PORT');
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1024 || n > 65535) throw new Error('PORT');
    return n;
  }
  function pac(value) {
    const p = port(value);
    return '// Rozaneh Tor v0.4.1\n' +
      'function FindProxyForURL(url, host) {\n' +
      '  host = host.toLowerCase().replace(/\\.$/, "");\n' +
      '  var roots = ' + JSON.stringify(ROOTS) + ';\n' +
      '  var exact = ' + JSON.stringify(EXACT) + ';\n' +
      '  var proxy = "SOCKS5 127.0.0.1:' + p + '";\n' +
      '  for (var i = 0; i < roots.length; i++) {\n' +
      '    var suffix = "." + roots[i];\n' +
      '    if (host === roots[i] || host.slice(-suffix.length) === suffix) return proxy;\n' +
      '  }\n' +
      '  for (var j = 0; j < exact.length; j++) if (host === exact[j]) return proxy;\n' +
      '  return "DIRECT";\n' +
      '}';
  }
  function config(value) { return {mode: 'pac_script', pacScript: {mandatory: true, data: pac(value)}}; }
  function configuredPort(settings) {
    if (settings.levelOfControl !== 'controlled_by_this_extension' || settings.value?.mode !== 'pac_script') return null;
    const data = settings.value.pacScript?.data;
    if (typeof data !== 'string') return null;
    const match = data.match(/SOCKS5 127\.0\.0\.1:(\d{4,5})/);
    if (!match) return null;
    try { const p = port(match[1]); return data === pac(p) && settings.value.pacScript.mandatory === true ? p : null; }
    catch { return null; }
  }
  const api = {DEFAULT_PORT, ROOTS, EXACT, port, pac, config, configuredPort};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Rozaneh = api;
})(globalThis);
