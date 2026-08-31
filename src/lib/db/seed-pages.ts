/**
 * Initial English page copy.
 *
 * EVERY sentence here is traceable to either the Phase 1 dossier (VERIFIED) or the Phase 2
 * owner brief (OWNER-PROVIDED). Deliberately absent: history, founder story, awards, ratings,
 * testimonials, client names, capacities, package prices, event counts, halal claims,
 * superlatives ("leading", "largest", "award-winning", "number one") and any scale claim.
 *
 * Arabic columns are intentionally EMPTY. The Arabic system is built and tested, but Arabic
 * marketing copy must be written or approved by a person — it is not machine-translated here.
 */

export interface SeedPage {
  slug: string;
  titleEn: string;
  kickerEn: string;
  introEn: string;
  bodyEn: string;
  seoTitleEn: string;
  seoDescriptionEn: string;
}

export const seedPages: SeedPage[] = [
  {
    slug: "home",
    titleEn: "Arabic and international dining in Dubai Silicon Oasis",
    kickerEn: "Semmer Villas Community Centre",
    introEn:
      "Jazeel is a restaurant and café in Dubai Silicon Oasis, open every day from 10:00 until 02:00. Charcoal grills, Levantine mezze, manakeesh and international dishes — served in an indoor family hall, on the outdoor terrace, or brought to you.",
    bodyEn:
      "Alongside daily dining, Jazeel caters and hosts occasions: weddings, private parties and family celebrations, Sunday brunch, and corporate meetings, gatherings and launches. Tell us what you are planning and the team will come back to you.",
    seoTitleEn: "Jazeel Restaurant & Café — Dubai Silicon Oasis",
    seoDescriptionEn:
      "Arabic and international restaurant and café in Dubai Silicon Oasis. Charcoal grills, mezze, indoor and outdoor seating. Weddings, celebrations, corporate events and catering.",
  },
  {
    slug: "restaurant",
    titleEn: "The restaurant and café",
    kickerEn: "Every day, 10:00 – 02:00",
    introEn:
      "A neighbourhood restaurant in the community centre at Semmer Villas, serving Arabic and international food from late morning until the early hours.",
    bodyEn:
      "The kitchen works over charcoal — mixed grills, kebabs, shish taouk, lamb chops and boneless chicken — alongside cold and hot mezze, salads, manakeesh and fatayer from the oven, and a set of international dishes including escalopes, cordon bleu and pasta.\n\nThere is an indoor dining room with a family hall, an outdoor seating area, and a children's area. Alcohol is not served.\n\nYou can eat in, collect a takeaway order, or have delivery brought to you through our delivery partners.",
    seoTitleEn: "Restaurant & Café in Dubai Silicon Oasis | Jazeel",
    seoDescriptionEn:
      "Charcoal grills, mezze, manakeesh and international dishes at Semmer Villas, Dubai Silicon Oasis. Indoor family hall, outdoor seating, children's area. Open daily 10:00–02:00.",
  },
  {
    slug: "menu",
    titleEn: "Menu",
    kickerEn: "Arabic grills, mezze and international dishes",
    introEn:
      "Our kitchen covers charcoal grills, cold and hot mezze, salads, manakeesh and fatayer, and a range of international dishes.",
    bodyEn: "",
    seoTitleEn: "Menu | Jazeel Restaurant & Café, Dubai Silicon Oasis",
    seoDescriptionEn:
      "The Jazeel menu — charcoal grills, Levantine mezze, salads, manakeesh, fatayer and international dishes. Dubai Silicon Oasis.",
  },
  {
    slug: "weddings",
    titleEn: "Weddings and celebrations",
    kickerEn: "Hosted at Jazeel, or catered at your venue",
    introEn:
      "Jazeel hosts and caters weddings, engagement parties, family celebrations and private gatherings. Friday and Saturday evenings are our busiest, so it is worth talking to us early.",
    bodyEn:
      "Tell us the shape of the occasion — the date you have in mind, roughly how many guests, and whether you would like to hold it here or have us cater somewhere else. The team will come back to you with what we can do and what it would cost.\n\nWhether you are planning a full wedding celebration or a smaller family gathering, the starting point is the same conversation.",
    seoTitleEn: "Wedding & Celebration Venue and Catering | Jazeel, Dubai Silicon Oasis",
    seoDescriptionEn:
      "Weddings, engagement parties and family celebrations — hosted at Jazeel in Dubai Silicon Oasis or catered at your venue. Send your date and guest numbers.",
  },
  {
    slug: "corporate",
    titleEn: "Corporate events and launches",
    kickerEn: "Meetings, gatherings, product and company launches",
    introEn:
      "Jazeel hosts and caters company meetings, corporate gatherings, and product and company launches, for businesses in Dubai Silicon Oasis and across Dubai.",
    bodyEn:
      "We can host your event here or bring the catering to your office, campus or venue. Send us the date, the approximate headcount and the format you have in mind — a working lunch, an evening reception, a launch — and the team will come back with options.\n\nIf you need something on short notice, calling is usually faster than the form.",
    seoTitleEn: "Corporate Events & Business Catering | Jazeel, Dubai Silicon Oasis",
    seoDescriptionEn:
      "Company meetings, corporate gatherings and product launches — hosted at Jazeel in Dubai Silicon Oasis or catered at your office. Send your date, headcount and format.",
  },
  {
    slug: "catering",
    titleEn: "Catering",
    kickerEn: "Delivered to you, or served on site",
    introEn:
      "Catering is part of what Jazeel does, alongside the restaurant. We cater private celebrations, corporate events and gatherings of most kinds.",
    bodyEn:
      "The same kitchen that runs the restaurant handles catering — charcoal grills, mezze, salads, manakeesh and fatayer, and international dishes — scaled to the occasion.\n\nTell us the date, roughly how many people you are feeding, and how you would like the food served: a buffet, a set menu, finger food, or simply delivered to your venue. We will come back to you with what we can do.",
    seoTitleEn: "Catering in Dubai Silicon Oasis | Jazeel Restaurant & Café",
    seoDescriptionEn:
      "Catering from Jazeel in Dubai Silicon Oasis — charcoal grills, mezze and international dishes for celebrations and corporate events. Buffet, set menu or delivered.",
  },
  {
    slug: "brunch",
    titleEn: "Sunday brunch",
    kickerEn: "Every Sunday at Jazeel",
    introEn: "Jazeel hosts a Sunday brunch — a long, unhurried table for families and friends.",
    bodyEn:
      "Brunch is served in the restaurant, with the indoor family hall and the outdoor seating both open. There is a children's area.\n\nTo join us, or to ask about a larger group, send an enquiry with your date and party size, or call the restaurant.",
    seoTitleEn: "Sunday Brunch in Dubai Silicon Oasis | Jazeel",
    seoDescriptionEn:
      "Sunday brunch at Jazeel, Semmer Villas Community Centre, Dubai Silicon Oasis. Indoor family hall and outdoor seating, children's area. Enquire with your date and party size.",
  },
  {
    slug: "gallery",
    titleEn: "Gallery",
    kickerEn: "",
    introEn: "Photographs of the restaurant, our food and the occasions we host.",
    bodyEn: "",
    seoTitleEn: "Gallery | Jazeel Restaurant & Café, Dubai Silicon Oasis",
    seoDescriptionEn: "Photographs of Jazeel Restaurant & Café in Dubai Silicon Oasis.",
  },
  {
    slug: "about",
    titleEn: "About Jazeel",
    kickerEn: "Dubai Silicon Oasis",
    introEn:
      "Jazeel is a restaurant and café in the community centre at Semmer Villas, Dubai Silicon Oasis, serving Arabic and international food every day from 10:00 until 02:00.",
    bodyEn:
      "The menu is built around a charcoal grill, with Levantine mezze, salads, manakeesh and fatayer from the oven, and a range of international dishes.\n\nThere is an indoor dining room with a family hall, outdoor seating, and a children's area. Alcohol is not served. You can eat in, order takeaway, or have delivery brought to you through our delivery partners.\n\nAlongside the restaurant, Jazeel caters and hosts occasions — weddings, private celebrations, Sunday brunch, and corporate meetings, gatherings and launches.",
    seoTitleEn: "About Jazeel Restaurant & Café | Dubai Silicon Oasis",
    seoDescriptionEn:
      "An Arabic and international restaurant and café at Semmer Villas, Dubai Silicon Oasis, open daily 10:00–02:00 — also catering weddings, celebrations and corporate events.",
  },
  {
    slug: "contact",
    titleEn: "Contact, location and enquiries",
    kickerEn: "Semmer Villas Community Centre, Dubai Silicon Oasis",
    introEn:
      "Call the restaurant for a table, a takeaway order or a quick question. For weddings, celebrations, corporate events, catering or Sunday brunch, send an enquiry and the team will come back to you.",
    bodyEn: "",
    seoTitleEn: "Contact & Location | Jazeel Restaurant & Café, Dubai Silicon Oasis",
    seoDescriptionEn:
      "Find Jazeel at Semmer Villas, Dubai Silicon Oasis. Call +971 4 323 2797 or send an enquiry about weddings, corporate events, catering or Sunday brunch.",
  },
  {
    slug: "privacy",
    titleEn: "Privacy notice",
    kickerEn: "",
    introEn: "How Jazeel handles the information you give us through this website.",
    bodyEn:
      "## What we collect\n\nWhen you send an enquiry through this website we collect the details you type into the form: your name, your contact number, and — where you provide them — your email address, company name, preferred date, guest numbers and the message you write.\n\nWe also record which page the enquiry came from, the language you were using, and a one-way hash of your network address. The hash is used only to limit automated abuse of the form; it cannot be turned back into your address.\n\n## Why we collect it\n\nWe use these details for one purpose: to respond to your enquiry and to arrange the service you asked about. We do not sell your details. We do not share them with third parties for marketing.\n\n## Consent\n\nYou are asked to confirm, before sending an enquiry, that we may use your details to reply to you. You can withdraw that consent at any time by contacting us, and we will delete your enquiry.\n\n## How long we keep it\n\nEnquiries are kept while they are being handled and for a reasonable period afterwards for our own records, then deleted.\n\n## Cookies\n\nThis website sets one cookie, and only for staff signing in to the administration area. Browsing the public pages of this site does not set advertising or analytics cookies.\n\n## Contacting us\n\nTo ask what we hold about you, to correct it, or to have it deleted, please call the restaurant on the number shown on this website.",
    seoTitleEn: "Privacy Notice | Jazeel Restaurant & Café",
    seoDescriptionEn: "How Jazeel handles information submitted through this website.",
  },
];
