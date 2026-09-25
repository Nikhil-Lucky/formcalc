import { evaluate, formatNumber, convert, units, type Angle, type Category } from './engine';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error('Missing UI element: ' + id);
  return element as T;
}
type HistoryEntry = { id: string; expression: string; result: string; angle: Angle; time: number };
type Preferences = { theme: string; angle: Angle; scientific: boolean; view: boolean; tilt: number; rotate: number };
const storageKey = 'form-calculator-v2';
const expression = el<HTMLInputElement>('expression');
const result = el<HTMLOutputElement>('result');
const defaults: Preferences = { theme: 'sage', angle: 'DEG', scientific: false, view: true, tilt: 8, rotate: -8 };
let preferences = { ...defaults };
let entries: HistoryEntry[] = [];
let memory = 0;
let answer = 0;
let finished = false;
let failed = false;
let currentResult: number | null = 0;
let undoStack: string[] = [];
let redoStack: string[] = [];
let lastInput = '';
let toastTimer: ReturnType<typeof setTimeout>;
let storageWarningShown = false;

function toast(message: string): void {
  const box = el('toast'); box.textContent = message; box.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { box.hidden = true; }, 2800);
}
function save(): void {
  try { localStorage.setItem(storageKey, JSON.stringify({ preferences, entries, memory, answer })); }
  catch { if (!storageWarningShown) { toast('Browser storage is unavailable. Changes last for this session.'); storageWarningShown = true; } }
}
function load(): void {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!stored || typeof stored !== 'object') return;
    const p = stored.preferences;
    if (p && typeof p === 'object') preferences = {
      theme: ['sage','sand','graphite'].includes(p.theme) ? p.theme : defaults.theme,
      angle: p.angle === 'RAD' ? 'RAD' : 'DEG', scientific: p.scientific === true,
      view: p.view !== false,
      tilt: Number.isFinite(p.tilt) ? Math.max(-10, Math.min(18, p.tilt)) : 8,
      rotate: Number.isFinite(p.rotate) ? Math.max(-18, Math.min(18, p.rotate)) : -8
    };
    if (Array.isArray(stored.entries)) entries = stored.entries.filter((item: unknown): item is HistoryEntry => {
      if (!item || typeof item !== 'object') return false;
      const row = item as HistoryEntry;
      return typeof row.id === 'string' && typeof row.expression === 'string' && row.expression.length <= 1000 && typeof row.result === 'string' && row.result.length < 30 && Number.isFinite(Number(row.result)) && Number.isFinite(row.time) && Math.abs(row.time) <= 8.64e15 && ['DEG', 'RAD'].includes(row.angle);
    }).slice(0, 100);
    if (Number.isFinite(stored.memory)) memory = stored.memory;
    if (Number.isFinite(stored.answer)) answer = stored.answer;
  } catch { /* Corrupt or disabled storage must never stop the calculator. */ }
}
function updateUndo(): void {
  el<HTMLButtonElement>('undo').disabled = !undoStack.length;
  el<HTMLButtonElement>('redo').disabled = !redoStack.length;
}
function setExpression(value: string, record = true): void {
  if (value.length > 256) { toast('Expressions can contain up to 256 characters.'); return; }
  if (record && value !== expression.value) { undoStack.push(expression.value); undoStack = undoStack.slice(-100); redoStack = []; }
  expression.value = value; lastInput = value; finished = false; failed = false; updateUndo(); preview();
}
function preview(showError = false): void {
  let message = expression.value ? 'Live result · Enter to save' : 'Ready when you are';
  let error = false;
  try {
    currentResult = evaluate(expression.value, preferences.angle, answer);
    result.textContent = formatNumber(currentResult);
  } catch (err) {
    currentResult = null; result.textContent = showError ? 'Error' : '…';
    message = showError && err instanceof Error ? err.message : 'Continue your expression'; error = showError;
  }
  result.style.fontSize = (result.textContent?.length || 0) > 12 ? '23px' : (result.textContent?.length || 0) > 9 ? '29px' : '';
  el('expressionHint').textContent = message;
  expression.closest('.display-panel')?.classList.toggle('has-error', error);
  failed = error;
  el<HTMLButtonElement>('copyResult').disabled = currentResult === null;
}
function insert(text: string): void {
  if (failed) { setExpression(text); expression.setSelectionRange(text.length, text.length); return; }
  const operator = /^[+\-*/^%!]/.test(text);
  if (finished) {
    const initial = operator ? formatNumber(answer) : '';
    setExpression(initial + text); expression.setSelectionRange(expression.value.length, expression.value.length); return;
  }
  const start = expression.selectionStart ?? expression.value.length;
  const end = expression.selectionEnd ?? start;
  setExpression(expression.value.slice(0, start) + text + expression.value.slice(end));
  expression.setSelectionRange(start + text.length, start + text.length);
}
function calculate(): void {
  if (!expression.value.trim() || finished) return;
  preview(true);
  if (currentResult === null) return;
  const evaluated = expression.value.replace(/\bans\b/gi, '(' + formatNumber(answer) + ')');
  expression.value = evaluated; lastInput = evaluated;
  answer = currentResult; finished = true;
  entries.unshift({ id: globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random(), expression: evaluated, result: formatNumber(answer), angle: preferences.angle, time: Date.now() });
  entries = entries.slice(0, 100); el('expressionHint').textContent = 'Saved to history'; renderHistory(); save();
}
function erase(): void {
  if (finished) { setExpression(''); return; }
  const start = expression.selectionStart ?? expression.value.length, end = expression.selectionEnd ?? start;
  const before = start === end ? Math.max(0, start - 1) : start;
  setExpression(expression.value.slice(0, before) + expression.value.slice(end));
  expression.setSelectionRange(before, before);
}
function undo(redo = false): void {
  const from = redo ? redoStack : undoStack, to = redo ? undoStack : redoStack;
  const previous = from.pop(); if (previous === undefined) return;
  to.push(expression.value); setExpression(previous, false); expression.setSelectionRange(previous.length, previous.length);
}
function action(key: string): void {
  if (key === 'clear') setExpression('');
  else if (key === '=') calculate();
  else if (key === 'delete') erase();
  else if (key === 'sign') {
    const value = finished ? formatNumber(answer) : expression.value;
    setExpression(value ? '-(' + value + ')' : '-');
    expression.setSelectionRange(expression.value.length, expression.value.length);
  } else insert(key);
}

type Key = [label: string, value: string, style?: string, accessible?: string];
const standardKeys: Key[] = [
  ['AC','clear','utility','Clear expression'], ['(','(','utility','Open parenthesis'], [')',')','utility','Close parenthesis'], ['⌫','delete','utility','Delete last digit'],
  ['7','7'],['8','8'],['9','9'],['÷','/','operator','Divide'],
  ['4','4'],['5','5'],['6','6'],['×','*','operator','Multiply'],
  ['1','1'],['2','2'],['3','3'],['−','-','operator','Subtract'],
  ['+/−','sign','small','Change sign'],['0','0'],['.','.','','Decimal point'],['+','+','operator','Add'],
  ['ans','ans','small','Previous answer'],['%','%','small','Percent (divide by 100)'],['xʸ','^','small','Power'],['=','=','equals','Equals']
];
const scienceKeys: Key[] = [['sin','sin('],['cos','cos('],['tan','tan('],['√','sqrt(','','Square root'],['x²','^2','','Square'],['1/x','1/(','','Reciprocal'],['ln','ln('],['log','log('],['π','pi','','Pi'],['e','e','','Euler number'],['n!','!','','Factorial'],['|x|','abs(','','Absolute value']];
function buildKeys(id: string, definitions: Key[]): void {
  for (const [label, value, style = '', accessible = label] of definitions) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'key ' + style;
    button.textContent = label; button.dataset.key = value; button.setAttribute('aria-label', accessible);
    button.addEventListener('click', () => action(value)); el(id).append(button);
  }
}

async function copy(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); }
  catch {
    const previous = document.activeElement;
    const area = document.createElement('textarea'); area.value = text; area.style.cssText = 'position:fixed;left:-9999px;'; document.body.append(area); area.select();
    try { toast(document.execCommand('copy') ? 'Copied to clipboard' : 'Copy unavailable in this browser. Select the value to copy it.'); }
    finally { area.remove(); if (previous instanceof HTMLElement) previous.focus(); }
  }
}
function renderHistory(): void {
  const list = el('historyList'); list.replaceChildren(); el('historyCount').textContent = String(entries.length);
  el<HTMLButtonElement>('clearHistory').disabled = !entries.length; el<HTMLButtonElement>('exportHistory').disabled = !entries.length;
  if (!entries.length) {
    const empty = document.createElement('div'); empty.className = 'empty-history';
    empty.innerHTML = '<div class="empty-icon" aria-hidden="true">↺</div><h3>A fresh start.</h3><p>Your calculations will appear here.<br>Make your first one.</p>'; list.append(empty); return;
  }
  for (const entry of entries) {
    const row = document.createElement('article'); row.className = 'history-item';
    const meta = document.createElement('div'); meta.className = 'history-meta';
    const time = document.createElement('time'); time.dateTime = new Date(entry.time).toISOString(); time.textContent = new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const angle = document.createElement('span'); angle.textContent = entry.angle; meta.append(time, angle);
    const reuse = document.createElement('button'); reuse.className = 'reuse'; reuse.title = 'Reuse this result'; reuse.setAttribute('aria-label', 'Reuse result ' + entry.result);
    const exp = document.createElement('div'); exp.className = 'history-expression'; exp.textContent = entry.expression.replace(/\*/g, '×').replace(/\//g, '÷');
    const value = document.createElement('div'); value.className = 'history-result'; value.textContent = '= ' + entry.result;
    reuse.append(exp, value); reuse.addEventListener('click', () => { switchTool(false); setExpression(entry.result); expression.setSelectionRange(entry.result.length, entry.result.length); toast('Result loaded into calculator'); });
    const actions = document.createElement('div'); actions.className = 'history-actions';
    const copyButton = document.createElement('button'); copyButton.textContent = 'Copy'; copyButton.setAttribute('aria-label', 'Copy result ' + entry.result); copyButton.addEventListener('click', () => void copy(entry.result));
    const deleteButton = document.createElement('button'); deleteButton.textContent = 'Remove'; deleteButton.setAttribute('aria-label', 'Remove calculation ' + entry.expression); deleteButton.addEventListener('click', () => { entries = entries.filter(item => item.id !== entry.id); save(); renderHistory(); });
    actions.append(copyButton, deleteButton); row.append(meta, reuse, actions); list.append(row);
  }
}
function updateMemory(): void { el('memoryIndicator').hidden = memory === 0; el('memoryIndicator').title = 'Memory: ' + formatNumber(memory); }
document.querySelectorAll<HTMLButtonElement>('[data-memory]').forEach(button => button.addEventListener('click', () => {
  const operation = button.dataset.memory;
  if (operation === 'clear') { memory = 0; toast('Memory cleared'); }
  else if (operation === 'recall') { insert('(' + formatNumber(memory) + ')'); }
  else {
    if (currentResult === null) { toast('Finish a valid calculation before using memory.'); return; }
    const next = memory + currentResult * (operation === 'subtract' ? -1 : 1);
    if (!Number.isFinite(next)) { toast('Memory result is too large.'); return; }
    memory = next; toast('Memory: ' + formatNumber(memory));
  }
  updateMemory(); save();
}));
function applyPreferences(): void {
  document.documentElement.dataset.theme = preferences.theme;
  document.querySelectorAll<HTMLButtonElement>('.swatch').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === preferences.theme)));
  el('scientificKeys').hidden = !preferences.scientific;
  for (const [id, active] of [['standardMode', !preferences.scientific], ['scientificMode', preferences.scientific]] as const) { el(id).classList.toggle('active', active); el(id).setAttribute('aria-pressed', String(active)); }
  el('displayMode').textContent = preferences.scientific ? 'SCIENTIFIC' : 'STANDARD';
  el('angleMode').textContent = preferences.angle;
  el('angleMode').setAttribute('aria-label', 'Angle mode: ' + (preferences.angle === 'DEG' ? 'degrees. Click for radians.' : 'radians. Click for degrees.'));
  el('viewToggle').setAttribute('aria-pressed', String(preferences.view)); el('calculator').classList.toggle('flat', !preferences.view);
  el('viewControls').classList.toggle('disabled', !preferences.view);
  for (const id of ['tilt', 'rotate'] as const) {
    el<HTMLInputElement>(id).value = String(preferences[id]); el<HTMLInputElement>(id).disabled = !preferences.view;
    el(id + 'Value').textContent = preferences[id] + '°';
  }
  el<HTMLButtonElement>('resetView').disabled = !preferences.view;
  el('calculator').style.setProperty('--rx', preferences.tilt + 'deg'); el('calculator').style.setProperty('--ry', preferences.rotate + 'deg');
}
function switchTool(converter: boolean): void {
  el('calculatorPanel').hidden = converter; el('converterPanel').hidden = !converter;
  el('calculatorTab').classList.toggle('active', !converter); el('calculatorTab').setAttribute('aria-pressed', String(!converter));
  el('converterTab').classList.toggle('active', converter); el('converterTab').setAttribute('aria-pressed', String(converter));
}
const categorySelect = el<HTMLSelectElement>('category');
const fromUnit = el<HTMLSelectElement>('fromUnit'), toUnit = el<HTMLSelectElement>('toUnit');
const fromValue = el<HTMLInputElement>('fromValue');
let converted: number | null = null;
function updateConversion(): void {
  try {
    if (!fromValue.value.trim()) throw new Error('Enter a value to convert.');
    converted = convert(Number(fromValue.value), categorySelect.value as Category, fromUnit.value, toUnit.value);
    el('convertedValue').textContent = formatNumber(converted);
    el('conversionNote').textContent = fromValue.value + ' ' + fromUnit.selectedOptions[0].text + ' = ' + formatNumber(converted) + ' ' + toUnit.selectedOptions[0].text;
  } catch (err) {
    converted = null; el('convertedValue').textContent = '—'; el('conversionNote').textContent = err instanceof Error ? err.message : 'Check the value.';
  }
  el<HTMLButtonElement>('copyConversion').disabled = converted === null;
}
function populateUnits(): void {
  const available = units[categorySelect.value as Category].units;
  for (const select of [fromUnit, toUnit]) { select.replaceChildren(); for (const [value, [label]] of Object.entries(available)) select.add(new Option(label, value)); }
  toUnit.selectedIndex = 1; updateConversion();
}
for (const [key, group] of Object.entries(units)) categorySelect.add(new Option(group.label, key));
categorySelect.addEventListener('change', populateUnits); fromUnit.addEventListener('change', updateConversion); toUnit.addEventListener('change', updateConversion); fromValue.addEventListener('input', updateConversion);
el('swapUnits').addEventListener('click', () => { const previous = fromUnit.value; fromUnit.value = toUnit.value; toUnit.value = previous; if (converted !== null) fromValue.value = formatNumber(converted); updateConversion(); });
el('copyConversion').addEventListener('click', () => { if (converted !== null) void copy(el('conversionNote').textContent || ''); });

expression.addEventListener('input', () => { if (expression.value !== lastInput) { undoStack.push(lastInput); undoStack = undoStack.slice(-100); redoStack = []; } lastInput = expression.value; finished = false; updateUndo(); preview(); });
expression.addEventListener('paste', event => {
  if (finished) { event.preventDefault(); setExpression((event.clipboardData?.getData('text') || '').slice(0, 256)); }
});
document.addEventListener('keydown', event => {
  if (el<HTMLDialogElement>('shortcutsDialog').open || !el('converterPanel').hidden || event.altKey) return;
  const target = event.target as HTMLElement;
  if (target.matches('input,select,textarea') && target !== expression) return;
  if (event.ctrlKey || event.metaKey) {
    if (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y') { event.preventDefault(); undo(event.shiftKey || event.key.toLowerCase() === 'y'); }
    return;
  }
  if (event.key === 'Escape') { event.preventDefault(); action('clear'); return; }
  if (event.key === 'Enter' || event.key === '=') {
    if (target.closest('button') && !target.matches('.key')) return;
    event.preventDefault(); calculate(); return;
  }
  if (target === expression) {
    if (finished && event.key.length === 1 && /[0-9a-zA-Z.+\-*/^()%!π]/.test(event.key)) { event.preventDefault(); insert(event.key); }
    return;
  }
  const key = event.key === 'Backspace' ? 'delete' : event.key;
  if (key === 'delete' || /^[0-9.+\-*/^()%!]$/.test(key)) { event.preventDefault(); action(key); }
});
el('undo').addEventListener('click', () => undo()); el('redo').addEventListener('click', () => undo(true));
el('copyResult').addEventListener('click', () => { if (currentResult !== null) void copy(formatNumber(currentResult)); });
el('angleMode').addEventListener('click', () => { preferences.angle = preferences.angle === 'DEG' ? 'RAD' : 'DEG'; finished = false; applyPreferences(); preview(); save(); });
document.querySelectorAll<HTMLButtonElement>('.swatch').forEach(button => button.addEventListener('click', () => { preferences.theme = button.dataset.theme || 'sage'; applyPreferences(); save(); }));
el('standardMode').addEventListener('click', () => { preferences.scientific = false; applyPreferences(); save(); });
el('scientificMode').addEventListener('click', () => { preferences.scientific = true; applyPreferences(); save(); });
el('viewToggle').addEventListener('click', () => { preferences.view = !preferences.view; applyPreferences(); save(); });
for (const id of ['tilt', 'rotate'] as const) el(id).addEventListener('input', () => { preferences[id] = Number(el<HTMLInputElement>(id).value); applyPreferences(); save(); });
el('resetView').addEventListener('click', () => { preferences.tilt = 8; preferences.rotate = -8; applyPreferences(); save(); });
el('calculatorTab').addEventListener('click', () => switchTool(false)); el('converterTab').addEventListener('click', () => switchTool(true));
el('clearHistory').addEventListener('click', () => { entries = []; renderHistory(); save(); toast('History cleared'); });
el('exportHistory').addEventListener('click', () => {
  const cell = (value: string) => '"' + (/^[=+\-@]/.test(value) ? "'" : '') + value.replace(/"/g, '""') + '"';
  const csv = ['Expression,Result,Angle,Time', ...entries.map(entry => [entry.expression, entry.result, entry.angle, new Date(entry.time).toISOString()].map(cell).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = 'form-calculation-history.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('History exported');
});
const dialog = el<HTMLDialogElement>('shortcutsDialog');
for (const id of ['shortcuts', 'moreShortcuts']) el(id).addEventListener('click', () => dialog.showModal());
el('closeShortcuts').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });

load(); buildKeys('keypad', standardKeys); buildKeys('scientificKeys', scienceKeys); applyPreferences(); updateMemory(); renderHistory(); populateUnits(); updateUndo(); preview();
