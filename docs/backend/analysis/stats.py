"""Pure-Python trend statistics used by analyze_v2.py (no third-party dependencies)."""
import math, random
from collections import Counter

# ---------- distributions ----------
def norm_sf2(z):
    """Two-sided normal p-value."""
    return math.erfc(abs(z) / math.sqrt(2))

def _betacf(a, b, x):
    tiny = 1e-30
    c = 1.0; d = 1 - (a + b) * x / (a + 1); d = 1 / (d if abs(d) > tiny else tiny); h = d
    for m in range(1, 300):
        m2 = 2 * m
        aa = m * (b - m) * x / ((a - 1 + m2) * (a + m2))
        d = 1 + aa * d; d = 1 / (d if abs(d) > tiny else tiny); c = 1 + aa / c; c = c if abs(c) > tiny else tiny; h *= d * c
        aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + 1 + m2))
        d = 1 + aa * d; d = 1 / (d if abs(d) > tiny else tiny); c = 1 + aa / c; c = c if abs(c) > tiny else tiny
        de = d * c; h *= de
        if abs(de - 1) < 1e-13:
            break
    return h

def ibeta(x, a, b):
    if x <= 0: return 0.0
    if x >= 1: return 1.0
    front = math.exp(math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log(1 - x))
    return front * _betacf(a, b, x) / a if x < (a + 1) / (a + b + 2) else 1 - front * _betacf(b, a, 1 - x) / b

def t_sf2(t, df):
    """Two-sided Student-t p-value."""
    return ibeta(df / (df + t * t), df / 2, 0.5)

def t_crit(df, alpha=0.05):
    lo, hi = 0.0, 100.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if t_sf2(mid, df) > alpha: lo = mid
        else: hi = mid
    return (lo + hi) / 2

# ---------- basic helpers ----------
def mean(v): return sum(v) / len(v)

def sd(v):
    m = mean(v); return math.sqrt(sum((a - m) ** 2 for a in v) / (len(v) - 1))

def acf(v, k):
    n = len(v); m = mean(v); den = sum((a - m) ** 2 for a in v)
    if den <= 0 or k >= n: return 0.0
    return sum((v[i] - m) * (v[i + k] - m) for i in range(n - k)) / den

def rankdata(v):
    order = sorted(range(len(v)), key=lambda i: v[i]); ranks = [0.0] * len(v); i = 0
    while i < len(v):
        j = i
        while j + 1 < len(v) and v[order[j + 1]] == v[order[i]]: j += 1
        r = (i + j) / 2 + 1
        for k in range(i, j + 1): ranks[order[k]] = r
        i = j + 1
    return ranks

def pearson(a, b):
    ma, mb = mean(a), mean(b)
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    den = math.sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))
    return num / den if den > 0 else float('nan')

def bh(pvals):
    """Benjamini–Hochberg q-values, same rule as lib/analysis/multiple-testing.ts."""
    idx = [i for i, p in enumerate(pvals) if p is not None]
    m = len(idx); q = [None] * len(pvals); run = 1.0
    for r, i in reversed(list(enumerate(sorted(idx, key=lambda i: pvals[i])))):
        run = min(run, pvals[i] * m / (r + 1)); q[i] = min(1.0, run)
    return q

# ---------- trend estimators ----------
def ols(x, y):
    n = len(x); mx = mean(x); my = mean(y)
    sxx = sum((a - mx) ** 2 for a in x); sxy = sum((a - mx) * (b - my) for a, b in zip(x, y))
    b = sxy / sxx; a = my - b * mx
    resid = [yy - (a + b * xx) for xx, yy in zip(x, y)]
    sse = sum(e * e for e in resid); sst = sum((yy - my) ** 2 for yy in y)
    df = n - 2
    se = math.sqrt(sse / df / sxx) if sse > 0 else 0.0
    p = t_sf2(b / se, df) if se > 0 else None
    q = t_crit(df)
    return dict(slope=b, intercept=a, se=se, p=p, ci=(b - q * se, b + q * se), r2=(1 - sse / sst) if sst > 0 else None, resid=resid, sxx=sxx, sigma=math.sqrt(sse / df))

def sen_slopes(x, y):
    return sorted((y[j] - y[i]) / (x[j] - x[i]) for i in range(len(x)) for j in range(i + 1, len(x)) if x[j] != x[i])

def median(v):
    s = sorted(v); n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2

def mk_var(y):
    n = len(y)
    return (n * (n - 1) * (2 * n + 5) - sum(c * (c - 1) * (2 * c + 5) for c in Counter(y).values())) / 18

def mk_s(y):
    n = len(y)
    return sum((y[j] > y[i]) - (y[j] < y[i]) for i in range(n) for j in range(i + 1, n))

def _z(s, var):
    if var <= 0: return 0.0
    return (s - 1) / math.sqrt(var) if s > 0 else (s + 1) / math.sqrt(var) if s < 0 else 0.0

def mann_kendall(y):
    n = len(y); s = mk_s(y); var = mk_var(y)
    return dict(S=s, tau=s / (n * (n - 1) / 2), var=var, p=norm_sf2(_z(s, var)) if var > 0 else None)

def sen_ci(x, y, alpha=0.05):
    """Gilbert (1987) non-parametric confidence interval for Sen's slope."""
    sl = sen_slopes(x, y); N = len(sl); var = mk_var(y)
    C = 1.959964 * math.sqrt(var)
    m1 = int(round((N - C) / 2)); m2 = int(round((N + C) / 2))
    lo = sl[max(0, min(N - 1, m1 - 1))]; hi = sl[max(0, min(N - 1, m2))]
    return median(sl), (lo, hi)

def hamed_rao(x, y, alpha=0.05):
    """Modified Mann–Kendall (Hamed & Rao 1998): variance inflated by significant lags of ranked Sen-detrended data."""
    n = len(y); s = mk_s(y); var = mk_var(y)
    b = median(sen_slopes(x, y))
    det = [yy - b * xx for xx, yy in zip(x, y)]
    rk = rankdata(det); bound = 1.959964 / math.sqrt(n); acc = 0.0
    for k in range(1, n - 2):
        r = acf(rk, k)
        if abs(r) > bound: acc += (n - k) * (n - k - 1) * (n - k - 2) * r
    factor = 1 + 2 / (n * (n - 1) * (n - 2)) * acc
    factor = max(factor, 1e-3)
    return dict(p=norm_sf2(_z(s, var * factor)) if var > 0 else None, factor=factor)

def tfpw(x, y):
    """Trend-free pre-whitening (Yue et al. 2002)."""
    b = median(sen_slopes(x, y))
    det = [yy - b * xx for xx, yy in zip(x, y)]
    r1 = acf(det, 1)
    yp = [det[i] - r1 * det[i - 1] + b * x[i] for i in range(1, len(det))]
    return dict(p=mann_kendall(yp)['p'], r1=r1)

def pettitt(x, y):
    """Pettitt (1979) single change-point test. Returns first year of the new regime."""
    n = len(y); best = (0, None)
    for t in range(1, n):
        u = sum((y[i] > y[j]) - (y[i] < y[j]) for i in range(t) for j in range(t, n))
        if abs(u) > abs(best[0]): best = (u, t)
    K, t = abs(best[0]), best[1]
    p = min(1.0, 2 * math.exp(-6 * K * K / (n ** 3 + n ** 2)))
    return dict(year=x[t], p=p, before=mean(y[:t]), after=mean(y[t:]))

def block_bootstrap_ci(x, y, B=2000, seed=7):
    """Moving-block residual bootstrap 95% CI for the OLS slope (block length ~ n^(1/3))."""
    rnd = random.Random(seed); n = len(x); L = max(2, round(n ** (1 / 3)))
    o = ols(x, y); fit = [yy - e for yy, e in zip(y, o['resid'])]; res = o['resid']; out = []
    mx = mean(x); sxx = o['sxx']
    for _ in range(B):
        r = []
        while len(r) < n:
            s = rnd.randrange(0, n - L + 1); r += res[s:s + L]
        yb = [f + e for f, e in zip(fit, r[:n])]; my = mean(yb)
        out.append(sum((a - mx) * (b - my) for a, b in zip(x, yb)) / sxx)
    out.sort()
    return (out[int(0.025 * B)], out[int(0.975 * B) - 1]), L

def min_detectable_trend(o, n, r1):
    """Slope detectable with 80% power at alpha 0.05 (two-sided), inflated for AR(1) residuals."""
    infl = math.sqrt((1 + r1) / (1 - r1)) if r1 > 0 else 1.0
    return (1.959964 + 0.841621) * o['sigma'] / math.sqrt(o['sxx']) * infl
