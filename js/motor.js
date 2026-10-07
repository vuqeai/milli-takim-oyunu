(function (g) {
  'use strict';
  g.MT = g.MT || {};
  const MT = g.MT;
  const V = () => MT.veri;
  const C = () => V().SABITLER;
  const Y = () => MT.yardim;
  const copy = x => Y().derinKopya(x);
  const clamp = (x, a, b) => Y().clamp(x, a, b);
  const slots = d => V().DIZILISLER[d] || [];
  const player = id => V().oyuncu(id);
  const team = id => V().takim(id);
  const err = kod => { const e = new Error(kod); e.kod = kod; throw e; };
  const emptyStats = () => ({ a: { sut: 0, isabet: 0, xg: 0 }, b: { sut: 0, isabet: 0, xg: 0 } });
  const statKey = (m, kod) => kod === m.takimA ? 'a' : 'b';
  const score = (m, kod) => m.skor[statKey(m, kod)];
  const other = (m, kod) => kod === m.takimA ? m.takimB : m.takimA;
  const active = (m, kod) => kod === 'TUR' ? m.kadro.ilk11 : m.anonimKadrolar[kod].aktif;
  const plan = (m, kod) => m.taktikler[kod].plan;
  // Hoca modu: seçili hazır ayar (yoksa ya da 'kendi' ise null) ve eşleşmede kullanılan stil.
  const hoca = (m, kod) => { const h = V().HOCALAR?.[m.hocalar?.[kod]]; return h && h.plan ? h : null; };
  const stilOf = (m, kod) => hoca(m, kod)?.stil || team(kod).stil;
  const durumOf = (m, kod) => score(m, kod) < score(m, other(m, kod)) ? 'geride' : score(m, kod) > score(m, other(m, kod)) ? 'onde' : 'berabere';
  const allPlayers = () => V().KADRO.oyuncular;
  let defaultKadroCache = null;
  const option = (p, s) => {
    if (!p) return -1000;
    if (s.hat === 'KL') return p.mevki === 'KL' ? 0 : -1000;
    if (p.mevki === 'KL') return -1000;
    if (p.detayMevki === s.rol) return C().pozisyonCezasi.ana;
    if ((p.yanMevkiler || []).includes(s.rol)) return C().pozisyonCezasi.yan;
    return C().pozisyonCezasi.diger;
  };
  function rolUyumu(oyuncuId, slotAdi, dizilis) {
    const s = slots(dizilis).find(x => x.slot === slotAdi);
    if (!s) err('DURUM_GECERSIZ');
    const ceza = option(player(oyuncuId), s);
    return { tur:ceza < -100 ? 'kl-disi' : ceza === C().pozisyonCezasi.ana ? 'ana' : ceza === C().pozisyonCezasi.yan ? 'yan' : 'diger', ceza };
  }
  const values = (p, s, e) => {
    const c=C(),q = p.puan, fatigue = (100 - e) * c.yorgunlukKatsayisi, fit = option(p, s);
    return { h: q.hucum * c.etkinHucum.hucum + q.pas * c.etkinHucum.pas + q.bitiricilik * c.etkinHucum.bitiricilik + fit - fatigue,
      s: q.savunma * c.etkinSavunma.savunma + q.dayaniklilik * c.etkinSavunma.dayaniklilik + fit - fatigue,
      g: q.kalecilik - fatigue };
  };
  function kadroOner(oyuncular, enerjiler, dizilis) {
    const list = (Array.isArray(oyuncular) ? oyuncular : oyuncular.oyuncular).filter(p => p.sonKampCagrisi).slice().sort((a, b) => a.id.localeCompare(b.id));
    const sl = slots(dizilis), n = sl.length, full = (1 << n) - 1;
    const count = { KL: 1, DEF: sl.filter(s => s.hat === 'DEF').length, OS: sl.filter(s => s.hat === 'OS').length, FV: sl.filter(s => s.hat === 'FV').length };
    let dp = new Array(full + 1); dp[0] = { value: 0, ids: [], players: [] };
    for (const p of list) {
      const next = dp.slice();
      for (let mask = 0; mask <= full; mask++) {
        const prev = dp[mask]; if (!prev) continue;
        for (let j = 0; j < n; j++) {
          if (mask & (1 << j) || option(p, sl[j]) < -100) continue;
          const v = values(p, sl[j], enerjiler[p.id] == null ? 100 : enerjiler[p.id]);
          const weight = C().hatH[sl[j].hat] ? C().hatH[sl[j].hat]/count[sl[j].hat] : 0;
          const defense = C().hatS[sl[j].hat] ? C().hatS[sl[j].hat]/count[sl[j].hat] : 0;
          const contribution = v.h * weight + (sl[j].hat === 'KL' ? v.g : v.s) * defense;
          const key = mask | (1 << j), ids = prev.ids.concat(p.id), val = prev.value + contribution;
          if (!next[key] || val > next[key].value + 1e-9 || (Math.abs(val - next[key].value) < 1e-9 && ids.join('|') < next[key].ids.join('|'))) next[key] = { value: val, ids, players: prev.players.concat(p) };
        }
      }
      dp = next;
    }
    if (!dp[full]) err('KADRO_EKSIK');
    // The first pass chooses the eleven; the shared second pass assigns their slots.
    const selected = dp[full].players;
    const ilk11 = yerlestir(selected.map(p => p.id), dizilis, enerjiler).ilk11;
    const used = new Set(Object.values(ilk11));
    const remaining = list.filter(p => !used.has(p.id));
    remaining.sort((a, b) => (b.puan.genel + (enerjiler[b.id] || 100) * .2) - (a.puan.genel + (enerjiler[a.id] || 100) * .2) || a.id.localeCompare(b.id));
    const keeper = remaining.find(p => p.mevki === 'KL');
    const yedekler = keeper ? [keeper.id] : [];
    for (const p of remaining) if (p.id !== keeper?.id && yedekler.length < 7) yedekler.push(p.id);
    return { dizilis, ilk11, yedekler };
  }
  function yerlestir(oyuncuIdler, dizilis, enerjiler = {}) {
    const sl = slots(dizilis), n = sl.length, full = (1 << n) - 1;
    if (n !== 11 || !Array.isArray(oyuncuIdler) || oyuncuIdler.length !== n || new Set(oyuncuIdler).size !== n) err('SADECE_KALECI');
    const selected = oyuncuIdler.slice().sort((a,b) => a.localeCompare(b)).map(player);
    if (selected.some(p => !p)) err('SADECE_KALECI');
    const count = { KL: 1, DEF: sl.filter(s => s.hat === 'DEF').length, OS: sl.filter(s => s.hat === 'OS').length, FV: sl.filter(s => s.hat === 'FV').length };
    let assignment = new Map([[0, { score: 0, ids: [] }]]);
    for (const p of selected) {
      const next = new Map();
      for (const [mask, entry] of assignment) for (let j = 0; j < n; j++) {
        if (mask & (1 << j) || option(p, sl[j]) < -100) continue;
        const v = values(p, sl[j], enerjiler[p.id] == null ? 100 : enerjiler[p.id]);
        const wh = C().hatH[sl[j].hat] ? C().hatH[sl[j].hat]/count[sl[j].hat] : 0;
        const ws = C().hatS[sl[j].hat] ? C().hatS[sl[j].hat]/count[sl[j].hat] : 0;
        const val = entry.score + v.h * wh + (sl[j].hat === 'KL' ? v.g : v.s) * ws;
        const key = mask | (1 << j), ids = entry.ids.concat([[j, p.id]]), old = next.get(key);
        if (!old || val > old.score + 1e-9 || (Math.abs(val - old.score) < 1e-9 && ids.map(x => x[1]).join('|') < old.ids.map(x => x[1]).join('|'))) next.set(key, { score: val, ids });
      }
      assignment = next;
    }
    const best = assignment.get(full);
    if (!best) err('SADECE_KALECI');
    const ilk11 = {}; for (const [j, id] of best.ids) ilk11[sl[j].slot] = id;
    return { dizilis, ilk11 };
  }
  function kadroValid(k) {
    if (!k || slots(k.dizilis).length !== 11 || !Array.isArray(k.yedekler) || k.yedekler.length !== 7) err('KADRO_EKSIK');
    const ids = slots(k.dizilis).map(s => k.ilk11[s.slot]);
    if (ids.some(x => !x) || new Set(ids.concat(k.yedekler)).size !== 18 || !ids.some(x => player(x)?.mevki === 'KL') || !k.yedekler.some(x => player(x)?.mevki === 'KL')) err('KADRO_EKSIK');
    for (const s of slots(k.dizilis)) if (option(player(k.ilk11[s.slot]), s) < -100) err('SADECE_KALECI');
  }
  function gucHesapla(takim, kadro, enerji, taktik, moral, rakipStil, eksikler) {
    const t = typeof takim === 'string' ? team(takim) : takim, c = C(), ex = new Set(eksikler || []);
    const planCode = taktik.plan, diz = taktik.dizilis;
    let h0, s0, missing = 0;
    const hat = { KL: [], DEF: [], OS: [], FV: [] };
    if (t.kod === 'TUR') {
      for (const s of slots(diz)) {
        const id = kadro?.ilk11?.[s.slot];
        if (!id || ex.has(id)) { missing++; continue; }
        const p = player(id); if (!p) { missing++; continue; }
        hat[s.hat].push(values(p, s, enerji?.[id] == null ? 100 : enerji[id]));
      }
      const avg = (a, k) => a.length ? a.reduce((v, q) => v + q[k], 0) / a.length : c.bosHat;
      h0 = avg(hat.FV, 'h') * c.hatH.FV + avg(hat.OS, 'h') * c.hatH.OS + avg(hat.DEF, 'h') * c.hatH.DEF + c.kadroGucOfseti;
      s0 = avg(hat.DEF, 's') * c.hatS.DEF + avg(hat.OS, 's') * c.hatS.OS + avg(hat.KL, 'g') * c.hatS.KL + c.kadroGucOfseti;
    } else {
      h0 = s0 = t.guc - (100 - (typeof enerji === 'number' ? enerji : 100)) * c.yorgunlukKatsayisi;
      missing = ex.size;
    }
    const pb = c.planBonus[planCode], db = c.dizilisBonus[diz], match = c.planStil[planCode][rakipStil] + c.dizilisStil[diz][rakipStil];
    const morale = (clamp(moral, ...c.moralSinir) - c.moralBaslangic) * c.moralKatsayisi;
    const leader = taktik.liderBonusu || 0;
    const bh = { temel: h0, plan: pb.H, dizilis: db.H, eslesme: match, moral: morale, lider: leader, eksik: missing * c.eksikKisi };
    const bs = { temel: s0, plan: pb.S, dizilis: db.S, eslesme: match, moral: morale, lider: leader, eksik: missing * c.eksikKisi };
    bh.toplam = Object.values(bh).reduce((a, b) => a + b, 0); bs.toplam = Object.values(bs).reduce((a, b) => a + b, 0);
    return { H: clamp(bh.toplam, ...c.gucSinir), S: clamp(bs.toplam, ...c.gucSinir), bilesenler: { H: bh, S: bs, eslesme: match, sikistirma: c.gucSinir.slice() } };
  }
  function strengths(m) {
    const out = {};
    for (const kod of [m.takimA, m.takimB]) {
      const ex = kod === 'TUR' ? Object.keys(m.sakatlar).filter(id => m.sakatlar[id]).concat(Object.keys(m.kirmiziKartlar).filter(id => m.kirmiziKartlar[id])) : Object.keys(m.sakatlar).filter(id => m.sakatlar[id] && id.startsWith(kod + '#') && !m.cikanlar.includes(id)).concat(Object.keys(m.kirmiziKartlar).filter(id => m.kirmiziKartlar[id] && id.startsWith(kod + '#')));
      out[kod] = gucHesapla(team(kod), kod === 'TUR' ? m.kadro : null, kod === 'TUR' ? m.enerjiler : m.topluEnerjiler[kod], m.taktikler[kod], m.moral[kod], stilOf(m, other(m, kod)), ex);
      const r = hoca(m, kod)?.risk; if (r) { const c = C(); out[kod].H = clamp(out[kod].H + r.H, ...c.gucSinir); out[kod].S = clamp(out[kod].S + r.S, ...c.gucSinir); }
    }
    return out;
  }
  function baseEvent(m, minute, n, tur, kod, details) {
    return Object.assign({ id: `m${m.fiksturNo}-${minute}-${n}`, fiksturNo: m.fiksturNo, dakika: minute, sira: n, tur, takimKod: kod || null, oyuncuId: null, formaNo: null, sonuc: null, sutTipi: null, xg: null, zarlar: null, bilesenler: null, sunumVaryanti: 0 }, details || {});
  }
  function nextSira(m) {
    for (let i=m.olaylar.length-1;i>=0;i--) if (m.olaylar[i].dakika===m.dakika) return m.olaylar[i].sira+1;
    return 0;
  }
  function actor(m, kod, z, shooting) {
    const sl = slots(m.taktikler[kod].dizilis), a = active(m, kod), choices = [];
    for (const s of sl) {
      const id = a[s.slot];
      if (!id || m.sakatlar[id] || m.kirmiziKartlar[id] || (shooting && s.hat !== 'OS' && s.hat !== 'FV')) continue;
      choices.push({ id, slot: s });
    }
    if (!choices.length) return null;
    if (shooting && kod === 'TUR') {
      let total = 0;
      for (const item of choices) { const p = player(item.id); item.weight = Math.max(1, values(p, item.slot, m.enerjiler[item.id]).h); total += item.weight; }
      let target = z * total;
      for (const item of choices) { target -= item.weight; if (target < 0) return item; }
      return choices[choices.length - 1];
    }
    return choices[Math.min(choices.length - 1, Math.floor(z * choices.length))];
  }
  function identity(kod, item) { return kod === 'TUR' ? { oyuncuId: item?.id || null, formaNo: null } : { oyuncuId: null, formaNo: item ? Number(item.id.split('#')[1]) : null }; }
  function cloneMatch(m) {
    return { ...m, skor: { ...m.skor }, kadro: m.kadro ? { ...m.kadro, ilk11: { ...m.kadro.ilk11 }, yedekler: m.kadro.yedekler.slice() } : null,
      anonimKadrolar: Object.fromEntries(Object.entries(m.anonimKadrolar).map(([k,v]) => [k, { aktif: { ...v.aktif }, yedek: v.yedek.slice() }])),
      taktikler: Object.fromEntries(Object.entries(m.taktikler).map(([k,v]) => [k, { ...v }])), enerjiler: { ...m.enerjiler }, topluEnerjiler: { ...m.topluEnerjiler }, moral: { ...m.moral },
      kararlar: m.kararlar.slice(), olaylar: m.olaylar.slice(), istatistik: { a: { ...m.istatistik.a }, b: { ...m.istatistik.b } }, sariKartlar: { ...m.sariKartlar }, kirmiziKartlar: { ...m.kirmiziKartlar }, sakatlar: { ...m.sakatlar }, cikanlar: m.cikanlar.slice(), anonimDegisiklikler: { ...m.anonimDegisiklikler }, otomatikPlanDegisti: { ...m.otomatikPlanDegisti }, hocalar: { ...(m.hocalar || {}) }, hocaDegisiklik: { ...(m.hocaDegisiklik || {}) }, penalti: m.penalti ? copy(m.penalti) : null };
  }
  function append(m, events) { m.olaylar.push(...events); return { durum: m, olaylar: events }; }
  function validatePlan(p, effective) { if (!C().planBonus[p]) err('DURUM_GECERSIZ'); if (p === 'yuklen' && effective < C().limit.yuklenIlkDakika) err('YUKLEN_ERKEN'); }
  function turnuvaBaslat(tohum, mod) {
    if (!Number.isInteger(tohum) || tohum < 0 || tohum > 4294967295) err('DURUM_GECERSIZ');
    const en = Object.fromEntries(allPlayers().map(p => [p.id, 100]));
    if (!defaultKadroCache) defaultKadroCache = kadroOner(allPlayers(), en, '4-3-3');
    const kadro = copy(defaultKadroCache);
    const table = Object.fromEntries(['TUR','AUT','CZE','ITA'].map(kod => [kod, { kod, o:0,g:0,b:0,m:0,a:0,y:0,av:0,p:0 }]));
    return { surum:2, tohum:tohum>>>0, mod:mod === 'hizli' ? 'hizli' : 'normal', tur:mod === 'hizli' ? 0 : 1, maclar:[], puanTablosu:table, siradakiFikstur:mod === 'hizli' ? 70 : 1,
      oyuncuEnerjileri:en, rakipEnerjileri:{ AUT:100,CZE:100,ITA:100 }, hazirlikKadro:kadro, hazirlikTaktik:{dizilis:'4-3-3',plan:'dengeli'}, oncekiKadro:null, oncekiTaktik:null, sonuc:'devam', macBaslangic:null, aktifMac:null };
  }
  function anonymous(kod, diz) {
    const aktif = {}; slots(diz).forEach((s, i) => { aktif[s.slot] = `${kod}#${i+1}`; });
    return { aktif, yedek:Array.from({length:7}, (_,i) => `${kod}#${i+12}`) };
  }
  function createMatch(turnuva, no, kadro, taktik) {
    const f = V().FIKSTUR[no], a = f.a === '1.' ? turnuva.siralama[0] : f.a, b = f.b === '2.' ? turnuva.siralama[1] : f.b;
    if (!a || !b) err('DURUM_GECERSIZ');
    const hasTUR = a === 'TUR' || b === 'TUR';
    if (hasTUR) { kadroValid(kadro); validatePlan(taktik.plan, no === 70 ? 71 : 1); }
    const ts = {}, ak = {};
    for (const kod of [a,b]) {
      ts[kod] = kod === 'TUR' ? { ...taktik, liderBonusu:no === 7 && turnuva.siralama?.[0] === kod ? C().liderBonusu : 0 } : { dizilis:team(kod).varsayilanDizilis, plan:team(kod).varsayilanPlan, liderBonusu:no === 7 && turnuva.siralama?.[0] === kod ? C().liderBonusu : 0 };
      if (kod !== 'TUR') ak[kod] = anonymous(kod, ts[kod].dizilis);
    }
    const en = { ...turnuva.oyuncuEnerjileri }, ten = { ...turnuva.rakipEnerjileri };
    if (no === 70) {
      for (const id of Object.values(kadro.ilk11)) { const p = player(id); en[id] = Math.max(C().enerjiMin, en[id] - 70 * C().enerjiKaybi.dengeli * (C().enerjiReferans.taban - (p.puan.dayaniklilik - C().enerjiReferans.referans) * C().enerjiReferans.dayaniklilikKatsayi)); }
      ten.AUT = Math.max(C().enerjiMin, ten.AUT - 70 * C().enerjiKaybi.baski * C().enerjiReferans.taban * C().rakipEnerjiKaybiCarpani);
    }
    const m = { fiksturNo:Number(no), mod:turnuva.mod, asama:no === 7 ? 'final' : no === 70 ? 'hizli' : 'grup', tohum:turnuva.tohum, takimA:a, takimB:b, dakika:no === 70 ? 70 : 0,
      skor:no === 70 ? {a:1,b:1} : {a:0,b:0}, baslangicSkor:no === 70 ? {a:1,b:1} : {a:0,b:0}, kadro:hasTUR ? copy(kadro) : null, anonimKadrolar:ak, taktikler:ts, enerjiler:en, topluEnerjiler:ten, moral:{[a]:C().moralBaslangic,[b]:C().moralBaslangic}, kararlar:[], olaylar:[], istatistik:emptyStats(), sariKartlar:{}, kirmiziKartlar:{}, sakatlar:{}, cikanlar:[], degisiklikSayisi:0, anonimDegisiklikler:{[a]:0,[b]:0}, planHamlesiSayisi:0, devreKonusmasi:null, otomatikPlanDegisti:{[a]:no === 70 && a === 'AUT',[b]:no === 70 && b === 'AUT'}, penalti:null, bitti:false };
    m.hocalar = {}; m.hocaDegisiklik = {};
    for (const kod of [a,b]) {
      const sec = turnuva.hocalar?.[kod];
      if (sec && V().HOCALAR?.[sec]) m.hocalar[kod] = sec;
      // Rakibin başlangıç planı hocadan gelir; Türkiye'nin planı maç önü ekranında hocayla birlikte seçilir.
      const h = hoca(m, kod); if (h && kod !== 'TUR' && no !== 70) ts[kod].plan = h.plan;
    }
    return m;
  }
  // Seçili hocanın tarzına göre Türkiye için değişiklik önerileri (en fazla 3). Uygulanmaz, yalnız önerilir.
  function hocaOnerileri(m) {
    const h = m && m.kadro && hoca(m, 'TUR'); if (!h || m.bitti) return [];
    const kalan = C().limit.degisiklik - (m.degisiklikSayisi || 0); if (kalan <= 0) return [];
    const st = durumOf(m, 'TUR'), sl = slots(m.taktikler.TUR.dizilis), en = m.enerjiler || {}, kullan = new Set(), out = [];
    const yedek = m.kadro.yedekler.filter(id => id && !m.cikanlar.includes(id) && !Object.values(m.kadro.ilk11).includes(id));
    for (const k of h.degisiklik) {
      if (out.length >= Math.min(3, kalan)) break;
      if (k.durum !== st || m.dakika < k.dk - 5) continue;
      const cik = sl.filter(s => s.hat === k.cikan).map(s => m.kadro.ilk11[s.slot]).filter(id => id && !kullan.has(id) && !m.kirmiziKartlar[id])
        .sort((x, y) => (en[x] ?? 100) - (en[y] ?? 100) || x.localeCompare(y))[0];
      const gir = yedek.filter(id => !kullan.has(id) && player(id)?.mevki === k.giren)
        .sort((x, y) => (player(y).puan.genel - player(x).puan.genel) || x.localeCompare(y))[0];
      if (!cik || !gir) continue;
      kullan.add(cik); kullan.add(gir);
      out.push({ cikanId: cik, girenId: gir, dk: k.dk, durum: st, cikanHat: k.cikan, girenHat: k.giren });
    }
    return out;
  }
  function macBaslat(turnuva, kadro, taktik) { return createMatch(turnuva, turnuva.siradakiFikstur, kadro || turnuva.hazirlikKadro, taktik || turnuva.hazirlikTaktik); }
  function adim(input) {
    if (input.bitti || input.dakika >= 90 || input.dakika === 45 && input.mod === 'normal' && (input.takimA === 'TUR' || input.takimB === 'TUR') && !input.devreKonusmasi) err('DURUM_GECERSIZ');
    const m = cloneMatch(input), minute = ++m.dakika, events = [], st = strengths(m), a = m.takimA, b = m.takimB;
    const rng = Y().mulberry32(Y().hash32(m.tohum, m.fiksturNo, minute));
    const r = Array.from({length:8}, () => rng());
    const dA = st[a].H - st[b].S, dB = st[b].H - st[a].S;
    const pa = clamp(C().aksiyon.taban + (dA+dB)/C().aksiyon.bolen, C().aksiyon.min, C().aksiyon.max);
    const side = clamp(C().taraf.taban + (dA-dB)*C().taraf.katsayi, C().taraf.min, C().taraf.max);
    if (r[0] < pa) {
      const kod = r[1] < side ? a : b, d = kod === a ? dA : dB, who = actor(m, kod, r[6], true), no = events.length;
      events.push(baseEvent(m, minute, no, 'atak', kod, { ...identity(kod, who), zarlar:r, bilesenler:{d,aksiyon:pa,taraf:side}, sunumVaryanti:Math.floor(r[7]*4) }));
      const ps = clamp(C().sut.taban + d*C().sut.katsayi, C().sut.min, C().sut.max);
      if (r[2] < ps) {
        const tip = r[3] < C().tip.uzak ? 'uzak' : r[3] < C().tip.uzak+C().tip.ceza ? 'ceza' : 'net';
        const base = C().xg[tip], effect = d*C().xg.katsayi, xg = clamp(base+effect, C().xg.min,C().xg.max);
        const goal = r[4] < xg;
        const result = goal ? 'gol' : r[5] < C().isabet[tip] ? 'kurtaris' : r[5] < C().isabet[tip] + (1-C().isabet[tip])/2 ? 'blok' : 'disari';
        const balanced = { ...m.taktikler[kod], plan:'dengeli' }, basestr = gucHesapla(team(kod), kod === 'TUR' ? m.kadro : null, kod === 'TUR' ? m.enerjiler : m.topluEnerjiler[kod], balanced, m.moral[kod], stilOf(m, other(m,kod)), []);
        const compare = clamp(base+(basestr.H-st[other(m,kod)].S)*C().xg.katsayi,C().xg.min,C().xg.max);
        const detail = { ...identity(kod,who), sonuc:result, sutTipi:tip, xg, zarlar:r, bilesenler:{tipTabani:base,gucFarki:effect,toplam:xg,dengeliKarsilastirma:xg-compare}, sunumVaryanti:Math.floor(r[7]*4) };
        events.push(baseEvent(m,minute,events.length,'sut',kod,detail));
        const sk = statKey(m,kod); m.istatistik[sk].sut++; m.istatistik[sk].xg += xg;
        if (goal || result === 'kurtaris') m.istatistik[sk].isabet++;
        if (goal) { m.skor[sk]++; events.push(baseEvent(m,minute,events.length,'gol',kod,detail)); }
      }
    }
    const drng = Y().mulberry32(Y().hash32(m.tohum,m.fiksturNo,minute,'disiplin'));
    const z = Array.from({length:6},()=>drng());
    const actors=[actor(m,a,z[4],false),actor(m,b,z[5],false)];
    for (let i=0;i<2;i++) {
      const kod = i ? b : a, id = actors[i], threshold = C().kart.sariDakika * (kod === 'TUR' && m.devreKonusmasi === 'sert' && minute >= 46 ? C().devre.sert.kartCarpani : 1);
      if (id && z[i] < threshold + C().kart.dogrudanKirmiziDakika) {
        const red = z[i] >= threshold || (m.sariKartlar[id.id] || 0) >= 1;
        if (red) m.kirmiziKartlar[id.id]=true;
        else m.sariKartlar[id.id]=(m.sariKartlar[id.id]||0)+1;
        events.push(baseEvent(m,minute,events.length,red?'kirmizi':'sari',kod,{...identity(kod,id),sonuc:red?'kirmizi':'sari',zarlar:z}));
      }
    }
    for (let i=0;i<2;i++) {
      const kod=i?b:a, id=actors[i];
      if (id && !m.kirmiziKartlar[id.id] && z[2+i] < C().sakatlik.dakika) {
        m.sakatlar[id.id]=true;
        events.push(baseEvent(m,minute,events.length,'sakatlik',kod,{...identity(kod,id),zarlar:z}));
        if (kod !== 'TUR' && m.anonimDegisiklikler[kod] < C().limit.degisiklik && m.anonimKadrolar[kod].yedek.length) {
          const enter = m.anonimKadrolar[kod].yedek.shift(); m.anonimKadrolar[kod].aktif[id.slot.slot]=enter; m.cikanlar.push(id.id); m.anonimDegisiklikler[kod]++;
          events.push(baseEvent(m,minute,events.length,'degisiklik',kod,{formaNo:Number(enter.split('#')[1]),sonuc:{cikanId:id.id,girenId:enter}}));
        }
      }
    }
    for (const kod of [a,b]) {
      const loss=C().enerjiKaybi[plan(m,kod)];
      if (kod==='TUR') for (const id of Object.values(active(m,kod))) {
        const p=player(id); if (p) m.enerjiler[id]=Math.max(C().enerjiMin,m.enerjiler[id]-loss*(C().enerjiReferans.taban-(p.puan.dayaniklilik-C().enerjiReferans.referans)*C().enerjiReferans.dayaniklilikKatsayi)-(minute>=46 && m.devreKonusmasi==='cesaret'?C().devre.cesaret.ekEnerji:minute>=46 && m.devreKonusmasi==='sert'?C().devre.sert.ekEnerji:0));
      } else m.topluEnerjiler[kod]=Math.max(C().enerjiMin,m.topluEnerjiler[kod]-loss*C().enerjiReferans.taban*C().rakipEnerjiKaybiCarpani);
    }
    // Rakip hocası kendi tarzına göre değişiklik yapar (anonim kadroda aynı mevkiye taze oyuncu).
    for (const kod of [a,b]) {
      const h = kod !== 'TUR' && hoca(m, kod); if (!h) continue;
      h.degisiklik.forEach((k, i) => {
        const key = `${kod}|${i}`;
        if (m.hocaDegisiklik[key] || minute < k.dk || k.durum !== durumOf(m, kod)) return;
        if (m.anonimDegisiklikler[kod] >= C().limit.degisiklik || !m.anonimKadrolar[kod].yedek.length) return;
        const s = slots(m.taktikler[kod].dizilis).find(x => x.hat === k.cikan && !m.kirmiziKartlar[m.anonimKadrolar[kod].aktif[x.slot]] && !m.sakatlar[m.anonimKadrolar[kod].aktif[x.slot]]);
        if (!s) return;
        const cik = m.anonimKadrolar[kod].aktif[s.slot], enter = m.anonimKadrolar[kod].yedek.shift();
        m.anonimKadrolar[kod].aktif[s.slot] = enter; m.cikanlar.push(cik); m.anonimDegisiklikler[kod]++; m.hocaDegisiklik[key] = minute;
        m.topluEnerjiler[kod] = Math.min(100, m.topluEnerjiler[kod] + 4);
        events.push(baseEvent(m,minute,events.length,'degisiklik',kod,{formaNo:Number(enter.split('#')[1]),sonuc:{cikanId:cik,girenId:enter}}));
      });
    }
    if (minute===45) events.push(baseEvent(m,minute,events.length,'devre',null));
    if (minute===90) events.push(baseEvent(m,minute,events.length,'bitis',null));
    if (minute===60) for (const kod of [a,b]) if (kod!=='TUR' && !m.otomatikPlanDegisti[kod]) {
      const next=score(m,kod)<score(m,other(m,kod))?'yuklen':score(m,kod)>score(m,other(m,kod))?'kontrollu':plan(m,kod);
      m.otomatikPlanDegisti[kod]=true;
      if (next!==plan(m,kod)) { m.taktikler[kod].plan=next; events.push(baseEvent(m,minute,events.length,'plan',kod,{sonuc:next})); }
    }
    return append(m,events);
  }
  function applyChanges(m, islem, free) {
    const events=[], minute=m.dakika, nextMinute=minute+1, firstSira=nextSira(m);
    if (m.takimA!=='TUR' && m.takimB!=='TUR' || minute>=90 || m.bitti) err('DURUM_GECERSIZ');
    const targetPlan=islem.plan || m.taktikler.TUR.plan, targetDiz=islem.dizilis || m.taktikler.TUR.dizilis;
    validatePlan(targetPlan,nextMinute);
    if (!slots(targetDiz).length) err('DURUM_GECERSIZ');
    const tacticsChanged=targetPlan!==m.taktikler.TUR.plan || targetDiz!==m.taktikler.TUR.dizilis;
    if (tacticsChanged && !free && m.planHamlesiSayisi>=C().limit.planHamlesi) err('KOTA_PLAN');
    const changes=islem.degisiklikler || [];
    if (m.degisiklikSayisi+changes.length>C().limit.degisiklik) err('KOTA_DEGISIKLIK');
    const ids=new Set();
    for (const d of changes) {
      if (ids.has(d.cikanId) || ids.has(d.girenId)) err('DURUM_GECERSIZ');
      ids.add(d.cikanId); ids.add(d.girenId);
      if (m.cikanlar.includes(d.girenId)) err('TEKRAR_GIREMEZ');
      if (m.kirmiziKartlar[d.cikanId]) err('KIRMIZI_GIREMEZ');
      const slot=Object.keys(m.kadro.ilk11).find(k=>m.kadro.ilk11[k]===d.cikanId);
      if (!slot || !m.kadro.yedekler.includes(d.girenId)) err('DURUM_GECERSIZ');
      const old=player(d.cikanId), entering=player(d.girenId);
      if ((old.mevki==='KL') !== (entering.mevki==='KL')) err('SADECE_KALECI');
      m.kadro.ilk11[slot]=d.girenId;
      m.kadro.yedekler=m.kadro.yedekler.filter(x=>x!==d.girenId);
      m.cikanlar.push(d.cikanId); m.degisiklikSayisi++;
      events.push(baseEvent(m,minute,firstSira+events.length,'degisiklik','TUR',{oyuncuId:d.girenId,sonuc:{cikanId:d.cikanId,girenId:d.girenId}}));
    }
    if (targetDiz!==m.taktikler.TUR.dizilis) {
      m.kadro.ilk11=yerlestir(Object.values(m.kadro.ilk11),targetDiz,m.enerjiler).ilk11;
      m.kadro.dizilis=targetDiz;
    }
    if (tacticsChanged) {
      m.taktikler.TUR={...m.taktikler.TUR,plan:targetPlan,dizilis:targetDiz};
      if (!free) m.planHamlesiSayisi++;
      events.unshift(baseEvent(m,minute,firstSira,'plan','TUR',{sonuc:{plan:targetPlan,dizilis:targetDiz}}));
      for (let i=0;i<events.length;i++) { events[i].sira=firstSira+i; events[i].id=`m${m.fiksturNo}-${minute}-${events[i].sira}`; }
    }
    return events;
  }
  function mudahale(input,islem) {
    if (!islem || input.dakika===45 && input.mod==='normal' || input.bitti) err('DURUM_GECERSIZ');
    const m=cloneMatch(input), before=strengths(m).TUR, events=applyChanges(m,islem,false), after=strengths(m).TUR;
    m.kararlar.push({tur:'mudahale',dakika:m.dakika,etkiliDakika:m.dakika+1,islem:copy(islem),once:{H:before.H,S:before.S},sonra:{H:after.H,S:after.S}});
    return append(m,events);
  }
  function talkEffect(m,secim) {
    const c=C().devre, deficit=score(m,'TUR')-score(m,other(m,'TUR'));
    return secim==='sakin' ? c.sakin : secim==='cesaret' ? deficit<0?c.cesaret.geride:deficit===0?c.cesaret.berabere:c.cesaret.onde : deficit<=-2?c.sert.ikiFarkGeride:c.sert.diger;
  }
  function devreEtkileri(durum) {
    const out={};
    for (const secim of ['sakin','cesaret','sert']) {
      const moral=talkEffect(durum,secim), d=moral*C().moralKatsayisi;
      out[secim]={moral,dH:d,dS:d,enerjiBedeli:secim==='cesaret'?C().devre.cesaret.ekEnerji:secim==='sert'?C().devre.sert.ekEnerji:0,kartRiski:secim==='sert'?C().devre.sert.kartCarpani:1};
    }
    return out;
  }
  function konusma(input,secim,islem) {
    if (input.dakika!==45 || input.takimA!=='TUR' && input.takimB!=='TUR' || input.bitti) err('DURUM_GECERSIZ');
    if (input.devreKonusmasi) err('KONUSMA_ZATEN');
    if (!['sakin','cesaret','sert'].includes(secim)) err('KONUSMA_GEREKLI');
    const m=cloneMatch(input), before=strengths(m).TUR;
    const events=islem ? applyChanges(m,islem,true) : [];
    m.moral.TUR=clamp(m.moral.TUR+talkEffect(m,secim),...C().moralSinir); m.devreKonusmasi=secim;
    const after=strengths(m).TUR;
    m.kararlar.push({tur:'konusma',dakika:45,etkiliDakika:46,secim,islem:islem?copy(islem):undefined,once:{H:before.H,S:before.S},sonra:{H:after.H,S:after.S}});
    return append(m,events);
  }
  function onizle(baglam,taslak,devreSecim) {
    const m=baglam.mac, k=baglam.kadro, tac=baglam.taktik, draft=taslak||{};
    const no=m?.fiksturNo || baglam.turnuva.siradakiFikstur;
    const before=m?strengths(m).TUR:strengths(createMatch(baglam.turnuva,no,k,tac)).TUR;
    let after;
    if (m) {
      const n=cloneMatch(m);
      if (draft.plan || draft.dizilis || draft.degisiklikler?.length) applyChanges(n,draft,n.dakika===45);
      if (devreSecim) n.moral.TUR=clamp(n.moral.TUR+talkEffect(n,devreSecim),...C().moralSinir);
      after=strengths(n).TUR;
    } else {
      const p={...tac,plan:draft.plan||tac.plan,dizilis:draft.dizilis||tac.dizilis}; validatePlan(p.plan,no===70?71:1);
      after=strengths(createMatch(baglam.turnuva,no,k,p)).TUR;
    }
    return {once:{H:before.H,S:before.S},sonra:{H:after.H,S:after.S},bilesenler:after.bilesenler,eslesme:after.bilesenler.eslesme,enerjiBedeli:C().enerjiKaybi[draft.plan||tac.plan]};
  }
  function macBitir(input) {
    if (input.dakika!==90) err('DURUM_GECERSIZ');
    if (input.bitti) return {durum:input,olaylar:[]};
    const m=cloneMatch(input), events=[];
    if ((m.asama==='final' || m.asama==='hizli') && m.skor.a===m.skor.b) {
      const st=strengths(m), ps=C().penalti;
      const pool={};
      for (const kod of [m.takimA,m.takimB]) {
        const sl=slots(m.taktikler[kod].dizilis), ids=sl.filter(s=>s.hat==='OS'||s.hat==='FV').map(s=>active(m,kod)[s.slot]).filter(id=>id&&!m.kirmiziKartlar[id]&&!m.sakatlar[id]);
        pool[kod]=kod==='TUR'?ids.sort((a,b)=>player(b).puan.bitiricilik-player(a).puan.bitiricilik||a.localeCompare(b)):ids;
      }
      const atislar=[], total={a:0,b:0};
      let decided=false;
      for (let pair=0;pair<ps.ilkSeri+ps.ekCift && !decided;pair++) {
        for (const kod of [m.takimA,m.takimB]) {
          const sk=statKey(m,kod), id=pool[kod][pair%pool[kod].length]||null, foe=other(m,kod);
          const finish=kod==='TUR'&&id?player(id).puan.bitiricilik-75:0;
          const keeper=foe==='TUR'?player(active(m,'TUR').KL)?.puan.kalecilik-75||0:0;
          const prob=clamp(ps.taban+(st[kod].H-st[foe].S)*ps.gucKatsayi+finish*ps.bitiricilikKatsayi-keeper*ps.kalecilikKatsayi,ps.min,ps.max);
          const zar=Y().mulberry32(Y().hash32(m.tohum,m.fiksturNo,'penalti',pair,kod))(), gol=zar<prob;
          const shot={sira:atislar.length+1,takimKod:kod,oyuncuId:kod==='TUR'?id:null,formaNo:kod==='TUR'?null:id?Number(id.split('#')[1]):null,gol,olasilik:prob,zar};
          atislar.push(shot); if (gol) total[sk]++;
          events.push(baseEvent(m,90,nextSira(m)+events.length,'penalti',kod,{...identity(kod,id?{id}:null),sonuc:gol?'gol':'kacti',zarlar:{zar,olasilik:prob}}));
          const aCount=atislar.filter(x=>x.takimKod===m.takimA).length, bCount=atislar.length-aCount;
          if (pair<ps.ilkSeri && (total.a>total.b+(ps.ilkSeri-bCount)||total.b>total.a+(ps.ilkSeri-aCount))) {decided=true;break;}
        }
        if (pair>=ps.ilkSeri-1 && total.a!==total.b) decided=true;
      }
      const kura=total.a===total.b;
      m.penalti={atislar,skor:total,kazanan:kura?((Y().hash32(m.tohum,m.fiksturNo,'kura')&1)?m.takimB:m.takimA):total.a>total.b?m.takimA:m.takimB,kura};
    }
    m.bitti=true;
    return append(m,events);
  }
  function ranking(t) {
    const rows=Object.values(t.puanTablosu);
    rows.sort((x,y)=>y.p-x.p||y.av-x.av||y.a-x.a);
    for (let start=0;start<rows.length;) {
      let end=start+1;
      while(end<rows.length && rows[end].p===rows[start].p && rows[end].av===rows[start].av && rows[end].a===rows[start].a)end++;
      if(end-start>1){
        const tied=new Set(rows.slice(start,end).map(r=>r.kod));
        const mini=Object.fromEntries([...tied].map(k=>[k,{p:0,av:0,g:0}]));
        for(const m of t.maclar) if(m.asama==='grup' && tied.has(m.takimA) && tied.has(m.takimB)){
          for(const [kod,gf,ga] of [[m.takimA,m.skor.a,m.skor.b],[m.takimB,m.skor.b,m.skor.a]]){
            mini[kod].p+=gf>ga?3:gf===ga?1:0;mini[kod].av+=gf-ga;mini[kod].g+=gf;
          }
        }
        const sorted=rows.slice(start,end).sort((x,y)=>mini[y.kod].p-mini[x.kod].p||mini[y.kod].av-mini[x.kod].av||mini[y.kod].g-mini[x.kod].g||Y().hash32(t.tohum,'grup-esitlik',x.kod)-Y().hash32(t.tohum,'grup-esitlik',y.kod)||x.kod.localeCompare(y.kod));
        rows.splice(start,end-start,...sorted);
      }
      start=end;
    }
    return rows.map(r=>r.kod);
  }
  function addResult(t,m) {
    const a=t.puanTablosu[m.takimA],b=t.puanTablosu[m.takimB];
    for (const [r,gf,ga] of [[a,m.skor.a,m.skor.b],[b,m.skor.b,m.skor.a]]) {
      r.o++;r.a+=gf;r.y+=ga;r.av=r.a-r.y;
      if (gf>ga) {r.g++;r.p+=3;} else if (gf===ga) {r.b++;r.p++;} else r.m++;
    }
    t.maclar.push(m);
  }
  function simulateBackground(t,no) {
    let m=createMatch(t,no,null,null);
    while(m.dakika<90) m=adim(m).durum;
    return macBitir(m).durum;
  }
  function replenishBench(k,m,previous) {
    const used=new Set(Object.values(k.ilk11));
    const candidates=[];
    const add=id=>{if(id && player(id) && !used.has(id) && !candidates.includes(id))candidates.push(id);};
    for(const id of k.yedekler)add(id);
    for(const id of m.cikanlar)add(id);
    for(const id of previous?.yedekler||[])add(id);
    const ranked=allPlayers().filter(p=>p.sonKampCagrisi).slice().sort((a,b)=>b.puan.genel-a.puan.genel||a.id.localeCompare(b.id));
    for(const p of ranked)add(p.id);
    const bench=candidates.slice(0,7);
    if(!bench.some(id=>player(id).mevki==='KL')){
      const keeper=candidates.find(id=>player(id).mevki==='KL');
      if(keeper)bench[bench.length-1]=keeper;
    }
    k.yedekler=bench;
    return k;
  }
  function sonucIsle(turnuva,mac) {
    if (!mac.bitti || turnuva.maclar.some(x=>x.fiksturNo===mac.fiksturNo) || mac.fiksturNo!==turnuva.siradakiFikstur) err('DURUM_GECERSIZ');
    const t=copy(turnuva);
    if (mac.asama==='hizli') { t.maclar.push(copy(mac));t.sonuc=(mac.penalti?mac.penalti.kazanan:mac.skor.a>mac.skor.b?mac.takimA:mac.takimB)==='TUR'?'kupa':'elenme';t.siradakiFikstur=null;t.aktifMac=null;return t; }
    if (mac.asama==='final') {
      t.maclar.push(copy(mac));t.sonuc=(mac.penalti?mac.penalti.kazanan:mac.skor.a>mac.skor.b?mac.takimA:mac.takimB)==='TUR'?'kupa':'elenme';t.siradakiFikstur=null;t.aktifMac=null;return t;
    }
    addResult(t,copy(mac));
    const background={1:2,3:4,5:6}[mac.fiksturNo];
    const backgroundMatch=simulateBackground(t,background);
    addResult(t,backgroundMatch);
    for (const p of allPlayers()) t.oyuncuEnerjileri[p.id]=Math.min(100,(mac.enerjiler[p.id] ?? t.oyuncuEnerjileri[p.id])+C().enerjiYenile);
    for (const kod of ['AUT','CZE','ITA']) {
      const finalEnergy=[mac.takimA,mac.takimB].includes(kod)?mac.topluEnerjiler[kod]:backgroundMatch.topluEnerjiler[kod];
      t.rakipEnerjileri[kod]=Math.min(100,finalEnergy+C().enerjiYenile);
    }
    t.oncekiKadro=copy(mac.kadro); t.oncekiTaktik=copy(mac.taktikler.TUR);
    t.hazirlikKadro=replenishBench(copy(mac.kadro),mac,turnuva.hazirlikKadro);
    t.hazirlikTaktik={dizilis:mac.taktikler.TUR.dizilis,plan:mac.taktikler.TUR.plan==='yuklen'?'dengeli':mac.taktikler.TUR.plan};
    t.aktifMac=null;t.macBaslangic=null;
    if (mac.fiksturNo===5) {t.siralama=ranking(t);t.tur=4;t.siradakiFikstur=t.siralama.includes('TUR')&&t.siralama.indexOf('TUR')<2?7:null;if(!t.siradakiFikstur)t.sonuc='elenme';}
    else {t.tur++;t.siradakiFikstur=mac.fiksturNo+2;}
    return t;
  }
  function analiz(m) {
    const shots=m.olaylar.filter(e=>e.tur==='sut');
    return {skor:copy(m.skor),istatistik:copy(m.istatistik),kararlar:copy(m.kararlar),sonUcPozisyon:shots.slice(-3).map(e=>e.id),
      etkiler:m.kararlar.map(k=>({dakika:k.dakika,tur:k.tur,once:k.once,sonra:k.sonra})),
      takimlar:[m.takimA,m.takimB]};
  }
  function tekrar(baslangic,kararlar) {
    let m=copy(baslangic), index=0;
    while(m.dakika<90) {
      while(index<kararlar.length && kararlar[index].dakika===m.dakika) {
        const k=kararlar[index++]; m=(k.tur==='konusma'?konusma(m,k.secim,k.islem):mudahale(m,k.islem)).durum;
      }
      if(m.dakika===45 && !m.devreKonusmasi && m.mod==='normal' && (m.takimA==='TUR'||m.takimB==='TUR')) m=konusma(m,'sakin').durum;
      m=adim(m).durum;
    }
    return macBitir(m).durum;
  }
  MT.motor={hocaOnerileri,kadroOner,yerlestir,rolUyumu,siralama:ranking,gucHesapla,onizle,devreEtkileri,turnuvaBaslat,macBaslat,adim,mudahale,konusma,macBitir,sonucIsle,analiz,tekrar};
})(typeof window!=='undefined'?window:globalThis);
