function extractFirstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function parseBoolean(value) {
  if (value == null) return null;

  const normalized = value.toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  return null;
}

function normalizeDisplayState(value) {
  if (!value) return 'UNKNOWN';
  return value.toUpperCase();
}

function inferScreenOn({ interactive, wakefulness, displayState }) {
  if (interactive === true) return true;
  if (interactive === false && displayState === 'OFF') return false;
  if (displayState === 'ON') return true;
  if (displayState === 'OFF') return false;
  if (wakefulness === 'Awake') return true;
  if (wakefulness === 'Asleep') return false;
  return null;
}

function parsePowerState({ powerOutput = '', displayOutput = '' } = {}) {
  const interactiveRaw = extractFirstMatch(powerOutput, [/mInteractive=(true|false)/i]);
  const wakefulness = extractFirstMatch(powerOutput, [/mWakefulness=([A-Za-z]+)/, /Wakefulness:\s*([A-Za-z]+)/i]) || 'unknown';
  const displayStateRaw = extractFirstMatch(
    `${powerOutput}\n${displayOutput}`,
    [
      /Display Power:\s*state=([A-Za-z_]+)/i,
      /\bstate=([A-Za-z_]+)\b/i,
      /mScreenState=([A-Za-z_]+)/i
    ]
  );

  const interactive = parseBoolean(interactiveRaw);
  const displayState = normalizeDisplayState(displayStateRaw);
  const screenOnGuess = inferScreenOn({ interactive, wakefulness, displayState });

  return {
    interactive,
    wakefulness,
    displayState,
    screenOnGuess,
    raw: {
      powerOutput,
      displayOutput
    }
  };
}

function detectScreenDisturbance(previousState, nextState) {
  if (!previousState || !nextState) {
    return false;
  }

  const previousOn = previousState.screenOnGuess === true || previousState.interactive === true;
  const nextOn = nextState.screenOnGuess === true || nextState.interactive === true;

  return previousOn === false && nextOn === true;
}

export { parsePowerState, detectScreenDisturbance };
