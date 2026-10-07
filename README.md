# Milli Takımın Başında

Tarayıcıda oynanan bir Türkiye milli takımı teknik direktör oyunu. Kadroyu sen kuruyorsun, taktiği sen veriyorsun, maça sen müdahale ediyorsun.

Bu oyunun tek satır kodunu ben yazmadım. Yapay zekâya tek bir mesaj attım; arkasında 70'ten fazla yapay zekâ ajanı 11 saatten fazla çalıştı. Araştırmayı, tasarımı, kodu ve testleri ajanlar yaptı: yönetimi Claude Opus 5.5, ağır kodu GPT-6, testleri Claude Sonnet üstlendi.

Hikâyenin tamamı videoda: [YouTube · VuqeAI](https://youtu.be/wNQ1KzGQNBw)

## Nasıl oynanır

1. Bu depoyu indir (Code → Download ZIP) ya da klonla.
2. `index.html` dosyasına çift tıkla.

Kurulum yok, internet gerekmiyor; her şey tarayıcıda çalışır.

- **Turnuva:** Türkiye, Avusturya, Çekya ve İtalya ile kurgu bir dörtlü kupa. Üç grup maçı, bir final.
- **Maç önü:** Hoca tarzı, ilk 11, diziliş (4-3-3, 4-2-3-1, 3-5-2) ve oyun planı.
- **Canlı maç:** 1×, 2×, 4× hız; kart ve gollerde durup müdahale (oyuncu değişikliği, plan, diziliş).
- **Devre arası:** Sakin kal, cesaret ver ya da sert uyar.
- **Hızlı dene:** Doğrudan 70. dakikada 1-1'den başla.

## Dosyalar

| Yol | İçerik |
|---|---|
| `index.html`, `style.css` | Arayüz |
| `js/motor.js` | Maç motoru |
| `js/veri.js` | Kadro, takımlar, puanlar |
| `js/saha.js`, `js/konum-verisi.js` | Saha çizimi ve oyuncu yerleşimi |
| `js/ekranlar.js`, `js/app.js`, `js/yardim.js` | Ekranlar ve akış |
| `arac/konum_cikar.py` | Yerleşim verisini Metrica örnek takip verisinden üreten araç |

## Veri ve kaynaklar

- Oyuncu bilgileri (kulüp, yaş, A milli maç/gol) kaynak tarihindeki halleriyle `js/veri.js` içinde, her oyuncunun kaynak bağlantısıyla birlikte. Oyun puanları oyun içindir.
- Turnuva, maçlar ve sonuçlar kurgudur.
- Saha yerleşimi ve top akışı: [Metrica Sports sample data](https://github.com/metrica-sports/sample-data).
- Yazı tipleri: Sora ve JetBrains Mono (SIL Open Font License 1.1).

## Lisans

Kod MIT lisanslıdır (bkz. `LICENSE`). Yazı tipleri kendi lisanslarıyla (OFL 1.1) dağıtılır.
