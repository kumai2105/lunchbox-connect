import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LandingPage from './LandingPage';

/**
 * THE PUBLIC HOMEPAGE MAY NOT INVENT SCALE, APPROVAL OR CAPABILITY.
 *
 * LunchBox Connect has no client base yet, and a homepage is exactly where
 * that gets quietly papered over — a "trusted by" strip, a meals-served
 * counter, a regulator's name beside a tick. Any of those would be a lie told
 * to a nursery owner in a first meeting, and the damage lands on the Founder.
 *
 * Asserted against the RENDERED OUTPUT, not the source. A first version of
 * this file scanned LandingPage.tsx as text and failed on its own doc comment
 * warning against "trusted by", and on SVG coordinates that looked like
 * invented statistics. Both were the test misreading the file. What a visitor
 * receives is the only thing worth constraining, so this renders the component
 * and reads the text a person would actually see.
 *
 * docs/LANDING_PAGE_CLAIM_REGISTER.md explains what each permitted claim rests
 * on; this file is the part that fails a build.
 */

const html = renderToStaticMarkup(
  <MemoryRouter>
    <LandingPage />
  </MemoryRouter>,
);

/** Visible text only: tags and their attributes are not what a visitor reads. */
const text = html
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

const REGISTER = readFileSync(join(process.cwd(), 'docs/LANDING_PAGE_CLAIM_REGISTER.md'), 'utf8');

/** Phrases that assert scale, endorsement or an outcome nobody has measured. */
const FORBIDDEN = [
  'trusted by',
  'our clients',
  'groups tell us',
  'market leader',
  'leading uae provider',
  'government approved',
  'khda approved',
  'dubai municipality approved',
  'adek approved',
  'happier children',
  'revenue line',
  'margin line',
  'pays for itself',
  'allergy safe',
  'eliminates allergy risk',
  'fully compliant',
  'pdpl certified',
  'peace of mind',
  'stress free',
  'real-time tracking',
  'case study',
  'testimonial',
  'no other company',
  'the only',
  'used by leading',
  'serving thousands',
];

describe('public homepage — forbidden claims', () => {
  it.each(FORBIDDEN)('the rendered page never says %j', (phrase) => {
    expect(text.toLowerCase()).not.toContain(phrase);
  });

  it('shows no customer count, meals-served counter or review score', () => {
    // The only figures a visitor sees are the three cited UAE ones (and the
    // years and phone number that carry them).
    const numbers = text.match(/\b\d[\d,]{2,}\b/g) ?? [];
    // 331/233/456 are the cited figures; the rest are the years that
    // qualify them and the digits of the published phone number.
    const allowed = new Set([
      '331', '233', '456', '2025', '2051', '2026', '33', '971', '993', '3354',
    ]);
    expect(numbers.filter((n) => !allowed.has(n.replace(/,/g, '')))).toEqual([]);
  });
});

describe('public homepage — UAE evidence', () => {
  it('attributes every figure to a named source and year', () => {
    expect(text).toContain('331');
    expect(text).toContain('Dubai, KHDA 2025–26');
    expect(text).toContain('233');
    expect(text).toContain('456');
    expect(text).toContain('Dubai Municipality, 2025');
    expect(text).toMatch(/Sources: KHDA, 24 August 2025/);
  });

  it('says the figures are point-in-time, not a live count', () => {
    expect(text).toMatch(/not a live count/i);
  });

  it('states that public-sector references are context, not endorsement', () => {
    expect(text).toMatch(/do not indicate endorsement, partnership or certification/i);
    expect(text).toMatch(/do not imply endorsement, approval, certification or partnership/i);
  });
});

describe('public homepage — audiences', () => {
  it('gives Institutions their own story', () => {
    expect(text).toContain('For Institutions');
    expect(text).toMatch(/Students, staff, published service, dietary requirements/);
  });

  it('gives Kitchen and delivery their own story', () => {
    // Labelled "For Operations" since the visual redesign — the panel covers
    // Kitchen production AND delivery, and the shorter label is what the
    // stakeholder row can carry. The meaning below is unchanged and is still
    // the claim the register supports.
    expect(text).toContain('For Operations');
    expect(text).toMatch(/exact Demand, production, packing, dispatch and recorded handover/);
  });

  it('gives Classroom teams their own story', () => {
    expect(text).toContain('For Classroom teams');
    expect(text).toMatch(/Meal Periods that actually apply/);
  });

  it('gives Parents a real section, not one card', () => {
    expect(text).toContain('For Parents');
    expect(text).toMatch(/Parents should see the part of the journey that belongs to their child/i);
    expect(text).toMatch(
      /Parent is part of the information chain — not the internal operations chain/,
    );
  });

  it('does not claim the Institution assigns Student Meal Plans', () => {
    // Student Meal Plan assignment is Super Admin authority.
    expect(text).not.toMatch(/Institution[^.]{0,80}assign[^.]{0,40}Meal Plan/i);
  });

  it('does not promise Parents ordering, editing or live monitoring', () => {
    for (const overreach of ['order meals', 'change meals', 'edit dietary', 'live tracking']) {
      expect(text.toLowerCase()).not.toContain(overreach);
    }
  });
});

describe('public homepage — current versus future', () => {
  it('separates Today from Tomorrow', () => {
    expect(text).toContain('Today');
    expect(text).toContain('Tomorrow');
    expect(text).toMatch(/If direct market validation supports it/);
  });

  it('never asserts the category as an existing public fact', () => {
    for (const overreach of ['national platform', 'uae standard', 'national operating system']) {
      expect(text.toLowerCase()).not.toContain(overreach);
    }
  });

  it('keeps the food service in the story', () => {
    expect(text).toMatch(/food service and the operating system are one offer today/i);
  });
});

describe('public homepage — no protected data', () => {
  it('imports no Supabase client, api layer or auth', () => {
    const source = readFileSync(join(process.cwd(), 'src/pages/LandingPage.tsx'), 'utf8');
    const imports = source.slice(0, source.indexOf('const NAV'));
    expect(imports).not.toMatch(/from '\.\.\/lib\/(api|auth|supabase)'/);
  });

  it('renders no operational record — the markup is static content only', () => {
    // A homepage that ever rendered a Student, a manifest or a Demand figure
    // would be leaking the product to anonymous visitors.
    for (const leak of ['institution_id', 'student_id', 'manifest', 'final_demand']) {
      expect(html.toLowerCase()).not.toContain(leak);
    }
  });

  it('offers exactly one way in, to the real sign-in route', () => {
    expect(html).toContain('href="/login"');
    expect(text.toLowerCase()).toContain('client login');
    // No self-service invention.
    for (const invented of ['sign up', 'create account', 'book a demo', 'forgot password']) {
      expect(text.toLowerCase()).not.toContain(invented);
    }
  });
});

describe('public homepage — claim register', () => {
  it('covers each claim type', () => {
    for (const type of [
      'OFFICIAL UAE FACT',
      'CURRENT PRODUCT CAPABILITY',
      'RESEARCH-SUPPORTED POSITION',
      'FUTURE VISION',
    ]) {
      expect(REGISTER).toContain(type);
    }
    for (const heading of ['EVIDENCE', 'ALLOWED WORDING', 'DO NOT ESCALATE TO']) {
      expect(REGISTER).toContain(heading);
    }
  });

  it('records the prohibited claims this test enforces', () => {
    for (const phrase of ['trusted by', 'market leader', 'government approved', 'pays for itself']) {
      expect(REGISTER.toLowerCase()).toContain(phrase);
    }
  });
});

describe('routing safety', () => {
  const APP = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');

  it('renders the landing page only for an anonymous visitor at the index route', () => {
    expect(APP).toContain('<Route index element={<Home anonymous="landing" />} />');
  });

  it('keeps the catch-all sending anonymous visitors to /login', () => {
    // An unknown URL must not answer with an advertisement.
    expect(APP).toContain('<Route path="*" element={<Home />} />');
  });

  it('still resolves the role and redirects an authenticated visitor', () => {
    expect(APP).toContain('return <Navigate to={`/${firstPageFor(role)}`} replace />;');
    expect(APP).toContain('if (!role) return <NoAccessPage />;');
  });

  it('does not put the landing page inside the authenticated Layout', () => {
    const layoutBlock = APP.slice(APP.indexOf('<Route element={<Layout />}>'));
    expect(layoutBlock).not.toContain('LandingPage');
  });
});
