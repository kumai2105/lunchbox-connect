"""
Import the owner-supplied photographs into public/uploads and the gallery table.

Everything here is one of the 21 files the owner sent on 2 September 2026. Nothing is
stock, nothing is generated, and nothing is used that he did not send.

Three things happen to each file:

  1. EXIF is stripped. The originals carry capture timestamps, camera serial numbers and
     in some cases lens data. None of that belongs on a public web server.
  2. It is resized to at most 2400px on the long edge and saved as a single JPEG. The
     originals are 11-23 MB; nothing on a web page needs that. No WebP copies are written
     — next/image negotiates format and size at request time, so a second set on disk
     would never be served.
  3. It is registered in the gallery table with alt text in both languages.

HELD BACK: nine files show shisha pipes in frame. Referring to tobacco online is the
open legal question in the content register (item 10), and a photograph of a pipe is a
more literal display than the word. They are listed at the bottom with the reason, and
are imported as UNPUBLISHED so they are one switch away once counsel has answered.
"""
import os
import sqlite3
from datetime import datetime, timezone
from PIL import Image

ROOT = "/home/claude/projects/jazeel-web"
SRC = "/home/claude/photos"
OUT = os.path.join(ROOT, "public/uploads")
DB = os.path.join(ROOT, "data/jazeel.db")
MAX_EDGE = 2400

# (file, slug, pillar, alt_en, alt_ar, caption_en, caption_ar, publish)
PHOTOS = [
    # ---------------------------------------------------------------- terrace
    ("batch2/15-terrace-umbrellas-wide.jpg", "terrace-umbrellas", "venue",
     "The outdoor terrace at Jazeel, shaded by a canopy of coloured umbrellas, with trees, "
     "flowers and hanging birdcages",
     "تراس جزيل الخارجي تحت مظلات ملوّنة، بين الأشجار والزهور وأقفاص العصافير المعلّقة",
     "The terrace", "التراس", True),
    ("batch2/20-terrace-empty-tables.jpg", "terrace-tables", "venue",
     "Tables set under the umbrella canopy on the outdoor terrace",
     "طاولات مجهّزة تحت مظلات التراس الخارجي",
     "Outdoor seating", "الجلسات الخارجية", True),
    ("batch2/19-terrace-canopy-lamp.jpg", "terrace-lamp", "venue",
     "A caged lamp hanging beneath the coloured umbrellas of the terrace canopy",
     "مصباح معلّق تحت مظلات التراس الملوّنة",
     None, None, True),
    # ---------------------------------------------------------------- food
    ("batch1/10-chef-platters.jpg", "chef-platters", "catering",
     "A Jazeel chef behind two large platters — roast lamb on spiced rice, and vegetables "
     "with potato and aubergine",
     "أحد طهاة جزيل خلف صينيتين كبيرتين من الأرز باللحم والخضار",
     "Prepared for a large party", "معدّة لمناسبة كبيرة", True),
    ("batch1/01-ouzi-tray-ghee.jpg", "ouzi-tray", "catering",
     "A large tray of ouzi — lamb over spiced rice with nuts — being finished at the table",
     "صينية أوزي كبيرة من اللحم والأرز بالمكسّرات",
     "Ouzi, served on the tray", "الأوزي كما يُقدّم على الصينية", True),
    # ---------------------------------------------------------------- celebrations
    ("batch2/21-cake-sword.jpg", "cake-sword", "wedding",
     "A celebration cake being cut with a ceremonial sword in the dining room",
     "تقطيع كعكة الاحتفال بالسيف في صالة المطعم",
     "A celebration at Jazeel", "احتفال في جزيل", True),
    ("batch1/08-anniversary-cake.jpg", "anniversary-cake", "restaurant",
     "The Jazeel team gathered around an anniversary cake",
     "فريق جزيل حول كعكة الذكرى السنوية",
     "The team", "الفريق", True),
    ("batch2/18-family-table-arch.jpg", "family-long-table", "wedding",
     "A family group seated along a long table set for a celebration",
     "عائلة مجتمعة حول طاولة طويلة في مناسبة",
     "A family gathering", "لمّة عائلية", True),
    # ---------------------------------------------------------------- live music
    ("batch2/14-male-singer-gold.jpg", "singer-male", "restaurant",
     "A singer performing live at Jazeel",
     "مطرب يحيي أمسية في جزيل",
     "Live music", "موسيقى حيّة", True),
    ("batch2/11-singer-black-arches.jpg", "singer-black", "restaurant",
     "A singer performing beside the keyboard player during an evening at Jazeel",
     "مطربة تغنّي إلى جانب عازف الأورغ في إحدى أمسيات جزيل",
     None, None, True),
    ("batch1/02-singer-portrait.jpg", "singer-portrait", "restaurant",
     "A singer performing during an evening at Jazeel",
     "مطربة تحيي إحدى أمسيات جزيل",
     None, None, True),
    ("batch2/17-singer-fringe-stage.jpg", "singer-stage", "wedding",
     "A singer on the stage during a celebration, with guests seated at the tables",
     "مطربة على المسرح خلال حفل والضيوف حول الطاولات",
     None, None, True),
    # ------------------------------------------------- held: shisha visible in frame
    ("batch1/05-room-B-full-stage.jpg", "room-full-stage", "restaurant",
     "The indoor dining room full for an evening, with a singer on the stage",
     "صالة المطعم ممتلئة في إحدى الأمسيات والمطربة على المسرح",
     "The dining room", "صالة المطعم", False),
    ("batch1/06-room-B-band-crowd.jpg", "room-band-crowd", "restaurant",
     "The dining room during a live performance, guests seated throughout",
     "الصالة أثناء وصلة حيّة والضيوف حول الطاولات",
     None, None, False),
    ("batch1/07-room-B-wide.jpg", "room-wide", "restaurant",
     "A wide view of the indoor dining room during an evening",
     "منظر واسع لصالة المطعم في إحدى الأمسيات",
     None, None, False),
    ("batch1/03-room-A-dancing.jpg", "room-dancing", "wedding",
     "Guests up and dancing between the tables during a celebration",
     "الضيوف يرقصون بين الطاولات خلال حفل",
     None, None, False),
    ("batch1/09-dabke-drummer.jpg", "dabke-drummer", "wedding",
     "A drummer playing as a guest dances during a celebration",
     "عازف الطبل يرافق أحد الضيوف في الرقص خلال حفل",
     None, None, False),
    ("batch1/04-guests-group-portrait.jpg", "guests-portrait", "wedding",
     "Guests posing together during a celebration",
     "ضيوف يلتقطون صورة تذكارية خلال حفل",
     None, None, False),
    ("batch2/12-room-C-wide-packed.jpg", "room-arches-wide", "restaurant",
     "The dining room full during an evening with live music",
     "الصالة ممتلئة في أمسية بموسيقى حيّة",
     None, None, False),
    ("batch2/13-long-table-guests.jpg", "long-table-guests", "wedding",
     "A long table of guests during a celebration",
     "طاولة طويلة من الضيوف خلال حفل",
     None, None, False),
    ("batch2/16-couple-celebrating.jpg", "couple-celebrating", "wedding",
     "Guests celebrating together at the table",
     "ضيوف يحتفلون حول الطاولة",
     None, None, False),
]


def process(rel: str, slug: str):
    src = os.path.join(SRC, rel)
    im = Image.open(src)
    im = im.convert("RGB")  # drops the EXIF block entirely
    w, h = im.size
    if max(w, h) > MAX_EDGE:
        r = MAX_EDGE / max(w, h)
        im = im.resize((round(w * r), round(h * r)), Image.LANCZOS)
    jpg = os.path.join(OUT, f"{slug}.jpg")
    im.save(jpg, "JPEG", quality=82, optimize=True, progressive=True)
    return im.size, os.path.getsize(jpg)


os.makedirs(OUT, exist_ok=True)
conn = sqlite3.connect(DB)
conn.execute("delete from gallery_images")
now = datetime.now(timezone.utc).isoformat()
total_j = 0
for i, (rel, slug, pillar, alt_en, alt_ar, cap_en, cap_ar, pub) in enumerate(PHOTOS):
    (w, h), sj = process(rel, slug)
    total_j += sj
    conn.execute(
        """insert into gallery_images
           (pillar, file_path, width, height, alt_en, alt_ar, caption_en, caption_ar,
            credit, sort, published, updated_at)
           values (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (pillar, f"/uploads/{slug}.jpg", w, h, alt_en, alt_ar, cap_en, cap_ar,
         None, (i + 1) * 10, 1 if pub else 0, now),
    )
    flag = "" if pub else "   [HELD — shisha in frame]"
    print(f"{slug:22} {w}x{h}  {sj/1024:6.0f} KB{flag}")
conn.commit()

pub = sum(1 for p in PHOTOS if p[7])
print(f"\n{len(PHOTOS)} imported, {pub} published, {len(PHOTOS)-pub} held")
print(f"total on disk: {total_j/1e6:.1f} MB")
