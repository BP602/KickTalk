// Deterministic mock fixtures for web preview
// Shapes match what ChatProvider.jsx expects

const toSlug = (s) => (typeof s === 'string' ? s.trim().toLowerCase().replaceAll(' ', '').replaceAll('-', '_') : 'unknown');

const simpleIdFrom = (str) => {
  let acc = 0;
  for (let i = 0; i < str.length; i++) acc = (acc * 31 + str.charCodeAt(i)) >>> 0;
  return 100000 + (acc % 900000);
};

export function buildChannelInfo(input) {
  const slug = toSlug(input);
  const channelId = simpleIdFrom(slug);
  return {
    id: channelId,
    user_id: channelId + 1,
    slug,
    user: { username: slug, profile_pic: '' },
    subscriber_badges: [],
    livestream: null,
    banner_image: null,
    chatroom: { id: channelId },
  };
}

export function buildSelfChatroomInfo(slug) {
  return { data: null };
}

export function buildEmotes(slug) {
  // Return Kick-like emote sets array (minimal)
  return [
    { type: 'global', emotes: [] },
    { type: 'channel', emotes: [] },
  ];
}

export function buildInitialMessages(chatroomId) {
  // Matches usage in ChatProvider: response.data.data and optional pinned_message
  return { data: { data: {} } };
}
