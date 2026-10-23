import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const { parseStreamlinkArgs, buildStreamlinkArgs } = createRequire(import.meta.url)('../src/main/services/streamlinkArgs.cjs');

describe('Streamlink custom arguments', () => {
  it('keeps the complete mpv argument string in one Streamlink option', () => {
    expect(parseStreamlinkArgs('--kick-low-latency --player-args="--cache=no --speed=1.01"')).toEqual([
      '--kick-low-latency',
      '--player-args=--cache=no --speed=1.01',
    ]);
  });

  it.each([
    ["--player-args '--cache=no --speed=1.01'", ['--player-args', '--cache=no --speed=1.01']],
    ['--player "/opt/media player/mpv"', ['--player', '/opt/media player/mpv']],
    [String.raw`--title "say \"hello\""`, ['--title', 'say "hello"']],
    [String.raw`--title two\ words`, ['--title', 'two words']],
    [String.raw`--player "C:\Program Files\mpv\mpv.exe"`, ['--player', String.raw`C:\Program Files\mpv\mpv.exe`]],
    ['--title "" --loglevel info', ['--title', '', '--loglevel', 'info']],
    [' \t\n ', []],
    ["--title '$HOME; $(touch /tmp/not-executed) | cat'", ['--title', '$HOME; $(touch /tmp/not-executed) | cat']],
  ])('preserves grouping and literal values in %s', (input, expected) => {
    expect(parseStreamlinkArgs(input)).toEqual(expected);
  });

  it.each(['--player-args="--cache=no', "--title 'unfinished"])('rejects unmatched quotes in %s', (input) => {
    expect(() => parseStreamlinkArgs(input)).toThrow(/unterminated quote/i);
  });
});

describe('Streamlink launch arguments', () => {
  const streamUrl = 'https://kick.com/example';

  it('defaults to mpv, low latency, and grouped player arguments', () => {
    expect(buildStreamlinkArgs(streamUrl, 'best')).toEqual([
      streamUrl,
      'best',
      '--player',
      'mpv',
      '--kick-low-latency',
      '--player-args=--cache=no --speed=1.01',
    ]);
  });

  it.each([
    ['enabled', { kickLowLatency: true }, ['--kick-low-latency']],
    ['disabled', { kickLowLatency: false }, []],
    ['missing', {}, ['--kick-low-latency']],
  ])('lets the %s toggle own legacy standalone flags without changing saved settings', (_label, toggle, flags) => {
    const customArgs = '--loglevel debug --kick-low-latency --player-args="--cache=no --speed=1.01" "--kick-low-latency" --title "two words"';
    const settings = Object.freeze({ player: ' /opt/media player/mpv ', customArgs, ...toggle });

    expect(buildStreamlinkArgs(streamUrl, '720p', settings)).toEqual([
      streamUrl,
      '720p',
      '--player',
      '/opt/media player/mpv',
      ...flags,
      '--loglevel',
      'debug',
      '--player-args=--cache=no --speed=1.01',
      '--title',
      'two words',
    ]);
    expect(settings.customArgs).toBe(customArgs);
  });

  it('preserves lookalikes and embedded flag text when low latency is disabled', () => {
    expect(buildStreamlinkArgs(streamUrl, 'best', {
      kickLowLatency: false,
      customArgs: '--kick-low-latency --kick-low-latency=true --title "keep --kick-low-latency here" --player-args="--kick-low-latency --cache=no"',
    })).toEqual([
      streamUrl,
      'best',
      '--player',
      'mpv',
      '--kick-low-latency=true',
      '--title',
      'keep --kick-low-latency here',
      '--player-args=--kick-low-latency --cache=no',
    ]);
  });

  it('does not restore default custom arguments over an explicit empty string', () => {
    expect(buildStreamlinkArgs(streamUrl, 'best', { customArgs: '' })).toEqual([
      streamUrl, 'best', '--player', 'mpv', '--kick-low-latency',
    ]);
  });

  it.each(['', ' \t '])('omits an explicitly empty player command %j', (player) => {
    expect(buildStreamlinkArgs(streamUrl, 'best', { player, kickLowLatency: false })).toEqual([
      streamUrl, 'best', '--player-args=--cache=no --speed=1.01',
    ]);
  });

  it('supports no player or custom arguments with low latency disabled', () => {
    expect(buildStreamlinkArgs(streamUrl, 'best', {
      player: '',
      customArgs: '',
      kickLowLatency: false,
    })).toEqual([streamUrl, 'best']);
  });

  it.each([true, false])('keeps all options when rebuilding for fallback quality with low latency %s', (kickLowLatency) => {
    const settings = {
      kickLowLatency,
      player: 'vlc',
      customArgs: "--kick-low-latency --player-args '--network-caching=1000 --fullscreen'",
    };
    const options = [
      '--player',
      'vlc',
      ...(kickLowLatency ? ['--kick-low-latency'] : []),
      '--player-args',
      '--network-caching=1000 --fullscreen',
    ];

    expect(buildStreamlinkArgs(streamUrl, '1080p60', settings)).toEqual([streamUrl, '1080p60', ...options]);
    expect(buildStreamlinkArgs(streamUrl, 'best', settings)).toEqual([streamUrl, 'best', ...options]);
  });

  it('rejects malformed quoted arguments before returning launch arguments', () => {
    expect(() => buildStreamlinkArgs(streamUrl, 'best', {
      customArgs: '--player-args="--cache=no',
    })).toThrow(/unterminated quote/i);
  });
});
