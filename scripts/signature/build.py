#!/usr/bin/env python3
"""
Jazeel email-signature banner.

Renders a single PNG at 2000 x 760 (intended to sit at ~700 CSS px wide in a mail
client, so it is a 3x asset and stays crisp on a retina screen).

Everything in it is either VERIFIED in the Phase 1 dossier or was supplied by the
owner. Nothing is invented. See NOTES at the bottom of this file for the provenance
of each line.

Built as HTML and screenshotted with Chromium rather than drawn in PIL, because the
curve, the real brand fonts and the icon paths all come out right that way.
"""

import base64, json, pathlib, subprocess, sys

ROOT = pathlib.Path("/home/claude/projects/jazeel-web")
SCRATCH = pathlib.Path(
    "/tmp/claude-0/-home-claude/b46d5157-25ce-5b3f-a616-cf5002d5b972/scratchpad"
)
FONTS = SCRATCH / "fonts"
OUT = SCRATCH / "signature"
OUT.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------- the photo
# Owner's choice, 19 Sep 2026: the outdoor umbrella terrace, not the room shot.
#
# Only the right ~1020 x 540 of the banner is actually visible through the clip
# path, so the source is cropped to that shape and composited onto a 2000 x 540
# canvas (at 2x) rather than letting `background-size: cover` throw most of the
# frame away. The left half of the canvas is never seen.
PHOTO_SRC = ROOT / "public/media/terrace-umbrellas.jpg"
PHOTO_CROP = (60, 160, 2100, 1239)   # drops the blurred green mass on the right edge


def prepare_photo() -> pathlib.Path:
    from PIL import Image

    dst = SCRATCH / "photo.jpg"
    panel_w, panel_h = 2040, 1080          # 2x of the 1020 x 540 visible region
    canvas_w, canvas_h = 4000, 1080        # 2x of the 2000 x 540 element
    crop = Image.open(PHOTO_SRC).convert("RGB").crop(PHOTO_CROP)
    crop = crop.resize((panel_w, panel_h), Image.LANCZOS)
    canvas = Image.new("RGB", (canvas_w, canvas_h), (12, 36, 38))
    canvas.paste(crop, (canvas_w - panel_w, 0))
    canvas.save(dst, quality=93)
    return dst


def b64(path: pathlib.Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


# ---------------------------------------------------------------- brand palette
NIGHT = "#0c2426"
PINE = "#143a3a"
TEAL = "#1d4a4e"
GOLD = "#bda65f"
GOLD_DEEP = "#a08d4c"
BONE = "#f4efe4"
LINEN = "#fffdf8"
INK = "#15282a"
INK_SOFT = "#4d5f5e"

# ------------------------------------------------------------------- the facts
PHONE_DISPLAY = "+971 4 323 2797"
PHONE_TEL = "+97143232797"
WHATSAPP_DISPLAY = "+971 55 665 4411"
WHATSAPP_INTL = "971556654411"
EMAIL = "management@jazeeluae.com"
INSTAGRAM = "@jazeel.dxb"
ADDRESS = "Semmer Villas Community Centre, Dubai Silicon Oasis"
HOURS_TOP = "Open daily"
HOURS_MAIN = "9am<br>&ndash;&nbsp;2am"   # owner-stated 19 Sep 2026; listings still say 10:00 (Zomato 9:30)

PILLARS = [
    (
        "restaurant",
        "Restaurant &amp; Café",
        "Arabic and Levantine cooking, indoors and on the terrace.",
    ),
    (
        "celebration",
        "Weddings &amp; Celebrations",
        "Weddings, graduations and private occasions.",
    ),
    (
        "catering",
        "Catering &amp; Corporate",
        "Off-site catering, meetings and company events.",
    ),
]

# ------------------------------------------------------------------------ icons
# Single-colour 24x24 paths, stroked or filled as noted. Drawn to sit on a circle.
ICONS = {
    "phone": """<path d="M6.6 3.5h3l1.5 3.7-1.9 1.1a11 11 0 0 0 4.5 4.5l1.1-1.9 3.7 1.5v3a1.7 1.7 0 0 1-1.9 1.7A14.6 14.6 0 0 1 4.9 5.4 1.7 1.7 0 0 1 6.6 3.5Z"
            fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>""",
    "whatsapp": """<path d="M12 2.6a9.3 9.3 0 0 0-8 14.1L2.7 21.4l4.8-1.3A9.3 9.3 0 1 0 12 2.6Zm0 1.9a7.4 7.4 0 0 1 6 11.8l-.3.4.6 2.1-2.2-.6-.4.2A7.4 7.4 0 1 1 12 4.5Z" fill="currentColor"/>
                  <path d="M9.3 7.8c-.2-.5-.4-.5-.6-.5h-.5a1 1 0 0 0-.7.35 2.1 2.1 0 0 0-.65 1.55 3.7 3.7 0 0 0 .78 1.95 8.3 8.3 0 0 0 3.25 2.85c1.6.63 1.93.5 2.28.47a1.9 1.9 0 0 0 1.25-.88 1.55 1.55 0 0 0 .1-.88c-.05-.08-.17-.13-.35-.22s-1.08-.53-1.25-.6-.3-.08-.42.1-.48.6-.59.73-.22.13-.4.05a6.7 6.7 0 0 1-1.96-1.21 7.4 7.4 0 0 1-1.36-1.69c-.14-.24 0-.37.11-.49l.33-.38a1.5 1.5 0 0 0 .22-.37.4.4 0 0 0 0-.38c-.06-.13-.42-1.02-.57-1.4Z" fill="currentColor"/>""",
    "mail": """<rect x="3" y="5.2" width="18" height="13.6" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.7"/>
               <path d="m3.8 6.6 7.3 5.4a1.5 1.5 0 0 0 1.8 0l7.3-5.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>""",
    "instagram": """<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" stroke-width="1.7"/>
                    <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.7"/>
                    <circle cx="17.1" cy="6.9" r="1.25" fill="currentColor"/>""",
    "pin": """<path d="M12 21.2s7-6.1 7-11.1a7 7 0 1 0-14 0c0 5 7 11.1 7 11.1Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
              <circle cx="12" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/>""",
    # bottom-band pillar icons
    "restaurant": """<path d="M4.2 7.6h11.4v5.6a5.7 5.7 0 0 1-11.4 0Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                     <path d="M15.6 8.8h2.1a2.5 2.5 0 0 1 0 5h-2.1" fill="none" stroke="currentColor" stroke-width="1.6"/>
                     <path d="M3 20.2h14.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>""",
    "celebration": """<path d="M12 2.8 13.85 9.1 20.2 11 13.85 12.9 12 19.2 10.15 12.9 3.8 11 10.15 9.1Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>""",
    "catering": """<path d="M2.4 18.4h19.2M4.8 18.4a7.2 7.2 0 0 1 14.4 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                   <circle cx="12" cy="5" r="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/>
                   <path d="M12 6.4v2.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>""",
}


def icon(name: str, size: int) -> str:
    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" '
        f'xmlns="http://www.w3.org/2000/svg">{ICONS[name]}</svg>'
    )


def contact_row(name, text, extra_class=""):
    return f"""
      <div class="row {extra_class}">
        <span class="ico">{icon(name, 30)}</span>
        <span class="txt">{text}</span>
      </div>"""


def pillar(key, head, body):
    return f"""
      <div class="pillar">
        <span class="pico">{icon(key, 38)}</span>
        <div class="ptext">
          <div class="phead">{head}</div>
          <div class="pbody">{body}</div>
        </div>
      </div>"""


prepare_photo()

HTML = f"""<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @font-face {{
    font-family: "Fraunces";
    src: url(data:font/ttf;base64,{b64(FONTS / "Fraunces.ttf")}) format("truetype");
    font-weight: 100 900;
  }}
  @font-face {{
    font-family: "Karla";
    src: url(data:font/ttf;base64,{b64(FONTS / "Karla.ttf")}) format("truetype");
    font-weight: 400 800;
  }}

  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{ width: 2000px; height: 760px; }}
  body {{ background: {LINEN}; font-family: "Karla", sans-serif; -webkit-font-smoothing: antialiased; }}

  .banner {{ position: relative; width: 2000px; height: 760px; overflow: hidden; background: {LINEN}; }}

  /* ---------------------------------------------------------------- photo */
  .photo-clip {{ position: absolute; inset: 0 0 220px 0; }}
  .photo {{
    position: absolute; inset: 0;
    background-image: url(data:image/jpeg;base64,{b64(SCRATCH / "photo.jpg")});
    background-size: cover; background-position: 50% 44%;
    filter: brightness(1.02) contrast(1.02) saturate(0.97);
    clip-path: path("M 1122,0 C 1066,196 1034,376 1038,540 L 2000,540 L 2000,0 Z");
  }}
  /* a whisper of night at the seam so the curve reads even over a bright frame */
  .photo-shade {{
    position: absolute; inset: 0;
    background: linear-gradient(100deg, rgba(12,36,38,0.34) 0%, rgba(12,36,38,0.06) 16%, rgba(12,36,38,0) 34%);
    clip-path: path("M 1122,0 C 1066,196 1034,376 1038,540 L 2000,540 L 2000,0 Z");
  }}
  .seam {{ position: absolute; inset: 0; }}

  /* ----------------------------------------------------------- left panel */
  .left {{ position: absolute; left: 76px; top: 52px; width: 960px; }}

  .lockup {{ display: flex; align-items: center; gap: 38px; }}
  .logo {{ width: 322px; height: auto; display: block; }}
  .divider {{ width: 3px; height: 134px; background: {GOLD}; opacity: .5; }}
  .tagline {{
    font-family: "Fraunces", serif;
    font-variation-settings: "opsz" 48, "wght" 460, "SOFT" 22, "WONK" 1;
    font-size: 42px; line-height: 1.26; color: {TEAL}; max-width: 680px;
    letter-spacing: -0.005em;
  }}
  .tagline em {{ font-style: normal; color: {GOLD_DEEP}; }}

  .contacts {{ margin-top: 54px; display: grid; grid-template-columns: 350px 1fr; row-gap: 26px; column-gap: 28px; }}
  .row {{ display: flex; align-items: center; gap: 20px; }}
  .row.wide {{ grid-column: 1 / -1; }}
  .ico {{
    width: 58px; height: 58px; flex: 0 0 58px; border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    background: {TEAL}; color: {BONE};
  }}
  .row.wide .ico {{ background: transparent; color: {GOLD_DEEP}; border: 3px solid rgba(160,141,76,.60); }}
  .txt {{ font-size: 32px; font-weight: 600; color: {INK}; letter-spacing: .002em; white-space: nowrap; }}
  .row.wide .txt {{ font-weight: 600; color: {TEAL}; font-size: 29px; }}

  /* ---------------------------------------------------------------- badge */
  .badge {{
    position: absolute; right: 92px; top: 372px;
    width: 208px; height: 208px; border-radius: 999px;
    background: {NIGHT}; border: 3px solid {GOLD};
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; color: {BONE}; z-index: 6;
    box-shadow: 0 10px 34px rgba(12,36,38,.38);
  }}
  .badge .b-top {{
    font-size: 19px; font-weight: 700; letter-spacing: .20em; text-transform: uppercase;
    color: {GOLD}; margin-bottom: 11px;
  }}
  .badge .b-main {{
    font-family: "Fraunces", serif;
    font-variation-settings: "opsz" 40, "wght" 520, "SOFT" 18, "WONK" 1;
    font-size: 39px; line-height: 1.12;
  }}

  /* ----------------------------------------------------------- bottom band */
  .band {{
    position: absolute; left: 0; right: 0; bottom: 0; height: 220px;
    background: {NIGHT}; overflow: hidden;
  }}
  .band-sweep {{
    position: absolute; inset: 0;
    background: {PINE};
    clip-path: path("M 1436,220 C 1558,174 1642,84 1700,0 L 2000,0 L 2000,220 Z");
    opacity: .42;
  }}
  .band-rule {{ position: absolute; left: 0; right: 0; top: 0; height: 4px; background: {GOLD}; opacity: .9; }}
  .pillars {{
    position: absolute; inset: 0; display: grid; grid-template-columns: repeat(3, 1fr);
    align-items: center; padding: 0 76px;
  }}
  .pillar {{ display: flex; align-items: center; gap: 26px; padding-right: 30px; position: relative; }}
  .pillar + .pillar {{ padding-left: 46px; }}
  .pillar + .pillar::before {{
    content: ""; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    width: 1px; height: 104px; background: rgba(189,166,95,.38);
  }}
  .pico {{
    width: 74px; height: 74px; flex: 0 0 74px; border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid rgba(189,166,95,.55); color: {GOLD};
  }}
  .phead {{
    font-size: 28px; font-weight: 700; color: {GOLD}; white-space: nowrap;
    letter-spacing: .045em; text-transform: uppercase; margin-bottom: 9px;
  }}
  .pbody {{ font-size: 27px; line-height: 1.30; color: rgba(244,239,228,.88); max-width: 500px; }}
</style></head>
<body>
  <div class="banner">
    <div class="photo-clip">
      <div class="photo"></div>
      <div class="photo-shade"></div>
    </div>

    <svg class="seam" width="2000" height="760" xmlns="http://www.w3.org/2000/svg">
      <path d="M 1122,0 C 1066,196 1034,376 1038,540" fill="none" stroke="{GOLD}" stroke-width="3" opacity="0.95"/>
    </svg>

    <div class="left">
      <div class="lockup">
        <img class="logo" src="data:image/png;base64,{b64(ROOT / "public/brand/logo.png")}" alt="">
        <div class="divider"></div>
        <div class="tagline">Arabic table.<br>Hosted occasions.<br><em>Catering across the UAE.</em></div>
      </div>

      <div class="contacts">
        {contact_row("phone", PHONE_DISPLAY)}
        {contact_row("mail", EMAIL)}
        {contact_row("whatsapp", WHATSAPP_DISPLAY)}
        {contact_row("instagram", INSTAGRAM)}
        {contact_row("pin", ADDRESS, "wide")}
      </div>
    </div>

    <div class="badge">
      <div class="b-top">{HOURS_TOP}</div>
      <div class="b-main">{HOURS_MAIN}</div>
    </div>

    <div class="band">
      <div class="band-sweep"></div>
      <div class="band-rule"></div>
      <div class="pillars">
        {"".join(pillar(*p) for p in PILLARS)}
      </div>
    </div>
  </div>
</body></html>
"""

html_path = OUT / "signature.html"
html_path.write_text(HTML, encoding="utf-8")

shot = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const b = await chromium.launch({{ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }});
  const p = await b.newPage({{ viewport: {{ width: 2000, height: 760 }}, deviceScaleFactor: 1 }});
  await p.goto('file://{html_path}');
  await p.waitForTimeout(700);
  await p.screenshot({{ path: '{OUT}/jazeel-signature.png' }});
  await b.close();
}})();
"""
(OUT / "shot.js").write_text(shot)
subprocess.run(["node", str(OUT / "shot.js")], cwd=str(ROOT), check=True)
print("wrote", OUT / "jazeel-signature.png")
