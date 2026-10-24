#!/usr/bin/env python3
"""Builds game/assets/audio/sfx/*.wav from Kenney CC0 packs (impact, rpg, digital, interface) + offline synthesis.
usage: python3 tools/audio/build_sfx.py <kenney_root> <out_dir>
Kenney packs: CC0 1.0 (www.kenney.nl). Synthesised sounds (guns, explosions, loops) are original to this project."""
import sys, os, json, subprocess, numpy as np
SR = 32000
K, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def load(rel, rate=1.0):
    """decode a Kenney ogg to mono float at SR (rate>1 = pitched up / shorter)"""
    p = os.path.join(K, rel)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(int(SR / rate)), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)
def kimp(name, i=0, rate=1.0): return load(f'kenney_impactsounds/Audio/{name}_{i:03d}.ogg', rate)
def krpg(name, rate=1.0): return load(f'kenney_rpgaudio/Audio/{name}.ogg', rate)
def kdig(name, rate=1.0): return load(f'kenney_digitalaudio/Audio/{name}.ogg', rate)
def kui(name, rate=1.0): return load(f'kenney_interfacesounds/Audio/{name}.ogg', rate)

def T(sec): return np.arange(int(SR * sec)) / SR
def noise(sec): return rng.standard_normal(int(SR * sec))
def env(n, a=0.002, d=0.1, curve=1.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d) ** curve
    return e
from scipy.signal import lfilter
def lp(x, fc):  # one-pole low-pass (cheap, smooth); run twice for a steeper slope
    a = np.exp(-2 * np.pi * fc / SR); return lfilter([1 - a], [1, -a], lfilter([1 - a], [1, -a], x))
def hp(x, fc): return x - lp(x, fc)
def bp(x, f0, f1=None): return hp(lp(x, f1 or f0 * 2), f0)
def sweep_lp(x, f0, f1):  # time-varying one-pole low-pass, f0→f1 (exponential)
    n = len(x); f = f0 * (f1 / f0) ** (np.arange(n) / max(1, n - 1)); a = np.exp(-2 * np.pi * f / SR); y = np.empty_like(x); s = 0.0
    for i in range(n): s = (1 - a[i]) * x[i] + a[i] * s; y[i] = s
    return y
def sine(f0, f1, sec):
    t = T(sec); f = f0 * (f1 / f0) ** (t / sec); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def verb(x, sec=0.6, wet=0.25, bright=4000):
    n = int(SR * sec); ir = noise(sec) * np.exp(-np.arange(n) / SR / (sec / 5)); ir = lp(ir, bright); ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    L = len(x) + n; F = 1 << (L - 1).bit_length(); w = np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(ir, F), F)[:L]
    y = np.concatenate([x, np.zeros(n)]); return y + wet * w
def mix(*parts):
    """parts: (signal, gain, offset_sec)"""
    L = max(int(o * SR) + len(s) for s, g, o in parts); y = np.zeros(L)
    for s, g, o in parts: i = int(o * SR); y[i:i + len(s)] += g * s
    return y
def sat(x, drive=2.0): return np.tanh(x * drive) / np.tanh(drive)
def fin(x, peak=0.89, fade=0.01, trim=True):
    x = np.asarray(x, np.float64)
    if trim:  # trim trailing near-silence
        a = np.abs(x); thr = a.max() * 0.002; idx = np.where(a > thr)[0]; x = x[: (idx[-1] + int(0.02 * SR)) if len(idx) else len(x)]
    nf = int(fade * SR); 
    if nf and len(x) > nf: x[-nf:] *= np.linspace(1, 0, nf)
    m = np.abs(x).max() or 1; return x / m * peak
def write(name, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', os.path.join(OUT, name + '.wav')], input=pcm, check=True)

M = {}  # name → number of variants
def emit(name, xs):
    xs = xs if isinstance(xs, list) else [xs]
    for k, x in enumerate(xs): write(f'{name}_{k}', x)
    M[name] = len(xs)

# ── gunshots: crack (transient) + body (filtered noise) + thump (low sine) + mech (metal click) + room
def gunshot(crack=1.0, body_f=2500, body_d=0.05, thump_f=90, thump=0.6, mech=0.25, room=0.5, rsec=0.7, drive=2.5, seed_rate=1.0):
    n = noise(0.6)
    c = hp(n[: int(0.012 * SR)], 3000) * env(int(0.012 * SR), 0.0003, 0.003)
    b = lp(n, body_f) * env(len(n), 0.0005, body_d)
    th = sine(thump_f * 1.8, thump_f * 0.6, 0.35) * env(int(0.35 * SR), 0.001, 0.06)
    mk = lp(noise(0.03), 900) * env(int(0.03 * SR), 0.0005, 0.008) # mechanism: a dull low clack, not a clink
    x = mix((c, crack, 0), (b, 1.0, 0), (th, thump, 0), (mk, mech, 0.004))
    x = sat(x, drive)
    return fin(verb(x, rsec, room, 3500))
emit('pistol', [gunshot(body_f=3000, body_d=0.04, thump_f=110, thump=0.5, room=0.45, seed_rate=1 + k * 0.05) for k in range(3)])
emit('revolver', [gunshot(crack=1.2, body_f=2200, body_d=0.09, thump_f=75, thump=0.9, mech=0.35, room=0.7, rsec=1.0, drive=3.2) for _ in range(2)])
emit('shotgun', [fin(verb(sat(mix((lp(noise(0.5), 1800) * env(int(0.5 * SR), 0.001, 0.12), 1.0, 0), (sine(140, 45, 0.5) * env(int(0.5 * SR), 0.001, 0.1), 1.0, 0), (hp(noise(0.02), 2500) * env(int(0.02 * SR), 0.0003, 0.004), 1.2, 0)), 3.5), 1.2, 0.6, 3000)) for _ in range(2)])
def smg_shot(): # paintball marker: pneumatic "thwap" + pop
    n = noise(0.12); return fin(verb(mix((bp(n, 600, 3500) * env(len(n), 0.0008, 0.025), 1.0, 0), (sine(420, 160, 0.06) * env(int(0.06 * SR), 0.001, 0.015), 0.5, 0), (lp(noise(0.05), 700) * env(int(0.05 * SR), 0.001, 0.012), 0.5, 0.008)), 0.3, 0.2, 3000))
emit('smg', [smg_shot() for _ in range(4)])
def nail_shot():
    n = noise(0.1); air = bp(n, 1500, 7000) * env(len(n), 0.0005, 0.03)
    thk = mix((lp(noise(0.04), 1200) * env(int(0.04 * SR), 0.0005, 0.01), 1.0, 0), (sine(220, 90, 0.05) * env(int(0.05 * SR), 0.001, 0.015), 0.6, 0))
    return fin(verb(mix((air, 0.9, 0), (thk, 1.0, 0)), 0.3, 0.15))
emit('nail', [nail_shot() for _ in range(3)])

# ── explosions: sub boom + roar + crackle + debris, long tail
def explosion(size=1.0):
    d = 1.6 * size; n = noise(d)
    roar = sweep_lp(n, 3500, 150) * env(len(n), 0.004, 0.35 * size)
    sub = sine(80, 28, d) * env(int(d * SR), 0.003, 0.4 * size)
    crack = hp(noise(0.03), 2000) * env(int(0.03 * SR), 0.0003, 0.006)
    crackle = (rng.random(int(d * SR)) > 0.9985) * rng.standard_normal(int(d * SR)) * env(int(d * SR), 0.05, 0.4)
    deb = mix(*[(lp(noise(0.06), 1500) * env(int(0.06 * SR), 0.001, 0.015), 0.25, 0.15 + rng.random() * 0.8) for _ in range(8)])
    return fin(verb(sat(mix((roar, 1.0, 0), (sub, 1.3, 0), (crack, 1.0, 0), (lp(crackle, 5000), 0.6, 0.02), (deb, 1.0, 0)), 2.2), 1.6 * size, 0.35, 2500))
emit('boom', [explosion(1.0), explosion(1.1)])
emit('signature', fin(mix((explosion(1.3), 1.0, 0), (sine(55, 22, 1.4) * env(int(1.4 * SR), 0.005, 0.5), 0.9, 0), (lp(noise(0.3), 400) * env(int(0.3 * SR), 0.002, 0.08), 0.8, 0))))
emit('pulse', fin(verb(mix((sine(90, 35, 0.8) * env(int(0.8 * SR), 0.01, 0.25), 1.0, 0), (sweep_lp(noise(0.8), 1200, 100) * env(int(0.8 * SR), 0.02, 0.2), 0.5, 0)), 0.8, 0.3)))
def rocket():
    d = 0.9; n = noise(d); w = sweep_lp(n, 600, 3000) * np.minimum(1, T(d) / 0.05) * np.exp(-T(d) / 0.5)
    return fin(verb(mix((hp(w, 200), 1.0, 0), (sine(60, 110, d) * env(int(d * SR), 0.01, 0.3), 0.4, 0), (hp(noise(0.03), 2000) * env(int(0.03 * SR), 0.0003, 0.005), 0.6, 0)), 0.6, 0.25))
emit('rocket', rocket())
def buzz():
    d = 0.6; t = T(d); f = 650 + 350 * t / d; s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5 + np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR) * 0.3
    return fin(verb(lp(s, 5000) * env(len(s), 0.01, 0.35), 0.4, 0.2))
emit('buzz', buzz())

def whoosh(f0=500, f1=3000, d=0.24, low=False):
    n = noise(d); t = T(d); e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    x = sweep_lp(hp(n, 150 if low else 400), f0, f1) * e
    return fin(x)
# ── skate: ollie pop, landings, flicks, catches, bails, wall taps (Kenney wood/plank/plate impacts)
def slap(dur=0.035, lo=180, hi=2200, d=0.012): n = noise(dur); return hp(lp(n, hi), lo) * env(len(n), 0.0005, d)
emit('pop', [fin(mix((slap(), 1.0, 0), (sine(150, 70, 0.08) * env(int(0.08 * SR), 0.001, 0.025), 0.7, 0), (lp(kimp('impactWood_heavy', k, 1.0), 1800), 0.6, 0.002))) for k in range(4)])
emit('land', [fin(mix((lp(kimp('impactWood_heavy', k, 0.9), 2000), 1.0, 0), (slap(0.06, 120, 1600, 0.02), 0.7, 0.004), (sine(110, 50, 0.12) * env(int(0.12 * SR), 0.001, 0.04), 0.6, 0), (lp(noise(0.12), 600) * env(int(0.12 * SR), 0.005, 0.04), 0.4, 0.02))) for k in range(4)])
emit('catch', [fin(mix((slap(0.03, 200, 1800, 0.01), 1.0, 0), (lp(kimp('impactSoft_medium', k, 1.0), 1500), 0.6, 0))) for k in range(3)])
emit('flick', [whoosh(700, 2600, 0.14), whoosh(600, 2200, 0.16), whoosh(800, 3000, 0.13)])
emit('wall', [fin(mix((lp(kimp('impactWood_heavy', k, 1.0), 2200), 1.0, 0), (slap(0.04, 150, 1800, 0.015), 0.6, 0))) for k in range(3)])
emit('bail', [fin(mix((kimp('impactSoft_heavy', k, 0.9), 1.0, 0), (kimp('impactPunch_heavy', (k + 1) % 5, 1.0), 0.6, 0.02), (lp(kimp('impactWood_heavy', (k + 2) % 5, 0.9), 1800), 0.6, 0.14), (slap(0.05, 120, 1500, 0.02), 0.5, 0.3))) for k in range(3)])
def scrape(d=0.3):
    n = noise(d); x = np.zeros_like(n)
    for f, q in [(1800, 0.3), (2900, 0.25), (4300, 0.15)]: x += bp(n, f * 0.9, f * 1.1) * q
    return x * env(len(n), 0.003, d / 3) + lp(n, 400) * env(len(n), 0.002, 0.05) * 0.5
emit('grind', [fin(scrape(0.3)), fin(scrape(0.25))])
# loops (looped at runtime, pitched with speed): wheels on concrete and a metal-on-metal grind
def roll_loop():
    d = 2.0; n = noise(d); x = lp(n, 220) * 0.8 + bp(n, 300, 900) * 0.25
    clicks = np.zeros(int(d * SR))
    for t0 in np.arange(0.11, d, 0.47): i = int(t0 * SR); c = lp(noise(0.04), 500) * env(int(0.04 * SR), 0.001, 0.012); clicks[i:i + len(c)] += c[: len(clicks) - i] * 0.6
    x = x + lp(clicks, 2500); m = int(0.08 * SR); x[:m] = x[:m] * np.linspace(0, 1, m) + x[-m:] * np.linspace(1, 0, m); x = x[:-m]  # crossfade seam
    return x / np.abs(x).max() * 0.8
emit('rollloop', roll_loop())
def grind_loop():
    d = 1.6; n = noise(d); x = np.zeros_like(n)
    for f, q in [(2100, 0.25), (3300, 0.2), (4700, 0.15), (6200, 0.1)]: x += bp(n, f * 0.92, f * 1.08) * q
    x *= 1 + 0.35 * np.sin(2 * np.pi * 13 * T(d)) + 0.2 * (rng.random(len(n)) > 0.995)
    x += lp(n, 300) * 0.15
    m = int(0.08 * SR); x[:m] = x[:m] * np.linspace(0, 1, m) + x[-m:] * np.linspace(1, 0, m); x = x[:-m]
    return x / np.abs(x).max() * 0.8
emit('grindloop', grind_loop())

# ── melee
emit('whoosh', [whoosh(400, 2800), whoosh(500, 3200, 0.2), whoosh(350, 2400, 0.26)])
emit('heavy', [whoosh(150, 900, 0.4, True), whoosh(120, 800, 0.45, True)])
emit('slash', [fin(mix((whoosh(1500, 6000, 0.16), 0.6, 0), (krpg(f'knifeSlice{"" if k == 0 else "2"}', 1.1), 1.0, 0.03))) for k in range(2)])
emit('chain', [fin(mix((krpg('handleCoins', 0.8), 1.0, 0), (whoosh(400, 2000, 0.2), 0.5, 0))), fin(mix((krpg('handleCoins2', 0.8), 1.0, 0), (whoosh(400, 2000, 0.2), 0.5, 0)))])
emit('shove', [fin(mix((kimp('impactSoft_medium', k, 0.9), 1.0, 0), (kimp('impactPunch_medium', k, 1.1), 0.5, 0))) for k in range(3)])
emit('zap', [fin(kdig('zap1')), fin(kdig('zap2'))])
emit('hurt', [fin(kimp('impactPunch_medium', k)) for k in range(4)])
emit('splat', [fin(mix((kimp('impactPunch_heavy', k), 1.0, 0), (kimp('impactSoft_heavy', (k + 2) % 5, 0.8), 0.8, 0.01))) for k in range(4)])
emit('clank', [fin(kimp('impactMetal_medium', k)) for k in range(3)])
emit('glass', [fin(kimp('impactGlass_heavy', k)) for k in range(2)])
emit('ricochet', [fin(verb(sine(3000 - k * 400, 900, 0.22) * env(int(0.22 * SR), 0.001, 0.08), 0.4, 0.2)) for k in range(2)])
emit('throw', [whoosh(600, 2200, 0.22)])
# ── pickups, UI, feedback
def clack(): return mix((lp(noise(0.035), 1400) * env(int(0.035 * SR), 0.0005, 0.008), 1.0, 0), (sine(260, 140, 0.03) * env(int(0.03 * SR), 0.0005, 0.008), 0.6, 0))
emit('pickup', fin(mix((clack(), 1.0, 0), (clack(), 0.9, 0.09), (kui('confirmation_002'), 0.35, 0.05))))  # a gear-up "chk-chk"
emit('swap', fin(krpg('metalClick')))
emit('charged', fin(kdig('powerUp7')))
emit('hit', fin(kui('tick_002', 1.0)))
emit('kill', fin(mix((sine(120, 50, 0.25) * env(int(0.25 * SR), 0.002, 0.07), 1.0, 0), (kui('confirmation_004'), 0.8, 0.02))))
emit('tick', fin(kui('tick_001')))
emit('go', fin(kdig('phaserUp6')))
emit('ui', fin(kui('click_002')))
emit('plop', fin(mix((kimp('impactSoft_heavy', 1, 0.7), 1.0, 0), (kimp('impactSoft_medium', 3, 0.6), 0.6, 0.03))))
emit('squish', fin(mix((kimp('impactSoft_heavy', 3, 0.55), 1.0, 0), (kimp('impactSoft_medium', 0, 0.5), 0.7, 0.04))))
# loudness targets (dB of the loudest 100 ms) so the runtime mix is even; then encode to mp3 (LAME, gapless header)
TARGET = {'pistol': -13, 'revolver': -11, 'shotgun': -10, 'smg': -15, 'nail': -15, 'boom': -9, 'signature': -8, 'pulse': -12, 'rocket': -13, 'buzz': -16,
  'pop': -15, 'land': -15, 'catch': -19, 'flick': -21, 'wall': -17, 'bail': -14, 'grind': -17, 'rollloop': -14, 'grindloop': -14,
  'whoosh': -17, 'heavy': -16, 'slash': -16, 'chain': -18, 'shove': -16, 'zap': -15, 'hurt': -15, 'splat': -13, 'clank': -17, 'glass': -16, 'ricochet': -19, 'throw': -19,
  'pickup': -17, 'swap': -22, 'charged': -15, 'hit': -17, 'kill': -14, 'tick': -20, 'go': -15, 'ui': -20, 'plop': -12, 'squish': -12}
out = {}
for n, c in M.items():
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(OUT, f'{n}_0.wav'), '-f', 'f32le', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, np.float32); w = int(0.1 * SR); e = np.convolve(a ** 2, np.ones(w) / w, 'valid') if len(a) > w else np.array([np.mean(a ** 2)])
    lvl = 10 * np.log10(max(float(e.max()), 1e-9)); out[n] = {'n': c, 'g': round(10 ** ((TARGET.get(n, -16) - lvl) / 20), 3)}
    for k in range(c):
        src = os.path.join(OUT, f'{n}_{k}.wav'); subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-c:a', 'libmp3lame', '-b:a', '96k', os.path.join(OUT, f'{n}_{k}.mp3')], check=True); os.remove(src)
json.dump(out, open(os.path.join(OUT, 'manifest.json'), 'w'), separators=(',', ':'))
print('sfx:', len(M), 'sounds,', sum(M.values()), 'files')
