# Brand

Everything here is measured from the logo file the owner supplied on 31 August 2026
(`373 × 189` JPEG, white ground). Nothing is invented, and the two adjustments that were
made are stated below with the reason.

---

## The logo

**Source.** One small JPEG. There is no vector original — see item 12b in the content
register; getting it from whoever drew the mark is still worth doing, for print and signage.

**What was done to it.** The white ground was removed by measuring how far each pixel had
been pulled off white, which recovers a proper transparency edge rather than a cut-out
halo. The colour was un-premultiplied so edge pixels carry the ink's own colour instead of
a wash of white. JPEG stores colour at quarter resolution, which is what caused the red
fringes and the mottling in the gold, so the colour channels were smoothed while the
lightness was left alone. The coverage map was then scaled up ten times and its contrast
restored, which is what a vector tracer does to an edge — except that this keeps the
internal gradient of the calligraphy, which a flat trace would throw away.

Nothing was redrawn, and no detail was added that was not in the file.

| File | What it is | Used for |
|---|---|---|
| `public/brand/logo.png` | 1600 px, transparent, original colours | Header on light grounds |
| `public/brand/logo-reversed.png` | Same, teal lifted to bone | Header on the dark hero, footer |
| `public/brand/logo.svg` | Flat two-colour vector trace | Print, large formats, anywhere a true vector is needed |
| `public/brand/mark.png` | The ج cluster, square | App icon |
| `public/apple-touch-icon.png` | 180 px | iOS home screen |
| `public/favicon.png` | 32 px | Browser tab |
| `public/brand/og.png` | 1200 × 630 | Link previews when the site is shared |

The reversed lockup exists because the mark's petrol teal is nearly the value of the dark
ground and disappears on it. Lifting the teal to bone and leaving the gold as gold is the
ordinary way a two-colour mark is handled on a dark ground.

The SVG is a **flat** two-colour trace: it does not carry the gradient in the calligraphy.
Use the PNGs on screen and keep the SVG for print and for sizes past 1600 px.

---

## Colour

Two ink families were measured in the logo: **#1c494c** deep petrol teal and **#a08d4c**
antique gold.

| Token | Value | Role |
|---|---|---|
| `--color-brand-night` | `#0c2426` | Darkest ground — heroes, the homepage |
| `--color-brand-pine` | `#143a3a` | Second dark ground — footer, alternating bands |
| `--color-brand-bone` | `#f4efe4` | Light ground |
| `--color-brand-linen` | `#fffdf8` | Lightest ground |
| `--color-brand-teal` | `#1d4a4e` | The logo's teal — buttons, links, accents on light |
| `--color-brand-teal-soft` | `#4b787b` | The lighter teal in the mark — secondary lines |
| `--color-brand-gold` | `#bda65f` | Accent on dark grounds, labels |
| `--color-brand-gold-deep` | `#a08d4c` | The logo's own gold — rules, decoration |
| `--color-brand-ink` | `#15282a` | Body text |
| `--color-brand-ink-soft` | `#4d5f5e` | Secondary text |

**Two values are adjusted rather than sampled, both for legibility.**

`--color-brand-gold` lifts the logo's gold so label text clears the 4.5:1 minimum on both
dark grounds — 6.78:1 on night, 5.18:1 on pine. The logo's own gold measures 3.78:1 on
pine, which fails. The unmodified value is kept as `--color-brand-gold-deep` and used for
rules and decoration, where contrast minimums do not apply.

`--color-brand-night` and `--pine` are darker than any ink in the logo, because a ground
cannot sit at the same value as the type on it.

**One rule that is not obvious.** Gold never carries text on a light ground. It measures
2.1:1 on bone, far below the minimum. On light grounds it appears only as rules and
underlines; teal is the light-ground accent. This is enforced by eye, not by the compiler —
if you add `text-brand-gold` to something on a bone or linen band, it will be unreadable.

Measured contrasts, for reference:

| | on night | on pine | on bone |
|---|---|---|---|
| bone | 14.1:1 | 10.8:1 | — |
| gold | 6.8:1 | 5.2:1 | 2.1:1 ✗ |
| teal | — | — | 8.6:1 |
| ink | — | — | 13.4:1 |
| ink-soft | — | — | 5.9:1 |

---

## Type

**Still ours, not Jazeel's.** No typeface was specified with the logo. If a designer chose
faces for the mark, send them and they replace these in `src/lib/fonts.ts` alone.

| Role | Face |
|---|---|
| English display | Fraunces (variable, SOFT/WONK axes) |
| English text | Karla |
| Arabic display | Amiri |
| Arabic text | IBM Plex Sans Arabic |

---

## Changing any of this

The palette lives in one `@theme` block in `src/app/globals.css`. Nothing else in the
codebase hard-codes a colour, so replacing those ten values changes the whole site. The
four faces live in `src/lib/fonts.ts`. Both are deliberately the only places to edit.

If you change a colour, re-check the contrast table above before shipping — the site
currently passes AA everywhere, and it is easy to lose that with one adjustment.
