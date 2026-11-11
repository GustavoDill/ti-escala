import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getNationalHolidays } from '../src/server/holidays.ts';

describe('getNationalHolidays', () => {
  it('returns national holidays for 2026 (from BrasilAPI or the bundled fallback)', async () => {
    const result = await getNationalHolidays(2026);
    assert.ok(['brasilapi', 'fallback'].includes(result.source));
    const natal = result.holidays.find((h) => h.date === '2026-12-25');
    assert.equal(natal?.name, 'Natal');
  });

  it('marks years without data as unavailable instead of failing', async () => {
    const result = await getNationalHolidays(2099);
    assert.ok(['brasilapi', 'unavailable'].includes(result.source));
    assert.ok(Array.isArray(result.holidays));
  });
});
