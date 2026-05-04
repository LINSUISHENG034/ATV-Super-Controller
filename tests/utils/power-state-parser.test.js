import { describe, it, expect } from 'vitest';
import {
  parsePowerState,
  detectScreenDisturbance
} from '../../src/utils/power-state-parser.js';

describe('power-state-parser', () => {
  it('parses interactive and wakefulness fields from dumpsys power output', () => {
    const parsed = parsePowerState({
      powerOutput: `Display Power: state=OFF\nmWakefulness=Asleep\nmInteractive=false\n`,
      displayOutput: ''
    });

    expect(parsed.interactive).toBe(false);
    expect(parsed.wakefulness).toBe('Asleep');
    expect(parsed.displayState).toBe('OFF');
    expect(parsed.screenOnGuess).toBe(false);
  });

  it('parses display state from display output when power output omits it', () => {
    const parsed = parsePowerState({
      powerOutput: 'mWakefulness=Awake\nmInteractive=true\n',
      displayOutput: 'mViewports=[DisplayViewport{displayId=0, orientation=0, logicalFrame=Rect(0, 0 - 1920, 1080), physicalFrame=Rect(0, 0 - 1920, 1080), deviceWidth=1920, deviceHeight=1080, uniqueId=local:0, physicalPort=0}]\nDisplay 0 HWC layers:\n  state=ON\n'
    });

    expect(parsed.interactive).toBe(true);
    expect(parsed.wakefulness).toBe('Awake');
    expect(parsed.displayState).toBe('ON');
    expect(parsed.screenOnGuess).toBe(true);
  });

  it('falls back to unknown values when fields are absent', () => {
    const parsed = parsePowerState({
      powerOutput: 'some unrelated line\n',
      displayOutput: ''
    });

    expect(parsed.interactive).toBe(null);
    expect(parsed.wakefulness).toBe('unknown');
    expect(parsed.displayState).toBe('UNKNOWN');
    expect(parsed.screenOnGuess).toBe(null);
  });

  it('detects disturbance when a later sample becomes interactive', () => {
    const disturbed = detectScreenDisturbance(
      {
        interactive: false,
        wakefulness: 'Asleep',
        displayState: 'OFF',
        screenOnGuess: false
      },
      {
        interactive: true,
        wakefulness: 'Awake',
        displayState: 'ON',
        screenOnGuess: true
      }
    );

    expect(disturbed).toBe(true);
  });

  it('does not flag disturbance when the screen remains off', () => {
    const disturbed = detectScreenDisturbance(
      {
        interactive: false,
        wakefulness: 'Asleep',
        displayState: 'OFF',
        screenOnGuess: false
      },
      {
        interactive: false,
        wakefulness: 'Asleep',
        displayState: 'OFF',
        screenOnGuess: false
      }
    );

    expect(disturbed).toBe(false);
  });
});
