/**
 * Gallery registration for the twenty-one photographs the owner supplied on 2 September 2026.
 *
 * The files ship in `public/media` because they are seed content rather than runtime uploads —
 * `public/uploads` is git-ignored, being data added through the admin. The rows that register
 * them, however, only ever existed in whichever database `scripts/import-photos.py` happened to
 * be run against, and that file is git-ignored too. So a fresh clone had all twenty-one
 * photographs on disk with nothing pointing at them, and `tests/evidence.test.ts` read every one
 * of them as unregistered — which is exactly what that test is for: an unreferenced image file is
 * how a stock photograph would arrive.
 *
 * Every field below is transcribed from `scripts/import-photos.py`, which produced both the
 * processed files and the original rows. No alt text is rewritten, no caption is invented, and
 * the `published` flags are the owner's own, recorded there on his instruction. Width and height
 * are read from the shipped JPEGs. EXIF was stripped at import and `tests/evidence.test.ts`
 * checks it stayed stripped.
 *
 * SHISHA — nine of these show a pipe somewhere in frame and are published by owner decision of
 * 2 September 2026 (CLAUDE.md rule 6). The line drawn there is between incidental presence and
 * promotion: a photograph of a full room in which a pipe happens to stand documents an evening,
 * while naming shisha in a facility list promotes it. So these publish and `shisha_visible` stays
 * off.
 *
 * CONSENT — several frames show identifiable guests in close-up, and whether they may be
 * published is an open question for the owner (CLAUDE.md rule 7, open decision 1). These flags
 * reproduce the state he set; they do not settle that question. Resolving it means changing
 * `published` here, not deleting rows: the registration is the provenance record, and a file on
 * disk with no row is what this module exists to prevent.
 */

export interface SeedGalleryImage {
  /** restaurant | wedding | corporate | catering | brunch | venue */
  pillar: string;
  filePath: string;
  width: number;
  height: number;
  altEn: string;
  altAr: string;
  captionEn: string | null;
  captionAr: string | null;
  sort: number;
  published: boolean;
}

export const seedGallery: SeedGalleryImage[] = [
  /* ------------------------------------------------------------------ terrace */
  {
    pillar: "venue",
    filePath: "/media/terrace-umbrellas.jpg",
    width: 2400,
    height: 1600,
    altEn:
      "The outdoor terrace at Jazeel, shaded by a canopy of coloured umbrellas, with trees, flowers and hanging birdcages",
    altAr: "تراس جزيل الخارجي تحت مظلات ملوّنة، بين الأشجار والزهور وأقفاص العصافير المعلّقة",
    captionEn: "The terrace",
    captionAr: "التراس",
    sort: 10,
    published: true,
  },
  {
    pillar: "venue",
    filePath: "/media/terrace-tables.jpg",
    width: 1600,
    height: 2400,
    altEn: "Tables set under the umbrella canopy on the outdoor terrace",
    altAr: "طاولات مجهّزة تحت مظلات التراس الخارجي",
    captionEn: "Outdoor seating",
    captionAr: "الجلسات الخارجية",
    sort: 20,
    published: true,
  },
  {
    pillar: "venue",
    filePath: "/media/terrace-lamp.jpg",
    width: 1600,
    height: 2400,
    altEn: "A caged lamp hanging beneath the coloured umbrellas of the terrace canopy",
    altAr: "مصباح معلّق تحت مظلات التراس الملوّنة",
    captionEn: null,
    captionAr: null,
    sort: 30,
    published: true,
  },
  /* --------------------------------------------------------------------- food */
  {
    pillar: "catering",
    filePath: "/media/chef-platters.jpg",
    width: 2400,
    height: 1600,
    altEn:
      "A Jazeel chef behind two large platters — roast lamb on spiced rice, and vegetables with potato and aubergine",
    altAr: "أحد طهاة جزيل خلف صينيتين كبيرتين من الأرز باللحم والخضار",
    captionEn: "Prepared for a large party",
    captionAr: "معدّة لمناسبة كبيرة",
    sort: 40,
    published: true,
  },
  {
    pillar: "catering",
    filePath: "/media/ouzi-tray.jpg",
    width: 2400,
    height: 1600,
    altEn:
      "A large tray of ouzi — lamb over spiced rice with nuts — being finished at the table",
    altAr: "صينية أوزي كبيرة من اللحم والأرز بالمكسّرات",
    captionEn: "Ouzi, served on the tray",
    captionAr: "الأوزي كما يُقدّم على الصينية",
    sort: 50,
    published: true,
  },
  /* ------------------------------------------------------------- celebrations */
  {
    pillar: "wedding",
    filePath: "/media/cake-sword.jpg",
    width: 2400,
    height: 1600,
    altEn: "A celebration cake being cut with a ceremonial sword in the dining room",
    altAr: "تقطيع كعكة الاحتفال بالسيف في صالة المطعم",
    captionEn: "A celebration at Jazeel",
    captionAr: "احتفال في جزيل",
    sort: 60,
    published: true,
  },
  {
    pillar: "restaurant",
    filePath: "/media/anniversary-cake.jpg",
    width: 2400,
    height: 1600,
    altEn: "The Jazeel team gathered around an anniversary cake",
    altAr: "فريق جزيل حول كعكة الذكرى السنوية",
    captionEn: "The team",
    captionAr: "الفريق",
    sort: 70,
    published: true,
  },
  {
    pillar: "wedding",
    filePath: "/media/family-long-table.jpg",
    width: 2400,
    height: 1017,
    altEn: "A family group seated along a long table set for a celebration",
    altAr: "عائلة مجتمعة حول طاولة طويلة في مناسبة",
    captionEn: "A family gathering",
    captionAr: "لمّة عائلية",
    sort: 80,
    published: true,
  },
  /* --------------------------------------------------------------- live music */
  {
    pillar: "restaurant",
    filePath: "/media/singer-male.jpg",
    width: 1600,
    height: 2400,
    altEn: "A singer performing live at Jazeel",
    altAr: "مطرب يحيي أمسية في جزيل",
    captionEn: "Live music",
    captionAr: "موسيقى حيّة",
    sort: 90,
    published: true,
  },
  {
    pillar: "restaurant",
    filePath: "/media/singer-black.jpg",
    width: 2400,
    height: 1600,
    altEn: "A singer performing beside the keyboard player during an evening at Jazeel",
    altAr: "مطربة تغنّي إلى جانب عازف الأورغ في إحدى أمسيات جزيل",
    captionEn: null,
    captionAr: null,
    sort: 100,
    published: true,
  },
  {
    pillar: "restaurant",
    filePath: "/media/singer-portrait.jpg",
    width: 2400,
    height: 1600,
    altEn: "A singer performing during an evening at Jazeel",
    altAr: "مطربة تحيي إحدى أمسيات جزيل",
    captionEn: null,
    captionAr: null,
    sort: 110,
    published: true,
  },
  {
    pillar: "wedding",
    filePath: "/media/singer-stage.jpg",
    width: 1349,
    height: 2400,
    altEn: "A singer on the stage during a celebration, with guests seated at the tables",
    altAr: "مطربة على المسرح خلال حفل والضيوف حول الطاولات",
    captionEn: null,
    captionAr: null,
    sort: 120,
    published: true,
  },
  /* ------------------------ shisha visible in frame — published by owner decision */
  {
    pillar: "restaurant",
    filePath: "/media/room-full-stage.jpg",
    width: 2400,
    height: 1600,
    altEn: "The indoor dining room full for an evening, with a singer on the stage",
    altAr: "صالة المطعم ممتلئة في إحدى الأمسيات والمطربة على المسرح",
    captionEn: "The dining room",
    captionAr: "صالة المطعم",
    sort: 130,
    published: true,
  },
  {
    pillar: "restaurant",
    filePath: "/media/room-band-crowd.jpg",
    width: 2400,
    height: 1600,
    altEn: "The dining room during a live performance, guests seated throughout",
    altAr: "الصالة أثناء وصلة حيّة والضيوف حول الطاولات",
    captionEn: null,
    captionAr: null,
    sort: 140,
    published: true,
  },
  {
    pillar: "restaurant",
    filePath: "/media/room-wide.jpg",
    width: 2400,
    height: 1600,
    altEn: "A wide view of the indoor dining room during an evening",
    altAr: "منظر واسع لصالة المطعم في إحدى الأمسيات",
    captionEn: null,
    captionAr: null,
    sort: 150,
    published: true,
  },
  {
    pillar: "wedding",
    filePath: "/media/room-dancing.jpg",
    width: 2400,
    height: 1600,
    altEn: "Guests up and dancing between the tables during a celebration",
    altAr: "الضيوف يرقصون بين الطاولات خلال حفل",
    captionEn: null,
    captionAr: null,
    sort: 160,
    published: true,
  },
  {
    pillar: "wedding",
    filePath: "/media/dabke-drummer.jpg",
    width: 2400,
    height: 1600,
    altEn: "A drummer playing as a guest dances during a celebration",
    altAr: "عازف الطبل يرافق أحد الضيوف في الرقص خلال حفل",
    captionEn: null,
    captionAr: null,
    sort: 170,
    published: true,
  },
  {
    pillar: "wedding",
    filePath: "/media/guests-portrait.jpg",
    width: 2400,
    height: 1600,
    altEn: "Guests posing together during a celebration",
    altAr: "ضيوف يلتقطون صورة تذكارية خلال حفل",
    captionEn: null,
    captionAr: null,
    sort: 180,
    published: true,
  },
  {
    pillar: "restaurant",
    filePath: "/media/room-arches-wide.jpg",
    width: 2400,
    height: 1215,
    altEn: "The dining room full during an evening with live music",
    altAr: "الصالة ممتلئة في أمسية بموسيقى حيّة",
    captionEn: null,
    captionAr: null,
    sort: 190,
    published: true,
  },
  {
    pillar: "wedding",
    filePath: "/media/long-table-guests.jpg",
    width: 2400,
    height: 1600,
    altEn: "A long table of guests during a celebration",
    altAr: "طاولة طويلة من الضيوف خلال حفل",
    captionEn: null,
    captionAr: null,
    sort: 200,
    published: true,
  },
  {
    pillar: "wedding",
    filePath: "/media/couple-celebrating.jpg",
    width: 2400,
    height: 1600,
    altEn: "Guests celebrating together at the table",
    altAr: "ضيوف يحتفلون حول الطاولة",
    captionEn: null,
    captionAr: null,
    sort: 210,
    published: true,
  },
];
