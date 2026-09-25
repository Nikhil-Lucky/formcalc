export type Angle = 'DEG' | 'RAD';
export class MathError extends Error {}
type Token = { kind: 'number' | 'name' | 'symbol' | 'end'; text: string };

function tokenize(source: string): Token[] {
  const normalized = source.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi');
  const tokens: Token[] = [];
  let index = 0;
  while (index < normalized.length) {
    const tail = normalized.slice(index);
    const space = /^\s+/.exec(tail);
    if (space) { index += space[0].length; continue; }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(tail);
    const name = /^[a-zA-Z]+/.exec(tail);
    if (number) { tokens.push({ kind: 'number', text: number[0] }); index += number[0].length; }
    else if (name) { tokens.push({ kind: 'name', text: name[0].toLowerCase() }); index += name[0].length; }
    else if ('+-*/^()%!'.includes(tail[0])) { tokens.push({ kind: 'symbol', text: tail[0] }); index++; }
    else throw new MathError('Use numbers and calculator operators only.');
    if (tokens.length > 256) throw new MathError('This expression is too long.');
  }
  tokens.push({ kind: 'end', text: '' });
  return tokens;
}

/** Recursive-descent parser. Never executes user input as JavaScript. */
export function evaluate(source: string, angle: Angle = 'DEG', answer = 0): number {
  if (!source.trim()) return 0;
  if (source.length > 1000) throw new MathError('This expression is too long.');
  const tokens = tokenize(source);
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = (symbol: string) => { if (peek().text === symbol) { cursor++; return true; } return false; };
  const checked = (n: number) => { if (!Number.isFinite(n)) throw new MathError('Result is outside the supported range.'); return n; };
  function sum(): number {
    let n = product();
    while (true) {
      if (take('+')) n = checked(n + product());
      else if (take('-')) n = checked(n - product());
      else return n;
    }
  }
  function product(): number {
    let n = unary();
    while (true) {
      if (take('*')) n = checked(n * unary());
      else if (take('/')) { const divisor = unary(); if (divisor === 0) throw new MathError('Cannot divide by zero.'); n = checked(n / divisor); }
      else if (peek().text === '(' || peek().kind === 'name') n = checked(n * unary());
      else return n;
    }
  }
  function unary(): number { if (take('+')) return unary(); if (take('-')) return -unary(); return power(); }
  function power(): number { const n = postfix(); return take('^') ? checked(n ** unary()) : n; }
  function postfix(): number {
    let n = atom();
    while (true) {
      if (take('%')) n /= 100;
      else if (take('!')) {
        if (n < 0 || !Number.isInteger(n)) throw new MathError('Factorial needs a non-negative whole number.');
        if (n > 170) throw new MathError('Factorial supports numbers up to 170.');
        let result = 1; for (let i = 2; i <= n; i++) result *= i; n = result;
      } else return n;
    }
  }
  function atom(): number {
    if (take('(')) { const n = sum(); if (!take(')')) throw new MathError('Close the open parenthesis.'); return n; }
    const token = tokens[cursor++];
    if (token.kind === 'number') return checked(Number(token.text));
    if (token.kind === 'name') {
      if (token.text === 'pi') return Math.PI;
      if (token.text === 'e') return Math.E;
      if (token.text === 'ans') return checked(answer);
      const names = ['sin', 'cos', 'tan', 'sqrt', 'ln', 'log', 'abs', 'exp'];
      if (!names.includes(token.text)) throw new MathError('Unknown function: ' + token.text);
      if (!take('(')) throw new MathError('Add parentheses after ' + token.text + '.');
      const n = sum(); if (!take(')')) throw new MathError('Close the open parenthesis.');
      const radians = angle === 'DEG' ? n * Math.PI / 180 : n;
      if (token.text === 'sqrt') { if (n < 0) throw new MathError('Square root needs a non-negative number.'); return Math.sqrt(n); }
      if (token.text === 'ln' || token.text === 'log') { if (n <= 0) throw new MathError('Logarithms need a positive number.'); return token.text === 'ln' ? Math.log(n) : Math.log10(n); }
      if (token.text === 'abs') return Math.abs(n);
      if (token.text === 'exp') return checked(Math.exp(n));
      if (token.text === 'tan' && Math.abs(Math.cos(radians)) < 1e-14) throw new MathError('Tangent is undefined at this angle.');
      return token.text === 'sin' ? Math.sin(radians) : token.text === 'cos' ? Math.cos(radians) : Math.tan(radians);
    }
    throw new MathError(token.kind === 'end' ? 'Finish the expression first.' : 'Check the expression near “' + token.text + '”.');
  }
  const result = checked(sum());
  if (peek().kind !== 'end') throw new MathError('Check the operators and parentheses.');
  return Object.is(result, -0) ? 0 : result;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) throw new MathError('Result is outside the supported range.');
  return String(Number(n.toPrecision(12)));
}

export const units = {
  length: { label: 'Length', units: { m: ['Meters', 1], km: ['Kilometers', 1000], cm: ['Centimeters', .01], mm: ['Millimeters', .001], in: ['Inches', .0254], ft: ['Feet', .3048], yd: ['Yards', .9144], mi: ['Miles', 1609.344] } },
  mass: { label: 'Mass', units: { kg: ['Kilograms', 1], g: ['Grams', .001], mg: ['Milligrams', .000001], lb: ['Pounds', .45359237], oz: ['Ounces', .028349523125] } },
  temperature: { label: 'Temperature', units: { C: ['Celsius', 1], F: ['Fahrenheit', 1], K: ['Kelvin', 1] } },
  area: { label: 'Area', units: { sqm: ['Square meters', 1], sqkm: ['Square kilometers', 1e6], sqft: ['Square feet', .09290304], acre: ['Acres', 4046.8564224], ha: ['Hectares', 10000] } },
  volume: { label: 'Volume', units: { l: ['Liters', 1], ml: ['Milliliters', .001], gal: ['US gallons', 3.785411784], cup: ['US cups', .2365882365] } },
  time: { label: 'Time', units: { s: ['Seconds', 1], min: ['Minutes', 60], hr: ['Hours', 3600], day: ['Days', 86400], week: ['Weeks', 604800] } }
} satisfies Record<string, { label: string; units: Record<string, [string, number]> }>;
export type Category = keyof typeof units;
export function convert(value: number, category: Category, from: string, to: string): number {
  if (!Number.isFinite(value)) throw new MathError('Enter a valid number.');
  const entries = units[category].units as Record<string, [string, number]>;
  if (!entries[from] || !entries[to]) throw new MathError('Choose valid units.');
  let result: number;
  if (category === 'temperature') {
    const celsius = from === 'F' ? (value - 32) * 5 / 9 : from === 'K' ? value - 273.15 : value;
    if (celsius < -273.15 - 1e-9) throw new MathError('Temperature cannot be below absolute zero.');
    result = to === 'F' ? celsius * 9 / 5 + 32 : to === 'K' ? celsius + 273.15 : celsius;
  } else result = value * entries[from][1] / entries[to][1];
  if (!Number.isFinite(result)) throw new MathError('Result is outside the supported range.');
  return result;
}
