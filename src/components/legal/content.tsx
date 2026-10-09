/**
 * Legal text, written from what the app actually does today. Original wording.
 * Details the owner has not decided (entity, address, contact, governing law)
 * come from BRAND and render as visible placeholders; `npm run check:release`
 * fails while any remain.
 */
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { TBD, type LegalSection } from "./LegalPage";

const Entity = () => <TBD value={BRAND.legalEntity} />;
const Contact = () => <TBD value={BRAND.contactEmail} />;

export const TERMS_INTRO = (
  <p>
    These terms cover your use of {BRAND.name} (&ldquo;the service&rdquo;), provided by <Entity /> (&ldquo;we&rdquo;). The service is
    currently a demo. By using it you agree to these terms, our <Link href="/legal/privacy" className="text-accent-text underline underline-offset-2">Privacy Policy</Link> and our{" "}
    <Link href="/legal/usage" className="text-accent-text underline underline-offset-2">Usage Policy</Link>.
  </p>
);

export const TERMS: LegalSection[] = [
  {
    id: "service",
    title: "What the service is",
    body: (
      <>
        <p>
          {BRAND.name} is a research aid for investigating AI systems: you state a question, and the service helps you plan experiments, collect
          evidence and summarise results.
        </p>
        <p>
          It is an aid, not an authority. Outputs, including interpretations written by the research agent, can be wrong or incomplete. Check results
          independently before you rely on them, and do not use the service as the only basis for decisions with legal, safety, medical or financial
          consequences.
        </p>
        <p>In the demo, every experiment run is simulated from fixed or seeded data. Demo results describe no real system.</p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts",
    body: (
      <>
        <p>The demo has no accounts and no sign-in. The &ldquo;Demo researcher&rdquo; identity is shared by everyone and stores nothing about you.</p>
        <p>
          If accounts are introduced, you will be responsible for keeping your credentials safe and for activity under your account, and you must give
          accurate information when you sign up.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <p>
        You must follow the <Link href="/legal/usage" className="text-accent-text underline underline-offset-2">Usage Policy</Link>. In short: only test
        systems you are authorised to test, respect their providers&apos; terms, and do not use the service to cause harm.
      </p>
    ),
  },
  {
    id: "ip",
    title: "Intellectual property",
    body: (
      <>
        <p>
          You keep whatever rights you have in the questions, notes and data you put into the service. Ownership of outputs, and the licence we need
          to operate the service: <TBD value={BRAND.ipTerms} />. They will be set out here before the service leaves the demo.
        </p>
        <p>The service&apos;s software, design and name belong to <Entity /> or its licensors. Fonts are used under the SIL Open Font License.</p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <p>
        The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent the law allows, we make no promise that it will be
        accurate, uninterrupted or fit for a particular purpose. Statistical results depend on the data and assumptions behind them; the service shows its
        checks so you can judge them, but it cannot make a weak design strong.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, or for decisions you make based on outputs of the service.
        Nothing in these terms limits liability that cannot be limited by law.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Suspension and termination",
    body: (
      <p>
        You can stop using the service at any time; in the demo, closing the tab or choosing &ldquo;Exit demo&rdquo; is enough. We may suspend or end
        access if you break these terms or the Usage Policy, or if we stop offering the service.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These terms are governed by the law of <TBD value={BRAND.governingLaw} />.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <>
        <p>We will update these terms as the service develops and change the date at the top when we do. Material changes will be announced in the app.</p>
        <p>
          Contact: <Contact />. Postal address: <TBD value={BRAND.address} />.
        </p>
      </>
    ),
  },
];

export const PRIVACY_INTRO = (
  <p>
    This policy explains what {BRAND.name} does with information. The short version for the demo: everything stays in your browser. The service sets no
    cookies, runs no analytics and sends nothing you type to us or to anyone else.
  </p>
);

export const PRIVACY: LegalSection[] = [
  {
    id: "today",
    title: "What happens today, in the demo",
    body: (
      <>
        <ul>
          <li>
            Investigations, experiments, samples and notes you create are kept in your browser&apos;s <code className="font-mono text-[14px]">sessionStorage</code> for
            this tab. They disappear when you close the tab, or when you choose &ldquo;Clear local data&rdquo; in Settings.
          </li>
          <li>
            Preferences (theme, motion, sidebar width, the AI system you last picked, where you left off in each investigation, and whether you have
            seen the logo reveal) are kept in <code className="font-mono text-[14px]">localStorage</code> on this device.
          </li>
          <li>The app sets no cookies and loads no analytics, advertising or third-party scripts.</li>
          <li>Questions and notes you type are processed in your browser by a rule-based demo. They are not sent to us or to any model provider.</li>
          <li>Our hosting provider receives the standard information any website request carries (such as your IP address and browser type) to deliver the pages.</li>
        </ul>
        <p>You can remove everything at any time: use Settings → Clear local data, or clear this site&apos;s data in your browser.</p>
      </>
    ),
  },
  {
    id: "connected",
    title: "When connected to a provider (not yet available)",
    body: (
      <>
        <p>
          A future version may connect to the AI systems you investigate and to supporting services. This section will describe that in full before it
          ships. It will cover at least:
        </p>
        <ul>
          <li>What is sent to model providers: the prompts and configuration of the experiments you run, and nothing beyond what a run needs.</li>
          <li>Retention: how long runs, samples and traces are kept, and how to shorten it. Not decided.</li>
          <li>Sub-processors: the hosting, storage and model providers involved. Not decided.</li>
          <li>Deletion: how to delete an investigation and all its data, and how long deletion takes. Not decided.</li>
        </ul>
        <p>No retention period, certification or compliance status is claimed here, because none has been decided.</p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your choices",
    body: (
      <p>
        Because the demo keeps data only in your browser, you control it directly. If accounts and server storage are introduced, this section will
        explain how to access, export, correct and delete your data. Settings → Export all as JSON already gives you a full copy of what the demo holds.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about privacy: <Contact />. Controller: <Entity />, <TBD value={BRAND.address} />.
      </p>
    ),
  },
];

export const USAGE_INTRO = (
  <p>
    {BRAND.name} is for understanding AI systems: how they behave, where they fail, and whether a change makes them better. This policy sets the limits on
    how it may be used.
  </p>
);

export const USAGE: LegalSection[] = [
  {
    id: "authorised",
    title: "Only test what you may test",
    body: (
      <ul>
        <li>Investigate only systems you own or are explicitly authorised to test.</li>
        <li>Follow the terms of service and rate limits of every system and provider you use, including any rules on evaluations and benchmarking.</li>
        <li>Do not use the service to get around access controls, safety measures or usage limits of another system.</li>
      </ul>
    ),
  },
  {
    id: "prohibited",
    title: "Prohibited uses",
    body: (
      <ul>
        <li>Developing or deploying content or tools meant to harm people, including weapons, malware, harassment or fraud.</li>
        <li>Extracting personal data, training data or confidential information from a system without permission.</li>
        <li>Testing on real people&apos;s personal data without a lawful basis and their consent where required.</li>
        <li>Publishing results in a way that misrepresents them, for example by hiding failed checks or presenting simulated runs as real.</li>
        <li>Anything that breaks the law where you or the tested system operate.</li>
      </ul>
    ),
  },
  {
    id: "findings",
    title: "Handling what you find",
    body: (
      <p>
        If an investigation reveals a security or safety problem in someone else&apos;s system, report it to that system&apos;s owner through their
        disclosure channel before publishing, and give them reasonable time to respond.
      </p>
    ),
  },
  {
    id: "report",
    title: "Reporting a problem",
    body: (
      <p>
        To report misuse of the service or a problem with it, write to <Contact />. Include what happened and, if you can, a link to the investigation.
      </p>
    ),
  },
];
