/**
 * @file ClockPort.contract.test.ts
 * @description Contract-style assertions shared by fake and Bun clock implementations.
 */

import { BunClockPort } from '@runtime/bun/ClockPort.bun';
import { FakeClockPort } from '@shared/test-fakes/FakeClockPort.fake';
import { describe, expect, it } from 'bun:test';

describe('IClockPort contract', () => {
  it('FakeClockPort returns controlled time', () => {
    const clock = new FakeClockPort();
    clock.setNowMs(42);
    expect(clock.nowMs()).toBe(42);
  });

  it('BunClockPort returns finite epoch ms', () => {
    const clock = new BunClockPort();
    expect(Number.isFinite(clock.nowMs())).toBe(true);
  });
});
