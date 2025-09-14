# Kick Event Definitions

Generated: 2025-09-14T16:28:05.041Z
Total Events Collected: 643

## Event Type Statistics

- **App\Events\ChatMessageEvent**: 626 events
- **GoalProgressUpdateEvent**: 14 events
- **App\Events\StreamerIsLive**: 1 events
- **App\Events\MessageDeletedEvent**: 2 events

## Channel Type Distribution

- **chatroom**: 628 events
- **channel**: 15 events

## Event Definitions

### App\Events\ChatMessageEvent

**Description**: Chat message sent in a chatroom

**Count**: 626

**Channels**: chatroom

**Data Structure**:
```json
{
  "id": "string",
  "chatroom_id": "number",
  "content": "string",
  "type": "string",
  "created_at": "string",
  "sender": {
    "id": "number",
    "username": "string",
    "slug": "string",
    "identity": {
      "color": "string",
      "badges": []
    }
  },
  "metadata": {
    "message_ref": "string"
  }
}
```

**Sample Data**:
```json
{
  "id": "58697a98-af91-4403-b106-cdbc663fa479",
  "chatroom_id": 1466067,
  "content": "bro how did hydra manage to end up holding out in cypress turf [emote:37226:KEKW]",
  "type": "message",
  "created_at": "2025-09-14T15:08:47+00:00",
  "sender": {
    "id": 15844757,
    "username": "K4ID3N",
    "slug": "k4id3n",
    "identity": {
      "color": "#B9D6F6",
      "badges": []
    }
  },
  "metadata": {
    "message_ref": "1757862526654"
  }
}
```

---

### GoalProgressUpdateEvent

**Description**: Unknown event type

**Count**: 14

**Channels**: channel

**Data Structure**:
```json
{
  "id": "string",
  "channel_id": "string",
  "type": "string",
  "target_value": "number",
  "current_value": "number",
  "progress_bar_emoji_id": "string",
  "status": "string",
  "created_at": "string",
  "updated_at": "string",
  "achieved_at": null,
  "end_date": null,
  "count_from_creation": "boolean"
}
```

**Sample Data**:
```json
{
  "id": "chgoal_01K0CSWXJYG9VPM5SM8HZHQGXN",
  "channel_id": "channel_01JZTAJA6H1RB6WPYVDFZ94SAA",
  "type": "followers",
  "target_value": 100000,
  "current_value": 87051,
  "progress_bar_emoji_id": "chnl-goal-emotes/1",
  "status": "active",
  "created_at": "2025-07-17T18:21:12.158724Z",
  "updated_at": "2025-09-14T15:08:56.879732103Z",
  "achieved_at": null,
  "end_date": null,
  "count_from_creation": true
}
```

---

### App\Events\MessageDeletedEvent

**Description**: Chat message was deleted by moderator

**Count**: 2

**Channels**: chatroom

**Data Structure**:
```json
{
  "id": "string",
  "message": {
    "id": "string"
  },
  "aiModerated": "boolean",
  "violatedRules": []
}
```

**Sample Data**:
```json
{
  "id": "4761cd38-3827-45a8-8533-b0d77e0f882f",
  "message": {
    "id": "c296f827-897e-42bc-9dbc-a80e8b415042"
  },
  "aiModerated": false,
  "violatedRules": []
}
```

---

### App\Events\StreamerIsLive

**Description**: Streamer went live

**Count**: 1

**Channels**: channel

**Data Structure**:
```json
{
  "livestream": {
    "id": "number",
    "channel_id": "number",
    "session_title": "string",
    "source": null,
    "created_at": "string"
  }
}
```

**Sample Data**:
```json
{
  "livestream": {
    "id": 74265904,
    "channel_id": 2587387,
    "session_title": "4HEAD | NOPIXEL 4.0 | TTS",
    "source": null,
    "created_at": "2025-09-14T16:11:18.000000Z"
  }
}
```

---

