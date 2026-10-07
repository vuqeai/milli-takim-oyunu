"""Metrica Sports açık örnek takip verisinden (2 maç) takım dizilişi tablosu ve top zincirleri çıkarır.

Kaynak: https://github.com/metrica-sports/sample-data (Sample_Game_1, Sample_Game_2)
Çıktı:  js/konum-verisi.js  ->  MT.konumVerisi = { tablo, sut, zincirler, ... }

Koordinatlar her takım için "soldan sağa hücum eder" olacak şekilde döndürülür (x: kendi kale 0 -> rakip kale 1).
Kullanım: python3 arac/konum_cikar.py <metrica_csv_klasoru>
"""
import csv, json, sys, os
import numpy as np

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'konum-verisi.js')
HZ_STEP = 5            # 25 Hz -> 5 Hz
GECIS_SN = 5.0         # top kazanımı / kaybından sonraki ilk 5 sn geçiş sayılır
BX = 8                 # top derinliği bölmesi
BY = 3                 # top yanal bölmesi
POSS_TYPES = {'PASS', 'RECOVERY', 'SET PIECE', 'SHOT', 'CARRY'}


def read_tracking(path):
    with open(path) as f:
        rows = list(csv.reader(f))
    head = rows[2]
    players = [h for h in head if h.startswith('Player')]
    data = np.array([[float(v) if v not in ('', 'NaN') else np.nan for v in r] for r in rows[3:]])
    period, frame = data[:, 0].astype(int), data[:, 1].astype(int)
    pxy = data[:, 3:3 + 2 * len(players)].reshape(len(data), len(players), 2)
    ball = data[:, -2:]
    return period, frame, players, pxy, ball


def read_events(path):
    with open(path) as f:
        return list(csv.DictReader(f))


def process(game):
    g = os.path.join(SRC, f'Sample_Game_{game}_Raw')
    per, frm, hp, hxy, ball = read_tracking(g + 'TrackingData_Home_Team.csv')
    _, _, ap, axy, _ = read_tracking(g + 'TrackingData_Away_Team.csv')
    ev = read_events(g + 'EventsData.csv')
    n = len(frm)
    # Topa sahip takım ve son sahiplik değişimi (kare bazında)
    poss = np.full(n, '', dtype=object)
    dead = np.zeros(n, bool)
    shot = np.zeros(n, bool)
    cur, cur_from = '', 0
    marks = []  # (frame, team or '' for dead)
    for e in ev:
        s = int(e['Start Frame'])
        if e['Type'] in POSS_TYPES:
            marks.append((s, e['Team']))
        if e['Type'] == 'BALL LOST' and e['Subtype'] in ('', 'INTERCEPTION', 'THEFT'):
            marks.append((int(e['End Frame']) or s, 'Away' if e['Team'] == 'Home' else 'Home'))
        if e['Type'] == 'BALL OUT':
            marks.append((int(e['End Frame']) or s, ''))
        if e['Type'] == 'SHOT':
            shot[max(0, s - 1 - 50):min(n, s - 1 + 25)] = True  # şuttan 2 sn önce .. 1 sn sonra
    marks.sort()
    since = np.zeros(n)
    mi = 0
    last_change = 0
    for i in range(n):
        f = frm[i]
        while mi < len(marks) and marks[mi][0] <= f:
            t = marks[mi][1]
            if t != cur:
                if cur and t:
                    last_change = i
                elif t:
                    last_change = -10**9  # duran toptan başlayan oyun geçiş sayılmaz
                cur = t
            mi += 1
        poss[i] = cur
        dead[i] = cur == ''
        since[i] = (i - last_change) / 25.0
    # Hücum yönü: her devrede kalecinin (ortalama x'i en uçta olan) tarafı
    out = []
    for team, xy, other in (('Home', hxy, axy), ('Away', axy, hxy)):
        for p in (1, 2):
            m = per == p
            mean_x = np.nanmean(xy[m, :, 0], axis=0)
            gk = int(np.nanargmin(np.abs(mean_x - 0.5) * -1)) if False else None
            # kaleci: devre boyunca kendi kale çizgisine en yakın oyuncu
            team_mean = np.nanmean(mean_x)
            flip = team_mean > 0.5  # kalesi sağdaysa döndür
            gk = int(np.nanargmax(mean_x) if flip else np.nanargmin(mean_x))
            idx = np.where(m)[0][::HZ_STEP]
            for i in idx:
                if dead[i] or not np.isfinite(ball[i]).all():
                    continue
                pts = xy[i].copy()
                b = ball[i].copy()
                if flip:
                    pts = 1 - pts
                    b = 1 - b
                ok = np.isfinite(pts).all(axis=1)
                ok[gk] = False
                of = pts[ok]
                if len(of) < 9 or not np.isfinite(pts[gk]).all():
                    continue
                has = poss[i] == team
                tr = since[i] < GECIS_SN
                state = ('HG' if tr else 'H') if has else ('SG' if tr else 'S')
                out.append((state, shot[i], b[0], b[1], pts[gk][0], np.sort(of[:, 0]), of[:, 1].mean(), of[:, 1].std(), len(of)))
    # Top zincirleri: takım sahipliği >= 6 sn, 2 Hz örnek, sahibi sağa hücum edecek şekilde
    chains = []
    i = 0
    while i < n:
        t = poss[i]
        j = i
        while j < n and poss[j] == t and per[j] == per[i]:
            j += 1
        if t and (j - i) / 25 >= 6:
            team_xy = hxy if t == 'Home' else axy
            mean_x = np.nanmean(team_xy[per == per[i], :, 0])
            flip = mean_x > 0.5
            seq = ball[i:j:12]
            if np.isfinite(seq).all():
                if flip:
                    seq = 1 - seq
                chains.append([[round(float(a), 3), round(float(b), 3)] for a, b in seq])
        i = j
    return out, chains


samples, chains = [], []
for game in (1, 2):
    s, c = process(game)
    samples += s
    chains += c
print('örnek', len(samples), 'zincir', len(chains))


def summarize(rows):
    q = np.array([np.interp(np.linspace(0, 1, 10), np.linspace(0, 1, len(r[5])), r[5]) for r in rows])
    return {
        'n': len(rows),
        'kl': round(float(np.median([r[4] for r in rows])), 3),
        'q': [round(float(v), 3) for v in np.median(q, axis=0)],
        'cy': round(float(np.median([r[6] for r in rows])), 3),
        'sy': round(float(np.median([r[7] for r in rows])), 3),
    }


tablo = {}
for state in ('H', 'HG', 'S', 'SG'):
    grid = []
    for bx in range(BX):
        row = []
        for by in range(BY):
            rows = [r for r in samples if r[0] == state and min(BX - 1, int(r[2] * BX)) == bx and min(BY - 1, int(r[3] * BY)) == by]
            row.append(summarize(rows) if len(rows) >= 25 else None)
        grid.append(row)
    # Az örnekli hücreleri en yakın dolu komşu ile doldur
    for bx in range(BX):
        for by in range(BY):
            if grid[bx][by] is None:
                best = min(((abs(bx - x) + 0.5 * abs(by - y), grid[x][y]) for x in range(BX) for y in range(BY) if grid[x][y]), key=lambda z: z[0])
                grid[bx][by] = dict(best[1], n=0)
    tablo[state] = grid

# Şut anı: hücum eden (A) ve savunan (D) takımın şekli, top yanal bölmesine göre
sut = {}
for side, st in (('A', ('H', 'HG')), ('D', ('S', 'SG'))):
    rows = [r for r in samples if r[1] and r[0] in st and r[2] > (0.6 if side == 'A' else -1) and r[2] < (2 if side == 'A' else 0.4)]
    sut[side] = summarize(rows)

chains.sort(key=lambda c: -len(c))
data = {
    'kaynak': 'Metrica Sports açık örnek takip verisi (Sample Game 1-2), github.com/metrica-sports/sample-data',
    'bx': BX, 'by': BY, 'hz': 25 / 12,
    'tablo': tablo, 'sut': sut,
    'zincirler': [c[:40] for c in chains[:160]],
}
with open(OUT, 'w') as f:
    f.write('// Otomatik üretildi: arac/konum_cikar.py. Elle düzenleme.\n')
    f.write('// ' + data['kaynak'] + '\n')
    f.write('(function(g){g.MT=g.MT||{};g.MT.konumVerisi=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';})(typeof window!=="undefined"?window:globalThis);\n')
print('yazıldı', OUT, os.path.getsize(OUT), 'bayt')
for st in ('H', 'S'):
    for bx in range(BX):
        c = tablo[st][bx][1]
        print(st, bx, c['n'], 'kl', c['kl'], 'arka', c['q'][0], c['q'][4], 'ön', c['q'][9], 'cy', c['cy'], 'sy', c['sy'])
print('sut', sut)
