const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../core.js');

function route(host, port = 9150) {
  const ctx = vm.createContext({});
  vm.runInContext(R.pac(port), ctx);
  return ctx.FindProxyForURL('https://' + host + '/app', host);
}
test('all required Google destinations including new generation API use SOCKS without direct fallback', () => {
  for (const host of ['gemini.google.com','aistudio.google.com','makersuite.google.com','generativelanguage.googleapis.com','flow.google.com','notebook.google.com','notebooklm.google.com','labs.google','aisandbox-pa.googleapis.com','accounts.google.com','mail.google.com','geminiweb-pa.clients6.google.com','content.googleapis.com','lh3.googleusercontent.com','gemini.gstatic.com','lh3.ggpht.com','accounts.youtube.com','check.torproject.org','GEMINI.GOOGLE.COM.']) {
    assert.equal(route(host), 'SOCKS5 127.0.0.1:9150', host);
  }
});
test('domain boundary prevents suffix lookalikes and unrelated destinations from using Tor', () => {
  for (const host of ['evilgoogle.com','google.com.evil.test','evillabs.google','labs.google.evil.test','notgoogleapis.com','check.torproject.org.evil.test','evil.check.torproject.org','example.com','localhost','127.0.0.1','youtube.com']) assert.equal(route(host), 'DIRECT', host);
});
test('PAC has no DNS-resolving functions or target fail-open fallback', () => {
  assert.doesNotMatch(R.pac(9150), /dnsResolve|isResolvable|myIpAddress|SOCKS5[^\n]*;\s*DIRECT/);
  assert.equal(R.config(9150).pacScript.mandatory, true);
});
test('port input cannot inject PAC and preserves loopback host', () => {
  for (const bad of [0,80,65536,-1,1.5,'9150; DIRECT','+9150','9e3',' 9150',null,{},Infinity,'0010240']) assert.throws(() => R.port(bad));
  assert.equal(route('gemini.google.com',19150),'SOCKS5 127.0.0.1:19150');
});
test('effective state requires both actual ownership and exact intended PAC', () => {
  assert.equal(R.configuredPort({levelOfControl:'controlled_by_this_extension',value:R.config(19150)}),19150);
  assert.equal(R.configuredPort({levelOfControl:'controlled_by_other_extensions',value:R.config(19150)}),null);
  const modified=R.config(9150); modified.pacScript.data+='\n';
  assert.equal(R.configuredPort({levelOfControl:'controlled_by_this_extension',value:modified}),null);
});

function mock({owner='controllable_by_this_extension',isTor=true,fetchFails=false,initialValue={mode:'system'},loseOnSet=false,tabsFail=false}={}) {
  let settings={levelOfControl:owner,value:initialValue};
  let saved={port:9150}, listener, fetchOptions, fetchCount=0, sets=0, clears=0, onChange;
  const opened=[];
  const chrome={
    runtime:{id:'test',lastError:null,getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>listener=f},onInstalled:{addListener(){}},onStartup:{addListener(){}}},
    proxy:{settings:{
      get(arg, cb){cb(structuredClone(settings));},
      set(arg,cb){sets++;settings={levelOfControl:'controlled_by_this_extension',value:structuredClone(arg.value)};if(loseOnSet)settings.levelOfControl='controlled_by_other_extensions';onChange?.();cb();},
      clear(arg,cb){clears++;if(settings.levelOfControl==='controlled_by_this_extension')settings={levelOfControl:'controllable_by_this_extension',value:{mode:'system'}};onChange?.();cb();},
      onChange:{addListener:f=>onChange=f}
    }},
    storage:{local:{get(arg,cb){cb({...arg,...saved});},set(arg,cb){Object.assign(saved,arg);cb();}}},
    tabs:{create(arg,cb){if(tabsFail){chrome.runtime.lastError={message:'failure'};cb();chrome.runtime.lastError=null;}else{assert.notEqual(R.configuredPort(settings),null);opened.push(arg.url);cb({id:1});}}},
    action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{},setTitle:async()=>{}}
  };
  const ctx=vm.createContext({chrome,Rozaneh:R,importScripts(){},AbortController,setTimeout,clearTimeout,fetch:async (url,options)=>{
    fetchCount++;fetchOptions=options;
    assert.equal(url,'https://check.torproject.org/api/ip');
    if(fetchFails)throw new Error('failed');
    return {ok:true,json:async()=>({IsTor:isTor,IP:'192.0.2.123'})};
  }});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),ctx);
  const sender={id:'test',url:'chrome-extension://test/popup.html'};
  return {
    send:message=>new Promise(resolve=>{assert.equal(listener(message,sender,resolve),true);}),
    get opened(){return opened;}, get sets(){return sets;}, get clears(){return clears;},get fetchCount(){return fetchCount;},get fetchOptions(){return fetchOptions;},
    state:()=>structuredClone(settings),
    external(){settings={levelOfControl:'controlled_by_other_extensions',value:{mode:'direct'}};onChange?.();},
    untrusted:message=>listener(message,{...sender,tab:{id:1}},()=>assert.fail('untrusted callback'))
  };
}
test('fresh install is off; enabling persists PAC; disabling restores underlying decision without writing direct',async()=>{
  const m=mock();
  assert.equal((await m.send({type:'status'})).state.enabled,false);
  assert.equal((await m.send({type:'enable',port:9150})).state.enabled,true);
  assert.equal(m.state().value.mode,'pac_script');
  assert.equal((await m.send({type:'disable'})).state.enabled,false);
  assert.equal(m.sets,1);assert.equal(m.clears,1);assert.equal(m.state().value.mode,'system');assert.equal(m.fetchCount,0);
});
test('other extension or managed policy cannot be silently overridden',async()=>{
  for(const owner of ['controlled_by_other_extensions','not_controllable']){
    const m=mock({owner});const result=await m.send({type:'enable',port:9150});
    assert.equal(result.error,'CONTROL');assert.equal(m.sets,0);
  }
});
test('invalid port cannot change proxy',async()=>{
  const m=mock(); assert.equal((await m.send({type:'enable',port:'9150;DIRECT'})).error,'PORT');assert.equal(m.sets,0);
});
test('check refuses to run when route is disabled',async()=>{
  const m=mock();assert.equal((await m.send({type:'check'})).error,'OFF');assert.equal(m.fetchCount,0);
});
test('Tor test uses no credentials or redirects and never copies returned IP into diagnostics',async()=>{
  const m=mock();await m.send({type:'enable',port:9150});const result=await m.send({type:'check'});
  assert.equal(result.state.check.result,'tor');assert.equal(m.fetchOptions.credentials,'omit');assert.equal(m.fetchOptions.redirect,'error');
  assert.ok(!JSON.stringify(result).includes('192.0.2.123'));
  assert.equal(result.state.enabled,true);
});
test('non-Tor and failed checks do not claim success or remove proxy',async()=>{
  for(const [options,result] of [[{isTor:false},'not-tor'],[{fetchFails:true},'unreachable']]){
    const m=mock(options);await m.send({type:'enable',port:9150});const checked=await m.send({type:'check'});
    assert.equal(checked.state.check.result,result);assert.equal(checked.state.enabled,true);assert.equal(m.clears,0);
  }
});
test('ownership loss invalidates prior test; disable does not overwrite the other extension',async()=>{
  const m=mock();await m.send({type:'enable',port:9150});await m.send({type:'check'});m.external();
  const state=(await m.send({type:'status'})).state;assert.equal(state.enabled,false);assert.equal(state.check,null);
  await m.send({type:'disable'});assert.equal(m.state().levelOfControl,'controlled_by_other_extensions');assert.equal(m.state().value.mode,'direct');
});
test('messages from content tabs cannot control proxy',()=>{assert.equal(mock().untrusted({type:'enable',port:9150}),false);});
test('manifest requests no Google content/cookie/history access; referenced runtime assets exist',()=>{
  const root=path.join(__dirname,'..');const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  assert.deepEqual(m.permissions,['proxy','storage']);assert.deepEqual(m.host_permissions,['https://check.torproject.org/*']);assert.equal(m.content_scripts,undefined);
  for(const file of [m.background.service_worker,m.action.default_popup,...Object.values(m.icons),'guide.html','core.js','popup.js','style.css','assets/Vazirmatn.woff2'])assert.ok(fs.existsSync(path.join(root,file)),file);
});


test('service launch activates and verifies the route before creating any tab',async()=>{
  const m=mock();
  for(const service of Object.keys(R.SERVICES)){
    const result=await m.send({type:'open',service});
    assert.equal(result.ok,true);assert.equal(result.state.enabled,true);
  }
  assert.deepEqual(m.opened,Object.values(R.SERVICES));assert.equal(m.sets,1);
});
test('service launch refuses uncontrolled or lost proxy ownership without opening a direct tab',async()=>{
  for(const options of [{owner:'controlled_by_other_extensions'},{owner:'not_controllable'},{loseOnSet:true}]){
    const m=mock(options);assert.equal((await m.send({type:'open',service:'gemini'})).error,'CONTROL');assert.deepEqual(m.opened,[]);
  }
});
test('unrecognized service identifiers and URLs cannot change the route or open a tab',async()=>{
  for(const service of ['https://evil.test','__proto__','constructor',null,undefined]){
    const m=mock();assert.equal((await m.send({type:'open',service})).error,'SERVICE');assert.equal(m.sets,0);assert.deepEqual(m.opened,[]);
  }
});
test('tab creation failure is reported while retaining the established route',async()=>{
  const m=mock({tabsFail:true});assert.equal((await m.send({type:'open',service:'studio'})).error,'API');assert.equal(R.configuredPort(m.state()),9150);
});
test('exact previous-version PAC remains enabled on reload, with tampered legacy scripts rejected',async()=>{
  const legacy=R.config(19150);legacy.pacScript.data=legacy.pacScript.data.replace('v0.5.0','v0.4.1');
  const m=mock({owner:'controlled_by_this_extension',initialValue:legacy});
  assert.equal((await m.send({type:'status'})).state.enabled,true);
  assert.equal((await m.send({type:'open',service:'studio'})).ok,true);assert.equal(m.sets,0);
  legacy.pacScript.data+='\n';assert.equal(R.configuredPort({levelOfControl:'controlled_by_this_extension',value:legacy}),null);
});
test('opening and disabling are serialized so the Google tab starts under the intended proxy',async()=>{
  const m=mock();const results=await Promise.all([m.send({type:'open',service:'gemini'}),m.send({type:'disable'})]);
  assert.ok(results.every(r=>r.ok));assert.equal(m.opened.length,1);assert.equal((await m.send({type:'status'})).state.enabled,false);
});

test('custom local SOCKS5 and HTTP routes preserve exact domains and never fail open',()=>{
  for(const kind of ['socks5','http']){
    const ctx=vm.createContext({});vm.runInContext(R.pac(1080,kind),ctx);
    const expected=(kind==='http'?'PROXY':'SOCKS5')+' 127.0.0.1:1080';
    assert.equal(ctx.FindProxyForURL('https://aistudio.google.com/','aistudio.google.com'),expected);
    assert.equal(ctx.FindProxyForURL('https://google.com.evil.test/','google.com.evil.test'),'DIRECT');
    assert.doesNotMatch(R.pac(1080,kind),/(?:SOCKS5|PROXY)[^\n]*;\s*DIRECT/);
    assert.deepEqual(R.configuredConnection({levelOfControl:'controlled_by_this_extension',value:R.config(1080,kind)}),{port:1080,kind});
  }
});
test('invalid proxy types cannot inject PAC or alter Chrome settings',async()=>{
  for(const kind of ['https','http; DIRECT',{},null]){
    assert.throws(()=>R.pac(1080,kind));const m=mock();assert.equal((await m.send({type:'enable',port:1080,kind})).error,'PROXY_TYPE');assert.equal(m.sets,0);
  }
});
test('opening while off applies the port and proxy type selected in the popup',async()=>{
  const m=mock({isTor:false});const result=await m.send({type:'open',service:'studio',port:1080,kind:'http'});
  assert.equal(result.state.kind,'http');assert.equal(result.state.port,1080);assert.equal(m.opened[0],R.SERVICES.studio);
  assert.equal((await m.send({type:'check'})).state.check.result,'proxy');
  await m.send({type:'disable'});const reopened=await m.send({type:'open',service:'gemini'});
  assert.equal(reopened.state.kind,'http');assert.equal(reopened.state.port,1080);
});
test('custom proxy check retains no exit IP and does not mislabel a normal proxy as failed Tor',async()=>{
  const m=mock({isTor:false});await m.send({type:'enable',port:1080,kind:'socks5'});const result=await m.send({type:'check'});
  assert.equal(result.state.check.result,'proxy');assert.ok(!JSON.stringify(result).includes('192.0.2.123'));
});
