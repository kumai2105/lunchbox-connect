# Visual direction — revision 2

## Why the first version read as a platform, not a restaurant

I reviewed how Dubai restaurants in Jazeel's world actually build their sites — Orfali Bros,
Bait Maryam, Al Safadi, Ninive, and Jazeel's own DSO competitor Khobzah W Fakhaara. Four patterns
run through all of them, and revision 1 had none of them.

| What Dubai restaurant sites do | What revision 1 did |
|---|---|
| **A full-height opening frame.** Ninive opens on a full-screen image with the logo over it. Al Safadi opens on a rotating food carousel. Bait Maryam opens on a looping video. | A small text block in a white box, next to an empty grey rectangle. |
| **Arabic used as display typography.** Bait Maryam's headline is *"Your Home, Away From Home بيتك ومطرحك"*. Al Safadi's catering heading is *"وبتبقى الطعمة الطيبة / As Tasty As Ever"*. The two scripts sit together as one piece of design. | Arabic existed only as a separate translated page. On the English site there was no Arabic at all. |
| **Warm or dark grounds, big type, full-bleed bands.** Colour runs edge to edge; sections are few and large. | Near-white paper, thin grey borders, 15px text, bordered cards in a 3-up grid, breadcrumbs, definition lists. |
| **Uppercase letterspaced navigation, few items, one loud CTA.** Ninive: EVENTS · PRIVATE EVENTS · MENU · RESERVATION · CONTACT, then "MAKE A RESERVATION". | Nine sentence-case links in a light grey bar, three equal-weight buttons. |

The root cause is diagnosable in one sentence: **we have no photography, and I compensated with
structure.** Cards, borders, tables and definition lists are the vocabulary of admin tools and
reports — so the site came out looking like one. The right compensation for missing photography is
atmosphere built from colour, scale, type and motif, not more boxes.

## The revision

**Palette — charcoal and fire, not cream and terracotta.** Jazeel's kitchen is a charcoal grill;
the palette comes from that rather than from generic "Arabian" decoration.

| Token | Light | Dark | Role |
|---|---|---|---|
| `ember` | `#1a1512` | `#120e0c` | The deep ground the hero and pillar bands sit on |
| `char` | `#241d18` | `#1b1512` | Secondary dark band |
| `bone` | `#f6f1e8` | `#15110f` | Warm reading ground — limestone, not cream |
| `flame` | `#c2571f` | `#e0783d` | The single loud accent: charcoal glow |
| `olive` | `#5c6b45` | `#8fa06d` | Quiet secondary — za'atar, olive, sumac leaf |
| `gold` | `#b98b34` | `#d5a94e` | Rules, small marks, the motif |

**Type — four faces, two scripts, treated as equals.**

- `Fraunces` — Latin display. Warm, high-contrast, a little wonky. Not Playfair, not Cormorant.
- `Amiri` — Arabic display. A real naskh face, so the Arabic lockups are typeset rather than
  rendered in a system fallback.
- `Karla` — Latin body and the uppercase letterspaced labels.
- `IBM Plex Sans Arabic` — Arabic body.

Self-hosted through `next/font`, so there is no third-party request and no layout shift.

**Layout — bands, not cards.**

- The homepage opens on a **full-height ember frame** carrying the bilingual name lockup, one line
  of position, hours and address, and two calls to action. It is built from colour, a charcoal-glow
  gradient, a fine gold eight-point motif at 3% opacity, and film grain — no photograph. **When the
  owner uploads a hero photograph it slides in behind the same lockup with a scrim**, and nothing
  else about the page changes.
- The three commercial pillars become **three full-bleed bands**, alternating ember and bone, each
  with a bilingual heading, one sentence and one call to action — the treatment Ninive gives private
  events, rather than a three-up card grid.
- The menu is a **printed-menu list**: large category headings, dotted leaders, prices set in
  tabular figures on the right. No bordered item cards.
- Navigation is **uppercase, letterspaced, seven items**. About and Gallery move to the footer, so
  the bar carries only what a visitor is actually choosing between. Weddings, Corporate and Catering
  each keep their own top-level slot — they are not folded into a "Services" item.
- Contact and hours sit on a dark band with large type, the way a venue's closing frame does.

**What has not changed.** Every evidence rule from the blueprint stands: no invented facts, no stock
or generated imagery, no rating, no halal claim, publication gates enforced in code, the same
content model, the same admin, the same 72 end-to-end checks. This revision changes how the site
looks and how it is composed — not what it is allowed to say.
