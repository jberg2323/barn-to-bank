#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  ShadingType,
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'docs');
const SITE_URL = 'https://barntobank.com';
const APP_URL = 'https://barntobank.com/app';
const LOGIN_URL = 'https://barntobank.com/app/login';
const GOLD = '8B6914';
const ACCENT = '2E5E34';
const LIGHT = 'F5F1E8';
const BORDER = 'CCCCCC';

const numbering = {
  config: [
    {
      reference: 'bullets',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    },
    {
      reference: 'numbers',
      levels: [{
        level: 0,
        format: LevelFormat.DECIMAL,
        text: '%1.',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    },
  ],
};

const styles = {
  default: { document: { run: { font: 'Arial', size: 22 } } },
  paragraphStyles: [
    {
      id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 36, bold: true, font: 'Arial', color: GOLD },
      paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0 },
    },
    {
      id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 28, bold: true, font: 'Arial', color: ACCENT },
      paragraph: { spacing: { before: 220, after: 140 }, outlineLevel: 1 },
    },
    {
      id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 24, bold: true, font: 'Arial' },
      paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 2 },
    },
  ],
};

const page = {
  size: { width: 12240, height: 15840 },
  margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
};

function text(str, opts = {}) {
  return new TextRun({ text: str, ...opts });
}

function para(children, opts = {}) {
  return new Paragraph({ ...opts, children: Array.isArray(children) ? children : [children] });
}

function bullet(textStr) {
  return para([text(textStr)], { numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80 } });
}

function numbered(textStr) {
  return para([text(textStr)], { numbering: { reference: 'numbers', level: 0 }, spacing: { after: 80 } });
}

function h1(str) {
  return para([text(str)], { heading: HeadingLevel.HEADING_1 });
}

function h2(str) {
  return para([text(str)], { heading: HeadingLevel.HEADING_2 });
}

function h3(str) {
  return para([text(str)], { heading: HeadingLevel.HEADING_3 });
}

function body(str, after = 120) {
  return para([text(str)], { spacing: { after } });
}

function link(label, url) {
  return new ExternalHyperlink({
    children: [new TextRun({ text: label, style: 'Hyperlink', color: '0563C1', underline: {} })],
    link: url,
  });
}

function table(rows, colWidths) {
  const cellCount = rows[0]?.length || 2;
  const defaultWidths = cellCount === 3
    ? [2200, 3000, 4160]
    : [2800, 6560];
  const widths = colWidths || defaultWidths;
  const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
  const borders = { top: border, bottom: border, left: border, right: border };
  const tableWidth = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((cells, rowIdx) => new TableRow({
      children: cells.map((cell, i) => new TableCell({
        borders,
        width: { size: widths[i], type: WidthType.DXA },
        shading: rowIdx === 0
          ? { fill: 'E8E0D0', type: ShadingType.CLEAR }
          : { fill: 'FFFFFF', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [para([text(cell, { bold: rowIdx === 0 })])],
      })),
    })),
  });
}

function docHeader(title) {
  return new Header({
    children: [para([
      text('Barn to Bank', { bold: true, color: GOLD }),
      text('   |   '),
      text(title, { italics: true, color: '666666' }),
    ], { spacing: { after: 0 } })],
  });
}

function docFooter() {
  return new Footer({
    children: [para([
      text('Barn to Bank — Texas Land Origination'),
      text('\t'),
      text('Page '),
      new TextRun({ children: [PageNumber.CURRENT] }),
    ], {
      tabStops: [{ type: 'right', position: 9360 }],
    })],
  });
}

function buildPitchDoc() {
  const children = [
    para([text('BARN TO BANK', { bold: true, size: 52, color: GOLD })], { spacing: { after: 80 } }),
    para([text('Texas Land Origination Platform', { size: 28, color: ACCENT })], { spacing: { after: 200 } }),
    para([
      text('Live app: '),
      link(APP_URL, APP_URL),
    ], { spacing: { after: 240 } }),

    h1('The Pitch'),
    body('Maps show parcels. Barn to Bank runs origination — the full path from a raw land lead to a defensible develop, flip, or retail decision. It is built for Texas land teams who need speed, compliance, and a compounding data moat — not another spreadsheet.'),

    h2('The Problem'),
    bullet('Land origination is fragmented across county GIS, FEMA, utility CCNs, id.land, Forewarn, and broker notes.'),
    bullet('Texas non-disclosure means comps live in heads and inboxes — not in Zillow.'),
    bullet('Sewer and entitlement bottlenecks kill deals late, after time is wasted on outreach.'),
    bullet('TCPA and DNC rules make owner contact risky without a scrub trail.'),
    bullet('Partners cannot share pipeline without emailing stale JSON or rebuilding spreadsheets.'),

    h2('The Solution'),
    body('Barn to Bank is a single-file web app — no install, no IT ticket. One address or parcel ID triggers Automation 1 enrichment, routes the deal into three silos, gates outreach through DNC scrub, and syncs team intel to Supabase.'),

    table([
      ['Capability', 'What it does'],
      ['Automation 1', 'Enriches jurisdiction, flood, utilities, comps, SF communities, owner contact'],
      ['Entitlement Score', 'Weighted 0–100 score with Develop / Sell / Retail recommendation'],
      ['Three-Silo Routing', 'Keeps develop, flip, and retail lanes separate'],
      ['Outreach CRM', 'DNC scrub, text/mail queues, TCPA audit trail'],
      ['Moat Intelligence', 'Comp lake, plat alerts, deal memos, cloud sync'],
      ['Team Sync', 'Supabase-backed Cloud Sync — shared pipeline across browsers'],
    ]),

    h2('Why Texas, Why Now'),
    bullet('Non-disclosure comps: every logged sale compounds pricing power.'),
    bullet('CCN / sewer gaps: entitlement score surfaces bottlenecks before LOI.'),
    bullet('Builder adjacency: plat alerts and SF community radius show where demand is moving.'),
    bullet('Ag exemptions and ETJ complexity: enrichment pulls jurisdiction and flood in one pass.'),

    h2('Who It Is For'),
    bullet('Land originators and acquisition teams underwriting Texas tracts'),
    bullet('Partners and analysts (e.g. Jack) who need shared pipeline without software installs'),
    bullet('Brokers evaluating develop vs. flip vs. retail on each parcel'),
    bullet('Small teams that need compliance discipline without enterprise CRM cost'),

    h2('The Moat'),
    body('The tool gets more valuable every time you use it. Each comp logged, deal enriched, and outreach touch recorded makes the next underwriting faster. Cloud Sync means the moat is shared — not trapped in one browser.'),

    h2('What It Is Not (Yet)'),
    bullet('Not a full CRM or closing / title platform'),
    bullet('Not a replacement for county clerk research or legal entitlement opinion'),
    bullet('Forewarn and DNC APIs require production keys from your secret store'),
    bullet('Plat filings are seeded — swap for live county clerk / HBA feed when ready'),

    h2('Call to Action'),
    numbered(`Open ${APP_URL} and sign in`),
    numbered('Run Automation 1 on a Bastrop, Bexar, Comal, or Caldwell tract'),
    numbered('Review entitlement score and assign a silo route'),
    numbered('Go to Intel → Cloud Sync to share with your team'),
    numbered('Submit ideas via Feature Request in the header'),

    h2('Contact & Sharing'),
    body('Share the app link with anyone on your team. Each user keeps their own id.land login in-browser. Team data syncs via Cloud Sync (Supabase).'),
    para([text('App URL: '), link(APP_URL, APP_URL)], { spacing: { after: 120 } }),
    body('Feature requests route to jeremy@cto.com via mailto on submit.'),
  ];

  return new Document({
    styles,
    numbering,
    sections: [{
      properties: { page },
      headers: { default: docHeader('Pitch Document') },
      footers: { default: docFooter() },
      children,
    }],
  });
}

function buildHowToDoc() {
  const children = [
    para([text('BARN TO BANK', { bold: true, size: 52, color: GOLD })], { spacing: { after: 80 } }),
    para([text('Complete How-To Guide', { size: 28, color: ACCENT })], { spacing: { after: 120 } }),
    para([text('Staff app: '), link(APP_URL, APP_URL)], { spacing: { after: 60 } }),
    para([text('Public site: '), link(SITE_URL, SITE_URL)], { spacing: { after: 240 } }),

    h1('What This Platform Is'),
    body('Barn to Bank is two connected pieces: a public marketing site that captures land leads, and a password-protected origination app where your team enriches parcels, routes deals, reaches owners, and builds a compounding intel moat.'),
    table([
      ['Piece', 'URL', 'Who uses it'],
      ['Public marketing site', SITE_URL, 'Landowners, brokers, visitors'],
      ['Staff origination app', APP_URL, 'Jack, analysts, origination team'],
      ['Staff login', LOGIN_URL, 'Anyone with the origination password'],
    ]),

    h1('Quick Start — First 10 Minutes'),
    numbered(`Go to ${APP_URL} and sign in with the origination password.`),
    numbered('Dismiss the welcome card on the left (or read it — it explains the four-step workflow).'),
    numbered('In Intake, choose a county and enter a property address or parcel/APN.'),
    numbered('Click Run Automation 1. Wait for jurisdiction, flood, utilities, comps, and owner contact to populate.'),
    numbered('Click + Add to Pipeline.'),
    numbered('Open the Deals tab, click the new deal, review entitlement score and route (Develop / Sell / Retail).'),
    numbered('Go to Outreach → Build Mail List → print labels or export CSV (no DNC vendor needed).'),
    numbered('Go to Intel → Cloud Sync to share pipeline with your team.'),

    h1('Signing In & Security'),
    bullet(`Staff app and APIs are protected. Bookmark ${LOGIN_URL} if prompted.`),
    bullet('Password is set in Vercel as ORIGINATION_PASSWORD — ask your admin if you do not have it.'),
    bullet('Sign Out is in the header (desktop). Session lasts 30 days in your browser.'),
    bullet('Public site contact form posts to /api/leads without a password — those leads appear in Website Leads inside the app.'),
    bullet('Theme toggle (sun/moon) in the header switches light and dark mode; preference is saved in your browser.'),

    h1('Navigation'),
    body('Desktop: use the sticky section bar — Intake | Deals | Silos | Outreach | Intel.'),
    body('Mobile: same section bar at the bottom of the header area; ← Site returns to the public marketing site; ← Main Site in the header does the same.'),
    table([
      ['Tab', 'What you do here'],
      ['Intake', 'Enter address/APN, run Automation 1, connect id.land, view website leads'],
      ['Deals', 'Pipeline table or cards, open deal modal, quick add'],
      ['Silos', 'Deals grouped by Develop, Sell (Flip), Retail'],
      ['Outreach', 'Direct mail (default) or cold texts (DNC vendor required)'],
      ['Intel', 'Comp lake, plat alerts, audit log, cloud sync, website leads refresh'],
    ]),
    body('Header buttons: Copy App Link (share with team), Feature Request, Intel (jump to moat), Cloud Sync (immediate team sync), Theme, Sign Out.'),

    h1('1. Intake — From Lead to Enriched Deal'),
    h2('Website Leads (inbound)'),
    bullet('Leads from the public site contact form land in Website Leads on the Intake panel.'),
    bullet('Click Refresh to pull latest from Supabase.'),
    bullet('Statuses: new → contacted → converted or dismissed.'),
    bullet('Inbound leads do not need DNC scrub — they contacted you first.'),

    h2('Automation 1 (parcel enrichment)'),
    h3('Step-by-step'),
    numbered('Select Lookup Type: Property Address or Parcel / APN.'),
    numbered('Enter the full address or parcel ID.'),
    numbered('Choose county from the dropdown.'),
    numbered('Click Run Automation 1. Watch the pipeline steps complete.'),
    numbered('Review enrichment — toggle Internal vs Client view (client view redacts skip-trace phones).'),
    numbered('Click + Add to Pipeline.'),

    h3('What Automation 1 pulls'),
    bullet('Jurisdiction: city limits, ETJ, or unincorporated county'),
    bullet('FEMA flood zone and SFHA (Special Flood Hazard Area) flag'),
    bullet('PUC water and sewer CCN (utility service areas)'),
    bullet('Private comps from Comp Lake + county seed data'),
    bullet('Nearby for-sale SF communities within radius'),
    bullet('Owner contact via Forewarn (mock until production API key is configured)'),
    bullet('Entitlement score 0–100 and Develop / Sell / Retail recommendation'),

    h3('id.land connection (optional, recommended)'),
    bullet('Enter id.land email/password or paste a Bearer token under Advanced.'),
    bullet('Token stays in your browser only — never stored in the repo.'),
    bullet('Live token upgrades parcel geometry, land use, and market comps from MOCK to LIVE.'),

    h1('2. Pipeline — Manage Deals'),
    h3('Views'),
    bullet('Table view: sortable columns, status, route badge, entitlement pill.'),
    bullet('Cards view: better on phone — acreage, comp band, bottleneck flag.'),
    bullet('Click any row or card to open the full deal modal.'),

    h3('Adding deals'),
    bullet('From Intake: after Automation 1, click + Add to Pipeline.'),
    bullet('Quick Add: manual entry without enrichment — run Automation 1 later from the deal modal.'),

    h3('Deal modal — key sections'),
    bullet('Entitlement Score and route recommendation'),
    bullet('Enriched property, tax history, utilities, flood'),
    bullet('Automation 1 report card and nearby SF communities'),
    bullet('Owner contact panel (internal view shows phones; client view redacts)'),
    bullet('Outreach CRM: contact status, sequence, touches'),
    bullet('Margin analysis: entitled value, flip spread, retail commission'),
    bullet('Deal Memo: printable PDF-style summary for partners or sellers'),

    h1('3. Three-Silo Routing'),
    body('Every deal gets a route — use the dropdown on the card or in the modal.'),
    bullet('Develop / Entitle: sewer/utilities and builder spillover support entitlement plays'),
    bullet('Sell (Flip): comp-supported acquisition where entitlement is the bottleneck'),
    bullet('Retail: smaller tracts or straight brokerage/listing plays'),
    body('Silos tab shows lane counts and total acres. Entitlement-bottlenecked tracts are excluded from outreach queues.'),

    h1('4. Outreach — Reach Owners'),
    h2('Choose your path (important)'),
    table([
      ['Method', 'DNC vendor needed?', 'When to use'],
      ['Direct mail (recommended)', 'No', 'Letters and Avery labels — start here'],
      ['Cold texts', 'Yes (e.g. DNCScrub)', 'Only with federal DNC scrub configured'],
      ['Inbound website leads', 'No', 'They filled out your form — call or email back'],
    ]),
    body('The app defaults to direct mail. The federal Do Not Call list does not apply to postal mail. Cold unsolicited texts carry TCPA risk ($500–$50,000+ per violation) without proper scrubbing.'),

    h2('Direct mail workflow (2 steps)'),
    numbered('Go to Outreach tab (mail tab is selected by default).'),
    numbered('Click Build Mail List.'),
    numbered('Step 1 — Pick tracts: check eligible deals (not entitlement-bottlenecked, has owner contact).'),
    numbered('Click Build Mail Queue — no DNC scrub step.'),
    numbered('Export CSV or Print Labels for Avery-style mail merge.'),
    body('Eligible deals need Forewarn owner contact and must not be flagged as entitlement bottlenecked.'),

    h2('Cold texts workflow (advanced, 3 steps)'),
    numbered('In Outreach, switch to the Cold texts tab OR choose Cold texts in the wizard mode picker.'),
    numbered('Click Build Text List.'),
    numbered('Step 1 — Pick tracts. Step 2 — Run Federal DNC Registry Scrub (requires DNC_SCRUB_API_KEY on Vercel). Step 3 — Review text queue.'),
    bullet('Only DNC-cleared numbers can be queued.'),
    bullet('Blocked numbers show DNC — DO NOT CONTACT.'),
    bullet('Edit template with {{owner_name}} and {{county}} merge fields.'),
    body('Until a DNC vendor API key is configured, scrub runs in mock mode for testing only — do not send real cold texts against mock results.'),

    h1('5. Intel — Moat Intelligence'),
    h3('Comp Lake'),
    bullet('+ Log Comp: record off-market sales (county, submarket, $/ac, buyer, date, notes).'),
    bullet('Comps feed entitlement scoring and margin bands for that county.'),
    bullet('Texas non-disclosure: logged comps are proprietary — this is your moat.'),

    h3('Plat & Development Alerts'),
    body('Plat filings within ~8 miles of pipeline deals in the same county. Builder adjacency often drives the thesis.'),

    h3('Website Leads'),
    body('Same inbound leads from barntobank.com — refresh, review, and mark contacted/converted from Intel or Intake.'),

    h3('Outreach Audit Log'),
    body('Timestamped trail: DNC scrubs, queued texts, mail queue builds, comp logs, bundle import/export, cloud sync.'),

    h3('Team Moat Sync'),
    bullet('Cloud Sync: merges local browser data with Supabase team bundle (deals, comps, audit, outreach).'),
    bullet('Export Bundle: download JSON backup or email to a partner.'),
    bullet('Import Bundle: upload a teammate\'s JSON file.'),
    bullet('Status bar shows Supabase connection and last sync time.'),

    h1('6. Working With Your Team'),
    bullet('Copy App Link in header — sends partners to barntobank.com/app.'),
    bullet('Each person signs in separately; id.land tokens are per-browser.'),
    bullet('Cloud Sync on Intel tab merges everyone\'s work into one team moat.'),
    bullet('Feature Request: submit product ideas from the header.'),
    bullet('Works on iPhone and desktop — use ← Site to return to the public marketing page.'),

    h1('7. Public Marketing Site'),
    body(`The public site at ${SITE_URL} is separate from the staff app.`),
    bullet('Visitors see farms, ranches, and land positioning for Central Texas.'),
    bullet('Contact form submits to /api/leads → Website Leads in the staff app.'),
    bullet('No password required on the public site.'),
    bullet('Staff reach the app via /app or the login link.'),

    h1('8. Counties & Data Sources'),
    body('Intake counties include Williamson, Travis, Bastrop, Caldwell, Hays, Comal, Bexar, Guadalupe, Fort Bend, Smith (Tyler), and more.'),
    bullet('County GIS / ArcGIS for parcel attributes'),
    bullet('FEMA NFHL for flood zones'),
    bullet('Texas PUC for water/sewer CCN boundaries'),
    bullet('id.land for parcel detail and comps (with token)'),
    bullet('Forewarn for owner contact (production key required)'),
    bullet('DNCScrub for federal DNC registry (cold texts only)'),

    h1('9. Admin & Setup (for operators)'),
    table([
      ['Task', 'How'],
      ['Deploy', 'Git push to main → Vercel auto-deploys to barntobank.com'],
      ['Set staff password', 'Vercel env: ORIGINATION_PASSWORD'],
      ['Enable cloud sync', 'Vercel env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MOAT_TEAM_ID'],
      ['Enable live DNC scrub', 'Vercel env: DNC_SCRUB_API_KEY — run npm run provision-dncscrub-mcp'],
      ['Provision Supabase', 'npm run provision-supabase-mcp'],
    ]),

    h1('10. Tips & Troubleshooting'),
    table([
      ['Issue', 'Fix'],
      ['Redirected to login', 'Session expired — sign in again at /app/login'],
      ['Cloud Sync not configured', 'Supabase env vars missing on Vercel — use Export/Import Bundle offline'],
      ['Enrichment shows MOCK', 'Connect id.land token; some counties use mock profile until CAD REST is wired'],
      ['Deal excluded from outreach', 'Entitlement bottleneck or missing owner contact'],
      ['DNC scrub failed', 'Set DNC_SCRUB_API_KEY or use direct mail instead'],
      ['Text blocked after scrub', 'Number on DNC list — use mail, do not text'],
      ['Website lead not showing', 'Click Website Leads Refresh on Intake or Intel'],
      ['Stale UI after update', 'Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)'],
      ['www vs apex domain', 'Both barntobank.com and www.barntobank.com point to Vercel'],
    ]),

    h1('11. Daily Workflow Cheat Sheet'),
    numbered('Morning: Intel → Cloud Sync. Review Website Leads.'),
    numbered('Intake: run Automation 1 on new tracts or inbound inquiries.'),
    numbered('Deals: route each tract Develop / Sell / Retail; open modal for margin check.'),
    numbered('Log comps after every broker call or off-market sale (+ Log Comp).'),
    numbered('Outreach: Build Mail List weekly; export CSV to mail house or print labels.'),
    numbered('End of day: Cloud Sync again so Jack sees your pipeline.'),

    h1('12. Glossary'),
    bullet('Automation 1: multi-source intake enrichment pipeline'),
    bullet('CCN: Certificate of Convenience and Necessity (Texas utility franchise area)'),
    bullet('SFHA: Special Flood Hazard Area on FEMA maps'),
    bullet('Entitlement bottleneck: no central sewer CCN — limits develop path'),
    bullet('Comp band: asking price vs your private comp average'),
    bullet('Moat bundle: JSON export of deals, comps, audit, outreach state'),
    bullet('TCPA: federal law governing calls/texts to cell phones'),
    bullet('DNC: National Do Not Call Registry — applies to cold calls/texts, not mail'),
    bullet('SAN: FTC Subscription Account Number — required for live federal DNC scrub vendors'),

    h2('Ready?'),
    para([text('Sign in at '), link(LOGIN_URL, LOGIN_URL), text(', run your first tract, and build your first mail list.')], { spacing: { after: 200 } }),
  ];

  return new Document({
    styles,
    numbering,
    sections: [{
      properties: { page },
      headers: { default: docHeader('How-To Guide') },
      footers: { default: docFooter() },
      children,
    }],
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pitch = buildPitchDoc();
  const howto = buildHowToDoc();
  const pitchPath = path.join(OUT_DIR, 'Barn-to-Bank-Pitch.docx');
  const howtoPath = path.join(OUT_DIR, 'Barn-to-Bank-How-To.docx');
  fs.writeFileSync(pitchPath, await Packer.toBuffer(pitch));
  fs.writeFileSync(howtoPath, await Packer.toBuffer(howto));
  console.log('Created:', pitchPath);
  console.log('Created:', howtoPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});