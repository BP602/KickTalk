'use strict';

// Shell-style grouping only: no expansion, operators, or shell execution.
function parseStreamlinkArgs(input = '') {
  const args = [];
  let value = '';
  let quote = null;
  let started = false;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '\\' && quote !== "'" &&
        (next === '"' || next === '\\' || (!quote && (next === "'" || /\s/.test(next || ''))))) {
      value += next;
      index++;
      started = true;
    } else if (char === quote) {
      quote = null;
    } else if (!quote && (char === '"' || char === "'")) {
      quote = char;
      started = true;
    } else if (!quote && /\s/.test(char)) {
      if (started) args.push(value);
      value = '';
      started = false;
    } else {
      value += char;
      started = true;
    }
  }

  if (quote) {
    throw new Error('Streamlink custom arguments contain an unterminated quote.');
  }
  if (started) args.push(value);
  return args;
}

function buildStreamlinkArgs(streamUrl, quality, settings = {}) {
  const {
    player = 'mpv',
    customArgs = '--player-args="--cache=no --speed=1.01"',
    kickLowLatency = true,
  } = settings;
  const args = [streamUrl, quality];

  if (player && player.trim()) {
    args.push('--player', player.trim());
  }
  if (kickLowLatency !== false) {
    args.push('--kick-low-latency');
  }

  // The toggle owns this standalone option, including flags in legacy settings.
  for (const arg of parseStreamlinkArgs(customArgs)) {
    if (arg !== '--kick-low-latency') args.push(arg);
  }
  return args;
}

module.exports = { parseStreamlinkArgs, buildStreamlinkArgs };
