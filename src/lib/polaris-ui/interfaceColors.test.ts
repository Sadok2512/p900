import { describe, expect, it } from 'vitest';
import {
  AVAILABILITY_TONE, CAPTURE_TONE, INTERFACE_FAMILY, INTERFACE_FAMILY_HEX,
  activitySamples, availabilityOf, bytesPerSecond, captureStateOf, hasMetric,
  interfaceFamilyOf, interfaceInk, packetsPerSecond, trafficOf,
} from './interfaceColors';

/* Acceptance rules of the probe-interfaces harmonization brief (§2, §4, §5, §6). */

describe('interface family colours', () => {
  it('maps the 5G core interfaces to their defined families', () => {
    expect(interfaceFamilyOf('N2')).toBe('blue');
    expect(interfaceFamilyOf('N3')).toBe('green');
    expect(interfaceFamilyOf('N4')).toBe('amber');
    expect(interfaceFamilyOf('SBI')).toBe('purple');
  });

  it('maps the LTE / EPC interfaces to the same families as their 5G equivalents', () => {
    expect(interfaceFamilyOf('S1-MME')).toBe('blue');
    expect(interfaceFamilyOf('S1-U')).toBe('green');
    expect(interfaceFamilyOf('S11')).toBe('amber');
    expect(interfaceFamilyOf('S6a')).toBe('purple');
    expect(interfaceFamilyOf('S5-C')).toBe('amber');
    expect(interfaceFamilyOf('S5-U')).toBe('green');
  });

  it('maps IMS, N6 and Sxab, and falls back to gray for anything unlisted', () => {
    expect(interfaceFamilyOf('IMS')).toBe('pink');
    expect(interfaceFamilyOf('N6')).toBe('teal');
    expect(interfaceFamilyOf('Sxab')).toBe('purple');
    expect(interfaceFamilyOf('T14')).toBe('gray');
    expect(interfaceFamilyOf('')).toBe('gray');
    expect(interfaceFamilyOf(null)).toBe('gray');
  });

  it('exposes one token per family so a badge and a chart line agree', () => {
    expect(interfaceInk('N2')).toBe('var(--ifc-blue-fg)');
    expect(interfaceInk('S6a')).toBe('var(--ifc-purple-fg)');
    expect(Object.keys(INTERFACE_FAMILY_HEX).sort()).toEqual(['amber', 'blue', 'gray', 'green', 'pink', 'purple', 'teal']);
    expect(INTERFACE_FAMILY_HEX.purple.fg).toBe('#7C3AED');
    expect(INTERFACE_FAMILY).toHaveProperty('S5-C');
  });
});

describe('availability and capture state stay independent of the interface colour', () => {
  it('reads availability from the runtime value, not from the interface name', () => {
    expect(availabilityOf(true, undefined)).toBe('available');
    expect(availabilityOf(false, 'N2')).toBe('unavailable');
    expect(availabilityOf(null, undefined)).toBe('unknown');
    expect(availabilityOf(true, 'DEGRADED')).toBe('degraded');
  });

  it('gives each availability state its own tone', () => {
    expect(AVAILABILITY_TONE.available).toBe('success');
    expect(AVAILABILITY_TONE.unavailable).toBe('danger');
    expect(AVAILABILITY_TONE.degraded).toBe('warning');
    expect(AVAILABILITY_TONE.unknown).toBe('subtle');
  });

  it('separates a running process from an idle or unknown one', () => {
    expect(captureStateOf({ state: 'CAPTURING' })).toBe('active');
    expect(captureStateOf({ state: 'STARTING' })).toBe('starting');
    expect(captureStateOf({ state: 'STOPPING' })).toBe('stopping');
    expect(captureStateOf({ active: false })).toBe('inactive');
    expect(captureStateOf({})).toBe('unknown');
    expect(CAPTURE_TONE.active).toBe('success');
    expect(CAPTURE_TONE.inactive).toBe('subtle');
    expect(CAPTURE_TONE.starting).toBe('warning');
  });

  it('never reads a live process as proof of traffic', () => {
    expect(trafficOf(0, 0)).toBe('silent');
    expect(trafficOf(12, null)).toBe('observed');
    expect(trafficOf(null, null)).toBe('unavailable');
  });
});

describe('missing measures never become zero', () => {
  it('keeps a missing throughput unreadable rather than false', () => {
    expect(hasMetric(0)).toBe(true);
    expect(hasMetric(null)).toBe(false);
    expect(hasMetric(undefined)).toBe(false);
    expect(bytesPerSecond(null)).toBe('—');
    expect(bytesPerSecond(0)).toBe('0 B/s');
    expect(bytesPerSecond(1024)).toBe('1.0 KiB/s');
    expect(packetsPerSecond(undefined)).toBe('— p/s');
    expect(packetsPerSecond(1500)).toMatch(/^1\s500 p\/s$/);
  });

  it('only feeds the activity curve with real readings', () => {
    expect(activitySamples([5, null, 2, 'x', 0, undefined])).toEqual([5, 2, 0]);
    expect(activitySamples([])).toEqual([]);
  });
});
