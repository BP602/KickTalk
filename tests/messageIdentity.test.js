// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isHighlightedMessage, isOwnMessage } from '../src/renderer/src/utils/messageIdentity';

// Characterization of the highlight rule previously inline in Message.jsx
// (shouldHighlightMessage). userId mirrors the kickId prop: a string from
// localStorage, while message sender ids arrive as numbers.
const notifications = { background: true, phrases: [] };
const base = { username: 'some-user', userId: '42', notifications };
const msg = (overrides = {}) => ({
  type: 'message',
  content: 'hello chat',
  sender: { id: 99, slug: 'other-user', username: 'other-user' },
  ...overrides,
});

describe('isHighlightedMessage', () => {
  it('highlights an @mention of the current user', () => {
    expect(isHighlightedMessage(msg({ content: 'hi @some-user !' }), base)).toBe(true);
  });

  it('matches -/_ username variants and the bare name', () => {
    expect(isHighlightedMessage(msg({ content: '@some_user hi' }), base)).toBe(true);
    expect(isHighlightedMessage(msg({ content: '@someuser hi' }), base)).toBe(true);
    expect(isHighlightedMessage(msg({ content: '@Some-User hi' }), base)).toBe(true);
  });

  it('does not match a longer username sharing the prefix', () => {
    expect(isHighlightedMessage(msg({ content: '@some-user2 hi' }), base)).toBe(false);
    expect(isHighlightedMessage(msg({ content: '@some-users hi' }), base)).toBe(false);
  });

  it('does not highlight unrelated content', () => {
    expect(isHighlightedMessage(msg(), base)).toBe(false);
  });

  it('highlights a reply to the current user', () => {
    const reply = msg({ type: 'reply', metadata: { original_sender: { id: 42 } } });
    expect(isHighlightedMessage(reply, base)).toBe(true);
  });

  it('does not highlight my own reply to myself via the reply rule', () => {
    const reply = msg({
      type: 'reply',
      metadata: { original_sender: { id: 42 } },
      sender: { id: 42, slug: 'not-my-slug', username: 'x' },
    });
    expect(isHighlightedMessage(reply, base)).toBe(false);
  });

  it('never highlights the current user\'s own messages (slug exclusion)', () => {
    const own = msg({ content: 'hi @some-user', sender: { id: 42, slug: 'some-user', username: 'some-user' } });
    expect(isHighlightedMessage(own, base)).toBe(false);
  });

  it('never highlights in dialogs', () => {
    expect(isHighlightedMessage(msg({ content: 'hi @some-user' }), { ...base, type: 'dialog' })).toBe(false);
  });

  it('highlights in reply threads (only dialogs are excluded)', () => {
    expect(isHighlightedMessage(msg({ content: 'hi @some-user' }), { ...base, type: 'replyThread' })).toBe(true);
  });

  it('requires the background gate for mentions, replies, and phrases', () => {
    const off = { ...base, notifications: { background: false, phrases: ['hello'] } };
    expect(isHighlightedMessage(msg({ content: 'hi @some-user' }), off)).toBe(false);
    expect(isHighlightedMessage(msg({ type: 'reply', metadata: { original_sender: { id: 42 } } }), off)).toBe(false);
    expect(isHighlightedMessage(msg({ content: 'say hello' }), off)).toBe(false);
  });

  it('highlights custom phrases case-insensitively', () => {
    const withPhrases = { ...base, notifications: { background: true, phrases: ['GG WP'] } };
    expect(isHighlightedMessage(msg({ content: 'gg wp everyone' }), withPhrases)).toBe(true);
    expect(isHighlightedMessage(msg({ content: 'nice play' }), withPhrases)).toBe(false);
  });

  it('does not highlight without a username or notifications', () => {
    expect(isHighlightedMessage(msg({ content: 'hi @some-user' }), { ...base, username: undefined })).toBe(false);
    expect(isHighlightedMessage(msg({ content: 'hi @some-user' }), { ...base, notifications: undefined })).toBe(false);
    expect(isHighlightedMessage(null, base)).toBe(false);
  });
});

describe('isOwnMessage', () => {
  const currentUser = { id: 42, username: 'some-user' };

  it('matches the current user\'s messages and replies', () => {
    expect(isOwnMessage(msg({ sender: { id: 42 } }), currentUser)).toBe(true);
    expect(isOwnMessage(msg({ type: 'reply', sender: { id: 42 } }), currentUser)).toBe(true);
  });

  it('coerces string/number ids', () => {
    expect(isOwnMessage(msg({ sender: { id: '42' } }), currentUser)).toBe(true);
    expect(isOwnMessage(msg({ sender: { id: 42 } }), { id: '42' })).toBe(true);
  });

  it('is false when signed out', () => {
    expect(isOwnMessage(msg({ sender: { id: 42 } }), null)).toBe(false);
    expect(isOwnMessage(msg({ sender: { id: 42 } }), undefined)).toBe(false);
    expect(isOwnMessage(msg({ sender: { id: 42 } }), {})).toBe(false);
  });

  it('excludes non-message types and other senders', () => {
    expect(isOwnMessage(msg({ type: 'system', sender: { id: 42 } }), currentUser)).toBe(false);
    expect(isOwnMessage(msg({ sender: { id: 7 } }), currentUser)).toBe(false);
    expect(isOwnMessage(msg({ sender: undefined }), currentUser)).toBe(false);
    expect(isOwnMessage(null, currentUser)).toBe(false);
  });
});
