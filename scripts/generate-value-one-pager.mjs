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
const OUT = path.join(__dirname, '..', 'docs', 'Barn-to-Bank-Value-One-Pager-Jack.docx');

const GOLD = '8B6914';
const ACCENT = '2E5E34';
const BORDER = 'CCCCCC';

const numbering = {
  config: [{
    reference: 'bullets',
    levels: [{
      level: 0,
      format: LevelFormat.BULLET,
      text: '•',
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 540, hanging: 270 } } },
    }],
  }],
};

const styles = {
  default: { document: { run: { font: 'Arial', size: 20 } } },
  paragraphStyles: [
    {
      id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 32, bold: true, font: 'Arial', color: GOLD },
      paragraph: { spacing: { before: 0, after: 100 }, outlineLevel: 0 },
    },
    {
      id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 22, bold: true, font: 'Arial', color: ACCENT },
      paragraph: { spacing: { before: 140, after: 60 }, outlineLevel: 1 },
    },
  ],
};

const page = {
  size: { width: 12240, height: 15840 },
  margin: { top: 900, right: 1080, bottom: 720, left: 1080 },
};

function text(str, opts = {}) {
  return new TextRun({ text: str, ...opts });
}

function para(children, opts = {}) {
  return new Paragraph({ ...opts, children: Array.isArray(children) ? children : [children] });
}

function bullet(textStr) {
  return para([text(textStr)], { numbering: { reference: 'bullets', level: 0 }, spacing: { after: 40 } });
}

function h1(str) {
  return para([text(str)], { heading: HeadingLevel.HEADING_1 });
}

function h2(str) {
  return para([text(str)], { heading: HeadingLevel.HEADING_2 });
}

function body(str, after = 60) {
  return para([text(str)], { spacing: { after } });
}

function link(label, url) {
  return new ExternalHyperlink({
    children: [new TextRun({ text: label, style: 'Hyperlink', color: '0563C1', underline: {} })],
    link: url,
  });
}

function table(rows, colWidths) {
  const widths = colWidths || [2400, 2200, 2200, 2560];
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
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [para([text(cell, { bold: rowIdx === 0, size: rowIdx === 0 ? 18 : 18 })])],
      })),
    })),
  });
}

const doc = new Document({
  numbering,
  styles,
  sections: [{
    properties: { page },
    headers: {
      default: new Header({
        children: [para([
          text('Barn to Bank', { bold: true, color: GOLD, size: 18 }),
          text('   |   Software Value — Jack', { italics: true, color: '666666', size: 18 }),
        ], { spacing: { after: 0 } })],
      }),
    },
    footers: {
      default: new Footer({
        children: [para([
          text('June 2026 · barntobanklandgroup.com/app', { size: 16, color: '888888' }),
          text('\t'),
          text('Page ', { size: 16, color: '888888' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' }),
        ], { tabStops: [{ type: 'right', position: 9360 }] })],
      }),
    },
    children: [
      h1('What Our Software Is Worth'),
      body('Jack — quick read on what we built, what it returns to our shop, and what it could become. Full model is in the companion spreadsheet.', 80),

      h2('The Bottom Line'),
      table([
        ['Lens', 'Today', '3-Year Value'],
        ['Our shop (internal use)', '~$200K to build', '$370K – $1.2M net to us'],
        ['Sell the code as-is', '—', '$25K – $75K'],
        ['Productize for other land teams', 'Pre-revenue', '$2M – $3M potential (Yr 3)'],
      ]),
      body('Voigt alone: 1% better economics on $7.04M = $70K. One extra deal a year pays for the whole platform.', 80),

      h2('What We Built (Not a Spreadsheet)'),
      bullet('Marketing site + staff app at barntobanklandgroup.com — intake, pipeline, outreach, intel'),
      bullet('Automation 1 enrichment, entitlement score, Develop / Sell / Retail routing'),
      bullet('Comp Lake (off-market comps Texas MLS won\'t show) + Cloud Sync for our team'),
      bullet('Mail-first outreach, DNC compliance trail, website lead capture, deal memos'),
      body('LandID shows parcels. We built the origination workflow on top — routing, pricing, outreach, team memory.', 60),

      h2('What It Returns to Barn to Bank'),
      table([
        ['Source', 'Base Case / Year', 'How'],
        ['Time saved', '~$94K', '12 hrs/wk × $150/hr — enrichment, sync, comps, mail'],
        ['Better pricing', '~$135K', 'Comp Lake sharpens $/acre on flip scenarios'],
        ['Extra deals', '~$120K', '1 more close/yr @ $3M × 4% net'],
        ['Inbound + routing', '~$75K', 'Website leads, kill bad outreach early'],
        ['Platform cost', '−$5K', 'Vercel, Supabase, LandID subscriptions'],
        ['Net to shop', '~$420K/yr', 'After costs; Year 1 lower while we stabilize sync'],
      ]),

      h2('Optional: Sell It to Other Land Shops'),
      body('Team tier ~$449/mo. 50 Texas land teams = ~$270K ARR. At 6–8× revenue, that\'s a $1.6M–$2.2M business — but only after Cloud Sync is bulletproof and onboarding takes <30 minutes.', 60),

      h2('What I Need From You'),
      bullet('Cloud Sync morning and night — that\'s how Comp Lake compounds for both of us'),
      bullet('Log every off-market comp you hear — that\'s the moat no one can copy fast'),
      bullet('Run Voigt and FM 1044 numbers in Deal stage & contract, then sync'),
      bullet('Flag sync issues immediately so we fix trust before we sell this to anyone else'),

      h2('Next 90 Days'),
      bullet('Fix Cloud Sync reliability (your erasing-work issue)'),
      bullet('Seed Guadalupe / Voigt comps in Intel'),
      bullet('Multi-parcel contract lines + PDF on deal flow'),
      bullet('Pilot 2–3 external teams at $449/mo if sync is solid by Q4'),

      para([
        text('App: '),
        link('barntobanklandgroup.com/app', 'https://barntobanklandgroup.com/app'),
        text('   |   Spreadsheet: Barn-to-Bank-Value-Model.xlsx   |   '),
        text('— Jeremy', { italics: true }),
      ], { spacing: { before: 100, after: 0 } }),
    ],
  }],
});

const buf = await Packer.toBuffer(doc);
fs.writeFileSync(OUT, buf);
console.log('Wrote', OUT);