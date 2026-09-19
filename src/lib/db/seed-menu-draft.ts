/**
 * DRAFT MENU IMPORT — research evidence, not owner-approved truth.
 *
 * Source: Deliveroo storefront "Jazeel Restaurant - Silicon Oasis", captured 2026-08-31
 * during Phase 1 research (dossier §5.2). It is the ONLY complete public menu that existed.
 *
 * Everything imported from it is created `published: false` and carries a `sourceNote`, because
 * Phase 1 established that this snapshot:
 *   - is the DELIVERY menu on one platform on one day, not confirmed as the dine-in menu;
 *   - contains no beverages, desserts, shisha, kids or catering items at all;
 *   - contains no item descriptions, no allergen data and no photography;
 *   - omits at least one product Talabat sells ("Thank You So Much Box");
 *   - spells the brand three different ways and misspells one category heading.
 *
 * The owner reviews, corrects and publishes from the admin. Nothing here reaches a public page
 * until they do.
 */

export interface DraftCategory {
  slug: string;
  nameEn: string;
  sort: number;
  items: { nameEn: string; price: number; featured?: boolean; portionEn?: string }[];
}

export const DELIVEROO_SNAPSHOT_NOTE =
  "Deliveroo storefront snapshot 2026-08-31 (Phase 1 research draft — unverified, needs owner approval)";

export const draftMenu: DraftCategory[] = [
  {
    slug: "soups",
    nameEn: "Soups",
    sort: 10,
    items: [
      { nameEn: "Lentil Soup", price: 29 },
      { nameEn: "Vegetable Soup", price: 29 },
      { nameEn: "Cream Soup — Chicken / Mushroom / Corn", price: 34 },
    ],
  },
  {
    slug: "cold-appetizers",
    nameEn: "Cold Appetizers",
    sort: 20,
    items: [
      { nameEn: "Hommous with Pine Nuts", price: 39 },
      { nameEn: "Handbeh with Oil", price: 39 },
      { nameEn: "Moutabal Jazeel", price: 33 },
      { nameEn: "Hommous", price: 28 },
      { nameEn: "Hommous Beiruti", price: 33 },
      { nameEn: "Vine Leaves", price: 32 },
      { nameEn: "Baba Ghanoj", price: 30 },
      { nameEn: "Moutabal", price: 30 },
      { nameEn: "Labneh", price: 28 },
    ],
  },
  {
    slug: "salads",
    nameEn: "Salads",
    sort: 30,
    items: [
      { nameEn: "Tabouleh Salad", price: 39 },
      { nameEn: "Rocca Salad", price: 39 },
      { nameEn: "Fatoush Salad", price: 39 },
      { nameEn: "Jazeel Salad", price: 49 },
      { nameEn: "Jazeel Avocado Salad", price: 49 },
    ],
  },
  {
    slug: "hot-appetizers",
    nameEn: "Hot Appetizers",
    sort: 40,
    items: [
      { nameEn: "Hot Potatoes", price: 36 },
      { nameEn: "Hommous with Meat and Pine Nuts", price: 42, featured: true },
      { nameEn: "Cheese Spring Rolls", price: 36 },
      { nameEn: "Falafel", price: 29 },
      { nameEn: "Grilled Chicken Wings", price: 44 },
      { nameEn: "Fried Kibbeh", price: 35 },
      { nameEn: "Grilled Halloumi", price: 45 },
      { nameEn: "Fries", price: 24 },
      { nameEn: "Meat with Tomato", price: 49 },
      { nameEn: "Meat with Mushrooms", price: 48 },
      { nameEn: "Meat with Potato", price: 49 },
      { nameEn: "Sujuk with Pomegranate Sauce", price: 45 },
      { nameEn: "Chicken Liver with Pomegranate Sauce", price: 45 },
    ],
  },
  {
    slug: "charcoal-grills",
    nameEn: "Grill on the Charcoal",
    sort: 50,
    items: [
      { nameEn: "Boneless Chicken", price: 54, featured: true },
      { nameEn: "Jazeel Mixed Grill", price: 85, featured: true },
      { nameEn: "Grilled Chicken", price: 59, featured: true, portionEn: "800g" },
      { nameEn: "Mixed Grill", price: 79 },
      { nameEn: "Kabab Halabi", price: 58 },
      { nameEn: "Shish Taouk", price: 59 },
      { nameEn: "Meat Arayes", price: 54 },
      { nameEn: "Meat Tikka Grill", price: 74 },
      { nameEn: "Kabab Keshkhash", price: 59 },
      { nameEn: "Chicken with Bone", price: 49 },
      { nameEn: "Lamb Chops", price: 89 },
      { nameEn: "Meat Arayes with Cheese", price: 62 },
      { nameEn: "Mixed Grill", price: 249, portionEn: "1 kg" },
      { nameEn: "Jazeel Mixed Grill", price: 279, portionEn: "1 kg" },
      { nameEn: "Boneless Chicken with Cheese", price: 60 },
    ],
  },
  {
    slug: "sawane-jazeel",
    nameEn: "Sawane Jazeel",
    sort: 60,
    items: [
      { nameEn: "Kofta with Tomato", price: 69 },
      { nameEn: "Kofta with Tahini", price: 69 },
      { nameEn: "Sliced Meat Provencal", price: 69 },
      { nameEn: "Chicken Slices Provencal", price: 55 },
    ],
  },
  {
    slug: "international-sandwiches",
    nameEn: "International Sandwiches",
    sort: 70,
    items: [
      { nameEn: "Fajita Sandwich", price: 56 },
      { nameEn: "Philadelphia Sandwich", price: 56 },
      { nameEn: "Escalope Sandwich", price: 55 },
      { nameEn: "Steak Sandwich", price: 58 },
      { nameEn: "Zinger Sandwich", price: 52 },
    ],
  },
  {
    slug: "international",
    nameEn: "International",
    sort: 80,
    items: [
      { nameEn: "Cordon Bleu", price: 84 },
      { nameEn: "Grilled Filet Hamour", price: 68 },
      { nameEn: "Escalope with Cheese and Mushroom", price: 79 },
      { nameEn: "Chicken Ala Kiev", price: 79 },
      { nameEn: "Chicken Escalope", price: 69 },
    ],
  },
  {
    slug: "pasta",
    nameEn: "Pasta",
    sort: 90,
    items: [
      { nameEn: "Spaghetti Bolognaise", price: 54 },
      { nameEn: "Penne Arrabiata", price: 54 },
      { nameEn: "Lasagna", price: 64 },
      { nameEn: "Fettucini", price: 64 },
      { nameEn: "Penne Cream Sauce", price: 58 },
    ],
  },
  {
    slug: "western-hot-appetizers",
    nameEn: "Western Hot Appetizers",
    sort: 100,
    items: [
      { nameEn: "Shrimp Dynamite", price: 64 },
      { nameEn: "Buffalo Wings", price: 59 },
    ],
  },
  {
    slug: "manakeesh",
    nameEn: "Manakeesh",
    sort: 110,
    items: [
      { nameEn: "Zaatar Manakeesh", price: 19 },
      { nameEn: "Cheese Manakeesh", price: 29 },
      { nameEn: "Spinach Manakeesh", price: 24 },
      { nameEn: "Zaatar and Cheese Manakeesh", price: 24 },
      { nameEn: "Meat Manakeesh", price: 29 },
      { nameEn: "Meat and Cheese Manakeesh", price: 29 },
      { nameEn: "Labneh Manakeesh", price: 19 },
      { nameEn: "Jazeel Manakeesh", price: 39 },
    ],
  },
  {
    slug: "fatayer",
    nameEn: "Fatayer",
    sort: 120,
    items: [
      { nameEn: "Cheese Fatayer", price: 35, featured: true },
      { nameEn: "Spinach Fatayer", price: 29 },
      { nameEn: "Meat Fatayer", price: 29 },
      { nameEn: "Olives Fatayer", price: 29 },
      { nameEn: "Mixed Fatayer", price: 34 },
    ],
  },
  {
    slug: "rice",
    nameEn: "Rice",
    sort: 130,
    items: [
      { nameEn: "Oriental Rice", price: 29 },
      { nameEn: "Vermicelli Rice", price: 24 },
      { nameEn: "Biryani Rice", price: 24 },
    ],
  },
];
