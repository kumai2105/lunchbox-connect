/**
 * The public homepage.
 *
 * Rendered at `/` for ANONYMOUS visitors only. An authenticated visitor never
 * reaches it — App.tsx keeps the existing role resolution and sends them to
 * their product. This component is deliberately outside <Layout>, so it never
 * exposes authenticated navigation, and it reads NOTHING: no Supabase client,
 * no api.ts, no session. It is static public content.
 *
 * Every substantive claim here is recorded in
 * docs/LANDING_PAGE_CLAIM_REGISTER.md with its evidence and the wording it may
 * not be escalated into. If you are about to add "trusted by", a customer
 * count, a testimonial or a regulator's approval, read that file first — none
 * of those exist yet, and the register says so.
 *
 * ON THE PRODUCT PREVIEWS. The frames below are ABSTRACT representations of
 * the real screens, not screenshots and not a fake dashboard. Their structure
 * is taken from the actual product — the Command Center's own navigation
 * labels, the Kitchen production table's own columns and stage names, the
 * Parent portal's own sections — but every value is drawn as a neutral bar.
 * That is deliberate: a homepage may show that the software exists and how it
 * is shaped, and may not invent a single figure to make it look busier than it
 * is. There is no children count, no meals-served counter, no compliance
 * percentage and no score anywhere on this page.
 */
import { Link } from 'react-router-dom';
import logoUrl from '../assets/lunchbox-connect-logo.png';

const NAV = [
  { href: '#why', label: 'Why LunchBox' },
  { href: '#institutions', label: 'For Institutions' },
  { href: '#parents', label: 'For Parents' },
  { href: '#journey', label: 'How It Works' },
  { href: '#vision', label: 'Our Vision' },
];

/**
 * The meal journey, compressed to the five stages a visitor can hold in their
 * head. The software underneath is more granular — entitlement, dietary
 * resolution, finalisation, manifests, handover, reconciliation — and it stays
 * that way. A homepage does not need to teach every state.
 */
const JOURNEY = [
  { t: 'Plan', d: 'Menus, service setup and child entitlement.' },
  { t: 'Prepare', d: 'Kitchen Demand, production and packing.' },
  { t: 'Move', d: 'Dispatch, delivery and handover.' },
  { t: 'Serve', d: 'Classroom receives and records.' },
  { t: 'Inform', d: 'Parent visibility and operational reconciliation.' },
];

/* ------------------------------------------------------------------ icons */
/* Single-stroke marks. They label a panel; they never carry meaning of their
   own, so each is hidden from assistive technology. */

function IconInstitution() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 21h18M5 21V9l7-5 7 5v12M10 21v-5h4v5" />
    </svg>
  );
}
function IconParent() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="10" r="2.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M15 20a4 4 0 0 1 5.5-3.7" />
    </svg>
  );
}
function IconOperations() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 13h16M6 13V9.5A6 6 0 0 1 18 9.5V13M5 17h14M7 21h10" />
    </svg>
  );
}
function IconClassroom() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7l9-3 9 3-9 3-9-3z" />
      <path d="M7 10v5c0 1.7 2.2 3 5 3s5-1.3 5-3v-5" />
    </svg>
  );
}

/**
 * A meal, drawn rather than photographed. LunchBox Connect exists around
 * children's meals and the page should remember that — but no approved
 * LunchBox food photography exists in this repository yet, and stock families
 * or AI-generated "customers" would be a lie about a company that has none. So
 * the food is a compartment tray, geometric and honest.
 */
function TrayMotif({ className = '' }: { className?: string }) {
  return (
    <svg className={`lp-tray ${className}`} viewBox="0 0 200 140" aria-hidden="true">
      <rect className="lp-tray-body" x="4" y="4" width="192" height="132" rx="18" />
      <rect className="lp-tray-well" x="18" y="20" width="94" height="60" rx="12" />
      <rect className="lp-tray-well" x="124" y="20" width="58" height="60" rx="12" />
      <rect className="lp-tray-well" x="18" y="92" width="58" height="30" rx="12" />
      <rect className="lp-tray-well" x="88" y="92" width="94" height="30" rx="12" />
      <circle className="lp-tray-food-a" cx="50" cy="46" r="15" />
      <circle className="lp-tray-food-b" cx="78" cy="58" r="11" />
      <circle className="lp-tray-food-c" cx="70" cy="36" r="9" />
      <rect className="lp-tray-food-b" x="136" y="34" width="34" height="8" rx="4" />
      <rect className="lp-tray-food-a" x="136" y="48" width="24" height="8" rx="4" />
      <rect className="lp-tray-food-c" x="136" y="62" width="30" height="6" rx="3" />
    </svg>
  );
}

/* ------------------------------------------------- abstract product frames */
/* Structure from the real screens; every value is a neutral bar. See the file
   header for why there is not one number in here. */

/** Command Center: the real left navigation, and its real summary tiles. */
function AdminFrame() {
  const nav = ['Command center', 'Institutions', 'Students', 'Meal Plans', 'Menu Builder', 'Kitchen production', 'Reporting'];
  const tiles = ['Active students', 'Meals today', 'Classrooms', 'Fill rate'];
  return (
    <div className="lp-fr lp-fr-admin" role="img" aria-label="An abstract representation of the LunchBox Connect command centre: its navigation and summary panels, shown without data.">
      <div className="lp-fr-bar"><i /><i /><i /></div>
      <div className="lp-fr-body">
        <aside className="lp-fr-nav">
          <span className="lp-fr-mark" />
          {nav.map((n, i) => (
            <em key={n} className={i === 0 ? 'is-on' : undefined}>{n}</em>
          ))}
        </aside>
        <div className="lp-fr-main">
          <div className="lp-fr-tiles">
            {tiles.map((t) => (
              <div key={t} className="lp-fr-tile"><span>{t}</span><u /></div>
            ))}
          </div>
          <div className="lp-fr-rows">
            {[0, 1, 2, 3, 4].map((r) => (
              <div key={r} className="lp-fr-row"><b /><s /><s className="sm" /><q /></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Kitchen production: the table's own columns and its own stage names. */
function KitchenFrame() {
  return (
    <div className="lp-fr lp-fr-kitchen" role="img" aria-label="An abstract representation of the Kitchen production view: site, meal, required quantity and production stage, shown without data.">
      <div className="lp-fr-head"><span>Production demand</span></div>
      <div className="lp-fr-cols"><span>Site</span><span>Meal</span><span>Required</span><span>Stage</span></div>
      {['Preparation', 'Packing', 'Packed'].map((stage, i) => (
        <div key={stage} className="lp-fr-line">
          <s className="w30" /><s className="w40" /><u />
          <span className={`lp-chip lp-chip-${i}`}>{stage}</span>
        </div>
      ))}
      <div className="lp-fr-foot"><span>Dispatch</span><i /></div>
    </div>
  );
}

/** Parent: today's meals for one child, and the published week. No name. */
function ParentFrame() {
  return (
    <div className="lp-fr lp-fr-parent" role="img" aria-label="An abstract representation of the Parent view: today's meals for one child and the published menu for the week, shown without data.">
      <div className="lp-fr-notch" />
      <span className="lp-fr-eyebrow">Today&rsquo;s meals</span>
      <div className="lp-fr-meals">
        <div className="lp-fr-meal"><TrayMotif className="is-mini" /><s /></div>
        <div className="lp-fr-meal"><TrayMotif className="is-mini" /><s className="w60" /></div>
      </div>
      <span className="lp-fr-eyebrow">This week&rsquo;s menu</span>
      <div className="lp-fr-week">
        {['M', 'T', 'W', 'T', 'F'].map((d, i) => (
          <div key={i} className="lp-fr-day"><em>{d}</em><u /></div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="lp">
      <a className="lp-skip" href="#main">Skip to content</a>

      {/* The header surface is light on purpose. The brand artwork carries a
          navy outline and a blue wordmark, which do not read on the navy used
          below; the answer is to give the logo a surface that suits it rather
          than to box it in a white plate. The navy language starts at the hero. */}
      <header className="lp-header">
        <div className="lp-shell lp-header-inner">
          <a className="lp-brand" href="#top" aria-label="LunchBox Connect, home">
            <img src={logoUrl} alt="LunchBox Connect" />
          </a>
          <nav className="lp-nav" aria-label="Primary">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>{n.label}</a>
            ))}
          </nav>
          <div className="lp-header-cta">
            <Link className="lp-btn lp-btn-quiet" to="/login">Client login</Link>
            <a className="lp-btn lp-btn-gold" href="#contact">Talk to us</a>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ---------------------------------------------------------- HERO */}
        <section className="lp-hero" id="top">
          <div className="lp-shell lp-hero-inner">
            <div className="lp-hero-copy">
              <p className="lp-eyebrow">Built in the UAE for institutional child nutrition</p>
              <h1>
                Every child&rsquo;s meal.
                <br />
                <span className="lp-accent">One accountable journey.</span>
              </h1>
              <p className="lp-lead">
                LunchBox Connect combines a managed meal service with the operating system behind
                it — connecting Institutions, Kitchen operations, Classroom teams and Parents around
                the same child-level meal journey.
              </p>
              <div className="lp-hero-actions">
                <a className="lp-btn lp-btn-gold lp-btn-lg" href="#journey">See the journey</a>
                <a className="lp-btn lp-btn-outline lp-btn-lg" href="#contact">Talk to us</a>
              </div>
            </div>

            <div className="lp-hero-art">
              <div className="lp-stack">
                <AdminFrame />
                <KitchenFrame />
                <ParentFrame />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- AUDIENCES */}
        <section className="lp-aud-band" id="why">
          <div className="lp-shell">
            <div className="lp-aud-head">
              <h2 className="lp-h2">
                One child. Four responsibilities.{' '}
                <span className="lp-accent-ink">One connected record.</span>
              </h2>
              <p className="lp-body">
                One meal crosses more boundaries than most people see — the Institution, the
                Kitchen, the delivery team, the Classroom and the Parent.
              </p>
            </div>

            <div className="lp-auds">
              <article className="lp-aud is-primary" id="institutions">
                <span className="lp-aud-ico lp-ico-blue"><IconInstitution /></span>
                <h3>For Institutions</h3>
                <p>
                  Manage the parts of the meal programme that belong to your Institution —
                  Students, staff, published service, dietary requirements and delivery handover.
                </p>
                <div className="lp-aud-art"><AdminFrame /></div>
              </article>

              <article className="lp-aud is-primary">
                <span className="lp-aud-ico lp-ico-gold"><IconParent /></span>
                <h3>For Parents</h3>
                <p>
                  See the part of the meal journey that belongs to your child: published meals and
                  the intake information recorded by the Classroom.
                </p>
                <div className="lp-aud-art"><ParentFrame /></div>
              </article>

              <article className="lp-aud is-primary">
                <span className="lp-aud-ico lp-ico-blue"><IconOperations /></span>
                <h3>For Operations</h3>
                <p>
                  Turn published service and child entitlement into exact Demand, production,
                  packing, dispatch and recorded handover.
                </p>
                <div className="lp-aud-art"><KitchenFrame /></div>
              </article>

              <article className="lp-aud is-wide">
                <span className="lp-aud-ico lp-ico-green"><IconClassroom /></span>
                <div className="lp-aud-wide-copy">
                  <h3>For Classroom teams</h3>
                  <p>
                    See the children and Meal Periods that actually apply, then record the meal
                    outcome — without exposing the Kitchen&rsquo;s internal operation.
                  </p>
                </div>
                <TrayMotif className="is-wide" />
              </article>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- JOURNEY */}
        <section className="lp-journey-band" id="journey">
          <div className="lp-shell">
            <h2 className="lp-h2 lp-h2-center">One connected meal journey</h2>
            <ol className="lp-journey">
              {JOURNEY.map((s) => (
                <li key={s.t}>
                  <span className="lp-journey-dot" aria-hidden="true" />
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------ PARENTS */}
        <section className="lp-parents" id="parents">
          <div className="lp-shell lp-parents-inner">
            <div className="lp-parents-art">
              <ParentFrame />
            </div>
            <div className="lp-parents-copy">
              <p className="lp-eyebrow lp-eyebrow-dark">For Parents</p>
              <h2 className="lp-h2">
                Parents should see the part of the journey that belongs to their child.
              </h2>
              <p className="lp-body">
                LunchBox Connect keeps internal Kitchen and Institution operations private while
                giving the Parent controlled visibility into their own child&rsquo;s published meal
                information and recorded Classroom outcome.
              </p>
              <p className="lp-pull">
                The Parent is part of the information chain — not the internal operations chain.
              </p>
              <p className="lp-note">Parent access is provided through the Institution.</p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- UAE EVIDENCE */}
        <section className="lp-evidence">
          <div className="lp-shell lp-evidence-inner">
            <ul className="lp-stats">
              <li>
                <b>331</b>
                <span>Early Childhood Centres</span>
                <em>Dubai, KHDA 2025–26</em>
              </li>
              <li>
                <b>233</b>
                <span>Private schools</span>
                <em>Dubai, KHDA 2025–26</em>
              </li>
              <li>
                <b>456</b>
                <span>Educational institutions monitored annually for food safety</span>
                <em>Dubai Municipality, 2025</em>
              </li>
            </ul>
            <div className="lp-evidence-note">
              <p>
                As the UAE&rsquo;s private education sector grows, expectations around food,
                wellbeing, records and Parent engagement are becoming increasingly structured.
              </p>
              <p className="lp-source">
                Sources: KHDA, 24 August 2025 · Dubai Municipality, September 2025. Figures are as
                reported at those dates, not a live count. Public-sector references are provided as
                UAE market context only. They do not indicate endorsement, partnership or
                certification.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- VISION */}
        <section className="lp-horizon" id="vision">
          <div className="lp-shell lp-horizon-inner">
            <article className="lp-hz lp-hz-today">
              <span className="lp-hz-tag">Today</span>
              <h2>A managed meal service powered by its own operating system.</h2>
              <p>
                LunchBox Connect operates the meal service while its platform connects multiple
                Institutions through one controlled operational model. The food service and the
                operating system are one offer today.
              </p>
              <TrayMotif className="is-corner" />
            </article>

            <article className="lp-hz lp-hz-next">
              <span className="lp-hz-tag lp-hz-tag-next">Tomorrow — the vision</span>
              <h2>Building the connected operating infrastructure for institutional child nutrition.</h2>
              <p>
                If direct market validation supports it, the same architecture can evolve to
                connect additional kitchens, caterers and education groups around a consistent
                institutional child-food operating model.
              </p>
            </article>
          </div>
        </section>

        {/* ------------------------------------------------------------ CONTACT */}
        <section className="lp-cta" id="contact">
          <div className="lp-shell lp-cta-inner">
            <div className="lp-cta-main">
              <h2>Let&rsquo;s talk about how your meal operation works today.</h2>
              <p>
                If you run a nursery, school or education group, we can walk through your current
                meal journey and show where LunchBox Connect fits.
              </p>
              <div className="lp-cta-row">
                <a className="lp-btn lp-btn-gold lp-btn-lg" href="mailto:kumai@lunchboxconnect.com">
                  Talk to us
                </a>
                <div className="lp-cta-direct">
                  <a href="mailto:kumai@lunchboxconnect.com">kumai@lunchboxconnect.com</a>
                  <a href="tel:+971559933354">+971 55 993 3354</a>
                </div>
              </div>
            </div>
            <aside className="lp-cta-login">
              <p>Already have a LunchBox Connect account?</p>
              <Link className="lp-btn lp-btn-outline" to="/login">Client login</Link>
            </aside>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-shell lp-footer-inner">
          <div className="lp-footer-brand">
            <a className="lp-brand" href="#top" aria-label="LunchBox Connect, home">
              <img src={logoUrl} alt="LunchBox Connect" />
            </a>
            <p className="lp-footer-what">
              Managed institutional meal service + connected child-food operations.
              <br />
              Built in the UAE.
            </p>
            <p className="lp-footer-contact">
              <a href="mailto:kumai@lunchboxconnect.com">kumai@lunchboxconnect.com</a>
              <a href="tel:+971559933354">+971 55 993 3354</a>
            </p>
          </div>
          <p className="lp-source lp-footer-note">
            References to UAE strategies, regulators and public-sector policies are included as
            market context only and do not imply endorsement, approval, certification or
            partnership.
          </p>
          <nav className="lp-footer-nav" aria-label="Footer">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>{n.label}</a>
            ))}
            <Link to="/login">Client login</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
