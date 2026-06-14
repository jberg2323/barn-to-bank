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
const APP_URL = 'https://barn-to-bank.vercel.app';
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

function table(rows, colWidths = [2800, 6560]) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
  const borders = { top: border, bottom: border, left: border, right: border };
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows.map((cells, rowIdx) => new TableRow({
      children: cells.map((cell, i) => new TableCell({
        borders,
        width: { size: colWidths[i], type: WidthType.DXA },
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
    numbered(`Open ${APP_URL}`),
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
    para([text('How-To Guide', { size: 28, color: ACCENT })], { spacing: { after: 200 } }),
    para([text('Live app: '), link(APP_URL, APP_URL)], { spacing: { after: 240 } }),

    h1('Quick Start (5 Minutes)'),
    numbered('Open the app link in Chrome or Safari (desktop or phone).'),
    numbered('Read the welcome card, then dismiss it.'),
    numbered('In Intake, pick a county and enter an address or parcel number.'),
    numbered('Optional: sign in to id.land for full parcel and comp data.'),
    numbered('Click Run Automation 1 → review → Add to Pipeline.'),
    numbered('Open Intel → Cloud Sync to merge with your team.'),

    h1('Navigation'),
    body('Use the section bar under the header: Intake | Deals | Silos | Outreach | Intel.'),
    table([
      ['Tab', 'What you do here'],
      ['Intake', 'Enter address/APN, run Automation 1 enrichment'],
      ['Deals', 'View pipeline table or cards, open deal details'],
      ['Silos', 'See deals grouped by Develop, Sell, Retail'],
      ['Outreach', 'Build outreach list, DNC scrub, text/mail queues'],
      ['Intel', 'Comp lake, plat alerts, audit log, Cloud Sync'],
    ]),
    body('Header shortcuts: Intel jumps to Moat Intelligence. Cloud Sync runs team sync immediately.'),

    h1('1. Intake — Run Automation 1'),
    h3('Step-by-step'),
    numbered('Select Lookup Type: Property Address or Parcel / APN.'),
    numbered('Enter the full address (e.g. 6200 Old Pearsall Rd, San Antonio TX) or parcel ID.'),
    numbered('Choose the county from the dropdown.'),
    numbered('Click Run Automation 1 and wait for the pipeline steps to complete.'),
    numbered('Review the enrichment panel — toggle Internal vs Client view.'),
    numbered('Click + Add to Pipeline when ready.'),

    h3('What Automation 1 pulls'),
    bullet('Jurisdiction: city limits, ETJ, or county-only'),
    bullet('FEMA flood zone and SFHA flag'),
    bullet('PUC water and sewer CCN holders'),
    bullet('Private comps for the county (Comp Lake + seed data)'),
    bullet('Nearby for-sale SF communities (Waterloo BTR excluded from radius)'),
    bullet('Owner contact (Forewarn — license-gated mock until API key is set)'),

    h3('id.land connection'),
    bullet('Enter your id.land email and password, or paste a Bearer token under Advanced.'),
    bullet('Token stays in your browser only — not committed to the app file.'),
    bullet('With a valid token, parcel and comp fields upgrade from MOCK to LIVE.'),

    h1('2. Pipeline — Manage Deals'),
    h3('Viewing deals'),
    bullet('Table view: sortable list with status, route, entitlement score pill.'),
    bullet('Cards view: mobile-friendly cards with comp band summary.'),
    bullet('Click any row or card to open the full deal modal.'),

    h3('Adding deals'),
    bullet('+ From Intake: scroll to intake after running Automation 1.'),
    bullet('+ Quick Add: manual entry without enrichment (run Automation 1 later).'),

    h3('Deal modal sections'),
    bullet('Entitlement Score: 0–100 with Develop / Sell / Retail recommendation'),
    bullet('Enriched property data, tax history, utilities'),
    bullet('Automation 1 report card and nearby SF communities'),
    bullet('Outreach CRM: status, sequence, touches, outcome'),
    bullet('Margin analysis: entitled value, flip, retail commission'),
    bullet('Internal Memo / Client Memo: printable deal summary'),

    h1('3. Three-Silo Routing'),
    body('Assign each deal to the best path using the route dropdown on the card or in the modal.'),
    bullet('Develop / Entitle: utilities and SF spillover support entitlement'),
    bullet('Sell (Flip): comp-supported flip where sewer is the bottleneck'),
    bullet('Retail: smaller tracts or brokerage commission plays'),
    body('Use the Silos tab to see lane counts and acres at a glance.'),

    h1('4. Outreach — Owner Contact'),
    h3('Build Outreach List wizard (3 steps — cannot skip)'),
    numbered('Filter: only enriched, non-bottlenecked deals with owner contact are eligible.'),
    numbered('DNC Scrub: run Federal DNC Registry scrub on every number (required).'),
    numbered('Queue: cleared numbers go to text queue; mail pieces go to direct mail.'),

    h3('Text queue'),
    bullet('Edit the template — use {{owner_name}} and {{county}} merge fields.'),
    bullet('Only DNC-cleared numbers can be queued.'),
    bullet('Blocked numbers stay labeled DNC — DO NOT CONTACT.'),

    h3('Direct mail'),
    bullet('Export CSV for mail merge.'),
    bullet('Print Labels opens a print-ready Avery-style label view.'),

    h1('5. Intel — Moat Intelligence'),
    h3('Comp Lake'),
    bullet('Click + Log Comp to record off-market sales (county, submarket, $/ac, buyer, date).'),
    bullet('Comps feed entitlement scoring and margin analysis for that county.'),
    bullet('Texas non-disclosure: every comp you log is proprietary moat data.'),

    h3('Plat & Development Alerts'),
    body('Shows plat filings within 8 miles of pipeline deals in the same county. Adjacency often drives the thesis.'),

    h3('Outreach Audit Log'),
    body('TCPA trail: DNC scrubs, queued texts, comp logs, bundle import/export, cloud sync — all timestamped.'),

    h3('Team Moat Sync'),
    bullet('Cloud Sync: merges your local data with Supabase team bundle (deals, comps, audit, outreach).'),
    bullet('Export Bundle: download JSON to share offline.'),
    bullet('Import Bundle: upload a teammate\'s JSON file.'),
    body('Status bar shows Supabase connection and last sync time.'),

    h1('6. Working With Your Team'),
    bullet('Copy App Link in the header — send to Jack or any partner.'),
    bullet('Each person uses their own browser; Cloud Sync merges on Intel tab.'),
    bullet('Feature Request button: submit ideas (routes to jeremy@cto.com).'),
    bullet('No software install — works on phone and desktop.'),

    h1('7. Counties Supported'),
    body('Intake dropdown: Williamson, Travis, Bastrop, Caldwell, Hays, Comal, Bexar, Guadalupe, Fort Bend, Smith (Tyler). Seed deals included for Bastrop, Caldwell, Comal, Bexar.'),

    h1('8. Tips & Troubleshooting'),
    table([
      ['Issue', 'Fix'],
      ['Cloud Sync says not configured', 'Deploy must be on Vercel with Supabase env vars. Use Export/Import Bundle offline.'],
      ['Enrichment shows MOCK', 'Connect id.land token or county may lack public CAD REST — mock profile fills gaps.'],
      ['Deal excluded from outreach', 'Entitlement bottleneck (no sewer) or missing owner contact.'],
      ['Text blocked', 'Number failed DNC scrub — do not contact. Use direct mail instead.'],
      ['Intel tab empty on phone', 'Tap Intel in section nav — moat section is panel-only on mobile.'],
      ['Hard refresh', 'Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows) after updates.'],
    ]),

    h1('9. Glossary'),
    bullet('Automation 1: multi-source intake enrichment pipeline'),
    bullet('CCN: Certificate of Convenience and Necessity (Texas utility service area)'),
    bullet('SFHA: Special Flood Hazard Area (FEMA)'),
    bullet('Entitlement bottleneck: no central sewer CCN — limits develop path'),
    bullet('Comp band: asking price vs private comp average for the county'),
    bullet('Moat bundle: JSON export of deals, comps, audit, and outreach state'),

    h2('Ready?'),
    para([text('Open '), link(APP_URL, APP_URL), text(' and run your first tract.')], { spacing: { after: 200 } }),
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