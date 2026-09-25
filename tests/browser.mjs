import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
await mkdir('test-results', { recursive: true });
const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const executablePath = process.env.CHROME_PATH || (existsSync(localChrome) ? localChrome : undefined);
const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const url = process.env.TEST_URL || pathToFileURL(resolve('index.html')).href;
let checks = 0;
async function expression(text, expected) {
  await page.locator('#expression').fill(text);
  await page.locator('#expression').press('Enter');
  assert.equal(await page.locator('#result').innerText(), expected, text); checks++;
}
try {
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#keypad button').first().waitFor();
  assert.equal(await page.locator('#keypad button').count(), 24); checks++;
  await expression('(24+16)*3','120');
  await expression('0.1+0.2','0.3');
  await expression('1/0','Error');
  await page.getByRole('button', {name:'7', exact:true}).click();
  assert.equal(await page.locator('#result').innerText(),'7'); checks++;
  await page.getByRole('button', {name:'Clear expression', exact:true}).click();
  await page.getByRole('button', {name:'7', exact:true}).click();
  await page.getByRole('button', {name:'Add', exact:true}).click();
  await page.getByRole('button', {name:'8', exact:true}).click();
  // Enter after a clicked numeric key must calculate, not click the focused key again.
  await page.keyboard.press('Enter'); assert.equal(await page.locator('#result').innerText(),'15'); checks++;
  await page.getByRole('button', {name:'Multiply', exact:true}).click();
  await page.getByRole('button', {name:'2', exact:true}).click();
  await page.getByRole('button', {name:'Equals', exact:true}).click();
  assert.equal(await page.locator('#result').innerText(),'30'); checks++;
  await page.getByRole('button', {name:'Scientific', exact:true}).click();
  await expression('sin(30)+sqrt(81)','9.5');
  await page.locator('#angleMode').click();
  await expression('sin(pi/2)','1');
  await page.locator('#angleMode').click();
  await expression('5!','120');
  await page.locator('[data-memory="add"]').click();
  await page.getByRole('button', {name:'Clear expression', exact:true}).click();
  await page.locator('[data-memory="recall"]').click();
  assert.equal(await page.locator('#result').innerText(),'120'); checks++;
  await page.locator('[data-memory="clear"]').click();
  await page.locator('#expression').fill('12');
  await page.getByRole('button',{name:'3',exact:true}).click();
  await page.locator('#undo').click(); assert.equal(await page.locator('#expression').inputValue(),'12'); checks++;
  await page.locator('#redo').click(); assert.equal(await page.locator('#expression').inputValue(),'123'); checks++;
  await page.getByRole('button',{name:'Sand theme',exact:true}).click();
  await page.reload(); assert.equal(await page.locator('html').getAttribute('data-theme'),'sand'); checks++;
  assert.ok(Number(await page.locator('#historyCount').innerText()) >= 6); checks++;
  await page.getByRole('button',{name:'Sage theme',exact:true}).click();
  await page.locator('#converterTab').click();
  await page.locator('#category').selectOption('temperature');
  await page.locator('#fromValue').fill('100');
  assert.equal(await page.locator('#convertedValue').innerText(),'212'); checks++;
  await page.locator('#swapUnits').click(); assert.equal(await page.locator('#convertedValue').innerText(),'100'); checks++;
  await page.locator('#fromUnit').selectOption('K'); await page.locator('#fromValue').fill('-1');
  assert.equal(await page.locator('#convertedValue').innerText(),'—'); checks++;
  await page.locator('#category').selectOption('length'); await page.locator('#fromValue').fill('1');
  await page.locator('#fromUnit').selectOption('mi'); await page.locator('#toUnit').selectOption('km');
  assert.equal(await page.locator('#convertedValue').innerText(),'1.609344'); checks++;
  await page.screenshot({path:'test-results/converter-desktop.png',fullPage:true});
  await page.locator('#calculatorTab').click();
  const downloadEvent = page.waitForEvent('download'); await page.locator('#exportHistory').click();
  const download = await downloadEvent; assert.equal(download.suggestedFilename(),'form-calculation-history.csv'); checks++;
  await download.saveAs('test-results/history.csv');
  await page.locator('#shortcuts').click(); assert.equal(await page.locator('#shortcutsDialog').isVisible(),true); checks++;
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#shortcutsDialog').isVisible(),false); checks++;
  await page.locator('#standardMode').click();
  await page.locator('#viewToggle').click();
  await page.waitForFunction(() => getComputedStyle(document.getElementById('calculator')).transform === 'none');
  assert.equal(await page.locator('#calculator').evaluate(e=>getComputedStyle(e).transform),'none'); checks++;
  await page.locator('#viewToggle').click();
  for (const width of [1920,1440,1024,820,768,600,390,360,320]) {
    await page.setViewportSize({width,height:1080});
    await page.waitForTimeout(300);
    for (const mode of ['standardMode','scientificMode']) {
      await page.locator('#'+mode).click();
      await page.waitForTimeout(300);
      const layout = await page.evaluate(() => {
        const calc=document.getElementById('calculator').getBoundingClientRect();
        const controls=document.getElementById('viewControls').getBoundingClientRect();
        const stage=document.getElementById('stage').getBoundingClientRect();
        const keys=Array.from(document.querySelectorAll('#keypad button')).map(e=>e.getBoundingClientRect());
        return {overflow:document.documentElement.scrollWidth>innerWidth, overlap:calc.bottom>controls.top, clipped:calc.left<stage.left || calc.right>stage.right, keyWidths:keys.map(k=>k.width)};
      });
      assert.equal(layout.overflow,false,`page overflow at ${width} ${mode}`);
      assert.equal(layout.overlap,false,`controls overlap at ${width} ${mode}`);
      assert.equal(layout.clipped,false,`calculator clipped at ${width} ${mode}`);
      checks+=3;
      if ([1440,390,320].includes(width)) await page.screenshot({path:`test-results/${mode}-${width}.png`,fullPage:true});
    }
  }
  await page.setViewportSize({width:1440,height:1100});
  await page.getByRole('button',{name:'Graphite theme',exact:true}).click();
  await page.waitForTimeout(300);
  await page.screenshot({path:'test-results/graphite-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Sage theme',exact:true}).click();
  await page.locator('#standardMode').click();
  await page.locator('#clearHistory').click(); assert.equal(await page.locator('#historyCount').innerText(),'0'); checks++;
  await page.reload(); assert.equal(await page.locator('#historyCount').innerText(),'0'); checks++;
  await page.locator('#expression').fill('18*7');
  await page.locator('#expression').press('Enter');
  await page.getByRole('button',{name:'Reuse result 126',exact:true}).click();
  assert.equal(await page.locator('#expression').inputValue(),'126'); checks++;
  await page.locator('#copyResult').click();
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('Copied'));
  assert.match(await page.locator('#toast').innerText(),/Copied/); checks++;
  await page.locator('.history-actions button').last().click();
  assert.equal(await page.locator('#historyCount').innerText(),'0'); checks++;
  for (const width of [1440,390,320]) {
    await page.setViewportSize({width,height:1000});
    await page.locator('#scientificMode').click();
    for (const [tilt,rotate] of [[18,18],[-10,-18]]) {
      await page.locator('#tilt').fill(String(tilt)); await page.locator('#tilt').dispatchEvent('input');
      await page.locator('#rotate').fill(String(rotate)); await page.locator('#rotate').dispatchEvent('input');
      await page.waitForTimeout(300);
      const safe=await page.evaluate(()=>{const c=document.getElementById('calculator').getBoundingClientRect(),s=document.getElementById('stage').getBoundingClientRect(),v=document.getElementById('viewControls').getBoundingClientRect();return c.left>=s.left && c.right<=s.right && c.bottom<v.top});
      assert.equal(safe,true,`3D angle bounds at ${width}: ${tilt},${rotate}`); checks++;
    }
    await page.locator('#converterTab').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false); checks++;
    await page.locator('#calculatorTab').click();
  }
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('#resetView').click();
  await page.locator('#standardMode').click();
  await page.getByRole('button',{name:'Clear expression',exact:true}).click();
  await page.waitForTimeout(300);
  await page.screenshot({path:'test-results/desktop-final.png',fullPage:true});
  assert.deepEqual(errors,[]); checks++;
  console.log(`PASS: ${checks} browser assertions. Screenshots saved in test-results/.`);
} finally { await browser.close(); }
