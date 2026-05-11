/**
 * M1 UI Inspection v4 - 简洁版
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:' + (process.env.WEB_PORT || 13181);
const API = 'http://localhost:' + (process.env.API_PORT || 13180) + '/api/v1';
const DIR = join(process.cwd(), 'inspection-screenshots');
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'zh-CN' });

const errors = [];
page.on('pageerror', e => errors.push(e.message));
const report = { timestamp: new Date().toISOString(), pages: {} };

async function apiCall(method, path, body) {
  // 直连后端 3000 端口，绕过 Vite 代理可能的认证问题
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  return { status: r.status, ok: r.ok, data: await r.json() };
}

async function check(name, urlPath) {
  const fullUrl = BASE + urlPath;
  console.log('\n=== ' + name + ' ===');
  console.log('URL: ' + fullUrl);
  try {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
    await page.waitForTimeout(1500);

    const shotName = name.replace(/[^\w\u4e00-\u9fff]/g, '_');
    const shotPath = join(DIR, shotName + '.png');
    await page.screenshot({ path: shotPath, fullPage: true });

    const info = await page.evaluate(() => {
      const vis = el => el && el.offsetParent !== null;
      const q = s => document.querySelector(s);
      const qa = s => Array.from(document.querySelectorAll(s)).filter(vis);

      return {
        title: document.title,
        sidebar: !!q('aside,[class*="sidebar"]'),
        header: !!q('header,[class*="header"]'),
        main: !!q('main,[class*="main"]'),
        breadcrumb: (q('[class*="breadcrumb"]') || {}).textContent?.trim() || null,
        headings: qa('h1,h2,[class*="text-2xl"]').map(e => e.textContent.trim()),
        buttons: qa('button,[role="button"]').map(b => b.textContent.trim().substring(0, 60)),
        inputs: qa('input:not([type=hidden]),textarea,select').map(i => ({
          type: i.type || i.tagName, ph: i.placeholder
        })),
        tables: qa('table,[role="table"],[class*="Table"]').map(t => ({
          h: Array.from(t.querySelectorAll('th')).map(th => th.textContent.trim()).filter(Boolean),
          r: t.querySelectorAll('tbody tr').length
        })),
        tabs: qa('[role="tab"],button[data-state]').map(el => ({
          t: el.textContent.trim(),
          a: el.dataset.state === 'active'
        })),
        dialogs: Array.from(document.querySelectorAll('[role="dialog"]')).map(d => ({
          o: d.dataset.state === 'open',
          title: (d.querySelector('[class*="title"],h2') || {}).textContent?.trim() || null
        })),
        links: qa('a[href]').map(a => ({ t: a.textContent.trim(), h: a.getAttribute('href') })),
        bodyText: (document.body?.innerText || '').substring(0, 800),
      };
    });

    report.pages[name] = { url: fullUrl, ok: true, shot: shotPath, ...info };

    console.log('  Title: ' + info.title);
    console.log('  Layout: S=' + info.sidebar + ' H=' + info.header + ' M=' + info.main);
    if (info.breadcrumb) console.log('  BC: "' + info.breadcrumb + '"');
    if (info.headings.length) console.log('  H: ' + info.headings.join(' | '));
    if (info.tabs.length) console.log('  Tabs(' + info.tabs.length + '): ' + info.tabs.map(t => t.t + (t.a ? '[*]' : '')).join(', '));
    if (info.tables.length) info.tables.forEach((t, i) => console.log('  Tbl#' + (i+1) + ': [' + t.h.join(',') + '] ' + t.r + 'rows'));
    if (info.buttons.length) console.log('  Btns(' + info.buttons.length + '): ' + info.buttons.map(b => '"' + b + '"').join(', '));
    if (info.inputs.length) console.log('  Inp: ' + info.inputs.map(i => i.type + '(' + i.ph + ')').join(', '));
    if (info.dialogs.length) console.log('  Dlg: ' + info.dialogs.map(d => '"' + d.title + '"[' + (d.o ? 'on' : 'off') + ']').join(', '));
    return info;

  } catch (err) {
    try {
      const ep = join(DIR, name.replace(/[^\w\u4e00-\u9fff]/g, '_') + '_err.png');
      await page.screenshot({ path: ep });
      report.pages[name] = { url: fullUrl, ok: false, err: err.message, shot: ep };
    } catch(e2) {}
    console.log('  ERR: ' + err.message);
    return null;
  }
}

// ========== MAIN ==========

console.log('M1 UI Inspection v4');

// F-M1-01: List page
await check('01-list', '/projects');

// Create test data via direct API
console.log('\n--- API: create test data ---');
let pid = null;
const ts = Date.now();
const r1 = await apiCall('POST', '/projects', { name: 'ui-t-' + ts, displayName: 'UI检查A' + ts });
pid = (r1.ok && r1.data && r1.data.data && r1.data.data.id) ? r1.data.data.id : null;
console.log('  create: ' + (pid ? 'OK ' + pid : 'FAIL ' + r1.status));
if (!pid) {
  // 获取已有项目
  const lr = await apiCall('GET', '/projects?pageSize=3');
  pid = (lr.ok && lr.data && lr.data.data && lr.data.data.items && lr.data.data.items[0]) ? lr.data.data.items[0].id : null;
  if (pid) console.log('  using existing: ' + pid);
}
await apiCall('POST', '/projects', { name: 'ui-t2-' + ts, displayName: 'UI检查B' });
await apiCall('POST', '/projects', { name: 'ui-t3-' + ts, displayName: 'UI检查C' });

// Re-check list with data
await check('01b-list-with-data', '/projects');

// F-M1-02: Create dialog
console.log('\n--- Open create dialog ---');
await page.goto(BASE + '/projects', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1000);
try {
  const nb = page.getByRole('button', { name: /新建|new|New/i }).first();
  if (await nb.isVisible({ timeout: 3000 })) {
    await nb.click();
    await page.waitForSelector('[role="dialog"][data-state="open"]', { timeout: 5000 });
    await page.waitForTimeout(500);
    await check('02-create-dialog', '/projects#dlg');
    const cb = page.getByRole('button', { name: /取消|cancel|Close/i }).first();
    if (await cb.isVisible({ timeout: 2000 })) await cb.click();
    await page.waitForTimeout(300);
  }
} catch(e) { console.log('  dialog err: ' + e.message.substring(0, 100)); }

// F-M1-03~05: Detail page
if (pid) {
  await check('03-detail', '/projects/' + pid);

  // Print body text for debugging black screen
  const p3 = report.pages['03-detail'];
  if (p3 && p3.bodyText) {
    console.log('\n  BODY TEXT (first 500):');
    console.log('  ' + p3.bodyText.substring(0, 500));
  }

  // Edit mode
  console.log('\n--- Edit mode ---');
  try {
    await page.goto(BASE + '/projects/' + pid, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    const eb = page.getByRole('button', { name: /编辑|edit/i });
    const cnt = await eb.count();
    console.log('  edit btns found: ' + cnt);
    if (cnt > 0) {
      await eb.first().click();
      await page.waitForTimeout(500);
      await check('04-edit-mode', '/projects/' + pid + '#edit');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      const allBtns = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button')).filter(e => e.offsetParent !== null).map(b => b.textContent.trim())
      );
      console.log('  all btns: ' + allBtns.join(', '));
      report.pages['04-edit-mode'] = { ok: false, err: 'no edit btn', btns: allBtns };
    }
  } catch(e) { console.log('  edit err: ' + e.message.substring(0, 150)); }

  // Archive dialog
  console.log('\n--- Archive dialog ---');
  try {
    await page.goto(BASE + '/projects/' + pid, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    const ab = page.getByRole('button', { name: /归档|archive/i });
    if (await ab.count() > 0 && await ab.first().isVisible({ timeout: 3000 })) {
      await ab.first().click();
      await page.waitForTimeout(500);
      await check('05-archive-dialog', '/projects/' + pid + '#arch');
      const cb2 = page.getByRole('button', { name: /取消|cancel/i }).first();
      if (await cb2.isVisible({ timeout: 2000 })) await cb2.click();
    } else {
      console.log('  no archive btn');
      report.pages['05-archive-dialog'] = { ok: false, err: 'no archive btn' };
    }
  } catch(e) { console.log('  arch err: ' + e.message.substring(0, 100)); }

  // Org area tabs
  console.log('\n--- Org navigation ---');
  await page.goto(BASE + '/projects/' + pid, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);

  const navItems = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll('[role="tab"], button[data-state], button').forEach(el => {
      if (el.offsetParent !== null) {
        items.push({ text: (el.textContent||'').trim(), role: el.getAttribute('role'), state: el.dataset.state });
      }
    });
    return items;
  });

  console.log('  nav items (' + navItems.length + '):');
  navItems.forEach(n => console.log('    [' + n.role + '|' + n.state + '] "' + n.text + '"'));

  const skip = /^(新建|编辑|删除|保存|取消|确认|归档|恢复|创建|关闭|Close)$/i;
  for (const item of navItems) {
    if (!item.text || skip.test(item.text)) continue;
    if (/^(概要|组织|公司|部门|角色|外部|领域|流程)/i.test(item.text) || item.role === 'tab' || item.state) {
      console.log('  -> click: "' + item.text + '"');
      try {
        let tgt;
        if (item.role === 'tab') tgt = page.getByRole('tab', { name: new RegExp(item.text, 'i') });
        else tgt = page.getByRole('button', { name: new RegExp(item.text, 'i') });
        await tgt.first().click({ timeout: 3000 });
        await page.waitForTimeout(800);
        const sn = '06-' + item.text.replace(/[^\w\u4e00-\u9fff]/g, '');
        await check(sn, '/projects/' + pid + '#n-' + item.text);
      } catch(e) {
        console.log('    fail: ' + e.message.substring(0, 80));
      }
    }
  }

  // Create sub-entities for org data
  console.log('\n--- Create sub-entities ---');
  let coId = null, deptId = null;
  const cr = await apiCall('POST', '/projects/' + pid + '/companies', { name: 'c1', displayName: '检查公司' });
  coId = (cr.ok && cr.data && cr.data.data && cr.data.data.id) ? cr.data.data.id : null;
  console.log('  co: ' + (coId ? 'OK' : 'FAIL ' + cr.status));
  if (coId) {
    const dr = await apiCall('POST', '/companies/' + coId + '/departments', { name: 'd1', displayName: '研发部' });
    deptId = (dr.ok && dr.data && dr.data.data && dr.data.data.id) ? dr.data.data.id : null;
    console.log('  dept: ' + (deptId ? 'OK' : 'FAIL ' + dr.status));
  }
  await apiCall('POST', '/projects/' + pid + '/roles', { name: 'r1', displayName: 'PM', departmentId: deptId });
  await apiCall('POST', '/projects/' + pid + '/external-entities', { name: 'e1', displayName: '支付网关', type: 'system' });

  // Detail with data
  console.log('\n--- Detail WITH data ---');
  await check('07-detail-data', '/projects/' + pid);

  // Tabs again with data
  for (const item of navItems) {
    if (!item.text || skip.test(item.text)) continue;
    if (/^(概要|组织|公司|部门|角色|外部|领域|流程)/i.test(item.text) || item.role === 'tab' || item.state) {
      console.log('  -> click(data): "' + item.text + '"');
      try {
        let tgt;
        if (item.role === 'tab') tgt = page.getByRole('tab', { name: new RegExp(item.text, 'i') });
        else tgt = page.getByRole('button', { name: new RegExp(item.text, 'i') });
        await tgt.first().click({ timeout: 3000 });
        await page.waitForTimeout(800);
        const sn = '08d-' + item.text.replace(/[^\w\u4e00-\u9fff]/g, '');
        await check(sn, '/projects/' + pid + '#d-' + item.text);
      } catch(e) {
        console.log('    fail: ' + e.message.substring(0, 80));
      }
    }
  }
} else {
  console.log('\nNO projectId - skipping detail checks');
  report.pages['SKIP'] = { ok: false, err: 'no project id' };
}

// Done
console.log('\n\n========== DONE ==========');
if (errors.length) {
  console.log('Console errors (' + errors.length + '):');
  errors.slice(0, 10).forEach((e, i) => console.log('  ' + (i+1) + '. ' + e.substring(0, 200)));
}

const rp = join(DIR, 'report-v4.json');
writeFileSync(rp, JSON.stringify(report, null, 2));
console.log('Report: ' + rp);
console.log('Shots: ' + DIR + '/');

await browser.close();
process.exit(0);
