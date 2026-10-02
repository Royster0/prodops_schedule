import { describe, expect, it } from 'vitest';
import { employee, shift, timeOff } from '../testing/fixtures';
import { dayAgenda } from './agenda';
import { byStartTime, compareTimes } from './shifts';

const people = [employee('ana'), employee('ben'), employee('cy'), employee('dee')];
const date = '2026-10-05';

function describeAgenda(entries: ReturnType<typeof dayAgenda>): string[] {
  return entries.map((e) =>
    'shift' in e ? `${e.employee.id} ${e.shift.start}-${e.shift.end}` : `${e.employee.id} off`,
  );
}

describe('dayAgenda', () => {
  it('orders shifts by start time across people, then lists time off', () => {
    const entries = dayAgenda(
      people,
      [
        [shift('a', 'ana', date, { start: '08:00', end: '16:30' })],
        [shift('b', 'ben', date, { start: '14:00', end: '22:30' })],
        [],
        [shift('d', 'dee', date, { start: '06:00', end: '14:30' })],
      ],
      [undefined, undefined, timeOff('t', 'cy', date, date), undefined],
    );
    expect(describeAgenda(entries)).toEqual([
      'dee 06:00-14:30',
      'ana 08:00-16:30',
      'ben 14:00-22:30',
      'cy off',
    ]);
  });

  it('keeps people order for the same times, and ends sooner first for the same start', () => {
    const entries = dayAgenda(
      people,
      [
        [shift('a', 'ana', date, { start: '07:00', end: '17:30' })],
        [shift('b', 'ben', date, { start: '07:00', end: '17:30' })],
        [shift('c', 'cy', date, { start: '07:00', end: '12:00' })],
        [],
      ],
      [undefined, undefined, undefined, undefined],
    );
    expect(describeAgenda(entries)).toEqual(['cy 07:00-12:00', 'ana 07:00-17:30', 'ben 07:00-17:30']);
  });
});

describe('shift time order', () => {
  it('treats an overnight end as the next day', () => {
    const overnight = shift('n', 'ana', date, { start: '22:00', end: '06:00' });
    const evening = shift('e', 'ana', date, { start: '22:00', end: '23:30' });
    expect(compareTimes(evening, overnight)).toBeLessThan(0);
    expect([overnight, evening].sort(byStartTime).map((s) => s.id)).toEqual(['e', 'n']);
  });
});
