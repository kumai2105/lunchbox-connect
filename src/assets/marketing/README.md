# Homepage imagery slots

The public homepage is built image-led. Every slot below is **optional**: drop a
file in with the matching name and it appears on the page automatically, with no
code change. If a file is absent, the slot renders a designed brand composition
instead — never a broken image and never an empty grey box.

Detection is a Vite `import.meta.glob` in `src/pages/LandingPage.tsx`. Supported
extensions: `.jpg` `.jpeg` `.png` `.webp`.

| Filename        | Where it appears            | Aspect | Suggested size |
| --------------- | --------------------------- | ------ | -------------- |
| `hero.*`        | Hero, behind the product    | 4:3    | 1600×1200      |
| `institutions.*`| "For Institutions" panel    | 16:10  | 1200×750       |
| `parents.*`     | "For Parents" panel         | 16:10  | 1200×750       |
| `operations.*`  | "For Operations" panel      | 16:10  | 1200×750       |
| `classroom.*`   | "For Classroom teams" panel | 16:10  | 1200×750       |
| `food.*`        | Journey band + Today panel  | 4:3    | 1200×900       |

## The rule that governs what may go here

These images are BRAND / EDITORIAL ILLUSTRATION. They communicate a stakeholder
TYPE and nothing more.

No image in this directory may be captioned, labelled or described as a
LunchBox Connect customer, a partner Institution, a testimonial, a case study or
a real client family — and the homepage never does so. There is no `alt` text,
caption or heading anywhere on the page that attributes an image to a real
person or organisation. Keep it that way.

Do not bake text, statistics or another company's branding into an image.
