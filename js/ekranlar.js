(function(g){
'use strict';
g.MT=g.MT||{};
const MT=g.MT;
const PLAN={kontrollu:'Kontrollü',dengeli:'Dengeli',baski:'Önde baskı',gecis:'Geçiş',yuklen:'Yüklen'};
// QA3 A-12: cümle içinde plan adı küçük harfle ve isim biçiminde (düğme/"Plan:" etiketleri PLAN'dan kalır).
const PLAN_CUMLE={kontrollu:'kontrollü',dengeli:'dengeli',baski:'önde baskı',gecis:'geçiş',yuklen:'yüklenme'};
const STIL={baski:'Baskı',derin:'Derin savunma',kanat:'Kanat oyunu',dengeli:'Dengeli'};
const KONUSMA={sakin:'Sakin kal',cesaret:'Cesaret ver',sert:'Sert uyar'};
const SCREEN_TESTIDS={acilis:'screen-acilis',merkez:'screen-merkez','mac-onu':'screen-mac-onu',canli:'screen-canli',devre:'screen-devre',sonuc:'screen-sonuc',kupa:'screen-kupa',elenme:'screen-elenme'};
const NOT='Bağımsız hayran yapımı kurgu oyun; TFF, UEFA, FIFA, kulüpler ve oyuncularla bağlantısı yoktur.';
const HATA={KOTA_DEGISIKLIK:'Değişiklik hakkı bitti.',KOTA_PLAN:'Bu maçtaki iki plan hamlesi kullanıldı.',KIRMIZI_GIREMEZ:'Kırmızı kartlı oyuncunun yerine oyuncu alınamaz.',SADECE_KALECI:'Kaleci yerine yalnız kaleci seçilebilir.',TEKRAR_GIREMEZ:'Çıkan oyuncu yeniden giremez.',KADRO_EKSIK:'11 oyuncu ve 7 yedek seç; iki grupta da bir kaleci olsun.',KONUSMA_GEREKLI:'Önce bir devre konuşması seç.',KONUSMA_ZATEN:'Devre konuşması zaten uygulandı.',YUKLEN_ERKEN:'Yüklen 60. dakikadan sonra açılır.',DURUM_GECERSIZ:'Bu işlem şu anda yapılamıyor.',TOHUM:'0 ile 4294967295 arasında sayı gir.',SECILI:'Bu oyuncu zaten seçili.',KAYIT:'Kayıt okunamadı. Yeni bir turnuva başlatabilirsin.',SIL_ONAY:'Kayıtlı koşu silinecek. Silip başlamak için bir kez daha bas; sürdürmek için "Kaldığın yerden devam et".'};
// Yorgunluk eşiği yalnız sunum etiketidir (kural motorda; ekran kural hesaplamaz).
const YORGUN_ESIK=90;
// Türkçe yayın kısaltmaları (istatistik sütun başlığı).
const KISA={TUR:'TÜR',AUT:'AVU',CZE:'ÇEK',ITA:'İTA'};
// Şut sonucu: ham motor kodu ekrana yazılmaz.
const SUT_SONUC={gol:'gol',kurtaris:'kaleci kurtardı',blok:'savunma blokladı',disari:'auta gitti'};
const SUT_YER={uzak:'uzaktan',ceza:'ceza alanından',net:'net pozisyonda'};
const SUT_FIIL=['şut çekti','kaleyi yokladı','vuruşunu yaptı','şansını denedi'];
const ATAK_TUR=['Türkiye pas trafiğiyle atak kuruyor.','Türkiye savunma arkasına koşu yapıyor.','Türkiye hücumu kanattan geliştiriyor.','Türkiye ceza alanı çevresinde baskı kuruyor.'];
const ATAK_RAKIP=[k=>`${k} topu ileri taşıyor.`,k=>`${k} savunma arkasına sarkıyor.`,k=>`${k} oyunu kanada açıyor.`,k=>`${k} ceza alanına yaklaşıyor.`];
let app, frame, layer, toast, active='', focusBefore=null;

function esc(x){return String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// Eksi işareti U+2212 ile yazılır (tire değil).
function n(x,d=0){return Number.isFinite(Number(x))?Number(x).toLocaleString('tr-TR',{maximumFractionDigits:d,minimumFractionDigits:d}).replace(/^-/,'−'):'—';}
function isaretli(x,d=1){if(!Number.isFinite(Number(x)))return '—';const v=Number(x),s=Math.abs(v).toLocaleString('tr-TR',{maximumFractionDigits:d,minimumFractionDigits:0});return `${v<0?'−':'+'}${s}`}
function title(x){return String(x||'').toLocaleUpperCase('tr-TR');}
function btn(text,tur,testid='',extra='',cls=''){return `<button type="button" class="btn ${cls}" data-action="${tur}" ${testid?`data-testid="${testid}"`:''} ${extra}>${text}</button>`;}
function oyuncu(id){try{return MT.veri.oyuncu(id)||null}catch(_){return null}}
function takim(kod){try{return MT.veri.takim(kod)||{kod,ad:kod}}catch(_){return {kod,ad:kod}}}
function bilgi(){const b=MT.veri&&MT.veri.BILGILER;return b&&Array.isArray(b.bilgiler)?b.bilgiler[0]:null}
function kisiAdi(id){const o=oyuncu(id);return o?(o.kisaAd||o.ad):id||'—'}
function rozet(id){const o=oyuncu(id);return o?esc(o.rozet||o.ad.slice(0,2)):'+'}
function tarih(s){if(!s)return 'Veri yok';const a=String(s).split('-');return a.length===3?`${a[2]}.${a[1]}.${a[0]}`:esc(s)}
function yas(o){try{return MT.yardim.yas(o.dogum)}catch(_){const b=String(o.dogum||'').split('-').map(Number),d=new Date();return b.length===3?d.getFullYear()-b[0]-(d.getMonth()+1<b[1]||(d.getMonth()+1===b[1]&&d.getDate()<b[2])?1:0):'—'}}
function eylem(tur,detail){document.dispatchEvent(new CustomEvent('mt:eylem',{detail:Object.assign({tur},detail||{})}));}
// Ülke adına ünlü uyumlu ek: Avusturya'dan / Avusturya'da / Türkiye'den.
function ek(ad,tur){const s=String(ad||''),low=s.toLocaleLowerCase('tr-TR'),v=[...low].reverse().find(c=>'aıoueiöü'.includes(c))||'a',kalin='aıou'.includes(v),d='fstkçşhp'.includes(low.slice(-1))?'t':'d';return `${s}'${d}${tur==='den'?(kalin?'an':'en'):(kalin?'a':'e')}`}
function fikstur(t){return MT.veri&&MT.veri.FIKSTUR&&MT.veri.FIKSTUR[t&&t.siradakiFikstur]}
function rakipKod(t,m){if(m)return m.takimA==='TUR'?m.takimB:m.takimA;const f=fikstur(t);if(f&&f.tur==='final'&&Array.isArray(t&&t.siralama))return t.siralama.find(k=>k!=='TUR')||'AUT';return f?f.a==='TUR'?f.b:f.a:'AUT'}
function finalMi(m){return !!m&&(Number(m.fiksturNo)===7||m.asama==='final')}

// ---------- Puan tablosu ----------
function tablo(t,ui){
  const raw=t&&t.puanTablosu||{};
  const rows=Array.isArray(raw)?raw.slice():Object.keys(raw).map(k=>Object.assign({kod:k},raw[k]||{}));
  const used=rows.length?rows:['TUR','AUT','CZE','ITA'].map(k=>({kod:k}));
  const tamam=Array.isArray(t&&t.siralama);
  // Sıralamayı motor/app hesaplar; ekran yalnız verilen sırayı uygular.
  const order=tamam?t.siralama:ui&&Array.isArray(ui.tabloSira)?ui.tabloSira:null;
  if(order)used.sort((a,b)=>order.indexOf(a.kod)-order.indexOf(b.kod));
  const cols=['oynanan','galibiyet','beraberlik','maglubiyet','atilan','yenilen','averaj','puan'],kisa=['o','g','b','m','a','y','av','p'];
  const body=used.map((r,i)=>{
    const row=`<tr class="${r.kod==='TUR'?'is-tur':''} ${order&&i===1?'is-cut':''}"><td>${esc(takim(r.kod).ad)}</td>${cols.map((k,j)=>`<td>${n(r[k]??r[kisa[j]]??0)}</td>`).join('')}</tr>`;
    return order&&i===1?row+`<tr class="final-cut"><td colspan="9"><span>▲ Finale çıkar</span></td></tr>`:row;
  }).join('');
  return `<table class="table"><thead><tr>${['Takım','O','G','B','M','A','Y','AV','P'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
}
function fiksturList(t){const fs=MT.veri&&MT.veri.FIKSTUR||{};return Object.keys(fs).filter(k=>Number(k)<=6).map(k=>{const f=fs[k],m=(t&&t.maclar||[]).find(x=>Number(x.fiksturNo)===Number(k));return `<div class="fixture-row ${Number(k)===Number(t&&t.siradakiFikstur)?'is-next':''}"><span><span class="tiny">${esc(f.tur)}. hafta</span><br>${esc(takim(f.a).ad)} <strong>${m?esc(skorText(m)):'–'}</strong> ${esc(takim(f.b).ad)}</span>${m?`<span class="pill">${f.a!=='TUR'&&f.b!=='TUR'?'Simüle edildi':'Oynandı'}</span>`:''}</div>`}).join('')}
function sonucHarf(m){const s=score(m);if(m.penalti)return m.penalti.kazanan==='TUR'?'G':'M';return s.a>s.b?'G':s.a<s.b?'M':'B'}
function scorePath(t,rozetli){
  let grup=0;
  return (t&&t.maclar||[]).filter(m=>m.takimA==='TUR'||m.takimB==='TUR').map(m=>{
    const etiket=m.asama==='final'?'FİNAL':m.asama==='hizli'?'HIZLI SENARYO':`Grup ${++grup}. maç`;
    const harf=sonucHarf(m),harfAd={G:'Galibiyet',B:'Beraberlik',M:'Mağlubiyet'}[harf];
    // QA3 A-6: Türkiye maçları gösterimde hep "Türkiye … rakip" sırasıyla (motor A/B sırası değişmez).
    const s=score(m),tb=m.takimB==='TUR',pa=m.penalti?(tb?m.penalti.skor.b:m.penalti.skor.a):0,pb=m.penalti?(tb?m.penalti.skor.a:m.penalti.skor.b):0;
    const pen=m.penalti?` · Penaltılar ${n(pa)}–${n(pb)} (${esc(takim(m.penalti.kazanan).ad)})`:'';
    return `<div class="fixture-row">${rozetli?`<span class="result-badge result-badge--${harf}" title="${harfAd}${m.penalti?' (penaltılarla)':''}">${harf}</span>`:''}<span class="path-text"><span class="tiny">${etiket}</span><br>Türkiye <strong>${n(s.a)}–${n(s.b)}</strong> ${esc(takim(s.op).ad)}${pen}</span></div>`;
  }).join('')||'<p class="muted">Maç kaydı yok.</p>';
}
function skorText(m){const s=m.skor||{};return `${s.a??s.A??0}–${s.b??s.B??0}`}
function score(m){const s=m&&m.skor||{};let a=s.a??s.A??0,b=s.b??s.B??0,op=rakipKod(null,m);if(m&&m.takimB==='TUR'){const x=a;a=b;b=x}return {a,b,op}}
function macEtiket(m){return finalMi(m)?'KURGU MAÇ · FİNAL':m&&m.asama==='hizli'?'KURGU MAÇ · SENARYO':'KURGU MAÇ'}
// QA3 A-7: yayın skor kartı düzeni: TÜRKİYE | skor (üstte KURGU MAÇ) | RAKİP | dakika. Türkiye B olsa da score(m) ile çevrilir.
function skorBand(m,ui){const s=score(m);return `<div class="scoreband"><div class="sb-team sb-team--tur">TÜRKİYE</div><div class="sb-mid"><div class="fiction">${macEtiket(m)}${ui&&ui.tekrarModu==='karar'?` <span class="replay-tag">${tekrarBitti(ui)?'TEKRAR · BİTTİ':'TEKRAR'}</span>`:''}</div><div class="score">${n(s.a)}–${n(s.b)}</div></div><div class="sb-team sb-team--op">${title(takim(s.op).ad)}</div><div class="minute">${n(m&&m.dakika||0)}'</div></div>`}
function datum(t){return `<span class="mono">Tohum ${n((t&&t.tohum)??0)}</span>`}

// ---------- Görseller (resmî logo/arma yok; sade ay-yıldız bayrak motifi) ----------
function ayYildiz(){
  const pts=[];for(let i=0;i<10;i++){const a=Math.PI+i*Math.PI/5,r=i%2?6.1:16;pts.push(`${(83+r*Math.cos(a)).toFixed(2)},${(60+r*Math.sin(a)).toFixed(2)}`)}
  return `<svg class="flag-mark" viewBox="0 0 120 120" role="img" aria-label="Ay-yıldız bayrak motifi"><defs><mask id="hilal-maske"><rect width="120" height="120" fill="#fff"/><circle cx="58" cy="60" r="32" fill="#000"/></mask></defs><circle cx="48" cy="60" r="40" fill="#E30A17" mask="url(#hilal-maske)"/><polygon points="${pts.join(' ')}" fill="#E30A17"/></svg>`;
}
function sahaCizgi(){return `<svg class="preview-pitch" viewBox="0 0 105 68" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width=".5"><rect x="3" y="3" width="99" height="62"/><line x1="52.5" y1="3" x2="52.5" y2="65"/><circle cx="52.5" cy="34" r="9.15"/><rect x="3" y="13.85" width="16.5" height="40.3"/><rect x="85.5" y="13.85" width="16.5" height="40.3"/><rect x="3" y="24.85" width="5.5" height="18.3"/><rect x="96.5" y="24.85" width="5.5" height="18.3"/></g></svg>`}
function kupaSvg(){return `<svg class="cup-art" viewBox="0 0 120 140" aria-hidden="true"><defs><linearGradient id="kupa-altin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF6A8"/><stop offset=".35" stop-color="#FFE40C"/><stop offset="1" stop-color="#F2982D"/></linearGradient></defs><g fill="url(#kupa-altin)"><path d="M30 12h60v26c0 22-12 38-30 42-18-4-30-20-30-42z"/><path d="M30 20H14c0 20 8 32 22 36l2-8C27 44 22 36 22 28h8zM90 20h16c0 20-8 32-22 36l-2-8c11-4 16-12 16-20h-8z"/><rect x="54" y="80" width="12" height="22" rx="3"/><path d="M38 104h44l6 16H32z"/><rect x="28" y="120" width="64" height="10" rx="3"/></g><path d="M44 20v18c0 12 6 22 14 26" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/></svg>`}

// ---------- Ekranlar ----------
function acilis(t,ui){const b=bilgi();return `<div class="intro"><div class="hero-line"></div><p class="eyebrow">ÇEVRİMDIŞI FUTBOL DENEYİMİ</p><h1>Milli Takımın <span class="grad-text">Başında</span></h1><p class="tagline">Dört takım. Üç grup maçı. Bir final. Kararlar senin.</p><p>Gerçek oyuncularla kurgu turnuva; puanlar temsili.</p><p class="pill">Oyun reytingleri temsilidir.</p></div><aside class="preview card">${sahaCizgi()}<div class="preview-top"><p class="eyebrow">KURGU DÖRTLÜ KUPA</p><div class="preview-mark">${ayYildiz()}</div></div><div><h2>Karar sahaya yansır.</h2><p class="muted">Dizilişi kur, planı seç, maçın akışına müdahale et.</p><p class="disclosure">${NOT}</p></div></aside><div class="actions card"><label class="eyebrow" for="seed-input">Tohum</label><div class="seed-field"><input id="seed-input" data-testid="seed-input" inputmode="numeric" maxlength="10" value="${esc((ui&&ui.tohumGiris)??(t&&t.tohum)??'')}" aria-label="Tohum"><button class="btn" data-action="tohum-kopyala">Tohumu kopyala</button></div><div class="actions-row">${ui&&ui.kayitVar?`${btn('Kaldığın yerden devam et','devam-kayit','btn-devam-kayit','','btn--primary')}${btn('Yeni turnuva','yeni','btn-yeni')}`:btn('Yeni turnuva','yeni','btn-yeni','','btn--primary')}${btn("Hızlı dene: 70'te 1–1",'hizli','btn-hizli')}</div>${b?`<div class="rule"></div><p class="tiny">TARİHTEN BİR NOT</p><p>${esc(b.metin)}</p><p class="tiny">Kaynak: ${b.kaynak.includes('fifa')?'FIFA':'UEFA'} · Kaynak kontrolü: ${tarih(MT.veri.BILGILER.veriTarihi)}${ui&&ui.temiz?'':` · <a class="optional-link" href="${esc(b.kaynak)}" target="_blank" rel="noopener">Kaynağı aç</a>`}</p>`:''}</div>`}
function merkez(t,ui){
  const f=fikstur(t),done=!f||t.tur>3||t.siradakiFikstur===7||t.sonuc&&t.sonuc!=='devam';
  let rk=rakipKod(t);if(f&&f.a!=='TUR'&&f.b!=='TUR')rk='AUT';const opp=takim(rk);
  const sira=Array.isArray(t&&t.siralama)?t.siralama:null,rank=sira?sira.indexOf('TUR')+1:0,oynandi=(t&&t.maclar||[]).length>0;
  const durum=t&&t.sonuc==='elenme'?(rank?`Türkiye grupta ${n(rank)}. oldu; final oynayamayacak.`:'Türkiye final oynayamayacak.'):`Türkiye finale kaldı: rakip ${esc(takim(sira?sira.find(k=>k!=='TUR'):rk).ad)}.`;
  return `<header class="header"><p class="eyebrow">TURNUVA MERKEZİ</p><h1>Kurgu Dörtlü Kupa</h1><p class="subtle">Gerçek fikstür değildir. Bütün maçlar ve sonuçlar kurgu simülasyondur.</p></header><section class="table-area card"><div class="section-head"><h2>Puan durumu</h2><span class="pill">${done?'Grup':oynandi?'Geçici sıra':'Grup'}</span></div>${tablo(t,ui)}${done?'<p class="subtle">Grup tamamlandı · Sıralama: puan, averaj, atılan gol, ikili sonuçlar. Tam eşitlikte tohumlu kura.</p>':oynandi?'<p class="subtle">Geçici sıra · grup bitince ilk iki takım finale çıkar.</p>':''}</section><section class="fixture card"><h2>Fikstür</h2><div class="fixture-list">${fiksturList(t)}</div></section><section class="next card card--red">${done?`<h2>Grup tamamlandı</h2><p class="muted">${durum}</p>${btn(t.sonuc==='elenme'?'Sonucu gör':'Finale geç','mac-onu','btn-mac-onu','','btn--primary')}`:`<p class="eyebrow">SIRADAKİ MAÇ</p><h2>Türkiye · ${esc(opp.ad)}</h2><p>Oyun gücü ${n(opp.guc)} (temsili; FIFA sırasından türetildi)</p>${btn('Maç önüne geç','mac-onu','btn-mac-onu','','btn--primary')}`}</section>`;
}
function kadro(t){return t&&t.hazirlikKadro||{dizilis:'4-3-3',ilk11:{},yedekler:[]}}
function taktik(t){return t&&t.hazirlikTaktik||{dizilis:kadro(t).dizilis||'4-3-3',plan:'dengeli'}}
// Enerji turnuva durumundan okunur (TurnuvaDurumu.oyuncuEnerjileri); yoksa 100 sayılır.
function enerji(t,id){const e=id&&t&&t.oyuncuEnerjileri?Number(t.oyuncuEnerjileri[id]):NaN;return Number.isFinite(e)?e:100}
function enerjiCubuk(E){return E<100?`<span class="energy-bar ${E<YORGUN_ESIK?'is-tired':''}" role="img" aria-label="Enerji %${n(E)}"><i style="width:${Math.max(0,Math.min(100,E))}%"></i></span>`:''}
function enerjiTitle(E){return E<100?` · Enerji %${n(E)}`:''}
function xiEnerji(k,t){const ids=Object.values(k&&k.ilk11||{}).filter(Boolean),es=ids.map(id=>enerji(t,id));if(!es.length||es.every(e=>e>=100))return '';const ort=es.reduce((a,b)=>a+b,0)/es.length,yorgun=es.filter(e=>e<YORGUN_ESIK).length;return `<span class="pill ${yorgun?'is-tired':''}">Ort. enerji %${n(ort)}${yorgun?` · ${n(yorgun)} yorgun`:''}</span>`}
function lineup(k,t){const d=MT.veri&&MT.veri.DIZILISLER&&MT.veri.DIZILISLER[k.dizilis]||[];return `<div class="lineup-pitch">${d.map(p=>{const id=k.ilk11&&k.ilk11[p.slot],E=enerji(t,id);return `<button type="button" class="slot" style="left:${p.x*100}%;top:${p.y*100}%" data-action="slot-ac" data-slot="${esc(p.slot)}" ${id?`data-testid="saha-oyuncu-${esc(id)}"`:''} title="${esc(p.slot)}: ${esc(kisiAdi(id))}${id?enerjiTitle(E):''}"><span class="badge ${id?'':'badge--empty'}">${rozet(id)}</span>${id?enerjiCubuk(E):''}<span class="slot-name">${esc(id?kisiAdi(id):p.slot)}</span></button>`}).join('')}</div>`}
function bench(k,t){return `<div class="bench-list">${Array.from({length:7},(_,i)=>{const id=k.yedekler&&k.yedekler[i],E=enerji(t,id);return `<button type="button" class="bench-player" data-action="slot-ac" data-slot="yedek:${i}" ${id?`data-testid="saha-oyuncu-${esc(id)}"`:''} title="${esc(id?kisiAdi(id):'Yedek seç')}${id?enerjiTitle(E):''}"><span class="badge ${id?'':'badge--empty'}">${rozet(id)}</span>${id?enerjiCubuk(E):''}<span>${esc(id?kisiAdi(id):'Seç')}</span></button>`}).join('')}</div>`}
function options(kind,current,hedef,disabledYuklen){const values=kind==='plan'?Object.keys(PLAN):Object.keys(MT.veri&&MT.veri.DIZILISLER||{'4-3-3':1,'4-2-3-1':1,'3-5-2':1});return `<div class="option-grid">${values.map(k=>btn(esc(kind==='plan'?PLAN[k]:k),kind==='plan'?'plan-sec':'dizilis-sec',`${kind==='plan'?'plan':'dizilis'}-${k}`,`data-hedef="${hedef}" data-kod="${esc(k)}" aria-pressed="${k===current}" ${k==='yuklen'&&disabledYuklen?'disabled title="Yüklen 60. dakikadan sonra açılır."':''}`,k===current?'is-selected':'' )).join('')}</div>`}
function hocaSecim(t,parca){const H=MT.veri&&MT.veri.HOCALAR;if(!H)return '';const rk=rakipKod(t),sec=(t&&t.hocalar)||{};const sel=kod=>`<select aria-label="${esc(takim(kod).ad)} hocası" title="${esc(takim(kod).ad)} hocası" data-action="hoca-sec" data-hedef="${esc(kod)}">${Object.entries(H).map(([k,h])=>`<option value="${k}" ${(sec[kod]||'kendi')===k?'selected':''}>${esc(takim(kod).ad)}: ${esc(h.ad)}</option>`).join('')}</select>`;const ht=H[sec.TUR||'kendi'];const acik=`${ht.ad}: ${ht.aciklama} Tarz esinlemesidir; gerçek karar ya da söz değildir.`;if(parca==='acik')return `<p class="tiny hoca-acik" title="${esc(acik)}">Hoca modu · ${esc(acik)}</p>`;return `<div class="hoca-row">${sel('TUR')}${sel(rk)}${btn('⇄','hoca-degistir','btn-hoca-degistir',`data-rakip="${esc(rk)}" title="Hocaları değiştir" aria-label="Hocaları değiştir"`,'btn--small')}</div>`}
function macOnu(t,ui){
  const k=kadro(t),tk=taktik(t),op=takim(rakipKod(t)),p=ui&&ui.onizleme||{},a=p.sonra||{},final=t&&t.siradakiFikstur===7;
  const eyebrow=t&&t.mod==='hizli'?"Kurgu senaryo · Final · 70' · 1–1":final?'FİNAL · KURGU DÖRTLÜ KUPA':'KURGU DÖRTLÜ KUPA';
  return `<header class="header"><p class="eyebrow">${eyebrow}</p><h1>Maç önü · ${esc(op.ad)}</h1><p>Rakip stili: ${esc(STIL[op.stil]||op.stil)} (temsili) &nbsp; · &nbsp; FIFA sırası: ${n(op.fifaSirasi)} · 20.07.2026</p>${final?`<div class="actions-row"><p class="pill">90'da beraberlikte penaltılar</p><p class="pill">Grup birincisi ${esc(takim(t.siralama&&t.siralama[0]).ad)}: hücum ve savunmaya +2 temsili lider bonusu</p></div>`:''}</header><section class="pitch card"><div class="section-head"><div class="head-left"><h2>İlk 11</h2>${xiEnerji(k,t)}</div>${hocaSecim(t,'satir')}${btn("Hazır 11'i öner",'kadro-oner','btn-kadro-oner')}</div>${lineup(k,t)}${hocaSecim(t,'acik')}</section><section class="bench card"><div class="section-head"><h3>Yedekler ${k.yedekler&&k.yedekler.filter(Boolean).length||0}/7</h3>${btn('Tüm adaylar','slot-ac','','data-slot="yedek:0"')}</div>${bench(k,t)}<div class="squad-notes"><p class="subtle">A Millî maç/gol: 02.10.2026 Belçika maçı sonrası; 05.10 İtalya maçı hariç.</p><p class="subtle">Arda Güler ve Barış Alper Yılmaz, 03.10'da kart cezası nedeniyle gerçek İtalya maçının (05.10) kampından ayrıldı. Bu kurgu turnuvadaki seçilebilirlikleri o gerçek maça müsait oldukları anlamına gelmez.</p></div></section><section class="tactics card"><h3>Diziliş</h3>${options('dizilis',tk.dizilis,'hazirlik',false)}<div class="rule"></div><h3>Oyun planı</h3>${options('plan',tk.plan,'hazirlik',t&&t.mod!=='hizli')}<p class="tiny">${t&&t.mod==='hizli'?'Yüklen bu senaryoda baştan seçilebilir; etkisi 71. dakikadan başlar.':'Yüklen 60. dakikadan sonra açılır.'}</p></section><section class="metrics card"><h3>Temsili güç önizlemesi</h3><div class="metrics-grid"><div class="metric">Temsili hücum <strong>${n(a.H)}</strong></div><div class="metric">Savunma <strong>${n(a.S)}</strong></div><div class="metric">Eşleşme etkisi <strong>${n(p.eslesme)}</strong></div><div class="metric">Enerji bedeli <strong>${n(p.enerjiBedeli,2)}/dk</strong></div></div><p>${btn('Nasıl hesaplanır?','hesap-ac')}</p></section><div class="actions actions-row">${btn('Oyuncu seç','slot-ac','','data-slot="KL"')}${btn('Merkeze dön','merkeze-don')}${btn('Maçı başlat','mac-baslat','btn-mac-baslat','','btn--primary')}</div>`;
}
function macStats(m,etiket){const s=m&&m.istatistik||{},turB=m&&m.takimB==='TUR',a=turB?(s.b||s.B||{}):(s.a||s.A||{}),b=turB?(s.a||s.A||{}):(s.b||s.B||{}),op=m?rakipKod(null,m):'';return `<div class="stats-line stats-head"><span>${esc(etiket||'')}</span><strong>${KISA.TUR}</strong><strong>${esc(KISA[op]||op||'RAK')}</strong></div>`+['Şut','İsabet','Temsili xG'].map((label,i)=>{const key=['sut','isabet','xg'][i];return `<div class="stats-line"><span>${label}</span><strong>${n(a[key]||0,i===2?2:0)}</strong><strong>${n(b[key]||0,i===2?2:0)}</strong></div>`}).join('')}

// ---------- Olay metni (SPEC §2: varyant MacOlayi.sunumVaryanti'nden) ----------
function statEtiket(m){return m&&m.asama==='hizli'?"70' sonrası":'Maç geneli'}
// Banka satırı: taban sunumVaryanti (0–3, SPEC §2); havuz olay kimliğinin hash'iyle genişler. Yalnız sunum: motor zarına ve tohuma dokunmaz.
function banka(tur,o,kaydir,alanlar,uygun){
  const V=MT.veri,liste=V&&V.YORUMLAR&&V.YORUMLAR[tur];
  if(!Array.isArray(liste)||!liste.length||typeof V.yorum!=='function')return null;
  const say=Math.max(1,Math.floor(liste.length/4)),h=MT.yardim&&MT.yardim.hash32?MT.yardim.hash32(o.id||'',tur):0,taban=Math.max(0,Math.floor(Number(kaydir)||0));
  let ilk=null;
  for(let k=taban;k<taban+4*say;k++){
    const v=((Number(o.sunumVaryanti)||0)+k)%4,ek=(h+Math.floor(k/4))%say,satir=V.yorum({tur,sunumVaryanti:v+4*ek},alanlar);
    if(ilk==null)ilk=satir;
    if(!uygun||uygun(satir))return satir;
  }
  return ilk;
}
function olayGovde(o,kaydir=0){
  if(!o)return '';
  const tur=o.takimKod==='TUR',tk=takim(o.takimKod).ad,no=o.formaNo?`${o.formaNo} numara`:'',ad=o.oyuncuId?kisiAdi(o.oyuncuId):null,P='Bu kurgu maçta: ';
  // Banka cümlesindeki kişi: Türkiye'de kısa ad, rakipte "{Takım} {no} numara".
  const kisi=tur?(ad||'Türkiye'):no?`${tk} ${no}`:`${ek(tk,'den')} bir oyuncu`;
  let b=null;
  switch(o.tur){
    case 'atak':b=banka('atak',o,kaydir,{takim:tk});break;
    case 'sut':if(o.sonuc==='kurtaris'||o.sonuc==='disari')b=banka(o.sonuc==='kurtaris'?'kurtaris':'kacanPozisyon',o,kaydir,{oyuncu:kisi});break;
    case 'gol':{const s=banka('gol',o,kaydir,{oyuncu:kisi});if(s)b=tur&&ad?P+s:s;break}
    case 'sari':case 'kirmizi':case 'sakatlik':b=banka(o.tur,o,kaydir,{oyuncu:kisi});break;
    case 'plan':{const pl=typeof o.sonuc==='string'?o.sonuc:o.sonuc&&o.sonuc.plan,dz=o.sonuc&&typeof o.sonuc==='object'?o.sonuc.dizilis:null;const s=banka('plan',o,kaydir,{takim:tk,plan:PLAN_CUMLE[pl]||pl||'yeni plan'},x=>x.includes(tk));if(s)b=`${s}${tur&&dz?` Diziliş: ${dz}.`:''}`;break}
    case 'degisiklik':{const r=o.sonuc||{},num=x=>x?`${tk} ${String(x).split('#')[1]} numara`:null;b=banka('degisiklik',o,kaydir,tur?{cikan:kisiAdi(r.cikanId),giren:kisiAdi(r.girenId)}:{cikan:num(r.cikanId)||'bir oyuncu',giren:no?`${tk} ${no}`:num(r.girenId)||'yeni oyuncu'});break}
    case 'devre':case 'bitis':b=banka(o.tur,o,kaydir,{});break;
    case 'penalti':{const s=banka(o.sonuc==='gol'?'penaltiGol':'penaltiKacti',o,kaydir,{oyuncu:kisi,takim:tk});if(s)b=tur&&ad?P+s:s;break}
  }
  if(b)return b;
  // Banka yoksa eski sabit cümleler (yedek).
  const v=(Number(o.sunumVaryanti||0)+kaydir)%4;
  switch(o.tur){
    case 'atak':return tur?ATAK_TUR[v]:ATAK_RAKIP[v](tk);
    case 'sut':{const s=SUT_SONUC[o.sonuc]||'pozisyon sonuçlandı',yer=SUT_YER[o.sutTipi]?SUT_YER[o.sutTipi]+' ':'',kim=ad||(no?`${ek(tk,'den')} ${no}`:tk);return `${kim} ${yer}${SUT_FIIL[v]} · ${s}.`}
    case 'gol':return tur?(ad?`${P}${ad} gol attı!`:'Türkiye gol attı!'):`${tk} gol buldu!${no?` (${no})`:''}`;
    case 'sari':case 'kirmizi':case 'sakatlik':{const fiil={sari:'sarı kart gördü',kirmizi:'kırmızı kart gördü',sakatlik:'sakatlandı'}[o.tur];return ad?`${P}${ad} ${fiil}.`:`${ek(tk,'den')} ${no||'bir oyuncu'} ${fiil}.`}
    case 'plan':{const pl=typeof o.sonuc==='string'?o.sonuc:o.sonuc&&o.sonuc.plan,dz=o.sonuc&&typeof o.sonuc==='object'?o.sonuc.dizilis:null;return `${P}${tk} planını değiştirdi: ${PLAN[pl]||pl||'—'}${tur&&dz?` · ${dz}`:''}.`}
    case 'degisiklik':{const r=o.sonuc||{};if(tur)return `${P}${kisiAdi(r.cikanId)} çıktı, ${kisiAdi(r.girenId)} girdi.`;const giren=no||(r.girenId?`${String(r.girenId).split('#')[1]} numara`:'bir oyuncu'),cikan=r.cikanId?String(r.cikanId).split('#')[1]:'';return `${ek(tk,'de')} ${giren} oyuna girdi${cikan?`, ${cikan} numara çıktı`:''}.`}
    case 'devre':return 'Devre arası.';
    case 'bitis':return 'Maç sona erdi.';
    case 'penalti':return tur&&ad?`${P}${ad} penaltıda ${o.sonuc==='gol'?'gol attı':'kaçırdı'}.`:`Penaltı · ${tur?'Türkiye':`${tk}${no?` ${no}`:''}`} · ${o.sonuc==='gol'?'Gol':'Kaçtı'}`;
    default:return '';
  }
}
function olayText(o,kaydir){return o?`${n(o.dakika)}' · ${olayGovde(o,kaydir)}`:''}
// Gole giden şut ayrıca yazılmaz: ardından gelen gol olayı aynı anı söyler.
function recent(m){return (m&&m.olaylar||[]).filter(o=>o.tur!=='atak'&&!(o.tur==='sut'&&o.sonuc==='gol')).slice(-4).reverse().map(o=>{const x=esc(olayText(o));return `<li data-tur="${esc(o.tur)}" title="${x}">${x}</li>`}).join('')||'<li class="muted">Henüz önemli olay yok.</li>'}
const TEKRAR_BITTI='Tekrar bitti · kararlar ve sonuç aynı kaldı.';
// QA3 A-4: sahne sırasında istenen müdahale kuyruktadır; düğme bunu söyler (devre dışı değildir).
const MUDAHALE_BEKLIYOR='Müdahale istendi · sahne bitince açılır';
// QA3 A-15: penaltı serisi sürerken seriyle çakışan düğmeler kilitlenir (Duraklat/Sürdür ve hız açık kalır).
const PEN_KILIT='Penaltı serisi sürerken kullanılamaz.';
function kilitAttr(on){return on?` disabled aria-disabled="true" title="${PEN_KILIT}"`:''}
function kilitle(el,on){if(!el)return;if(el._baslik===undefined)el._baslik=el.getAttribute('title');el.disabled=on;el.classList.toggle('is-disabled',on);if(on){el.setAttribute('aria-disabled','true');el.setAttribute('title',PEN_KILIT)}else{el.removeAttribute('aria-disabled');if(el._baslik==null)el.removeAttribute('title');else el.setAttribute('title',el._baslik)}}
function tekrarBitti(ui){return !!(ui&&ui.tekrarModu==='karar'&&ui.tekrarBitti)}
function ilkYorum(t,m,ui){
  if(tekrarBitti(ui))return TEKRAR_BITTI;
  if(ui&&ui.tekrarModu==='karar')return 'Maç baştan izleniyor · kararlar ve sonuç aynı kalır.';
  const d=m&&m.dakika||0;if(!d)return 'Maç başlıyor.';
  if((m.asama==='hizli'||t&&t.mod==='hizli')&&d===70){const s=score(m);return `Senaryo 70. dakikadan devam ediyor · ${s.a}–${s.b}`}
  if(d===45)return 'İkinci yarı başlıyor.';
  const last=(m.olaylar||[]).filter(o=>o.tur!=='atak').slice(-1)[0];
  return `Kaldığın yerden devam ediyorsun · ${n(d)}'${last?`. Son olay: ${olayGovde(last)}`:''}`;
}
function otoBtn(ui){const on=!!(ui&&ui.otomatikHiz),f=!!(ui&&ui.film);return `<button type="button" class="btn btn--toggle ${on?'is-selected':''}" data-action="otomatik-hiz" aria-pressed="${on}"><span>Otomatik hız</span><span class="toggle-state">${on?'Açık':'Kapalı'}</span></button><button type="button" class="btn btn--toggle ${f?'is-selected':''}" data-action="film-modu" aria-pressed="${f}" title="90 dakikayı yaklaşık 1 dakikada, durmadan oynatır"><span>90 dk / 1 dk</span><span class="toggle-state">${f?'Açık':'Kapalı'}</span></button>`}
function live(t,m,ui){
  const tk=m&&m.taktikler&&(m.taktikler.TUR||m.taktikler.tur)||taktik(t),tekrar=ui&&ui.tekrarModu==='karar',bitti=tekrarBitti(ui);
  return `<div class="score-area">${skorBand(m,ui)}</div><div class="pitch-area" data-canvas-anchor><span class="sr-only">Canlı maç sahası</span></div><div class="commentary-area"><div class="card card--flat commentary-card"><p class="eyebrow">Spiker yorumu</p><p class="commentary-text" data-live="commentary">${esc(ilkYorum(t,m,ui))}</p><p class="tiny">Son 10 dakika baskısı (temsili)</p><div class="pressure"><span data-live="pressure"></span></div><div class="tiny">Türkiye <span data-live="momentum">50</span> · Rakip <span data-live="momentum-rakip">50</span></div></div><div class="card card--flat"><p class="eyebrow">Son olaylar</p><ul class="event-list" data-live="events">${recent(m)}</ul></div><div class="card card--flat stats-card"><p class="eyebrow">Şut / İsabet / Temsili xG</p><div data-live="stats">${macStats(m,statEtiket(m))}</div></div></div><aside class="controls card"><p class="eyebrow">MAÇ KONTROLÜ</p><div class="control-meta"><strong data-live="plan">Plan: ${esc(PLAN[tk.plan]||'Dengeli')}</strong><span data-live="quota">Kalan değişiklik: ${5-(m&&m.degisiklikSayisi||0)}/5</span></div><div class="live-control">${tekrar?btn(bitti?'Sonuca dön':'Tekrarı kapat','tekrar-kapat','','',bitti?'btn--primary':''):btn(ui&&ui.panelBekliyor?MUDAHALE_BEKLIYOR:'Müdahale et','mudahale-ac','btn-mudahale',`aria-live="polite"${kilitAttr(ui&&ui.penaltiAktif)}`,`${ui&&ui.panelBekliyor?'btn--pending':''} ${ui&&ui.penaltiAktif?'is-disabled':''}`)}${tekrar?'':ui&&ui.durakli?btn('Sürdür','surdur','btn-surdur','','btn--primary'):btn('Duraklat','duraklat','btn-duraklat')}${btn('Sıradaki pozisyona atla','pozisyona-atla','',`${bitti?'hidden':''}${kilitAttr(ui&&ui.penaltiAktif)}`,ui&&ui.penaltiAktif?'is-disabled':'')}<div class="sahne-atla-slot">${ui&&ui.sahneAktif?btn('Gol sahnesini atla','sahne-atla','btn-sahne-atla'):''}</div></div><div class="speed-block"${bitti?' hidden':''}><p class="tiny">Hız: 1× / 2× / 4×</p><div class="speed-grid">${[1,2,4].map(x=>btn(`${x}×`,'hiz-sec',`btn-hiz-${x}`,`data-hiz="${x}" aria-pressed="${ui&&ui.hiz===x}"`,ui&&ui.hiz===x?'is-selected':'' )).join('')}</div></div>${tekrar?'':otoBtn(ui)}<div class="replay-block"${tekrar?' hidden':''}><p class="tiny replay-head${tekrar||replayBtns(m,ui,true)?'':' is-empty'}">Pozisyonu yeniden izle</p><div class="replay-list" data-live="replays">${tekrar?'':replayBtns(m,ui,true)}</div></div></aside>`;
}
function pozEtiket(o){return `${n(o.dakika)}′ ${o.oyuncuId?kisiAdi(o.oyuncuId):`${takim(o.takimKod).ad}${o.formaNo?` ${o.formaNo} numara`:''}`}`}
function replayBtns(m,ui,kompakt){const ids=(ui&&ui.sonUcSut||[]).slice(-3).reverse(),olaylar=m&&m.olaylar||[];return ids.map(id=>{const o=olaylar.find(x=>x.id===id),et=o?pozEtiket(o):'',full=`Pozisyonu yeniden izle${et?` · ${et}`:''}`;const kilit=kompakt&&ui&&ui.penaltiAktif;return `<button type="button" class="btn replay-btn${kilit?' is-disabled':''}" data-action="pozisyon-tekrar" data-olay-id="${esc(id)}" aria-label="${esc(full)}" ${kilit?kilitAttr(true):`title="${esc(full)}"`}>${kompakt?`<span class="play-ico" aria-hidden="true"></span><span>${esc(et||'Pozisyon')}</span>`:esc(full)}</button>`}).join('')}
function konusmaEtki(x){if(!x)return 'Temsili etki hesaplanamadı';const en=Number(x.enerjiBedeli)||0,kr=Number(x.kartRiski)||1;return `Temsili: Moral ${isaretli(x.moral,0)} · H ${isaretli(x.dH)} / S ${isaretli(x.dS)} · ${en>0?`Enerji kaybı ${isaretli(en,2)}/dk (46–90')`:'Ek enerji kaybı yok'} · ${kr!==1?`Sarı kart riski ×${n(kr,1)}`:'Kart riski değişmez'}`}
function devre(t,m,ui){const e=ui&&ui.devreEtkileri||{},sel=ui&&ui.devreSecim;const energies=Object.entries(m&&m.enerjiler||{}).filter(([id])=>Object.values(m&&m.kadro&&m.kadro.ilk11||{}).includes(id)||!(m&&m.kadro)).sort((a,b)=>a[1]-b[1]).slice(0,3);return `<div class="score-area"><p class="eyebrow">${macEtiket(m)}</p><h1>Devre arası · 45'</h1>${skorBand(m,ui)}</div><section class="talk card"><h2>Takıma ne söyleyeceksin?</h2>${[['sakin','Sakin kal'],['cesaret','Cesaret ver'],['sert','Sert uyar']].map(([k,label])=>`<button type="button" class="btn talk-option ${sel===k?'is-selected':''}" data-action="konusma-sec" data-secim="${k}" aria-pressed="${sel===k}"><strong>${label}</strong><small>${konusmaEtki(e[k])}</small></button>`).join('')}<p class="subtle">Sert uyar: iki fark geride moral +7, diğer durumlarda −4; ek enerji tüketimi ve 1,5× sarı kart riski (temsili).</p></section><section class="tactics card"><h2>İlk yarı</h2><p>Şut / Temsili xG</p>${macStats(m,'')}<div class="rule"></div><h3>En yorgun üç oyuncu</h3>${energies.map(([id,val])=>`<div class="energy-row"><span>${esc(kisiAdi(id))}</span><div class="meter"><span style="width:${Math.max(0,Math.min(100,val))}%"></span></div><span>%${n(val)}</span></div>`).join('')}<div class="actions-row" style="margin-top:16px">${btn('Planı düzenle','mudahale-ac')}${btn('Oyuncu değiştir','mudahale-ac')}</div>${ui&&ui.taslak&&((ui.taslak.degisiklikler||[]).length||ui.taslak.plan||ui.taslak.dizilis)?`<p class="subtle">Bekleyen devre taslağı: ${taslakOzet(ui.taslak)}</p>`:''}</section><div class="actions">${btn('İkinci yarıya başla','ikinci-yari','btn-ikinci-yari','','btn--primary')}</div>`}
function taslakOzet(d){const p=[];if(d.plan)p.push(`plan ${PLAN[d.plan]||d.plan}`);if(d.dizilis)p.push(`diziliş ${d.dizilis}`);for(const x of d.degisiklikler||[])p.push(`${kisiAdi(x.cikanId)} → ${kisiAdi(x.girenId)}`);return esc(p.join(' · '))}
function kararAd(k){const i=k.islem||{},ek=[];if(i.plan)ek.push('plan');if(i.dizilis)ek.push('diziliş');const dn=(i.degisiklikler||[]).length;if(dn)ek.push(`${dn} değişiklik`);if(k.tur==='konusma')return `Devre konuşması${k.secim&&KONUSMA[k.secim]?` (${KONUSMA[k.secim]})`:''}${ek.length?' + '+ek.join(' + '):''}`;return `Müdahale${ek.length?': '+ek.join(' + '):''}`}
function golListe(gs){return gs.map(o=>`<span>${n(o.dakika)}' ${esc(o.oyuncuId?kisiAdi(o.oyuncuId):o.formaNo?`${o.formaNo} numara`:takim(o.takimKod).ad)}</span>`).join('')}
function sonuc(t,m,ui){
  // QA3 A-16: maç önü planı/dizilişi de bir karardır; sonuçta açıkça yazılır (macBaslangic aynı maçınsa).
  const mb=t&&t.macBaslangic,bas=mb&&m&&Number(mb.fiksturNo)===Number(m.fiksturNo)&&mb.taktikler?(mb.taktikler.TUR||mb.taktikler.tur):null;
  const s=score(m),goals=(m&&m.olaylar||[]).filter(o=>o.tur==='gol'),hizli=t&&t.mod==='hizli'||m&&m.asama==='hizli';
  const turG=goals.filter(o=>o.takimKod==='TUR'),opG=goals.filter(o=>o.takimKod!=='TUR');
  const pen=m&&m.penalti,penA=pen?(m.takimB==='TUR'?pen.skor.b:pen.skor.a):0,penB=pen?(m.takimB==='TUR'?pen.skor.a:pen.skor.b):0;
  // Hızlı senaryonun 70' başlangıç skoru (A/B sırası; Türkiye B ise çevrilir).
  const b0=m&&m.baslangicSkor,bs=b0?(m.takimB==='TUR'?{a:b0.b??b0.B??0,b:b0.a??b0.A??0}:{a:b0.a??b0.A??0,b:b0.b??b0.B??0}):null;
  return `<div class="score-area card card--red"><p class="eyebrow">Kurgu maç sonucu${finalMi(m)?' · Final':''}</p><h1 class="sr-only">Türkiye · ${esc(takim(s.op).ad)}</h1><div class="result-board"><div class="result-side"><p class="result-team">TÜRKİYE</p><p class="scorers">${golListe(turG)}</p></div><div class="result-score" aria-label="Skor ${n(s.a)}–${n(s.b)}">${n(s.a)}–${n(s.b)}</div><div class="result-side result-side--away"><p class="result-team">${title(takim(s.op).ad)}</p><p class="scorers">${golListe(opG)}</p></div></div>${pen?`<p class="pill result-pen">Penaltılar ${n(penA)}–${n(penB)} · ${esc(takim(pen.kazanan).ad)} kazandı${pen.kura?' · Simülasyon kura kararı':''}</p>`:''}${goals.length?'':`<p class="result-none">${hizli?"70' sonrası gol yok":'Gol yok'}</p>`}${hizli&&bs?`<p class="subtle">Senaryo 70'te ${n(bs.a)}–${n(bs.b)} başladı; listelenen goller 70' sonrasıdır.</p>`:''}<p class="disclosure">Kurgu simülasyon · Sonuç gerçek maç değildir.</p></div><section class="stats card"><h2>Şut / İsabet / Temsili xG${hizli?" · 70' sonrası":''}</h2>${macStats(m,hizli?"70' sonrası":'Maç geneli')}<div class="rule"></div><h3>Son üç pozisyon</h3><div class="replay-list replay-list--wide">${replayBtns(m,ui,false)||'<p class="muted">Şut kaydı yok.</p>'}</div></section><section class="analysis card"><h2>Kararların etkisi</h2><p class="subtle">H/S öncesi ve sonrası gösterilir; tek bir golün kesin nedeni çıkarılamaz.</p>${bas?`<div class="fixture-row fixture-row--start"><span>Maç önü: plan ${esc(PLAN[bas.plan]||bas.plan||'Dengeli')} · diziliş ${esc(bas.dizilis||'—')}${hizli?" · 70'te başladı":''}</span></div>`:''}${(m&&m.kararlar||[]).map(k=>`<div class="fixture-row"><span>${n(k.dakika)}' ${esc(kararAd(k))}</span><span>H ${n(k.once&&k.once.H)}→${n(k.sonra&&k.sonra.H)}, S ${n(k.once&&k.once.S)}→${n(k.sonra&&k.sonra.S)} (temsili)</span></div>`).join('')||'<p class="muted">Maç içi müdahale yapılmadı.</p>'}</section><div class="actions actions-row">${hizli?`${btn('Aynı tohumla yeniden dene','yeniden-ayni','btn-yeniden-ayni','','btn--primary')}${btn('Yeni tohumla dene','yeniden-yeni','btn-yeniden-yeni')}`:`${btn(m&&m.fiksturNo===7?'Kapanışı gör':'Turnuvaya dön','merkeze-don','btn-merkeze-don','','btn--primary')}${btn('Maçı baştan izle','karar-tekrar','btn-karar-tekrar')}`}</div>`;
}
function ending(t,isCup,ui){
  const finalM=(t&&t.maclar||[]).find(m=>m.asama==='final'),finalPlayed=!!finalM,rank=Array.isArray(t&&t.siralama)?t.siralama.indexOf('TUR')+1:0;
  let finalLine='';
  if(finalM){const s=score(finalM),p=finalM.penalti,pa=p?(finalM.takimB==='TUR'?p.skor.b:p.skor.a):0,pb=p?(finalM.takimB==='TUR'?p.skor.a:p.skor.b):0;finalLine=`<p class="final-line"><span class="tiny">Final</span><span>Türkiye <strong>${n(s.a)}–${n(s.b)}</strong> ${esc(takim(s.op).ad)}${p?` · Penaltılar ${n(pa)}–${n(pb)}`:''}</span></p>`}
  const konfeti=isCup&&!(ui&&ui.dusukEfekt)?`<div class="confetti" aria-hidden="true">${Array.from({length:64},(_,i)=>`<i style="--i:${i};--x:${(i*37+11)%100}%"></i>`).join('')}</div>`:'';
  return `${konfeti}<header class="header">${isCup?kupaSvg():''}<p class="eyebrow">KURGU DÖRTLÜ KUPA · ${finalPlayed?'FİNAL':'GRUP'}</p><h1 class="${isCup?'grad-text':''}">${isCup?"KURGU KUPA TÜRKİYE'NİN!":'Bu kurgu koşu burada bitti'}</h1><p>${isCup?'Turnuvanın kurgu şampiyonu Türkiye.':finalPlayed?'Final kaybı':`Grup sırası: ${rank?`${n(rank)}.`:'—'}`}</p>${finalLine}${datum(t)}<p class="disclosure">${NOT}</p></header><section class="path card"><h2>Skor yolu</h2><div class="fixture-list">${scorePath(t,true)}</div></section><section class="table-area card"><h2>Son grup tablosu</h2>${tablo(t,ui)}<p class="tiny">Sıralama: puan, averaj, atılan gol, ikili sonuçlar. Tam eşitlikte tohumlu kura.</p></section><div class="actions actions-row">${btn('Aynı tohumla yeniden başla','yeniden-ayni','btn-yeniden-ayni','','btn--primary')}${btn('Yeni koşu','yeniden-yeni','btn-yeniden-yeni')}</div>`;
}
function screenHtml(id,t,m,ui){switch(id){case'acilis':return acilis(t,ui);case'merkez':return merkez(t,ui);case'mac-onu':return macOnu(t,ui);case'canli':return live(t,m,ui);case'devre':return devre(t,m,ui);case'sonuc':return sonuc(t,m,ui);case'kupa':return ending(t,true,ui);case'elenme':return ending(t,false,ui);default:return '<h1>Bu ekran açılamadı.</h1>'}}
// Penaltı katmanı sahneyi örtmez: canlı ekranın yorum alanına yaslanır; sağ panel ve canvas açık kalır.
function dockYerlesim(){if(!layer||!layer.classList.contains('layer--dock'))return;const a=app&&app.querySelector('.commentary-area');if(!a){layer.classList.remove('layer--dock');layer.removeAttribute('style');return}const r=a.getBoundingClientRect();Object.assign(layer.style,{inset:'auto',left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,padding:'0'})}
function canvasPlace(){dockYerlesim();const c=document.getElementById('match-canvas'),a=layer&&layer.dataset.layer==='tekrar'?layer.querySelector('[data-canvas-anchor]'):app&&app.querySelector('[data-canvas-anchor]');if(!c)return;if(!a){c.style.display='none';return}const r=a.getBoundingClientRect();c.style.display='block';c.style.zIndex=layer&&layer.dataset.layer==='tekrar'?'45':'4';c.style.left=`${r.left}px`;c.style.top=`${r.top}px`;c.style.width=`${r.width}px`;c.style.height=`${r.height}px`;try{MT.saha&&MT.saha.yerlesim&&MT.saha.yerlesim(MT.app&&MT.app.getVisibleMatch&&MT.app.getVisibleMatch())}catch(_){}}
function goster(id,t,m,ui){if(!app)baslat();if(!app)return;document.body.classList.toggle('is-clean',!!(ui&&ui.temiz));document.body.classList.toggle('is-low-fx',!!(ui&&ui.dusukEfekt));const strip=frame.querySelector('.strip');strip.textContent=`${t&&t.mod==='hizli'?'KURGU SENARYO':'KURGU TURNUVA'} · TEMSİLİ OYUN PUANLARI · Tohum ${t&&t.tohum!=null?t.tohum:ui&&ui.tohumGiris!=null?ui.tohumGiris:'—'}`;if(active!==id){const section=document.createElement('section');section.className=`screen screen--${id==='kupa'||id==='elenme'?'ending':id}`;section.dataset.screen=id;section.dataset.active='true';section.dataset.testid=SCREEN_TESTIDS[id]||'';if(id==='kupa')section.dataset.kupa='true';section.innerHTML=screenHtml(id,t,m,ui);app.replaceChildren(section);active=id;// QA3 A-2: yalnız ekran değişiminde sayfa başa kaydırılır (yeniden çizim ve canliGuncelle kaydırmaya dokunmaz).
try{g.scrollTo(0,0)}catch(_){}requestAnimationFrame(canvasPlace)}else if(id==='canli'){canliGuncelle(m,[],ui)}else if(id!=='acilis'){const sec=app.querySelector('.screen');const activeElement=document.activeElement;const data=activeElement&&activeElement.dataset?{...activeElement.dataset}:null;sec.innerHTML=screenHtml(id,t,m,ui);if(data&&data.action){const target=Array.from(sec.querySelectorAll('[data-action]')).find(x=>Object.entries(data).every(([k,v])=>k==='testid'||x.dataset[k]===v));target&&target.focus({preventScroll:true})}}}
function canliGuncelle(m,yeni,ui){
  if(active!=='canli'||!app)return;
  const q=s=>app.querySelector(`[data-live="${s}"]`);
  const band=app.querySelector('.scoreband');
  if(band){const s=score(m),v=band.querySelector('.score'),minute=band.querySelector('.minute');if(v)v.textContent=`${n(s.a)}–${n(s.b)}`;if(minute)minute.textContent=`${n(m&&m.dakika||0)}'`;
    // Gol anı: skor aynı düğümde kısa bir büyüme/altın vurgu yapar (M-2). Düşük efekt ve azaltılmış harekette yok.
    const gol=(yeni||[]).filter(o=>o&&o.tur==='gol').slice(-1)[0];
    if(v&&gol&&band.dataset.golId!==String(gol.id)){band.dataset.golId=String(gol.id);const az=document.body.classList.contains('is-low-fx')||(g.matchMedia&&g.matchMedia('(prefers-reduced-motion: reduce)').matches);if(!az){v.classList.remove('is-goal');void v.offsetWidth;v.classList.add('is-goal');v.addEventListener('animationend',()=>v.classList.remove('is-goal'),{once:true})}}
  }
  const events=q('events');if(events){const html=recent(m);if(events.innerHTML!==html)events.innerHTML=html}
  const last=(yeni||[]).slice(-1)[0],c=q('commentary');
  if(last&&c&&c.dataset.olay!==String(last.id)){
    c.dataset.olay=String(last.id);
    if(ui&&ui.anons)c.textContent=ui.anons;
    else{
      // Maç içi tekrar azaltma (durum DOM'da): son 6 gövde dışlanır, aday varyantlar içinden bu ekranda en az kullanılan seçilir;
      // eşitlikte sunumVaryanti tabanı (kaydir=0) önce gelir. Yalnız sunum; olay ve tohum değişmez.
      let son=[],say={};try{son=JSON.parse(c.dataset.son||'[]');say=JSON.parse(c.dataset.say||'{}')}catch(_){son=[];say={}}
      let body='',enIyi=Infinity;
      for(let k=0;k<12;k++){const aday=olayGovde(last,k);if(!aday)continue;const puan=(son.includes(aday)?1000:0)+(say[aday]||0);if(puan<enIyi){enIyi=puan;body=aday}}
      say[body]=(say[body]||0)+1;
      c.dataset.son=JSON.stringify(son.concat([body]).slice(-6));c.dataset.say=JSON.stringify(say);
      c.textContent=`${n(last.dakika)}' · ${body}`;
    }
  }
  const bitti=tekrarBitti(ui);
  if(c&&bitti&&c.textContent!==TEKRAR_BITTI)c.textContent=TEKRAR_BITTI;
  if(q('stats')){const html=macStats(m,statEtiket(m));if(q('stats').innerHTML!==html)q('stats').innerHTML=html}
  const momentum=(ui&&ui.momentum)??50,mo=Math.round(Math.max(0,Math.min(100,Number(momentum)||50)));if(q('momentum'))q('momentum').textContent=n(mo);if(q('momentum-rakip'))q('momentum-rakip').textContent=n(100-mo);if(q('pressure'))q('pressure').style.width=`${Math.max(20,Math.min(80,momentum))}%`;
  const tk=m&&m.taktikler&&(m.taktikler.TUR||m.taktikler.tur);if(q('plan'))q('plan').textContent=`Plan: ${PLAN[tk&&tk.plan]||'Dengeli'}`;if(q('quota'))q('quota').textContent=`Kalan değişiklik: ${5-(m&&m.degisiklikSayisi||0)}/5`;
  if(q('replays')){const html=ui&&(ui.sahneAktif||ui.tekrarModu==='karar')?'':replayBtns(m,ui,true);if(!q('replays').contains(document.activeElement)&&q('replays').innerHTML!==html)q('replays').innerHTML=html}
  const controls=app.querySelector('.live-control');
  if(controls){
    const pause=controls.querySelector('[data-action="duraklat"],[data-action="surdur"]');
    if(pause){const d=!!(ui&&ui.durakli);pause.dataset.action=d?'surdur':'duraklat';pause.dataset.testid=d?'btn-surdur':'btn-duraklat';pause.textContent=d?'Sürdür':'Duraklat';pause.classList.toggle('btn--primary',d)}
    // "Gol sahnesini atla" için yer hep ayrılı; düğme yalnız sahnede slota girer (testid tekil kalır).
    const slot=controls.querySelector('.sahne-atla-slot'),skip=controls.querySelector('[data-action="sahne-atla"]');
    if(ui&&ui.sahneAktif&&!skip&&slot)slot.innerHTML=btn('Gol sahnesini atla','sahne-atla','btn-sahne-atla');
    if(!(ui&&ui.sahneAktif)&&skip)skip.remove();
    const pen=!!(ui&&ui.penaltiAktif),mud=controls.querySelector('[data-action="mudahale-ac"]');
    if(mud){const bekliyor=!!(ui&&ui.panelBekliyor),metin=bekliyor?MUDAHALE_BEKLIYOR:'Müdahale et';if(mud.textContent!==metin)mud.textContent=metin;mud.classList.toggle('btn--pending',bekliyor);kilitle(mud,pen)}
    kilitle(controls.querySelector('[data-action="pozisyona-atla"]'),pen);
  }
  // QA3 A-9: "Pozisyonu yeniden izle" başlığı yalnız listede düğme varken görünür (sahne sırasında gizlenen düğmeler sayılır; başlık titremez).
  const rh=app.querySelector('.replay-head');if(rh)rh.classList.toggle('is-empty',!(ui&&ui.tekrarModu==='karar')&&!replayBtns(m,ui,true));
  // "Maçı baştan izle" bitti: çıkış düğmesi öne çıkar, akış düğmeleri gizlenir (testid'ler DOM'da kalır).
  if(ui&&ui.tekrarModu==='karar'){
    const kapat=app.querySelector('[data-action="tekrar-kapat"]');if(kapat){const metin=bitti?'Sonuca dön':'Tekrarı kapat';if(kapat.textContent!==metin)kapat.textContent=metin;kapat.classList.toggle('btn--primary',bitti)}
    const atla=app.querySelector('[data-action="pozisyona-atla"]');if(atla)atla.hidden=bitti;
    const hizBlok=app.querySelector('.speed-block');if(hizBlok)hizBlok.hidden=bitti;
    const tag=app.querySelector('.replay-tag');if(tag)tag.textContent=bitti?'TEKRAR · BİTTİ':'TEKRAR';
  }
  app.querySelectorAll('[data-action="hiz-sec"]').forEach(b=>{const on=Number(b.dataset.hiz)===Number(ui&&ui.hiz);b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on))});
  app.querySelectorAll('[data-action="otomatik-hiz"]').forEach(b=>{const on=!!(ui&&ui.otomatikHiz);b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));const st=b.querySelector('.toggle-state');if(st)st.textContent=on?'Açık':'Kapalı'});
  app.querySelectorAll('[data-action="film-modu"]').forEach(b=>{const on=!!(ui&&ui.film);b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));const st=b.querySelector('.toggle-state');if(st)st.textContent=on?'Açık':'Kapalı'});
  canvasPlace();
}

// ---------- Katmanlar ----------
function oyuncuSecenek(id,en,sakat){const o=oyuncu(id),val=en&&Number.isFinite(en[id])?en[id]:100;return `${kisiAdi(id)} · ${o?o.mevki:'—'}${o&&o.mevki==='KL'?'':` · %${n(val)}`}${sakat?' · Sakat':''}`}
function hocaOneri(mac,degs){const H=MT.veri&&MT.veri.HOCALAR,h=H&&mac&&mac.hocalar&&H[mac.hocalar.TUR];if(!h||!h.plan||!MT.motor.hocaOnerileri)return '';const list=MT.motor.hocaOnerileri(mac);const DUR={geride:'geride',onde:'önde',berabere:'berabere'},HAT={FV:'forvet',OS:'orta saha',DEF:'savunma'};return `<div class="hoca-oneri"><p class="tiny">Hoca önerisi · ${esc(h.ad)}</p>${list.length?list.map(o=>{const on=degs.some(x=>x.cikanId===o.cikanId&&x.girenId===o.girenId);return `<label class="check-row"><input type="checkbox" data-action="taslak-guncelle" data-alan="oneri" data-cikan="${esc(o.cikanId)}" data-giren="${esc(o.girenId)}" ${on?'checked':''}><span>${esc(kisiAdi(o.cikanId))} → ${esc(kisiAdi(o.girenId))}</span><span class="tiny">${DUR[o.durum]}, ${HAT[o.girenHat]} girer</span></label>`}).join(''):'<p class="tiny">Şu an bu tarzda bir değişiklik önerisi yok.</p>'}</div>`}
function panelMudahale(v){
  const {mac,ui,turnuva}=v;
  const base=ui&&ui.panelTaslak||{degisiklikler:[]},tk=mac&&mac.taktikler&&(mac.taktikler.TUR||mac.taktikler.tur)||taktik(turnuva),p=ui&&ui.onizleme||{},en=mac&&mac.enerjiler||{};
  const activeIds=Object.values(mac&&mac.kadro&&mac.kadro.ilk11||{}).filter(Boolean),bench=mac&&mac.kadro&&mac.kadro.yedekler||[],degs=base.degisiklikler||[];
  const bosMu=!degs.length&&!base.plan&&!base.dizilis;
  // Kırmızı kart ve sakatlık yalnız okunur; kural ve ret mesajı motorda kalır.
  const kir=mac&&mac.kirmiziKartlar||{},sak=mac&&mac.sakatlar||{},kirmiziVar=activeIds.some(id=>kir[id]);
  const cikanlar=activeIds.filter(id=>!kir[id]).sort((a,b)=>(sak[b]?1:0)-(sak[a]?1:0));
  const taslakSatir=degs.map((x,i)=>`<li class="draft-row"><span>${esc(kisiAdi(x.cikanId))} → ${esc(kisiAdi(x.girenId))}</span>${btn('Kaldır','taslak-guncelle','',`data-alan="degisiklik-kaldir" data-index="${i}" aria-label="Taslaktan kaldır: ${esc(kisiAdi(x.cikanId))} → ${esc(kisiAdi(x.girenId))}"`,'btn--small btn--quiet')}</li>`).join('');
  return `<div class="layer-panel layer-panel--wide" role="dialog" aria-modal="true" aria-label="Müdahale" data-testid="panel-mudahale"><div class="section-head"><div><p class="eyebrow">KURGU MAÇ · ${n(mac&&mac.dakika)}'</p><h2>Müdahale</h2></div>${btn('Vazgeç','mudahale-vazgec','btn-mudahale-vazgec')}</div><div class="two-col"><div><h3>Plan ve diziliş</h3>${options('plan',base.plan||tk.plan,'taslak',mac&&mac.dakika<60)}<div class="rule"></div>${options('dizilis',base.dizilis||tk.dizilis,'taslak',false)}<p class="tiny">Kalan plan hamlesi: ${2-(mac&&mac.planHamlesiSayisi||0)}/2</p><p class="tiny">Önce / sonra: H ${n(p.once&&p.once.H)}→${n(p.sonra&&p.sonra.H)}, S ${n(p.once&&p.once.S)}→${n(p.sonra&&p.sonra.S)} (temsili)</p></div><div><h3>Oyuncu değiştir</h3><p class="tiny">Kalan değişiklik: ${5-(mac&&mac.degisiklikSayisi||0)}/5</p><div class="energy-list">${activeIds.map(id=>{const val=en[id]??100,isaret=kir[id]?'<span class="pill pill--warn">Kırmızı kart</span>':sak[id]?'<span class="pill pill--warn">Sakat</span>':'';return `<div class="energy-row ${val<55||isaret?'is-tired':''}"><span class="energy-name"><span>${esc(kisiAdi(id))}</span>${isaret}</span><div class="meter"><span style="width:${Math.max(0,Math.min(100,val))}%"></span></div><span>%${n(val)}</span></div>`}).join('')}</div>${kirmiziVar?`<p class="tiny">${HATA.KIRMIZI_GIREMEZ}</p>`:''}<p class="tiny">Yorgunluk cezası −${n(Math.max(0,100-Math.min(...Object.values(en).filter(x=>Number.isFinite(x)),100))*.4,1)} (temsili)</p>${hocaOneri(mac,degs)}<div class="substitution-row"><select aria-label="Çıkan oyuncu" data-sub="out"><option value="">Çıkan oyuncu</option>${cikanlar.map(id=>`<option value="${esc(id)}">${esc(oyuncuSecenek(id,en,!!sak[id]))}</option>`).join('')}</select><select aria-label="Giren oyuncu" data-sub="in"><option value="">Giren oyuncu</option>${bench.map(id=>`<option value="${esc(id)}">${esc(oyuncuSecenek(id,en))}</option>`).join('')}</select>${btn('Ekle','taslak-guncelle','','data-alan="degisiklik"')}</div><div class="draft-box"><div class="section-head"><p class="tiny">Taslak</p>${bosMu?'':btn('Taslağı temizle','taslak-guncelle','','data-alan="temizle"','btn--small btn--quiet')}</div>${degs.length?`<ul class="draft-list">${taslakSatir}</ul>`:'<p class="tiny">Taslakta oyuncu değişikliği yok.</p>'}</div></div></div><div class="layer-actions">${btn('Uygula','mudahale-uygula','btn-mudahale-uygula','','btn--primary')}</div></div>`;
}
function uyumRozet(u,o,slot){
  if(!u)return '';
  if(u.engel==='SADECE_KALECI')return `<span class="pill pill--warn">${slot==='KL'||o.mevki!=='KL'?'Kaleci değil':'Yalnız kalede oynar'}</span>`;
  if(u.tur==='ana')return '<span class="pill pill--good">Ana rol</span>';
  if(u.tur==='yan')return `<span class="pill">Yan rol ${n(-Math.abs(Number(u.ceza)||6))}</span>`;
  if(u.tur==='diger')return `<span class="pill pill--muted">Diğer saha rolü ${n(-Math.abs(Number(u.ceza)||14))}</span>`;
  if(u.tur==='kl-disi')return `<span class="pill pill--warn">${o.mevki==='KL'?'Yalnız kalede oynar':'Kaleci değil'}</span>`;
  return '';
}
function candidate(v){
  const all=MT.veri&&MT.veri.KADRO&&MT.veri.KADRO.oyuncular||[],slot=v&&v.slot||'',k=v&&v.kadro||{},uyum=v&&v.uyum||{},enerjiler=v&&v.enerjiler||null;
  const xi=new Set(Object.values(k.ilk11||{})),res=new Set(k.yedekler||[]);
  const list=Array.isArray(v&&v.sira)?v.sira.map(id=>all.find(o=>o.id===id)).filter(Boolean):all;
  const current=slot.startsWith('yedek:')?(k.yedekler||[])[Number(slot.slice(6))]:(k.ilk11||{})[slot];
  const slotAd=slot.startsWith('yedek:')?`YEDEK ${Number(slot.slice(6))+1}`:slot;
  return `<div class="drawer-panel" role="dialog" aria-modal="true" aria-label="Tüm adaylar"><div class="section-head"><div><p class="eyebrow">${esc(slotAd)}${current?` · şu an ${esc(kisiAdi(current))}`:''}</p><h2>Tüm adaylar</h2></div>${btn('Kapat','cekmece-kapat')}</div><p class="subtle">Oyun içi rol uyumu (temsili): Ana rol · Yan rol −6 · Diğer saha rolü −14</p><div class="candidate-list">${list.map(o=>{const u=uyum[o.id],engel=u&&u.engel,durum=xi.has(o.id)?'İlk 11':res.has(o.id)?'Yedek':'';return `<article class="candidate ${xi.has(o.id)||res.has(o.id)?'is-selected':''} ${engel?'is-blocked':''}" data-testid="aday-oyuncu-${esc(o.id)}"><span class="badge">${esc(o.rozet)}</span><div><div class="name">${esc(o.ad)} ${durum?`<span class="pill pill--squad">${durum}</span>`:''} ${!o.sonKampCagrisi?'<span class="pill">Son listede yok</span>':''}</div><div class="meta">${esc(o.mevki)} · ${esc(o.kulup)} · ${yas(o)} yaş${(()=>{const E=enerjiler&&Number.isFinite(Number(enerjiler[o.id]))?Number(enerjiler[o.id]):100;return E<100?` · Enerji %${n(E)}${E<YORGUN_ESIK?' <span class="pill pill--warn">Yorgun</span>':''}`:''})()}</div><div class="role-line">${uyumRozet(u,o,slot)}<span class="tiny">Oyun rolü: ${esc(o.detayMevki||o.mevki)}${(o.yanMevkiler||[]).length?` · Yan: ${esc(o.yanMevkiler.join(', '))}`:''} (temsili)</span></div></div>${btn('Seç','aday-sec','','data-slot="'+esc(slot)+'" data-oyuncu-id="'+esc(o.id)+'"'+(engel?` disabled title="${esc(HATA[engel]||engel)}"`:''),o.id===current?'is-selected':'')}<div class="candidate-detail"><div><strong>Gerçek oyuncu bilgisi</strong>Kaynak kesiti ${tarih(o.kaynakTarihi)}<br>A Millî maç/gol: ${o.milliMac==null?'Veri yok':n(o.milliMac)} / ${o.milliGol==null?'Veri yok':n(o.milliGol)}</div><div><strong>Oyun puanları (temsili)</strong>Genel ${n(o.puan&&o.puan.genel)} · ${o.mevki==='KL'?`Kalecilik ${n(o.puan&&o.puan.kalecilik)}`:`Hücum ${n(o.puan&&o.puan.hucum)} · Savunma ${n(o.puan&&o.puan.savunma)} · Pas ${n(o.puan&&o.puan.pas)} · Bitiricilik ${n(o.puan&&o.puan.bitiricilik)}`}</div></div></article>`}).join('')}</div></div>`;
}
function hesap(){const s=MT.veri&&MT.veri.SABITLER||{};return `<div class="layer-panel" role="dialog" aria-modal="true" aria-label="Nasıl hesaplanır?"><div class="section-head"><h2>Nasıl hesaplanır?</h2>${btn('Kapat','hesap-kapat')}</div><p>Hücum ve savunma temsili oyun puanlarıyla hesaplanır. Oyuncu rolü, enerji, diziliş, plan, rakip stili ve moral etkilerinin toplamı kullanılır.</p><p class="tiny">Sahadaki oyuncu yerleşimi ve top akışı gerçek maç verisinden türetilir: Metrica Sports açık örnek takip verisi (2 maç, github.com/metrica-sports/sample-data).</p><div class="metrics-grid"><div class="metric">Yan rol <strong>${n(s.pozisyonCezasi&&s.pozisyonCezasi.yan)}</strong></div><div class="metric">Diğer saha rolü <strong>${n(s.pozisyonCezasi&&s.pozisyonCezasi.diger)}</strong></div><div class="metric">Eksik oyuncu <strong>${n(s.eksikKisi)}</strong></div><div class="metric">Lider bonusu <strong>+${n(s.liderBonusu)}</strong></div></div><div class="rule"></div><table class="table"><thead><tr><th>Bileşen</th><th>H</th><th>S</th></tr></thead><tbody><tr><td>Hat ağırlığı</td><td>FV %${n((s.hatH&&s.hatH.FV||0)*100)} · OS %${n((s.hatH&&s.hatH.OS||0)*100)} · DEF %${n((s.hatH&&s.hatH.DEF||0)*100)}</td><td>DEF %${n((s.hatS&&s.hatS.DEF||0)*100)} · OS %${n((s.hatS&&s.hatS.OS||0)*100)} · KL %${n((s.hatS&&s.hatS.KL||0)*100)}</td></tr><tr><td>Türkiye kadro ofseti (temsili denge ayarı; rakiplere uygulanmaz)</td><td>${isaretli(s.kadroGucOfseti,2)}</td><td>${isaretli(s.kadroGucOfseti,2)}</td></tr><tr><td>Eklenen etkiler</td><td>Plan · diziliş · eşleşme · moral · lider</td><td>Plan · diziliş · eşleşme · moral · lider</td></tr></tbody></table><p class="subtle">Bu puanlar FIFA puanı veya gerçek oyuncu değerlendirmesi değildir.</p></div>`}
function penalti(v){
  const p=v&&v.penalti||{},at=p.atislar||[],last=at.slice(-1)[0];
  const A=v&&v.takimA||(at[0]&&at[0].takimKod)||'TUR',B=v&&v.takimB||(at.find(x=>x.takimKod!==A)||{}).takimKod||'TUR';
  const skor={[A]:p.skor&&p.skor.a||0,[B]:p.skor&&p.skor.b||0};
  const sira=B==='TUR'?[B,A]:[A,B];
  const seri=Math.max(5,...sira.map(k=>at.filter(x=>x.takimKod===k).length));
  const iz=kod=>{const list=at.filter(x=>x.takimKod===kod);return Array.from({length:seri},(_,i)=>{const x=list[i];if(!x)return '<span class="pen-mark is-bekliyor" title="Bekliyor"></span>';return x.gol?'<span class="pen-mark is-gol" title="Gol">G</span>':'<span class="pen-mark is-kacti" title="Kaçtı">K</span>'}).join('')};
  const vuran=last?(last.oyuncuId?kisiAdi(last.oyuncuId):`${last.formaNo} numara`):'';
  return `<div class="layer-panel layer-panel--penalti" role="region" aria-label="Penaltılar"><div class="pen-board"><div class="pen-head"><h2>Penaltılar</h2><p class="eyebrow">KURGU MAÇ · FİNAL</p></div><div class="pen-rows">${sira.map(k=>`<div class="pen-row ${k==='TUR'?'is-tur':''}"><span class="pen-team">${title(takim(k).ad)}</span><span class="pen-marks">${iz(k)}</span><span class="pen-score">${n(skor[k])}</span></div>`).join('')}</div>${p.kazanan?`<p class="pen-winner">Penaltılarda ${esc(takim(p.kazanan).ad)} kazandı.${p.kura?' <span class="pen-kura">Simülasyon kura kararı</span>':''}</p>`:'<p class="tiny">G: gol · K: kaçtı · boş halka: sırada</p>'}</div><div class="pen-focus">${last?`<p class="pen-series">Seri ${n(Math.ceil(last.sira/2))} · ${esc(takim(last.takimKod).ad)} · ${esc(vuran)} · ${last.gol?'Gol':'Kaçtı'}</p>${last.takimKod==='TUR'&&last.oyuncuId?'<p class="tiny pen-kurgu">Bu kurgu maçta</p>':''}<p class="pen-shooter">${esc(vuran)}</p><p class="pen-stamp ${last.gol?'is-gol':'is-kacti'}">${last.gol?'GOL':'KAÇTI'}</p>`:'<p class="pen-series">Seri başlıyor…</p>'}${v&&v.durakli?btn('Sürdür','surdur','','','btn--primary'):''}</div></div>`;
}
function tekrarKatman(v){const o=v&&v.olay,head=o?`${n(o.dakika)}′ · ${takim(o.takimKod).ad} şutu${o.oyuncuId?` · ${kisiAdi(o.oyuncuId)}`:o.formaNo?` · ${o.formaNo} numara`:''}`:'Pozisyonu yeniden izle';return `<div class="layer-panel"><div class="section-head"><div><p class="eyebrow">Pozisyonu yeniden izle</p><h2>${esc(head)}</h2></div>${btn('Kapat','tekrar-kapat')}</div><div class="replay-stage" data-canvas-anchor></div></div>`}
// QA3 A-1: panel gövdesi kayıyorsa yapışık eylem çubuğunun üstünde solma ipucu gösterilir (alta inince kalkar).
function panelKaydirma(){const p=layer&&layer.querySelector('.layer-panel--wide');if(!p)return;const f=()=>p.classList.toggle('is-scrollable',p.scrollHeight>p.clientHeight+1&&p.scrollTop+p.clientHeight<p.scrollHeight-2);f();if(!p._kaydirma){p._kaydirma=true;p.addEventListener('scroll',f,{passive:true})}}
function katman(ad,v){if(!layer)baslat();const focusData=layer&&layer.contains(document.activeElement)&&document.activeElement.dataset?{...document.activeElement.dataset}:null;if(!v){if(layer){layer.remove();layer=null;if(focusBefore&&focusBefore.isConnected)focusBefore.focus({preventScroll:true});focusBefore=null;canvasPlace()}return}if(layer&&layer.dataset.layer!==ad){layer.remove();layer=null}if(!layer){layer=document.createElement('div');layer.className=ad==='cekmece'?'drawer':'layer';layer.dataset.layer=ad;const dock=ad==='penalti'&&app&&app.querySelector('.commentary-area');if(dock)layer.classList.add('layer--dock');focusBefore=dock?null:document.activeElement;document.body.appendChild(layer)}layer.innerHTML=ad==='mudahale'?panelMudahale(v):ad==='cekmece'?candidate(v):ad==='hesap'?hesap():ad==='penalti'?penalti(v):tekrarKatman(v);dockYerlesim();panelKaydirma();const prior=focusData&&Array.from(layer.querySelectorAll('button')).find(x=>Object.entries(focusData).every(([k,val])=>k==='testid'||x.dataset[k]===val));// Yaslanan penaltı kartı modal değildir: odağı sağ panelden çalmaz.
const first=prior||(layer.classList.contains('layer--dock')?null:layer.querySelector('button:not([disabled])'));first&&first.focus({preventScroll:true});requestAnimationFrame(canvasPlace)}
// secenek.kalici: otomatik duraklama uyarısı Sürdür/Müdahale/ekran değişimine kadar kalır (bildirimKapat). Diğerleri 5 sn.
function bildirim(kod,degerler,secenek){if(!toast)baslat();if(!toast)return;let message=HATA[kod]||kod||'Bir uyarı oluştu.';if(degerler&&typeof degerler==='object')for(const [k,v] of Object.entries(degerler))message=message.replaceAll(`{${k}}`,String(v));toast.textContent=message;toast.hidden=false;clearTimeout(toast._timer);toast._timer=null;if(!(secenek&&secenek.kalici))toast._timer=setTimeout(()=>{toast.hidden=true},5000)}
function bildirimKapat(){if(!toast)return;clearTimeout(toast._timer);toast._timer=null;toast.hidden=true}
function baslat(){if(app)return;app=document.getElementById('app');if(!app)return;frame=document.createElement('div');frame.className='frame';frame.innerHTML='<div class="strip"></div><div class="brand"><img src="vuqeai_logo.svg" alt="VuqeAI"></div>';document.body.appendChild(frame);toast=document.createElement('div');toast.className='toast';toast.hidden=true;toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');document.body.appendChild(toast);document.addEventListener('click',ev=>{const el=ev.target.closest('[data-action]');if(!el)return;const d={};for(const [key,val] of Object.entries(el.dataset)){if(key==='action'||key==='testid')continue;d[key]=val}if(el.dataset.action==='taslak-guncelle'&&el.dataset.alan==='degisiklik'){const scope=el.closest('.layer-panel');const out=scope&&scope.querySelector('[data-sub="out"]'),inn=scope&&scope.querySelector('[data-sub="in"]');d.alan='degisiklik';d.deger={cikanId:out&&out.value,girenId:inn&&inn.value}}if(el.dataset.action==='taslak-guncelle'&&el.dataset.alan==='degisiklik-kaldir')d.deger=Number(el.dataset.index);if(el.dataset.action==='taslak-guncelle'&&el.dataset.alan==='oneri')d.deger={cikanId:el.dataset.cikan,girenId:el.dataset.giren};if(el.tagName==='SELECT')return;if(el.dataset.action==='plan-sec'||el.dataset.action==='dizilis-sec'){d.hedef=el.dataset.hedef;d.deger=el.dataset.kod}if(el.dataset.action==='hiz-sec')d.hiz=Number(el.dataset.hiz);if(el.dataset.action==='aday-sec')d.oyuncuId=el.dataset.oyuncuId;eylem(el.dataset.action,d)});document.addEventListener('change',ev=>{const el=ev.target.closest('select[data-action]');if(!el)return;eylem(el.dataset.action,{hedef:el.dataset.hedef,deger:el.value})});g.addEventListener('resize',()=>{canvasPlace();panelKaydirma()})}
MT.ekranlar={baslat,goster,canliGuncelle,katman,bildirim,bildirimKapat,canvasPlace,hataMetni:kod=>HATA[kod]||HATA.DURUM_GECERSIZ};
})(typeof window!=='undefined'?window:globalThis);
