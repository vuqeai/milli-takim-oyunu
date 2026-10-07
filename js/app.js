(function(g){
'use strict';
g.MT=g.MT||{};
const MT=g.MT,KEY='vuqeai-milli-takim-v2';
let silZaman=null,penaltiVeri=null,turnuva=null,ui=null,jenerasyon=0,runner=false,waiter=null,instant=false,queuedPanel=false,pendingSave=false,visibleMac=null,playingReplay=false,openingWarning=null;
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
function randomSeed(){try{const a=new Uint32Array(1);g.crypto.getRandomValues(a);return a[0]}catch(_){return Date.now()>>>0}}
function params(){const p=new URLSearchParams(g.location.search);const raw=p.get('tohum'),valid=raw!=null&&/^(0|[1-9]\d{0,9})$/.test(raw)&&Number(raw)<=4294967295;return {seed:valid?Number(raw):randomSeed(),hiz:[1,2,4].includes(Number(p.get('hiz')))?Number(p.get('hiz')):1,demo:p.get('demo')==='1',temiz:p.get('temiz')==='1',dusukEfekt:p.get('efekt')==='az',test:p.get('test')==='1'}}
function initUI(p){return {ekran:'acilis',donusEkrani:null,hiz:p.hiz,durakli:false,panelOncesiDurakli:null,temiz:p.temiz,dusukEfekt:p.dusukEfekt,otomatikHiz:false,seciliSlot:null,cekmece:null,hesapAcik:false,taslak:null,panelTaslak:null,devreSecim:null,onizleme:null,devreEtkileri:null,analiz:null,sonUcSut:[],sahneAktif:false,tekrarModu:null,tekrarMac:null,toast:null,tohumGiris:String(p.seed),kayitVar:false,momentum:50}}
function hataMetni(kod){return MT.ekranlar&&MT.ekranlar.hataMetni?MT.ekranlar.hataMetni(kod):kod}
function notice(e){MT.ekranlar.bildirim(e&&e.kod||'DURUM_GECERSIZ')}
function safe(fn){try{return fn()}catch(e){notice(e);return null}}
function match(){return turnuva&&turnuva.aktifMac}
// QA3 A-4: kuyruktaki müdahale isteği ui.panelBekliyor ile görünür olur (kayda yazılmaz; kaydet yalnız §8 alt kümesini yazar).
function kuyruk(v){const yeni=!!v,degisti=yeni!==queuedPanel;queuedPanel=yeni;if(!ui)return;ui.panelBekliyor=yeni;if(degisti&&ui.ekran==='canli'&&MT.ekranlar)MT.ekranlar.canliGuncelle(current(),[],ui)}
function current(){return visibleMac||(playingReplay?ui.tekrarMac:match())}
function preview(){if(!turnuva||!MT.motor)return;try{const m=ui.ekran==='mac-onu'?null:match();const kadro=m?m.kadro:turnuva.hazirlikKadro,taktik=m?m.taktikler.TUR:turnuva.hazirlikTaktik;ui.onizleme=MT.motor.onizle({turnuva,mac:m,kadro,taktik},m?(ui.panelTaslak||ui.taslak):null,ui.ekran==='devre'?ui.devreSecim:null)}catch(_){ui.onizleme=null}}
// Grup sürerken de tablo sıralı görünsün: motorun saf sıralaması (yoksa puan/averaj/gol/kod yedeği). Ekranlar kural hesaplamaz.
function tabloSira(t){if(!t||!t.puanTablosu)return null;if(Array.isArray(t.siralama))return t.siralama;try{if(MT.motor&&typeof MT.motor.siralama==='function')return MT.motor.siralama(t)}catch(_){}const rows=Object.keys(t.puanTablosu).map(k=>Object.assign({kod:k},t.puanTablosu[k]));rows.sort((x,y)=>(y.p||0)-(x.p||0)||(y.av||0)-(x.av||0)||(y.a||0)-(x.a||0)||String(x.kod).localeCompare(String(y.kod)));return rows.map(r=>r.kod)}
// Çekmece: rol uyumu, engel ve sıra app'te hesaplanır (SPEC §3: ekranlar kural hesaplamaz).
function swapKadro(k0,slot,id){const k=clone(k0),old=slot.startsWith('yedek:')?k.yedekler[Number(slot.slice(6))]:k.ilk11[slot];let source=null;for(const [s,p] of Object.entries(k.ilk11))if(p===id)source={kind:'xi',slot:s};for(let i=0;i<k.yedekler.length;i++)if(k.yedekler[i]===id)source={kind:'bench',index:i};if(slot.startsWith('yedek:'))k.yedekler[Number(slot.slice(6))]=id;else k.ilk11[slot]=id;if(source){if(source.kind==='xi')k.ilk11[source.slot]=old;else k.yedekler[source.index]=old}return {k,old}}
function kaleciIhlali(k){return Object.entries(k.ilk11||{}).some(([s,id])=>{const p=id&&MT.veri.oyuncu(id);return p&&((s==='KL')!==(p.mevki==='KL'))})}
function cekmeceVeri(){const slot=ui.cekmece.slot,k=turnuva.hazirlikKadro,diz=k.dizilis||turnuva.hazirlikTaktik.dizilis,yedek=slot.startsWith('yedek:'),list=MT.veri.KADRO.oyuncular||[],uyum={},hat=(MT.veri.DIZILISLER[diz]||[]).find(s=>s.slot===slot);const RANK={ana:0,yan:1,diger:2,'kl-disi':4};for(const o of list){const u={};if(!yedek){try{if(MT.motor&&typeof MT.motor.rolUyumu==='function'){const r=MT.motor.rolUyumu(o.id,slot,diz);if(r){u.tur=r.tur;u.ceza=r.ceza}}}catch(_){}}const current=yedek?k.yedekler[Number(slot.slice(6))]:k.ilk11[slot];if(current!==o.id&&kaleciIhlali(swapKadro(k,slot,o.id).k))u.engel='SADECE_KALECI';uyum[o.id]=u}const puan=o=>o.puan&&(o.mevki==='KL'?o.puan.kalecilik:o.puan.genel)||0;const kaba=o=>uyum[o.id].engel?5:uyum[o.id].tur in RANK?RANK[uyum[o.id].tur]:yedek?0:hat&&(hat.hat===o.mevki||hat.hat==='KL'&&o.mevki==='KL')?0:2;const sira=list.map((o,i)=>({o,i})).sort((x,y)=>kaba(x.o)-kaba(y.o)||puan(y.o)-puan(x.o)||x.i-y.i).map(x=>x.o.id);return {slot,kadro:k,uyum,sira,enerjiler:turnuva.oyuncuEnerjileri||null}}
function draw(){if(!MT.ekranlar)return;ui.tabloSira=tabloSira(turnuva);MT.ekranlar.goster(ui.ekran,turnuva,current(),ui);if(ui.cekmece)MT.ekranlar.katman('cekmece',cekmeceVeri());else if(ui.hesapAcik)MT.ekranlar.katman('hesap',{});else if(ui.panelTaslak)MT.ekranlar.katman('mudahale',{turnuva,mac:match(),ui});else if(!penaltiVeri)MT.ekranlar.katman('mudahale',null)}
function bildirimKapat(){try{MT.ekranlar.bildirimKapat&&MT.ekranlar.bildirimKapat()}catch(_){}}
function layerClose(){penaltiVeri=null;ui.penaltiAktif=false;MT.ekranlar.katman('mudahale',null);ui.cekmece=null;ui.hesapAcik=false}
function saveable(){return turnuva&&ui.ekran!=='acilis'&&!ui.cekmece&&!ui.hesapAcik&&!ui.panelTaslak&&!ui.sahneAktif&&!playingReplay}
function kaydet(){if(!saveable())return false;try{localStorage.setItem(KEY,JSON.stringify({surum:2,turnuva,ui:{ekran:ui.ekran,hiz:ui.hiz,temiz:ui.temiz,dusukEfekt:ui.dusukEfekt,otomatikHiz:ui.otomatikHiz,devreSecim:ui.devreSecim,taslak:ui.ekran==='devre'?ui.taslak:null}}));return true}catch(_){return false}}
// Kaydı doğrular; bozuksa atar. readSave uyarı üretir, kayitVarMi yan etkisizdir.
function kayitOku(){const raw=localStorage.getItem(KEY);if(!raw)return null;{const x=JSON.parse(raw),t=x.turnuva,u=x.ui;if(x.surum!==2||t?.surum!==2||!Number.isInteger(t.tohum)||t.tohum<0||t.tohum>4294967295||!['normal','hizli'].includes(t.mod)||!Array.isArray(t.maclar)||!t.puanTablosu?.TUR||!t.oyuncuEnerjileri||!t.rakipEnerjileri||!t.hazirlikKadro?.ilk11||!Array.isArray(t.hazirlikKadro.yedekler)||!t.hazirlikTaktik||!MT.veri.SABITLER.hizlar.includes(u?.hiz)||!['merkez','mac-onu','canli','devre','sonuc','kupa','elenme'].includes(u?.ekran)||['canli','devre','sonuc'].includes(u.ekran)&&(!t.aktifMac||!Number.isInteger(t.aktifMac.dakika)||!t.aktifMac.skor||!t.aktifMac.istatistik||!Array.isArray(t.aktifMac.olaylar)))throw Error('KAYIT');return x}}
function readSave(){try{return kayitOku()}catch(_){openingWarning='KAYIT';return null}}
function kayitVarMi(){try{return !!kayitOku()}catch(_){return false}}
function switchTo(id){bildirimKapat();if(ui.ekran==='canli'&&id!=='canli'){kuyruk(false);jenerasyon++;cancelWait();try{MT.saha&&MT.saha.yokEt&&MT.saha.yokEt()}catch(_){}}ui.ekran=id;visibleMac=null;ui.tekrarBitti=false;layerClose();if(id==='acilis'){ui.kayitVar=kayitVarMi();ui.silOnay=null}if(id==='mac-onu')preview();if(id==='devre'){ui.devreEtkileri=safe(()=>MT.motor.devreEtkileri(match()));ui.durakli=true}if(id==='sonuc'){ui.analiz=safe(()=>MT.motor.analiz(match()));ui.sonUcSut=ui.analiz&&ui.analiz.sonUcPozisyon||ui.sonUcSut}draw();kaydet();if(id==='canli'){try{MT.saha&&MT.saha.baslat&&MT.saha.baslat(document.getElementById('match-canvas'),{dusukEfekt:ui.dusukEfekt});MT.saha&&MT.saha.yerlesim&&MT.saha.yerlesim(current(),{dusukEfekt:ui.dusukEfekt});MT.saha&&MT.saha[ui.durakli?'duraklat':'surdur']&&MT.saha[ui.durakli?'duraklat':'surdur']()}catch(_){}if(!ui.durakli)run()}}
function reset(seed,mod){kuyruk(false);jenerasyon++;cancelWait();try{MT.saha&&MT.saha.yokEt&&MT.saha.yokEt()}catch(_){}const next=MT.motor.turnuvaBaslat(seed,mod);turnuva=next;ui.durakli=false;ui.panelTaslak=null;ui.taslak=null;ui.devreSecim=null;ui.sonUcSut=[];ui.momentum=50;ui.anons=null;ui.tohumGiris=String(seed);ui.tekrarModu=null;ui.tekrarMac=null;switchTo(mod==='hizli'?'mac-onu':'merkez')}
function sifirla(){reset(randomSeed(),'normal')}
function seedFromInput(){const el=document.querySelector('[data-testid="seed-input"]'),raw=(el?el.value:ui.tohumGiris||'').trim();if(!/^(0|[1-9]\d{0,9})$/.test(raw)||Number(raw)>4294967295){MT.ekranlar.bildirim('TOHUM');return null}ui.tohumGiris=raw;return Number(raw)}
function pause(kayitIste=true){ui.durakli=true;pauseWait();try{MT.saha&&MT.saha.duraklat&&MT.saha.duraklat()}catch(_){}MT.ekranlar.canliGuncelle(current(),[],ui);if(penaltiVeri)penaltiGoster(penaltiVeri);if(kayitIste){if(!ui.sahneAktif)kaydet();else pendingSave=true}}
function resume(){if(document.hidden)return;bildirimKapat();ui.durakli=false;try{MT.saha&&MT.saha.surdur&&MT.saha.surdur()}catch(_){}MT.ekranlar.canliGuncelle(current(),[],ui);if(penaltiVeri)penaltiGoster(penaltiVeri);resumeWait();run()}
function cancelWait(){if(waiter){if(waiter.id!=null)clearTimeout(waiter.id);const finish=waiter.resolve;waiter=null;finish('iptal')}}
function armWaiter(w){w.started=performance.now();w.id=setTimeout(()=>{if(waiter===w)waiter=null;w.resolve('tamam')},w.remaining)}
function pauseWait(){if(waiter&&waiter.id!=null){clearTimeout(waiter.id);waiter.remaining=Math.max(0,waiter.remaining-(performance.now()-waiter.started));waiter.id=null}}
function resumeWait(){if(waiter&&waiter.id==null&&(!ui.durakli||waiter.force))armWaiter(waiter)}
function rescaleWait(oldSpeed,newSpeed){MT.saha?.hizAyarla?.(oldSpeed,newSpeed);if(!waiter||waiter.fast)return;const active=waiter.id!=null;pauseWait();waiter.remaining*=oldSpeed/newSpeed;if(active&&(!ui.durakli||waiter.force))resumeWait()}
function wait(ms,token,fast=false,force=false){if(instant||ms<=0)return Promise.resolve('tamam');return new Promise(resolve=>{waiter={id:null,resolve,started:0,remaining:ms,token,fast,force};if(!ui.durakli||force)armWaiter(waiter)})}
function valid(token){return token===jenerasyon&&ui.ekran==='canli'&&!document.hidden}
function effectEvent(base,o){
  const x=clone(base);
  x.olaylar=(x.olaylar||[]).concat([o]);
  if(o.tur==='gol'){
    const key=o.takimKod===x.takimA?'a':'b';
    x.skor[key]=(x.skor[key]||0)+1;
  }
  if(o.tur==='sut'){
    const key=o.takimKod===x.takimA?'a':'b',stat=x.istatistik?.[key];
    if(stat){stat.sut=(stat.sut||0)+1;if(o.sonuc==='gol'||o.sonuc==='kurtaris')stat.isabet=(stat.isabet||0)+1;stat.xg=(stat.xg||0)+(Number(o.xg)||0)}
  }
  const id=o.oyuncuId||(o.takimKod&&o.formaNo?`${o.takimKod}#${o.formaNo}`:null);
  if(o.tur==='sari'&&id)x.sariKartlar[id]=(x.sariKartlar[id]||0)+1;
  if(o.tur==='kirmizi'&&id)x.kirmiziKartlar[id]=true;
  if(o.tur==='sakatlik'&&id)x.sakatlar[id]=true;
  if(o.tur==='plan'&&o.takimKod&&x.taktikler[o.takimKod]){
    const next=typeof o.sonuc==='string'?o.sonuc:o.sonuc?.plan;
    if(next)x.taktikler[o.takimKod].plan=next;
  }
  if(o.tur==='degisiklik'&&o.takimKod!=='TUR'&&o.sonuc?.cikanId){
    const roster=x.anonimKadrolar?.[o.takimKod];
    const slot=roster&&Object.keys(roster.aktif).find(k=>roster.aktif[k]===o.sonuc.cikanId);
    if(slot){roster.aktif[slot]=o.sonuc.girenId;roster.yedek=roster.yedek.filter(v=>v!==o.sonuc.girenId);x.cikanlar.push(o.sonuc.cikanId)}
  }
  return x;
}
function updateMomentum(m){if(!m)return;const start=Math.max(1,m.dakika-9),shots=(m.olaylar||[]).filter(o=>o.tur==='sut'&&o.dakika>=start&&o.dakika<=m.dakika);let diff=0;for(const o of shots)diff+=(o.takimKod==='TUR'?1:-1)*(Number(o.xg)||0);ui.momentum=Math.max(20,Math.min(80,50+25*diff))}
// Anons satırı olay satırıyla aynı kısa adı kullanır; rakipte takım adı + numara.
// QA3 A-11: metin hazır bankadan (geriDonus / macYenidenAcildi); varyant sunumVaryanti + olay kimliği hash'i (yalnız sunum).
// Golcü adı burada yok (olay satırı ve gol bandı söylüyor); dakika ile başlar, skor Türkiye solda.
function golAnons(o,shown,deficit){if(deficit!==1&&deficit!==2)return null;const key=o.takimKod===shown.takimA?'a':'b',s={...shown.skor};s[key]=(s[key]||0)+1;const turA=shown.takimA==='TUR',sk=`${turA?s.a:s.b}–${turA?s.b:s.a}`;const tur=deficit===1?'geriDonus':'macYenidenAcildi',liste=MT.veri.YORUMLAR&&MT.veri.YORUMLAR[tur],takimAdi=o.takimKod==='TUR'?'Türkiye':(MT.veri.takim(o.takimKod)||{}).ad||o.takimKod;let satir=null;if(Array.isArray(liste)&&liste.length&&typeof MT.veri.yorum==='function'){const say=Math.max(1,Math.floor(liste.length/4));satir=MT.veri.yorum({tur,sunumVaryanti:((Number(o.sunumVaryanti)||0)%4)+4*(MT.yardim.hash32(o.id||'','anons')%say)},{takim:takimAdi})}if(!satir)satir=deficit===1?`GERİ DÖNÜŞ! ${takimAdi} yeniden oyunda.`:'Maç yeniden açıldı; fark artık bir.';return `${o.dakika}' · ${satir} (${sk})`}
// Otomatik duraklama uyarısı olayı söyler: kim, ne oldu (SPEC §2: gerçek ada "Bu kurgu maçta" öneki).
const PLAN_AD={kontrollu:'Kontrollü',dengeli:'Dengeli',baski:'Önde baskı',gecis:'Geçiş',yuklen:'Yüklen'};
const OLAY_FIIL={sari:'sarı kart gördü',kirmizi:'kırmızı kart gördü',sakatlik:'sakatlandı'};
function duraklamaMetni(events){const parca=[];for(const o of events){const tk=(MT.veri.takim(o.takimKod)||{}).ad||o.takimKod||'',p=o.oyuncuId&&MT.veri.oyuncu(o.oyuncuId);if(OLAY_FIIL[o.tur]){const fiil=OLAY_FIIL[o.tur];if(o.takimKod==='TUR')parca.push(p?`Bu kurgu maçta: ${p.kisaAd||p.ad} ${fiil}.`:`Bu kurgu maçta: Türkiye'den bir oyuncu ${fiil}.`);else parca.push(`${tk} ${o.formaNo?`${o.formaNo} numara`:'bir oyuncusu'} ${fiil}.`)}else if(o.tur==='plan'&&o.dakika===60&&o.takimKod!=='TUR'){const pl=typeof o.sonuc==='string'?o.sonuc:o.sonuc&&o.sonuc.plan;parca.push(`60' · ${tk} planını değiştirdi: ${PLAN_AD[pl]||pl}.`)}}return `${parca.length?parca.join(' ')+' ':''}Maç duraklatıldı. Sürdür ya da Müdahale et.`}
function eventImportant(o){return ['sut','gol','sari','kirmizi','sakatlik','plan','degisiklik','penalti'].includes(o.tur)}
async function presentStep(before,result,token){let shown=clone(before),pendingGoalShot=null;const events=result.olaylar||[];for(let i=0;i<events.length;i++){const o=events[i];if(!valid(token))return false;// QA3 A-10: bant dakikası sahnelenen olayın dakikasıdır (dakika sonuç sızdırmaz; motor durumu değişmez).
if(Number.isFinite(o.dakika)&&o.dakika>(shown.dakika||0)){shown.dakika=o.dakika;visibleMac=shown}ui.sahneAktif=!!(MT.veri.SABITLER.sahneMs[o.tur]);MT.ekranlar.canliGuncelle(shown,[],ui);if(ui.sahneAktif&&MT.saha&&MT.saha.oynat){try{const scene=instant?Promise.resolve('tamam'):MT.saha.oynat(o,shown,{hiz:ui.hiz,dusukEfekt:ui.dusukEfekt});if(scene&&typeof scene.then==='function')await scene}catch(_){}}if(!valid(token))return false;const next=events[i+1];if(o.tur==='sut'&&o.sonuc==='gol'&&next?.tur==='gol'&&next.takimKod===o.takimKod){pendingGoalShot=o;continue}if(o.tur==='gol'){const key=o.takimKod===shown.takimA?'a':'b',other=key==='a'?'b':'a',deficit=(shown.skor[other]||0)-(shown.skor[key]||0);ui.anons=golAnons(o,shown,deficit);if(pendingGoalShot){shown=effectEvent(shown,pendingGoalShot);ui.sonUcSut=[...ui.sonUcSut,pendingGoalShot.id].slice(-3);pendingGoalShot=null}}else ui.anons=null;shown=effectEvent(shown,o);visibleMac=shown;if(o.tur==='sut')ui.sonUcSut=[...ui.sonUcSut,o.id].slice(-3);ui.sahneAktif=false;MT.ekranlar.canliGuncelle(shown,[o],ui);}return true}
// 90 dk / 1 dk modunda Türkiye hocası kendi tarzındaki değişiklikleri kendisi yapar (en fazla birer birer).
function filmHoca(){const m=match();if(!m||!MT.motor.hocaOnerileri)return;const o=MT.motor.hocaOnerileri(m).find(x=>m.dakika>=x.dk);if(!o)return;try{const r=MT.motor.mudahale(m,{degisiklikler:[{cikanId:o.cikanId,girenId:o.girenId}]});turnuva.aktifMac=r.durum;MT.ekranlar.canliGuncelle(match(),r.olaylar,ui)}catch(_){}}
async function oneStep(token){const before=match();if(!before||before.bitti||before.dakika>=90)return;let result;try{result=MT.motor.adim(before)}catch(e){notice(e);pause();return}visibleMac=clone(before);const ok=await presentStep(before,result,token);if(!ok||!valid(token))return;turnuva.aktifMac=result.durum;visibleMac=null;if(pendingSave){pendingSave=false;kaydet()}updateMomentum(match());MT.ekranlar.canliGuncelle(match(),[],ui);const events=result.olaylar||[];if(match().dakika===45&&turnuva.mod==='normal'&&ui.film&&!queuedPanel){try{turnuva.aktifMac=MT.motor.konusma(match(),'sakin').durum}catch(e){notice(e);pause();return}MT.ekranlar.canliGuncelle(match(),[],ui);return}if(match().dakika===45&&turnuva.mod==='normal'){const q=queuedPanel;switchTo('devre');if(q){kuyruk(false);openPanel()}return}if(match().dakika>=90){kuyruk(false);await finishMatch(token);return}if(queuedPanel){kuyruk(false);openPanel();return}if(ui.film)filmHoca();else if(events.some(o=>['sari','kirmizi','sakatlik'].includes(o.tur))||match().dakika===60&&events.some(o=>o.tur==='plan')){pause();MT.ekranlar.bildirim(duraklamaMetni(events),null,{kalici:true});return}const skip=ui.atlaPozisyon;const hasImportant=events.some(eventImportant);if(skip&&hasImportant)ui.atlaPozisyon=false;const auto=ui.otomatikHiz&&!hasImportant;const delay=instant||skip&&!hasImportant?0:ui.film?470:(MT.veri.SABITLER.sureMs||1300)/(auto?4:ui.hiz);await wait(delay,token,auto)}
async function run(){if(runner||ui.durakli||ui.ekran!=='canli'||document.hidden||!match()||match().dakika>=90)return;runner=true;const token=jenerasyon;try{while(valid(token)&&!ui.durakli&&match()&&!match().bitti&&match().dakika<90){await oneStep(token);if(!valid(token)||ui.durakli||ui.ekran!=='canli')break}}finally{runner=false;if(valid(token)&&!ui.durakli&&match()&&!match().bitti&&match().dakika<90)queueMicrotask(run)}}
// Penaltı katmanı verisi app'te saklanır; duraklat/sürdür katmanı yeniden çizer ('Sürdür' yalnız duraklıyken).
// QA3 A-15: seri sürerken ui.penaltiAktif sağ paneldeki Müdahale/atla/tekrar düğmelerini kilitler (kayda yazılmaz).
function penaltiGoster(v){penaltiVeri=v;MT.ekranlar.katman('penalti',v?{...v,durakli:!!ui.durakli}:null);if(ui.penaltiAktif!==!!v){ui.penaltiAktif=!!v;MT.ekranlar.canliGuncelle(current(),[],ui)}}
async function finishMatch(token){
  let r;
  try{r=MT.motor.macBitir(match())}catch(e){notice(e);return}
  if(r.olaylar?.length){
    const full=r.durum.penalti,shown=[],total={a:0,b:0};
    penaltiGoster({penalti:{atislar:shown,skor:total},takimA:r.durum.takimA,takimB:r.durum.takimB});
    for(let i=0;i<r.olaylar.length;i++){
      if(!valid(token))return;
      const o=r.olaylar[i],shot=full.atislar[i];
      if(!instant&&MT.saha?.oynat)try{await MT.saha.oynat(o,r.durum,{hiz:ui.hiz})}catch(_){}
      if(!valid(token))return;
      shown.push(shot);
      if(shot.gol)total[shot.takimKod===r.durum.takimA?'a':'b']++;
      penaltiGoster({penalti:{atislar:shown.slice(),skor:{...total},kazanan:i===r.olaylar.length-1?full.kazanan:null,kura:i===r.olaylar.length-1?full.kura:false},takimA:r.durum.takimA,takimB:r.durum.takimB});
    }
    await wait(instant?0:1300,token);
    if(!valid(token))return;
    penaltiGoster(null);
  }
  turnuva.aktifMac=r.durum;
  switchTo('sonuc');
}
async function replayLoop(decisions){const token=jenerasyon;let index=0,tamam=false;while(playingReplay&&valid(token)&&ui.tekrarMac&&!ui.tekrarMac.bitti){let m=ui.tekrarMac;try{while(index<decisions.length&&decisions[index].dakika===m.dakika){const k=decisions[index++];m=(k.tur==='konusma'?MT.motor.konusma(m,k.secim,k.islem):MT.motor.mudahale(m,k.islem)).durum}if(m.dakika===45&&!m.devreKonusmasi&&m.mod==='normal')m=MT.motor.konusma(m,'sakin').durum;if(m.dakika>=90){const end=MT.motor.macBitir(m);ui.tekrarMac=end.durum;visibleMac=null;MT.ekranlar.canliGuncelle(current(),[],ui);if(end.olaylar.length){const full=end.durum.penalti,shown=[],total={a:0,b:0};penaltiGoster({penalti:{atislar:shown,skor:total},takimA:end.durum.takimA,takimB:end.durum.takimB});for(let i=0;i<end.olaylar.length;i++){if(!playingReplay||!valid(token))break;const o=end.olaylar[i],shot=full.atislar[i];if(!instant)await MT.saha.oynat(o,end.durum,{hiz:ui.hiz});shown.push(shot);if(shot.gol)total[shot.takimKod===end.durum.takimA?'a':'b']++;penaltiGoster({penalti:{atislar:shown.slice(),skor:{...total},kazanan:i===end.olaylar.length-1?full.kazanan:null,kura:i===end.olaylar.length-1?full.kura:false},takimA:end.durum.takimA,takimB:end.durum.takimB})}await wait(instant?0:1300,token,false,true);penaltiGoster(null)}tamam=true;break}const result=MT.motor.adim(m);visibleMac=clone(m);if(!await presentStep(m,result,token))break;ui.tekrarMac=result.durum;visibleMac=null;if(ui.atlaPozisyon&&(result.olaylar||[]).some(eventImportant))ui.atlaPozisyon=false;updateMomentum(ui.tekrarMac);MT.ekranlar.canliGuncelle(ui.tekrarMac,[],ui);await wait(instant?0:(MT.veri.SABITLER.sureMs||1300)/(ui.atlaPozisyon?4:ui.hiz),token,false,true)}catch(e){notice(e);break}}
// Tekrar normal bittiyse bitiş durumu gösterilir: "Sonuca dön", akış düğmeleri gizli. Motor/kayıt/sonucIsle yine kapalı.
if(tamam&&playingReplay&&valid(token)){ui.tekrarBitti=true;MT.ekranlar.canliGuncelle(current(),[],ui)}}
function openPanel(){if(!match()||!['canli','devre'].includes(ui.ekran))return;if(penaltiVeri){MT.ekranlar.bildirim('DURUM_GECERSIZ');return}if(ui.sahneAktif){kuyruk(true);return}kuyruk(false);bildirimKapat();ui.donusEkrani=ui.ekran;ui.panelOncesiDurakli=ui.durakli;ui.durakli=true;pauseWait();try{MT.saha&&MT.saha.duraklat&&MT.saha.duraklat()}catch(_){}ui.panelTaslak=clone(ui.taslak||{degisiklikler:[]});preview();MT.ekranlar.katman('mudahale',{turnuva,mac:match(),ui})}
function closePanel(apply){if(!ui.panelTaslak)return;const from=ui.donusEkrani;if(apply){if(from==='devre'){ui.taslak=clone(ui.panelTaslak)}else{const d=ui.panelTaslak;if(d.plan||d.dizilis||(d.degisiklikler||[]).length){const r=MT.motor.mudahale(match(),d);turnuva.aktifMac=r.durum;ui.sonUcSut=[...ui.sonUcSut];MT.ekranlar.canliGuncelle(match(),r.olaylar,ui)}}}ui.panelTaslak=null;MT.ekranlar.katman('mudahale',null);ui.durakli=document.hidden?true:!!ui.panelOncesiDurakli;ui.panelOncesiDurakli=null;// openPanel sahayı da duraklattı; akış sürecekse sahne saatini de sürdür (yoksa sonraki oynat() hiç bitmez).
if(!ui.durakli){try{MT.saha&&MT.saha.surdur&&MT.saha.surdur()}catch(_){}}
preview();if(from==='canli')MT.ekranlar.canliGuncelle(current(),[],ui);if(apply)kaydet();if(from==='canli'&&!ui.durakli){resumeWait();run()}}
function selectCandidate(slot,id){const k0=turnuva.hazirlikKadro,cur=slot.startsWith('yedek:')?k0.yedekler[Number(slot.slice(6))]:k0.ilk11[slot];if(cur===id){MT.ekranlar.bildirim('SECILI');return}const p=MT.veri.oyuncu(id);if(!p){MT.ekranlar.bildirim('DURUM_GECERSIZ');return}const {k}=swapKadro(k0,slot,id);// KL slotunda yalnız kaleci, saha slotunda kaleci yok (doğrudan seçim ya da takas sonucu).
if(kaleciIhlali(k)){MT.ekranlar.bildirim('SADECE_KALECI');return}const xi=Object.values(k.ilk11||{}),res=k.yedekler||[],all=[...xi,...res];if(xi.length!==11||res.length!==7||all.some(x=>!x)||new Set(all).size!==18||!xi.some(x=>MT.veri.oyuncu(x)?.mevki==='KL')||!res.some(x=>MT.veri.oyuncu(x)?.mevki==='KL')){MT.ekranlar.bildirim('KADRO_EKSIK');return}turnuva.hazirlikKadro=k;ui.cekmece=null;MT.ekranlar.katman('cekmece',null);preview();draw();kaydet()}
function changeFormation(code){const k=clone(turnuva.hazirlikKadro),old=k.ilk11||{},newSlots=MT.veri.DIZILISLER[code]||[],kept=new Set(),next={};// Motor M-9 hazırsa aynı 11 oyuncu yeni dizilişe en iyi rol eşleşmesiyle yerleşir; yedekler değişmez.
if(MT.motor&&typeof MT.motor.yerlestir==='function'){try{const r=MT.motor.yerlestir(Object.values(old).filter(Boolean),code,turnuva.oyuncuEnerjileri),ilk11=r&&r.ilk11||r;if(ilk11&&newSlots.every(s=>ilk11[s.slot])){k.ilk11=ilk11;k.dizilis=code;turnuva.hazirlikKadro=k;turnuva.hazirlikTaktik={...turnuva.hazirlikTaktik,dizilis:code};return}}catch(_){}}
for(const s of newSlots)if(old[s.slot]){next[s.slot]=old[s.slot];kept.add(old[s.slot])}const spare=[...Object.values(old),...(k.yedekler||[])].filter(x=>x&&!kept.has(x));for(const s of newSlots)if(!next[s.slot]&&spare.length){next[s.slot]=spare.shift();kept.add(next[s.slot])}k.ilk11=next;k.dizilis=code;k.yedekler=[...new Set([...(k.yedekler||[]),...spare])].filter(x=>!kept.has(x)).slice(0,7);turnuva.hazirlikKadro=k;turnuva.hazirlikTaktik={...turnuva.hazirlikTaktik,dizilis:code}}
// Taslak motorla doğrulanır (SPEC §4 "UI de doğrular"); geçersiz aday taslağa hiç girmez.
function taslakHatasi(d){const m=match();if(!m||!MT.motor)return null;try{MT.motor.onizle({turnuva,mac:m,kadro:m.kadro,taktik:m.taktikler.TUR},d,null);return null}catch(e){return e&&e.kod||'DURUM_GECERSIZ'}}
function updateDraft(alan,deger){const d=clone(ui.panelTaslak||{degisiklikler:[]});d.degisiklikler=d.degisiklikler||[];if(alan==='degisiklik'){if(!deger||!deger.cikanId||!deger.girenId)return;d.degisiklikler=[...d.degisiklikler,{cikanId:deger.cikanId,girenId:deger.girenId}]}else if(alan==='degisiklik-kaldir'){const i=Number(deger);if(!Number.isInteger(i)||i<0||i>=d.degisiklikler.length)return;d.degisiklikler=d.degisiklikler.filter((_,j)=>j!==i);while(d.degisiklikler.length>i&&taslakHatasi(d))d.degisiklikler.pop()}else if(alan==='temizle'){ui.panelTaslak={degisiklikler:[]};preview();draw();return}else if(alan==='plan'||alan==='dizilis')d[alan]=deger;else if(alan==='oneri'){if(!deger||!deger.cikanId||!deger.girenId)return;const i=d.degisiklikler.findIndex(x=>x.cikanId===deger.cikanId&&x.girenId===deger.girenId);if(i>=0){d.degisiklikler.splice(i,1);while(d.degisiklikler.length>i&&taslakHatasi(d))d.degisiklikler.pop();ui.panelTaslak=d;preview();draw();return}d.degisiklikler=[...d.degisiklikler,{cikanId:deger.cikanId,girenId:deger.girenId}]}else return;if(alan!=='degisiklik-kaldir'){const kod=taslakHatasi(d);if(kod){MT.ekranlar.bildirim(kod);return}}ui.panelTaslak=d;preview();draw()}
function finishPositionReplay(){if(ui.tekrarModu!=='pozisyon')return;const source=ui.tekrarKaynakEkran,wasPaused=ui.tekrarOncekiDurakli;ui.tekrarModu=null;ui.tekrarKaynakEkran=null;ui.tekrarOncekiDurakli=null;MT.ekranlar.katman('tekrar',null);try{MT.saha&&MT.saha.yokEt&&MT.saha.yokEt()}catch(_){}if(source==='canli'){try{MT.saha&&MT.saha.baslat&&MT.saha.baslat(document.getElementById('match-canvas'),{dusukEfekt:ui.dusukEfekt});MT.saha&&MT.saha.yerlesim&&MT.saha.yerlesim(match(),{dusukEfekt:ui.dusukEfekt})}catch(_){}if(wasPaused){ui.durakli=true;MT.saha&&MT.saha.duraklat&&MT.saha.duraklat()}else resume()}}
function digest(){return JSON.stringify((match()||turnuva&&turnuva.maclar.slice(-1)[0]||{}).olaylar||[])}
async function action(e){const d=e.detail||{};if(!d.tur)return;try{switch(d.tur){case'yeni':case'hizli':{const seed=seedFromInput();if(seed==null)break;// Kayıtlı koşu varken ilk basış yalnız uyarır; aynı düğmeye 6 sn içinde ikinci basış silip başlatır.
if(ui.kayitVar&&ui.silOnay!==d.tur){ui.silOnay=d.tur;clearTimeout(silZaman);silZaman=setTimeout(()=>{ui.silOnay=null},6000);MT.ekranlar.bildirim('SIL_ONAY');break}ui.silOnay=null;clearTimeout(silZaman);reset(seed,d.tur==='hizli'?'hizli':'normal');break}case'devam-kayit':{const x=readSave();if(!x){MT.ekranlar.bildirim('KAYIT');break}turnuva=x.turnuva;const hedef=x.ui.ekran;Object.assign(ui,x.ui,{ekran:'acilis',durakli:true,panelTaslak:null,cekmece:null,hesapAcik:false,sonUcSut:(x.turnuva.aktifMac?.olaylar||[]).filter(o=>o.tur==='sut').slice(-3).map(o=>o.id)});if(ui.taslak&&taslakHatasi(ui.taslak))ui.taslak=null;updateMomentum(match());switchTo(hedef);break}case'tohum-kopyala':{const seed=seedFromInput();if(seed==null)break;const fail=()=>MT.ekranlar.bildirim('Tohum kopyalanamadı; elle seçip kopyala.');if(!navigator.clipboard||!navigator.clipboard.writeText){fail();break}navigator.clipboard.writeText(String(seed)).then(()=>MT.ekranlar.bildirim('Tohum kopyalandı.'),fail);break}case'mac-onu':if(turnuva.sonuc==='elenme'&&!turnuva.siradakiFikstur)switchTo('elenme');else switchTo('mac-onu');break;case'kadro-oner':{const k=MT.motor.kadroOner(MT.veri.KADRO.oyuncular,turnuva.oyuncuEnerjileri,turnuva.hazirlikTaktik.dizilis);turnuva.hazirlikKadro=k;preview();draw();kaydet();break}case'slot-ac':ui.cekmece={slot:d.slot||'KL'};MT.ekranlar.katman('cekmece',cekmeceVeri());break;case'cekmece-kapat':ui.cekmece=null;MT.ekranlar.katman('cekmece',null);break;case'aday-sec':selectCandidate(d.slot,d.oyuncuId);break;case'dizilis-sec':if(d.hedef==='taslak')updateDraft('dizilis',d.deger||d.kod);else{changeFormation(d.deger||d.kod);preview();draw();kaydet()}break;case'plan-sec':if(d.hedef==='taslak')updateDraft('plan',d.deger||d.kod);else{turnuva.hazirlikTaktik={...turnuva.hazirlikTaktik,plan:d.deger||d.kod};preview();draw();kaydet()}break;case'mac-baslat':{const m=MT.motor.macBaslat(turnuva,turnuva.hazirlikKadro,turnuva.hazirlikTaktik);turnuva.macBaslangic=clone(m);turnuva.aktifMac=m;ui.durakli=false;ui.devreSecim=null;ui.sonUcSut=[];switchTo('canli');try{MT.saha&&MT.saha.baslat&&MT.saha.baslat(document.getElementById('match-canvas'),{dusukEfekt:ui.dusukEfekt});MT.saha&&MT.saha.yerlesim&&MT.saha.yerlesim(m,{dusukEfekt:ui.dusukEfekt})}catch(_){}break}case'duraklat':pause();break;case'surdur':resume();break;case'hiz-sec':{const speed=Number(d.hiz);if(!MT.veri.SABITLER.hizlar.includes(speed))break;const old=ui.hiz;ui.hiz=speed;rescaleWait(old,speed);draw();break}case'otomatik-hiz':ui.otomatikHiz=!ui.otomatikHiz;draw();break;case'film-modu':{ui.film=!ui.film;const old=ui.hiz;if(ui.film){ui.filmOncekiHiz=old;ui.hiz=4}else ui.hiz=ui.filmOncekiHiz||1;rescaleWait(old,ui.hiz);draw();if(ui.film&&ui.ekran==='canli'&&ui.durakli&&!ui.panelTaslak){bildirimKapat();resume()}break}case'hoca-sec':case'hoca-degistir':{if(!turnuva)break;const H=MT.veri.HOCALAR,h={...(turnuva.hocalar||{})};if(d.tur==='hoca-sec'){if(!H[d.deger])break;h[d.hedef]=d.deger}else{const rk=d.rakip;if(!rk)break;const a=h.TUR||'kendi';h.TUR=h[rk]||'kendi';h[rk]=a}turnuva.hocalar=h;const p=H[h.TUR||'kendi'];if(p&&p.plan&&turnuva.mod!=='hizli')turnuva.hazirlikTaktik={...turnuva.hazirlikTaktik,plan:p.plan};preview();draw();kaydet();break}case'pozisyona-atla':ui.atlaPozisyon=true;if(waiter){cancelWait();run()}break;case'mudahale-ac':openPanel();break;case'taslak-guncelle':updateDraft(d.alan,d.deger);break;case'mudahale-uygula':closePanel(true);break;case'mudahale-vazgec':closePanel(false);break;case'konusma-sec':ui.devreSecim=d.secim;preview();draw();kaydet();break;case'ikinci-yari':if(!ui.devreSecim){MT.ekranlar.bildirim('KONUSMA_GEREKLI');break}{let r;try{r=MT.motor.konusma(match(),ui.devreSecim,ui.taslak)}catch(e){const kod=e&&e.kod||'DURUM_GECERSIZ';if(ui.taslak&&!/^KONUSMA_/.test(kod)){/* Geçersiz devre taslağı çıkmaz yaratmasın: taslak atılır, konuşma seçimi kalır. */ui.taslak=null;preview();draw();kaydet();MT.ekranlar.bildirim(`${hataMetni(kod)} Geçersiz taslak temizlendi.`)}else notice(e);break}turnuva.aktifMac=r.durum;ui.taslak=null;ui.durakli=false;switchTo('canli')}break;case'sahne-atla':MT.saha&&MT.saha.atla&&MT.saha.atla();break;case'pozisyon-tekrar':{// Penaltı serisi sürerken sağ panel açık; pozisyon tekrarı seriyle aynı sahneyi paylaşamaz.
if(penaltiVeri){MT.ekranlar.bildirim('DURUM_GECERSIZ');break}const o=(match()&&match().olaylar||[]).find(x=>x.id===d.olayId);if(o&&MT.saha&&MT.saha.oynat&&!ui.sahneAktif){bildirimKapat();ui.tekrarKaynakEkran=ui.ekran;ui.tekrarOncekiDurakli=ui.durakli;if(ui.ekran==='canli')pause();ui.tekrarModu='pozisyon';MT.ekranlar.katman('tekrar',{olay:o});MT.saha.surdur();MT.saha.oynat(o,match(),{hiz:ui.hiz}).then(finishPositionReplay)}break}case'tekrar-kapat':if(playingReplay){playingReplay=false;ui.tekrarBitti=false;ui.tekrarModu=null;ui.tekrarMac=null;switchTo('sonuc')}else{MT.saha&&MT.saha.atla&&MT.saha.atla();finishPositionReplay()}break;case'karar-tekrar':{if(!turnuva.macBaslangic||!match())break;bildirimKapat();ui.tekrarBitti=false;const decisions=clone(match().kararlar);ui.tekrarModu='karar';ui.tekrarMac=clone(turnuva.macBaslangic);playingReplay=true;ui.durakli=true;switchTo('canli');replayLoop(decisions);break}case'merkeze-don':{if(ui.ekran==='mac-onu'){switchTo('merkez');break}if(ui.ekran==='sonuc'&&turnuva.mod==='normal'){const ended=match();turnuva=MT.motor.sonucIsle(turnuva,ended);switchTo(ended.fiksturNo===7?turnuva.sonuc:'merkez')}else switchTo('merkez');break}case'acilisa-don':switchTo('acilis');break;case'yeniden-ayni':{const hizliMod=turnuva.mod==='hizli';reset(turnuva.tohum,turnuva.mod);// QA3 A-16: hızlıda maç önü seçimleri varsayılana döner; bunu söyle (SPEC §8: yeni karar fırsatı).
if(hizliMod)MT.ekranlar.bildirim('Maç önü seçimlerin sıfırlandı; tohum aynı.');break}case'yeniden-yeni':reset(randomSeed(),turnuva.mod);break;case'hesap-ac':ui.hesapAcik=true;MT.ekranlar.katman('hesap',{});break;case'hesap-kapat':ui.hesapAcik=false;MT.ekranlar.katman('hesap',null);break;default:break}}catch(err){notice(err)}}
function setupTest(){
  if(!params().test)return;
  async function takeover(){
    jenerasyon++;cancelWait();
    try{MT.saha?.yokEt?.()}catch(_){}
    ui.durakli=true;ui.sahneAktif=false;visibleMac=null;
    await new Promise(resolve=>setTimeout(resolve,0));
    if(ui.ekran==='canli'){
      MT.saha?.baslat?.(document.getElementById('match-canvas'),{dusukEfekt:ui.dusukEfekt});
      MT.saha?.yerlesim?.(match(),{dusukEfekt:ui.dusukEfekt});
      MT.saha?.duraklat?.();
      MT.ekranlar.canliGuncelle(match(),[],ui);
    }
  }
  async function advance(count){
    await takeover();const wasInstant=instant;instant=true;
    try{
      for(let i=0;i<count;i++){
        if(!match()||match().bitti||ui.ekran==='sonuc')break;
        if(ui.ekran==='devre'){
          ui.devreSecim=ui.devreSecim||'sakin';
          turnuva.aktifMac=MT.motor.konusma(match(),ui.devreSecim,ui.taslak).durum;
          ui.taslak=null;ui.durakli=true;switchTo('canli');
        }
        if(ui.ekran!=='canli')break;
        if(match().dakika>=90){await finishMatch(jenerasyon);break}
        await oneStep(jenerasyon);
      }
      return clone({turnuva,ui});
    }finally{instant=wasInstant}
  }
  MT.test={
    getState:()=>clone({turnuva,ui}),
    setInstant:x=>{instant=x!==false},
    advanceMinutes:advance,
    chooseHalfTalk:secim=>{ui.devreSecim=secim;preview();draw()},
    finishCurrentMatch:async()=>{
      const wasInstant=instant;instant=true;await takeover();
      try{
        while(match()&&!match().bitti&&ui.ekran!=='sonuc'){
          if(ui.ekran==='devre'){
            ui.devreSecim=ui.devreSecim||'sakin';
            turnuva.aktifMac=MT.motor.konusma(match(),ui.devreSecim,ui.taslak).durum;
            ui.taslak=null;ui.durakli=true;switchTo('canli');
          }
          if(ui.ekran!=='canli')break;
          if(match().dakika>=90){await finishMatch(jenerasyon);break}
          await oneStep(jenerasyon);
        }
        return clone({turnuva,ui});
      }finally{instant=wasInstant}
    },
    getEventDigest:digest
  };
}
function baslat(){MT.ekranlar.baslat();const p=params();ui=initUI(p);const saved=readSave();ui.kayitVar=!!saved;document.addEventListener('mt:eylem',action);document.addEventListener('visibilitychange',()=>{if(document.hidden&&ui.ekran==='canli')pause(false)});g.addEventListener('blur',()=>{if(ui.ekran==='canli')pause(false)});g.addEventListener('pagehide',()=>{if(ui.ekran==='canli')pause(false)});draw();if(openingWarning)MT.ekranlar.bildirim(openingWarning);setupTest();if(p.demo){safe(()=>reset(p.seed,'hizli'))}}
MT.app={baslat,kaydet,sifirla,getVisibleMatch:()=>current()};
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>MT.app.baslat(),{once:true});else MT.app.baslat()}
})(typeof window!=='undefined'?window:globalThis);
