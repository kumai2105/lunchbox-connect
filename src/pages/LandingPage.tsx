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

/** The six stages one meal actually moves through, in the product's own order. */
const JOURNEY = [
  { n: '01', t: 'Plan', a: 'Institution service and menu', b: 'Child entitlement' },
  { n: '02', t: 'Decide', a: 'Dietary requirement', b: 'Standard or Special Meal' },
  { n: '03', t: 'Prepare', a: 'Exact Kitchen Demand', b: 'Production and packing' },
  { n: '04', t: 'Move', a: 'Dispatch and Driver', b: 'Delivery run' },
  { n: '05', t: 'Hand over', a: 'Authorised receipt', b: 'Classroom service' },
  { n: '06', t: 'Reconcile', a: 'Parent visibility', b: 'Operational reconciliation' },
];

const VIEWS = [
  {
    id: 'institutions',
    eyebrow: 'For Institutions',
    body: 'See and manage the parts of the meal programme that belong to your Institution — Students, staff, published service, dietary requirements and delivery handover.',
  },
  {
    id: 'operations',
    eyebrow: 'For Kitchen & Delivery',
    body: 'Turn published service and child entitlement into exact Demand, production, packing, dispatch and recorded handover.',
  },
  {
    id: 'classroom',
    eyebrow: 'For Classroom teams',
    body: 'See the children and Meal Periods that actually apply, then record what happened without exposing the Kitchen’s internal operation.',
  },
  {
    id: 'parents',
    eyebrow: 'For Parents',
    body: 'When access is provided through the Institution, Parents see their own child’s published meals and the intake information recorded for that child.',
  },
];

/** The connected-chain hero diagram. Decorative: the meaning is in the text. */
function ChainDiagram() {
  const nodes = [
    { x: 190, y: 40, label: 'Institution' },
    { x: 330, y: 130, label: 'Kitchen' },
    { x: 280, y: 285, label: 'Delivery' },
    { x: 100, y: 285, label: 'Classroom' },
    { x: 50, y: 130, label: 'Parent' },
  ];
  return (
    <svg className="lp-chain" viewBox="0 0 380 340" role="img" aria-label="A child's meal at the centre, connected to the Institution, Kitchen, delivery, Classroom and Parent.">
      <defs>
        <radialGradient id="lp-core" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </radialGradient>
      </defs>
      <g className="lp-chain-lines">
        {nodes.map((n) => (
          <line key={n.label} x1="190" y1="170" x2={n.x} y2={n.y} />
        ))}
      </g>
      <circle className="lp-chain-halo" cx="190" cy="170" r="58" />
      <circle cx="190" cy="170" r="44" fill="url(#lp-core)" />
      <text className="lp-chain-core" x="190" y="166">Child</text>
      <text className="lp-chain-core" x="190" y="182">meal</text>
      {nodes.map((n) => (
        <g key={n.label}>
          <circle className="lp-chain-node" cx={n.x} cy={n.y} r="7" />
          <text className="lp-chain-label" x={n.x} y={n.y - 15}>{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

/** Disconnected vs connected. The left panel is a model, not a claim about anyone. */
function ContrastDiagram() {
  const scattered = [
    { x: 30, y: 34 }, { x: 132, y: 22 }, { x: 96, y: 96 },
    { x: 22, y: 128 }, { x: 148, y: 132 }, { x: 74, y: 168 },
  ];
  return (
    <div className="lp-contrast">
      <figure className="lp-contrast-panel">
        <svg viewBox="0 0 190 200" role="img" aria-label="Six separate points with no lines between them.">
          {scattered.map((p, i) => (
            <circle key={i} className="lp-loose" cx={p.x} cy={p.y} r="9" />
          ))}
        </svg>
        <figcaption>Without a shared operational chain</figcaption>
      </figure>
      <div className="lp-contrast-arrow" aria-hidden="true">→</div>
      <figure className="lp-contrast-panel is-joined">
        <svg viewBox="0 0 190 200" role="img" aria-label="The same six points joined to one record at the centre.">
          <g className="lp-joined-lines">
            {scattered.map((p, i) => (
              <line key={i} x1="95" y1="100" x2={p.x} y2={p.y} />
            ))}
          </g>
          {scattered.map((p, i) => (
            <circle key={i} className="lp-tight" cx={p.x} cy={p.y} r="9" />
          ))}
          <circle className="lp-joined-core" cx="95" cy="100" r="18" />
        </svg>
        <figcaption>The LunchBox Connect model</figcaption>
      </figure>
    </div>
  );
}

/**
 * An ABSTRACT representation of the Parent portal, derived from what the real
 * screens contain: today's meals for one child, the intake the Classroom
 * recorded, and this week's published menu. No child name, no invented score,
 * no claim of live tracking — this is a marketing shape, not a screenshot.
 */
function ParentDeviceVisual() {
  return (
    <div className="lp-phone" role="img" aria-label="An abstract representation of the Parent view: today's meals for one child, the intake recorded by the Classroom, and the published menu for the week.">
      <div className="lp-phone-screen">
        <span className="lp-phone-eyebrow">Today</span>
        <div className="lp-phone-rows">
          <div className="lp-phone-row"><i /><span className="w70" /><b /></div>
          <div className="lp-phone-row"><i /><span className="w50" /><b /></div>
          <div className="lp-phone-row"><i /><span className="w60" /><b className="pale" /></div>
        </div>
        <span className="lp-phone-eyebrow">This week’s menu</span>
        <div className="lp-phone-week">
          {['M', 'T', 'W', 'T', 'F'].map((d, i) => (
            <div key={i} className="lp-phone-day"><em>{d}</em><u /></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="lp">
      <a className="lp-skip" href="#main">Skip to content</a>

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
            <Link className="lp-link-login" to="/login">Client login</Link>
            <a className="lp-btn lp-btn-solid" href="#contact">Talk to us</a>
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
                Every child’s meal.
                <br />
                <span className="lp-accent">One accountable journey.</span>
              </h1>
              <p className="lp-lead">
                LunchBox Connect combines a managed meal service with the operating system behind
                it — connecting Institutions, Kitchen operations, Classroom teams and Parents around
                the same child-level meal journey.
              </p>
              <div className="lp-hero-actions">
                <a className="lp-btn lp-btn-solid" href="#journey">See the journey</a>
                <a className="lp-btn lp-btn-ghost" href="#contact">Talk to us</a>
              </div>
            </div>
            <div className="lp-hero-art"><ChainDiagram /></div>
          </div>
        </section>

        {/* ------------------------------------------------------- THE PROBLEM */}
        <section className="lp-section" id="why">
          <div className="lp-shell">
            <p className="lp-eyebrow lp-eyebrow-dark">Why LunchBox Connect</p>
            <h2 className="lp-h2">One meal crosses more boundaries than most people see.</h2>
            <p className="lp-body lp-body-wide">
              The challenge is not only preparing food. It is keeping the right meal connected to
              the right child as information moves between the Institution, Kitchen, delivery team,
              Classroom and Parent.
            </p>
            <ContrastDiagram />
          </div>
        </section>

        {/* --------------------------------------------------- UAE CONTEXT STRIP */}
        <section className="lp-context">
          <div className="lp-shell">
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
            <p className="lp-body lp-context-note">
              As the UAE’s private education sector grows, expectations around food, wellbeing,
              records and Parent engagement are becoming increasingly structured.
            </p>
            <p className="lp-source">
              Sources: KHDA, 24 August 2025 · Dubai Municipality, September 2025. Figures are as
              reported at those dates, not a live count.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------- FOUR OPERATIONAL VIEWS */}
        <section className="lp-section lp-section-tint" id="institutions">
          <div className="lp-shell">
            <h2 className="lp-h2 lp-h2-stack">
              One child.
              <br />
              Four different responsibilities.
              <br />
              <span className="lp-accent-ink">One connected record.</span>
            </h2>
            <div className="lp-views">
              {VIEWS.map((v, i) => (
                <article key={v.id} id={v.id === 'parents' ? undefined : v.id} className="lp-view">
                  <span className="lp-view-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{v.eyebrow}</h3>
                  <p>{v.body}</p>
                </article>
              ))}
            </div>
            <p className="lp-pull">
              The Parent is part of the information chain — not the internal operations chain.
            </p>
          </div>
        </section>

        {/* ----------------------------------------------------------- JOURNEY */}
        <section className="lp-section lp-journey-section" id="journey">
          <div className="lp-shell">
            <h2 className="lp-h2 lp-h2-center">
              From plan to Parent,
              <br />
              <span className="lp-accent">without losing the child in between.</span>
            </h2>
            <ol className="lp-journey">
              {JOURNEY.map((s) => (
                <li key={s.n}>
                  <span className="lp-journey-n">{s.n}</span>
                  <h3>{s.t}</h3>
                  <p>{s.a}</p>
                  <p>{s.b}</p>
                </li>
              ))}
            </ol>
            <div className="lp-food">
              <h3>The food service and the operating system are one offer today.</h3>
              <p>
                LunchBox Connect currently manages the meal service itself while the platform
                connects the operational journey behind it.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ PARENTS */}
        <section className="lp-section lp-parents" id="parents">
          <div className="lp-shell lp-parents-inner">
            <div className="lp-parents-copy">
              <p className="lp-eyebrow lp-eyebrow-dark">For Parents</p>
              <h2 className="lp-h2">
                Parents should see the part of the journey that belongs to their child.
              </h2>
              <p className="lp-body">
                LunchBox Connect keeps internal Kitchen and Institution operations private while
                giving the Parent controlled visibility into their own child’s published meal
                information and recorded Classroom outcome.
              </p>
              <p className="lp-note">
                Parent access is provided through the Institution.
              </p>
            </div>
            <div className="lp-parents-art"><ParentDeviceVisual /></div>
          </div>
        </section>

        {/* ------------------------------------------------------------- VISION */}
        <section className="lp-section lp-vision" id="vision">
          <div className="lp-shell">
            <div className="lp-today-tomorrow">
              <article className="lp-tt lp-tt-today">
                <span className="lp-tt-tag">Today</span>
                <h2>A managed meal service powered by its own operating system.</h2>
                <p>
                  LunchBox Connect operates the meal service while its platform connects multiple
                  Institutions through one controlled operational model.
                </p>
              </article>
              <article className="lp-tt lp-tt-tomorrow">
                <span className="lp-tt-tag">Tomorrow</span>
                <h2>A possible common operating layer for a larger ecosystem.</h2>
                <p>
                  If direct market validation supports it, the same architecture can evolve to
                  connect additional kitchens, caterers and education groups around a consistent
                  institutional child-food operating model.
                </p>
              </article>
            </div>

            <p className="lp-vision-line">
              Building the connected operating infrastructure for institutional child nutrition.
            </p>

            <div className="lp-context-refs">
              <div>
                <h4>Education</h4>
                <p>
                  Dubai Education 33: learner-centred education, engaged Parents and an innovative
                  ecosystem.
                </p>
              </div>
              <div>
                <h4>Food</h4>
                <p>
                  UAE Food Security Strategy 2051: technology-enabled food systems, nutrition, food
                  safety and reduced waste.
                </p>
              </div>
              <div>
                <h4>Operations</h4>
                <p>
                  Dubai Municipality / ADEK: increasingly structured food, nutrition, records and
                  operational expectations.
                </p>
              </div>
            </div>
            <p className="lp-source lp-source-strong">
              Public-sector references are provided as UAE market context only. They do not
              indicate endorsement, partnership or certification.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------ CONTACT */}
        <section className="lp-section lp-contact" id="contact">
          <div className="lp-shell">
            <h2 className="lp-h2 lp-h2-center">
              Let’s talk about how your meal operation works today.
            </h2>
            <p className="lp-body lp-body-center">
              If you run a nursery, school or education group, we can walk through your current meal
              journey and show where LunchBox Connect fits.
            </p>
            <div className="lp-contact-actions">
              <a className="lp-btn lp-btn-solid lp-btn-lg" href="mailto:kumai@lunchboxconnect.com">
                Talk to LunchBox Connect
              </a>
              <div className="lp-contact-direct">
                <a href="mailto:kumai@lunchboxconnect.com">kumai@lunchboxconnect.com</a>
                <a href="tel:+971559933354">+971 55 993 3354</a>
              </div>
            </div>
            <p className="lp-contact-parent">
              Already have a LunchBox Connect account? <Link to="/login">Client login →</Link>
            </p>
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
          <nav className="lp-footer-nav" aria-label="Footer">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>{n.label}</a>
            ))}
            <Link to="/login">Client login</Link>
          </nav>
        </div>
        <div className="lp-shell">
          <p className="lp-source lp-footer-note">
            References to UAE strategies, regulators and public-sector policies are included as
            market context only and do not imply endorsement, approval, certification or
            partnership.
          </p>
        </div>
      </footer>
    </div>
  );
}
