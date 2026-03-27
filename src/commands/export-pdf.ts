import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

const CSS = `
@page {
  size: A4;
  margin: 20mm 18mm 20mm 18mm;
}
* { box-sizing: border-box; }
body {
  font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", "WenQuanYi Micro Hei", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  line-height: 1.65;
  color: #1a1a1a;
  max-width: 100%;
}
h1 {
  font-size: 22px;
  border-bottom: 2px solid #0969da;
  padding-bottom: 8px;
  margin-top: 0;
}
h2 {
  font-size: 16px;
  color: #0969da;
  border-bottom: 1px solid #d0d7de;
  padding-bottom: 4px;
  margin-top: 28px;
}
h3 {
  font-size: 13px;
  color: #24292f;
  margin-top: 20px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 10.5px;
  page-break-inside: auto;
}
tr { page-break-inside: avoid; }
th {
  background: #f0f4f8;
  color: #24292f;
  font-weight: 600;
  text-align: left;
  padding: 8px 10px;
  border: 1px solid #d0d7de;
  white-space: nowrap;
}
td {
  padding: 6px 10px;
  border: 1px solid #d0d7de;
  vertical-align: top;
}
tr:nth-child(even) td { background: #f8f9fa; }
code {
  background: #f0f4f8;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 10px;
  font-family: "SF Mono", "Fira Code", monospace;
}
pre {
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 12px;
  font-size: 10px;
  line-height: 1.5;
  overflow-x: auto;
  page-break-inside: avoid;
}
pre code { background: none; padding: 0; }
blockquote {
  border-left: 3px solid #0969da;
  margin: 12px 0;
  padding: 4px 16px;
  color: #57606a;
}
ul, ol { padding-left: 24px; margin: 8px 0; }
li { margin: 3px 0; }
strong { color: #0969da; }
hr {
  border: none;
  border-top: 2px solid #0969da;
  margin: 24px 0;
}
.frontmatter {
  background: #f0f4f8;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 20px;
  font-size: 11px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 24px;
}
.frontmatter .fm-row {
  display: flex;
  gap: 6px;
}
.frontmatter .fm-key {
  color: #57606a;
  min-width: 100px;
}
.frontmatter .fm-val {
  font-weight: 600;
  color: #24292f;
}
`;

function parseFrontmatter(md: string): { meta: Record<string, string>; body: string } {
  const match = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: md };
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      meta[key] = val;
    }
  }
  return { meta, body: match[2] };
}

function renderFrontmatter(meta: Record<string, string>): string {
  if (Object.keys(meta).length === 0) return '';

  const labels: Record<string, string> = {
    applicant: '申请人',
    target: '目标',
    primary_program: '主路线',
    backup_program: '备选路线',
    crs_estimate: 'CRS 估算',
    crs_with_pnp: 'CRS (含PNP)',
    total_duration_months: '预计时长(月)',
    total_cost_cad: '预计费用(CAD)',
    generated_at: '生成日期',
  };

  const rows = Object.entries(meta).map(([k, v]) => {
    const label = labels[k] || k;
    return `<div class="fm-row"><span class="fm-key">${label}</span><span class="fm-val">${v}</span></div>`;
  }).join('\n');

  return `<div class="frontmatter">${rows}</div>`;
}

export async function exportPdf(pathwayDir?: string): Promise<void> {
  const cwd = pathwayDir || process.cwd();
  const mdPath = path.join(cwd, 'pathway.md');

  if (!fs.existsSync(mdPath)) {
    console.log(chalk.red('\n  pathway.md not found in current directory.\n'));
    process.exit(1);
  }

  const raw = fs.readFileSync(mdPath, 'utf-8');
  const { meta, body } = parseFrontmatter(raw);
  const frontmatterHtml = renderFrontmatter(meta);
  const bodyHtml = await marked.parse(body);

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>${CSS}</style>
</head>
<body>
${frontmatterHtml}
${bodyHtml}
</body>
</html>`;

  const outPath = path.join(cwd, 'pathway.pdf');
  const spinner = chalk.dim('  Generating PDF...');
  process.stdout.write(spinner);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outPath,
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
    printBackground: true,
  });
  await browser.close();

  process.stdout.write('\r');
  console.log(chalk.green(`  PDF exported: ${outPath}\n`));
}
