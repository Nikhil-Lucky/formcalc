import assert from 'node:assert/strict';
import { evaluate, convert, formatNumber } from '../test-results/engine.mjs';
let checks = 0;
function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12, `${actual} ≠ ${expected}`); checks++;
}
const examples = [
  ['2+3',5], ['9-12',-3], ['12/4',3], ['2+3*4',14], ['(2+3)*4',20],
  ['2^3^2',512], ['-2^2',-4], ['(-2)^2',4], ['2^-2',.25], ['2*-3',-6],
  ['0.1+0.2',.3], ['.5+.25',.75], ['1e3+2',1002], ['1e-3',.001],
  ['2pi',2*Math.PI], ['2(3+4)',14], ['(2+3)(4+1)',25],
  ['sqrt(81)',9], ['abs(-7)',7], ['ln(e)',1], ['log(100)',2],
  ['sin(30)',.5], ['cos(60)',.5], ['tan(45)',1], ['exp(0)',1],
  ['5!',120], ['0!',1], ['200*10%',20], ['200*(1+10%)',220],
  ['100/25%',400], ['3×4÷2',6], ['5−2',3], ['π',Math.PI]
];
for (const [source, expected] of examples) close(evaluate(source), expected);
close(evaluate('sin(pi/2)', 'RAD'), 1); close(evaluate('ans+3', 'DEG', 7), 10);
for (const invalid of ['1/0','sqrt(-1)','ln(0)','log(-2)','tan(90)','(-1)!','2.5!','171!','2^1024','1+','(2+3','2..3','alert(1)','1;2','1 2','1e999','2)']) {
  assert.throws(() => evaluate(invalid), undefined, invalid); checks++;
}
assert.equal(formatNumber(evaluate('0.1+0.2')), '0.3'); checks++;
assert.equal(formatNumber(-0), '0'); checks++;
close(evaluate('0.00000000000000001'), 1e-17);
close(convert(1,'length','mi','km'),1.609344);
close(convert(1,'length','ft','in'),12);
close(convert(1,'mass','lb','kg'),.45359237);
close(convert(0,'temperature','C','F'),32);
close(convert(212,'temperature','F','C'),100);
close(convert(0,'temperature','K','C'),-273.15);
close(convert(-40,'temperature','C','F'),-40);
close(convert(1,'area','ha','sqm'),10000);
close(convert(1,'volume','gal','l'),3.785411784);
close(convert(1,'time','day','hr'),24);
for (const args of [[-1,'temperature','K','C'],[Infinity,'length','m','ft'],[1,'length','bogus','m']]) {
  assert.throws(() => convert(...args)); checks++;
}
// A generated family of independent arithmetic identities catches precedence regressions.
for (let a = -10; a <= 10; a++) for (let b = 1; b <= 10; b++) close(evaluate(`(${a}+${b})*${b}-${a}`), (a+b)*b-a);
console.log(`PASS: ${checks} math, domain, formatting and conversion checks.`);
