// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// EmoteSuggestions itself uses none of these; keep the module's unrelated
// store/editor dependencies out of this rendering test.
vi.mock('../src/renderer/src/providers/ChatProvider', () => ({ default: vi.fn() }));
vi.mock('../src/renderer/src/providers/SettingsProvider', () => ({ useSettings: () => ({}) }));
vi.mock('../src/renderer/src/components/Chat/hooks/useAllStvEmotes', () => ({ useAllStvEmotes: () => [] }));
vi.mock('../src/renderer/src/components/Chat/Input/EmoteDialogs', () => ({ default: () => null }));
vi.mock('../src/renderer/src/components/Chat/Input/InfoBar', () => ({ default: () => null }));
vi.mock('../src/renderer/src/components/Chat/Input/EmoteNode', () => ({ EmoteNode: class {} }));
vi.mock('../src/renderer/src/components/Chat/Input/useAccessibleKickEmotes', () => ({
  useAccessibleKickEmotes: () => [],
}));
vi.mock('../src/renderer/src/utils/MessageParser', () => ({ MessageParser: () => '' }));
vi.mock('../src/renderer/src/utils/ChatUtils', () => ({
  isModeEnabled: () => false,
  chatModeMatches: () => false,
}));
vi.mock('../src/renderer/src/telemetry/chatModeTelemetry', () => ({
  recordChatModeFeatureUsage: vi.fn(),
}));

// React's server renderer (used elsewhere in this suite) never emits
// duplicate-key warnings — that check lives only in the client reconciler,
// and no DOM implementation is installed — so key uniqueness is asserted on
// the element tree the component returns. Stubbing only React's hook
// primitives lets that tree be produced without a DOM; the component itself
// and its rendering are not mocked.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useRef: () => ({ current: null }),
    useCallback: (fn) => fn,
    useEffect: () => {},
  };
});

import { EmoteSuggestions } from '../src/renderer/src/components/Chat/Input/index.jsx';

// Shapes mirror the real producers: 7TV emotes carry platform/type with
// alias null whenever the set name equals the emote's own name
// (ChatProvider/stvAPI), Kick emotes carry platform "kick" plus the section
// identity added by useAccessibleKickEmotes (kickAPI adds platform).
const suggestions = [
  { id: 'emote-1', name: 'KEKW', alias: null, platform: '7tv', type: 'channel' },
  // The same 7TV emote offered again by the global set: same id/name/alias.
  { id: 'emote-1', name: 'KEKW', alias: null, platform: '7tv', type: 'global' },
  // A different emote that provider-side shares the first emote's id.
  { id: 'emote-1', name: 'LULW', alias: null, platform: '7tv', type: 'personal' },
  // The same id+name arriving from Kick instead of 7TV.
  {
    id: 'emote-1',
    name: 'KEKW',
    platform: 'kick',
    __sectionKey: 'global:kick-emotes',
    __sectionKind: 'global',
    __sourceChatroomId: 42,
  },
  { id: 'emote-2', name: 'Sadge', alias: null, platform: '7tv', type: 'channel' },
  { id: 'emote-3', name: 'PogChamp', alias: null, platform: '7tv', type: 'channel' },
  { id: 'emote-4', name: 'Aliased', alias: 'OriginalName', platform: '7tv', type: 'channel' },
];

const props = {
  suggestions,
  onSelect: () => {},
  selectedIndex: 0,
  userChatroomInfo: null,
};

// Collect every keyed row element and every rendered text node in the tree.
const collect = (node, rows, texts) => {
  if (node == null || typeof node === 'boolean') return;
  if (typeof node === 'string') {
    texts.push(node);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collect(child, rows, texts));
    return;
  }
  if (typeof node === 'object' && node.props) {
    if (node.key != null && String(node.props.className || '').includes('inputSuggestion')) {
      rows.push(node);
    }
    collect(node.props.children, rows, texts);
  }
};

describe('emote suggestions', () => {
  let consoleError;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders every null-alias suggestion row', () => {
    const html = renderToStaticMarkup(createElement(EmoteSuggestions, props));

    const rows = html.match(/class="inputSuggestion[" ]/g) || [];
    expect(rows).toHaveLength(suggestions.length);
    for (const emote of suggestions) {
      expect(html).toContain(`<span>${emote.name}</span>`);
    }
  });

  it('gives every suggestion row a unique key', () => {
    const tree = EmoteSuggestions.type(props);
    const rows = [];
    const texts = [];
    collect(tree, rows, texts);

    expect(rows).toHaveLength(suggestions.length);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    for (const emote of suggestions) {
      expect(texts).toContain(emote.name);
    }
  });
});
