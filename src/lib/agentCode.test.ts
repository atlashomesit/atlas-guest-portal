import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { captureAgentCodeFromUrl, clearAgentCode, getAgentCode, stripAgentCodeFromUrl } from './agentCode';

describe('PRICE-016 agent code from the agent link', () => {
  beforeEach(() => {
    clearAgentCode();
    window.history.replaceState({}, '', '/');
  });
  afterEach(() => {
    clearAgentCode();
    window.history.replaceState({}, '', '/');
  });

  it('has no code for an ordinary guest', () => {
    expect(captureAgentCodeFromUrl('?checkIn=2027-06-10')).toBeNull();
    expect(getAgentCode()).toBeNull();
  });

  it('remembers a well-formed ?agent= code, upper-cased, for this tab', () => {
    expect(captureAgentCodeFromUrl('?agent=sunrise-net-01')).toBe('SUNRISE-NET-01');
    expect(getAgentCode()).toBe('SUNRISE-NET-01');
    expect(window.sessionStorage.getItem('atlas.agentCode')).toBe('SUNRISE-NET-01');
  });

  it('also reads ?agentCode=', () => {
    expect(captureAgentCodeFromUrl('?agentCode=GLOBE-CORP-22')).toBe('GLOBE-CORP-22');
  });

  it('ignores a malformed code (too short, too long, bad characters) so it is never sent', () => {
    expect(captureAgentCodeFromUrl('?agent=short')).toBeNull();
    expect(captureAgentCodeFromUrl(`?agent=${'A'.repeat(40)}`)).toBeNull();
    expect(captureAgentCodeFromUrl('?agent=has%20space%201234')).toBeNull();
    expect(captureAgentCodeFromUrl('?agent=%3Cscript%3E12345')).toBeNull();
    expect(getAgentCode()).toBeNull();
  });

  it('survives a reload within the tab (sessionStorage) and clears on request', () => {
    captureAgentCodeFromUrl('?agent=SUNRISE-NET-01');
    clearAgentCode();
    expect(getAgentCode()).toBeNull();
    window.sessionStorage.setItem('atlas.agentCode', 'GLOBE-CORP-22');
    expect(getAgentCode()).toBe('GLOBE-CORP-22');
  });

  it('removes the code from the address bar and keeps every other parameter', () => {
    window.history.replaceState({}, '', '/stay?checkIn=2027-06-10&agent=SUNRISE-NET-01&guests=2#top');
    stripAgentCodeFromUrl();
    expect(window.location.search).toBe('?checkIn=2027-06-10&guests=2');
    expect(window.location.hash).toBe('#top');
  });
});
