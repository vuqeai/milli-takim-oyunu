(function (g) {
  g.MT = g.MT || {};

  // FNV-1a, UTF-16 kod birimleri. Tüm parçalardaki ayraç sabittir.
  function hash32(...parcalar) {
    const metin = parcalar.map(String).join('|');
    let h = 2166136261;
    for (let i = 0; i < metin.length; i += 1) {
      h = Math.imul(h ^ metin.charCodeAt(i), 16777619) >>> 0;
    }
    return h;
  }

  function mulberry32(tohum) {
    let t = tohum >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let x = Math.imul(t ^ (t >>> 15), t | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(sayi, alt, ust) {
    return Math.min(ust, Math.max(alt, sayi));
  }

  // ISO metni UTC'ye çevirmeden, yerel takvim gününe göre yaş hesaplar.
  function yas(dogum, bugun) {
    const [yil, ay, gun] = String(dogum).split('-').map(Number);
    const tarih = bugun === undefined ? new Date() : bugun;
    const [buYil, buAy, buGun] = typeof tarih === 'string'
      ? tarih.split('-').map(Number)
      : [tarih.getFullYear(), tarih.getMonth() + 1, tarih.getDate()];
    if (![yil, ay, gun, buYil, buAy, buGun].every(Number.isInteger)) return NaN;
    return buYil - yil - (buAy < ay || (buAy === ay && buGun < gun) ? 1 : 0);
  }

  function derinKopya(deger) {
    return deger === undefined ? undefined : JSON.parse(JSON.stringify(deger));
  }

  g.MT.yardim = { hash32, mulberry32, clamp, yas, derinKopya };
})(typeof window !== 'undefined' ? window : globalThis);
