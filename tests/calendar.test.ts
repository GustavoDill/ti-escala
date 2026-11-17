import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCalendarCells,
  buildMonthDays,
  formatMonthLabel,
  insertDateChronologically,
  shiftMonthKey,
} from '../src/client/calendarMonth.ts';

describe('calendarMonth helpers', () => {
  it('builds all 31 days of Dezembro 2026 and pads leading/trailing outside days into 5 full weeks', () => {
    const days = buildMonthDays('2026-12');
    assert.equal(days.length, 31);
    assert.equal(days[0].raw, '01/12/2026');
    assert.equal(days[0].weekdayShort, 'Ter'); // Dec 1, 2026 is Tuesday (index 2)
    assert.equal(days[30].raw, '31/12/2026');

    const cells = buildCalendarCells('2026-12');
    // 2 leading (Dom 29, Seg 30 Nov) + 31 days + 2 trailing (01, 02 Jan) = 35
    assert.equal(cells.length, 35);
    assert.deepEqual(cells[0], { outsideDay: 29 });
    assert.deepEqual(cells[1], { outsideDay: 30 });
    assert.equal('raw' in cells[2] && cells[2].raw, '01/12/2026');
    assert.deepEqual(cells[34], { outsideDay: 2 });
  });

  it('handles leap-year February (2028-02 has 29 days)', () => {
    const days = buildMonthDays('2028-02');
    assert.equal(days.length, 29);
    assert.equal(days[28].raw, '29/02/2028');
  });

  it('shifts month keys cleanly across year boundaries and formats Portuguese labels', () => {
    assert.equal(shiftMonthKey('2026-12', 1), '2027-01');
    assert.equal(shiftMonthKey('2027-01', -1), '2026-12');
    assert.equal(formatMonthLabel('2027-01'), 'Janeiro 2027');
  });

  it('inserts new unplanned/future dates chronologically without duplicates', () => {
    const base = ['30/11/2026', '01/12/2026', '02/12/2026'];
    const withFuture = insertDateChronologically(base, '15/01/2027');
    assert.deepEqual(withFuture, ['30/11/2026', '01/12/2026', '02/12/2026', '15/01/2027']);

    const withBetween = insertDateChronologically(withFuture, '10/12/2026');
    assert.deepEqual(withBetween, [
      '30/11/2026',
      '01/12/2026',
      '02/12/2026',
      '10/12/2026',
      '15/01/2027',
    ]);

    // Duplicate date is ignored
    assert.deepEqual(insertDateChronologically(withBetween, '10/12/2026'), withBetween);
  });
});
