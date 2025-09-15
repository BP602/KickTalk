# Kick Event Definitions

Generated: 2025-09-15T20:20:28.702Z
Total Events Processed: 805905
Event Types Discovered: 20
Sample Events for Analysis: 1833

## Event Type Statistics

- **App\Events\ChatMessageEvent (regular)**: 736747 events
- **App\Events\ChatMessageEvent (reply)**: 46525 events
- **App\Events\UserBannedEvent**: 1399 events
- **App\Events\MessageDeletedEvent**: 2036 events
- **GoalProgressUpdateEvent (followers)**: 12314 events
- **RewardRedeemedEvent**: 1306 events
- **App\Events\UserUnbannedEvent**: 294 events
- **App\Events\ChatMessageEvent (celebration - subscription_renewed)**: 282 events
- **App\Events\ChatMessageSentEvent**: 723 events
- **App\Events\SubscriptionEvent**: 554 events
- **App\Events\LuckyUsersWhoGotGiftSubscriptionsEvent**: 59 events
- **GiftedSubscriptionsEvent**: 284 events
- **App\Events\PinnedMessageCreatedEvent**: 2635 events
- **App\Events\PinnedMessageDeletedEvent**: 59 events
- **App\Events\ChannelSubscriptionEvent**: 177 events
- **App\Events\ChatMoveToSupportedChannelEvent**: 57 events
- **App\Events\StopStreamBroadcast**: 58 events
- **App\Events\StreamerIsLive**: 168 events
- **App\Events\StreamHostedEvent**: 114 events
- **App\Events\StreamHostEvent**: 114 events

## Channel Type Distribution

- **chatroom**: 793072 events
- **channel**: 12833 events

## Event Definitions

### App\Events\ChatMessageEvent (regular)

**Description**: Regular chat message

**Count**: 736747

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
      "badges": [
        "..."
      ]
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
  "id": "73aaa4fd-ce0a-49ce-83fd-2b150d2913cd",
  "chatroom_id": 2579856,
  "content": "too late fatty",
  "type": "message",
  "created_at": "2025-09-14T16:59:34+00:00",
  "sender": {
    "id": 82098,
    "username": "joaquin7m",
    "slug": "joaquin7m",
    "identity": {
      "color": "#B9D6F6",
      "badges": [
        {
          "type": "subscriber",
          "text": "Subscriber",
          "count": 2
        }
      ]
    }
  },
  "metadata": {
    "message_ref": "1757869174401"
  }
}
```

---

### App\Events\ChatMessageEvent (reply)

**Description**: Reply to another chat message

**Count**: 46525

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
    "original_sender": {
      "id": "number",
      "username": "string"
    },
    "original_message": {
      "id": "string",
      "content": "string"
    },
    "message_ref": "string"
  }
}
```

**Sample Data**:
```json
{
  "id": "c196a907-44ca-4e27-80dd-da5036d7ffea",
  "chatroom_id": 1466067,
  "content": "hahahahaha",
  "type": "reply",
  "created_at": "2025-09-14T16:59:36+00:00",
  "sender": {
    "id": 63189506,
    "username": "Usernamezon",
    "slug": "usernamezon",
    "identity": {
      "color": "#DEB2FF",
      "badges": []
    }
  },
  "metadata": {
    "original_sender": {
      "id": 51131710,
      "username": "LadySokk"
    },
    "original_message": {
      "id": "4d9cd589-3da6-4288-a35c-93bd692f25b5",
      "content": "of course"
    },
    "message_ref": "1757871206912"
  }
}
```

---

### GoalProgressUpdateEvent (followers)

**Description**: GoalProgressUpdateEvent - followers variant

**Count**: 12314

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
  "current_value": 87106,
  "progress_bar_emoji_id": "chnl-goal-emotes/1",
  "status": "active",
  "created_at": "2025-07-17T18:21:12.158724Z",
  "updated_at": "2025-09-14T18:28:43.670407152Z",
  "achieved_at": null,
  "end_date": null,
  "count_from_creation": true
}
```

---

### App\Events\PinnedMessageCreatedEvent

**Description**: Message was pinned in chat

**Count**: 2635

**Channels**: chatroom

**Data Structure**:
```json
{
  "message": {
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
        "color": "...",
        "badges": "..."
      }
    },
    "metadata": {
      "message_ref": "string"
    }
  },
  "duration": "string",
  "pinnedBy": {
    "id": "number",
    "username": "string",
    "slug": "string",
    "identity": {
      "color": "string",
      "badges": [
        "..."
      ]
    }
  }
}
```

**Sample Data**:
```json
{
  "message": {
    "id": "c7d0b815-f358-4332-b35c-1bcd5735fc29",
    "chatroom_id": 2579856,
    "content": "i can prolly get us all on ranch",
    "type": "message",
    "created_at": "2025-09-14T21:02:53+00:00",
    "sender": {
      "id": 10885610,
      "username": "kyle",
      "slug": "kyle",
      "identity": {
        "color": "#75FD46",
        "badges": [
          {
            "type": "verified",
            "text": "Verified channel"
          }
        ]
      }
    },
    "metadata": {
      "message_ref": "1757883772034"
    }
  },
  "duration": "1200",
  "pinnedBy": {
    "id": 584800,
    "username": "sino_tf",
    "slug": "sino-tf",
    "identity": {
      "color": "#FF9D00",
      "badges": [
        {
          "type": "moderator",
          "text": "Moderator",
          "active": true
        },
        {
          "type": "founder",
          "text": "Founder",
          "active": true
        }
      ]
    }
  }
}
```

---

### App\Events\MessageDeletedEvent

**Description**: Chat message was deleted by moderator

**Count**: 2036

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
  "id": "af745ef1-164d-4134-96aa-ff48fce41375",
  "message": {
    "id": "05579f64-beeb-45ee-93c9-5a636c3e2b08"
  },
  "aiModerated": false,
  "violatedRules": []
}
```

---

### App\Events\UserBannedEvent

**Description**: User was banned from the chatroom

**Count**: 1399

**Channels**: chatroom

**Data Structure**:
```json
{
  "id": "string",
  "user": {
    "id": "number",
    "username": "string",
    "slug": "string"
  },
  "banned_by": {
    "id": "number",
    "username": "string",
    "slug": "string"
  },
  "permanent": "boolean"
}
```

**Sample Data**:
```json
{
  "id": "fb890862-43f1-413b-bc7e-6ac3d37d0a33",
  "user": {
    "id": 78515166,
    "username": "X9584560T",
    "slug": "x9584560t"
  },
  "banned_by": {
    "id": 0,
    "username": "Soda19XX",
    "slug": "soda19xx"
  },
  "permanent": true
}
```

---

### RewardRedeemedEvent

**Description**: Unknown event type: RewardRedeemedEvent

**Count**: 1306

**Channels**: chatroom

**Data Structure**:
```json
{
  "reward_title": "string",
  "user_id": "number",
  "channel_id": "number",
  "username": "string",
  "user_input": "string",
  "reward_background_color": "string"
}
```

**Sample Data**:
```json
{
  "reward_title": "Obese Tax",
  "user_id": 30048604,
  "channel_id": 1473258,
  "username": "vankizle",
  "user_input": "",
  "reward_background_color": "#E9113C"
}
```

---

### App\Events\ChatMessageSentEvent

**Description**: Unknown event type: App\Events\ChatMessageSentEvent

**Count**: 723

**Channels**: chatroom

**Data Structure**:
```json
{
  "message": {
    "id": "string",
    "message": null,
    "type": "string",
    "replied_to": null,
    "is_info": null,
    "link_preview": null,
    "chatroom_id": "number",
    "role": "string",
    "created_at": "number",
    "action": "string",
    "optional_message": null,
    "months_subscribed": "number",
    "subscriptions_count": "number",
    "giftedUsers": null
  },
  "user": {
    "id": "number",
    "username": "string",
    "role": "string",
    "isSuperAdmin": null,
    "profile_thumb": null,
    "verified": "boolean",
    "follower_badges": [],
    "is_subscribed": null,
    "is_founder": "boolean",
    "months_subscribed": "number",
    "quantity_gifted": "number"
  }
}
```

**Sample Data**:
```json
{
  "message": {
    "id": "16e4043b-bd9a-4710-bd3e-481c6348d32c",
    "message": null,
    "type": "info",
    "replied_to": null,
    "is_info": null,
    "link_preview": null,
    "chatroom_id": 27670567,
    "role": "user",
    "created_at": 1757877790,
    "action": "subscribe",
    "optional_message": null,
    "months_subscribed": 1,
    "subscriptions_count": 0,
    "giftedUsers": null
  },
  "user": {
    "id": 30814612,
    "username": "JonElsdon23",
    "role": "user",
    "isSuperAdmin": null,
    "profile_thumb": null,
    "verified": false,
    "follower_badges": [],
    "is_subscribed": null,
    "is_founder": false,
    "months_subscribed": 1,
    "quantity_gifted": 0
  }
}
```

---

### App\Events\SubscriptionEvent

**Description**: Unknown event type: App\Events\SubscriptionEvent

**Count**: 554

**Channels**: chatroom

**Data Structure**:
```json
{
  "chatroom_id": "number",
  "username": "string",
  "months": "number"
}
```

**Sample Data**:
```json
{
  "chatroom_id": 27670567,
  "username": "JonElsdon23",
  "months": 1
}
```

---

### App\Events\UserUnbannedEvent

**Description**: User was unbanned from the chatroom

**Count**: 294

**Channels**: chatroom

**Data Structure**:
```json
{
  "id": "string",
  "user": {
    "id": "number",
    "username": "string",
    "slug": "string"
  },
  "unbanned_by": {
    "id": "number",
    "username": "string",
    "slug": "string"
  },
  "permanent": "boolean"
}
```

**Sample Data**:
```json
{
  "id": "a7b169a6-80b6-44e8-80ab-157296bdb35e",
  "user": {
    "id": 67805825,
    "username": "granddar1990",
    "slug": "granddar1990"
  },
  "unbanned_by": {
    "id": 27998913,
    "username": "rupje",
    "slug": "rupje"
  },
  "permanent": true
}
```

---

### GiftedSubscriptionsEvent

**Description**: Unknown event type: GiftedSubscriptionsEvent

**Count**: 284

**Channels**: chatroom

**Data Structure**:
```json
{
  "chatroom_id": "number",
  "gifted_usernames": [
    "string"
  ],
  "gifter_username": "string",
  "gifter_total": "number"
}
```

**Sample Data**:
```json
{
  "chatroom_id": 2579856,
  "gifted_usernames": [
    "4headschair"
  ],
  "gifter_username": "adrighh",
  "gifter_total": 355
}
```

---

### App\Events\ChatMessageEvent (celebration - subscription_renewed)

**Description**: Subscription renewal celebration

**Count**: 282

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
      "badges": [
        "..."
      ]
    }
  },
  "metadata": {
    "celebration": {
      "id": "string",
      "type": "string",
      "total_months": "number",
      "created_at": "string"
    }
  }
}
```

**Sample Data**:
```json
{
  "id": "971f5e15-3d1a-4603-b730-46dcffb5fdf1",
  "chatroom_id": 27670567,
  "content": "🎉",
  "type": "celebration",
  "created_at": "2025-09-14T18:54:06+00:00",
  "sender": {
    "id": 4932883,
    "username": "Yaaaooo",
    "slug": "yaaaooo",
    "identity": {
      "color": "#00CCB3",
      "badges": [
        {
          "type": "subscriber",
          "text": "Subscriber",
          "count": 13
        },
        {
          "type": "sub_gifter",
          "text": "Sub Gifter",
          "count": 5
        }
      ]
    }
  },
  "metadata": {
    "celebration": {
      "id": "chceleb_01K4JCQWBXWRCTNM0PG0PAGTFY",
      "type": "subscription_renewed",
      "total_months": 13,
      "created_at": "2025-09-07T15:29:29.469652Z"
    }
  }
}
```

---

### App\Events\ChannelSubscriptionEvent

**Description**: Unknown event type: App\Events\ChannelSubscriptionEvent

**Count**: 177

**Channels**: channel

**Data Structure**:
```json
{
  "user_ids": [
    "number"
  ],
  "username": "string",
  "channel_id": "number"
}
```

**Sample Data**:
```json
{
  "user_ids": [
    64852064
  ],
  "username": "DharionDrahl",
  "channel_id": 10127341
}
```

---

### App\Events\StreamerIsLive

**Description**: Streamer went live

**Count**: 168

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
    "id": 74331109,
    "channel_id": 668,
    "session_title": "+18 #ad🌟LIVE🌟CLICK🌟DRAMA🌟NEWS🌟VIDEOS🌟GAMES🌟VIDEOGAMES🌟STUFF🌟WOW🌟FUN🌟LOCK IN🌟",
    "source": null,
    "created_at": "2025-09-14T23:18:20.000000Z"
  }
}
```

---

### App\Events\StreamHostedEvent

**Description**: Unknown event type: App\Events\StreamHostedEvent

**Count**: 114

**Channels**: chatroom

**Data Structure**:
```json
{
  "message": {
    "id": "string",
    "numberOfViewers": "number",
    "optionalMessage": null,
    "createdAt": "string"
  },
  "user": {
    "id": "number",
    "username": "string",
    "isSuperAdmin": "boolean",
    "verified": "boolean"
  }
}
```

**Sample Data**:
```json
{
  "message": {
    "id": "a2bb4863-f25d-4c23-818c-bac1d5a23741",
    "numberOfViewers": 216,
    "optionalMessage": null,
    "createdAt": "2025-09-15T02:58:11.211597Z"
  },
  "user": {
    "id": 2390554,
    "username": "BortnykChess",
    "isSuperAdmin": false,
    "verified": false
  }
}
```

---

### App\Events\StreamHostEvent

**Description**: Unknown event type: App\Events\StreamHostEvent

**Count**: 114

**Channels**: chatroom

**Data Structure**:
```json
{
  "chatroom_id": "number",
  "optional_message": null,
  "number_viewers": "number",
  "host_username": "string"
}
```

**Sample Data**:
```json
{
  "chatroom_id": 668,
  "optional_message": null,
  "number_viewers": 216,
  "host_username": "BortnykChess"
}
```

---

### App\Events\LuckyUsersWhoGotGiftSubscriptionsEvent

**Description**: Unknown event type: App\Events\LuckyUsersWhoGotGiftSubscriptionsEvent

**Count**: 59

**Channels**: channel

**Data Structure**:
```json
{
  "channel": {
    "id": "number",
    "user_id": "number",
    "slug": "string",
    "is_banned": "boolean",
    "playback_url": "string",
    "name_updated_at": null,
    "vod_enabled": "boolean",
    "subscription_enabled": "boolean",
    "is_affiliate": "boolean",
    "can_host": "boolean",
    "chatroom": {
      "id": "number",
      "chatable_type": "string",
      "channel_id": "number",
      "created_at": "string",
      "updated_at": "string",
      "chat_mode_old": "string",
      "chat_mode": "string",
      "slow_mode": "boolean",
      "chatable_id": "number",
      "followers_mode": "boolean",
      "subscribers_mode": "boolean",
      "emotes_mode": "boolean",
      "message_interval": "number",
      "following_min_duration": "number"
    }
  },
  "usernames": [
    "string"
  ],
  "gifter_username": "string"
}
```

**Sample Data**:
```json
{
  "channel": {
    "id": 2587387,
    "user_id": 2642629,
    "slug": "4head",
    "is_banned": false,
    "playback_url": "https://fa723fc1b171.us-west-2.playback.live-video.net/api/video/v1/us-west-2.196233775518.channel.Nfs1w4IqMfpg.m3u8",
    "name_updated_at": null,
    "vod_enabled": true,
    "subscription_enabled": true,
    "is_affiliate": true,
    "can_host": true,
    "chatroom": {
      "id": 2579856,
      "chatable_type": "App\\Models\\Channel",
      "channel_id": 2587387,
      "created_at": "2023-04-01T06:05:06.000000Z",
      "updated_at": "2025-09-10T18:12:13.000000Z",
      "chat_mode_old": "public",
      "chat_mode": "public",
      "slow_mode": true,
      "chatable_id": 2587387,
      "followers_mode": false,
      "subscribers_mode": false,
      "emotes_mode": false,
      "message_interval": 2,
      "following_min_duration": 0
    }
  },
  "usernames": [
    "4headschair"
  ],
  "gifter_username": "adrighh"
}
```

---

### App\Events\PinnedMessageDeletedEvent

**Description**: Pinned message was removed

**Count**: 59

**Channels**: chatroom

**Data Structure**:
```json
[]
```

**Sample Data**:
```json
[]
```

---

### App\Events\StopStreamBroadcast

**Description**: Streamer stopped broadcasting

**Count**: 58

**Channels**: channel

**Data Structure**:
```json
{
  "livestream": {
    "id": "number",
    "channel": {
      "id": "number",
      "is_banned": "boolean"
    }
  }
}
```

**Sample Data**:
```json
{
  "livestream": {
    "id": 74265904,
    "channel": {
      "id": 2587387,
      "is_banned": false
    }
  }
}
```

---

### App\Events\ChatMoveToSupportedChannelEvent

**Description**: Unknown event type: App\Events\ChatMoveToSupportedChannelEvent

**Count**: 57

**Channels**: channel

**Data Structure**:
```json
{
  "channel": {
    "id": "number",
    "user_id": "number",
    "slug": "string",
    "is_banned": "boolean",
    "playback_url": "string",
    "name_updated_at": null,
    "vod_enabled": "boolean",
    "subscription_enabled": "boolean",
    "is_affiliate": "boolean",
    "can_host": "boolean",
    "current_livestream": {
      "id": "number",
      "slug": "string",
      "channel_id": "number",
      "created_at": "string",
      "session_title": "string",
      "is_live": "boolean",
      "risk_level_id": null,
      "start_time": "string",
      "source": null,
      "twitch_channel": null,
      "duration": "number",
      "language": "string",
      "is_mature": "boolean",
      "viewer_count": "number"
    }
  },
  "slug": "string",
  "hosted": {
    "id": "number",
    "username": "string",
    "slug": "string",
    "viewers_count": "number",
    "is_live": "boolean",
    "profile_pic": "string",
    "category": "string",
    "preview_thumbnail": {
      "srcset": "string",
      "src": "string"
    }
  }
}
```

**Sample Data**:
```json
{
  "channel": {
    "id": 2587387,
    "user_id": 2642629,
    "slug": "4head",
    "is_banned": false,
    "playback_url": "https://fa723fc1b171.us-west-2.playback.live-video.net/api/video/v1/us-west-2.196233775518.channel.Nfs1w4IqMfpg.m3u8",
    "name_updated_at": null,
    "vod_enabled": true,
    "subscription_enabled": true,
    "is_affiliate": true,
    "can_host": false,
    "current_livestream": {
      "id": 74265904,
      "slug": "e36ef0e0-4head-the-frontier-rp-tts-who-tf-knows",
      "channel_id": 2587387,
      "created_at": "2025-09-14 16:11:18",
      "session_title": "4HEAD | The Frontier RP | TTS (who tf knows)",
      "is_live": true,
      "risk_level_id": null,
      "start_time": "2025-09-14 16:11:16",
      "source": null,
      "twitch_channel": null,
      "duration": 0,
      "language": "English",
      "is_mature": false,
      "viewer_count": 1371
    }
  },
  "slug": "dripp",
  "hosted": {
    "id": 972889,
    "username": "dripp",
    "slug": "dripp",
    "viewers_count": 1692,
    "is_live": true,
    "profile_pic": "https://files.kick.com/images/user/1015661/profile_image/conversion/1f64aace-aa40-458d-8c2d-0f1664b53168-thumb.webp",
    "category": "Games",
    "preview_thumbnail": {
      "srcset": "https://images.kick.com/video_thumbnails/87zvBZkYDBdk/H5XiKkFSroOb/1080.webp?versionId=9.RBG5XI465cTXtzrvrQgbPLVJKCzLyt 1920w, https://images.kick.com/video_thumbnails/87zvBZkYDBdk/H5XiKkFSroOb/720.webp?versionId=pLm0p272r_l2nZE2NTGDBeehD4PAQczw 1280w, https://images.kick.com/video_thumbnails/87zvBZkYDBdk/H5XiKkFSroOb/360.webp?versionId=RsvC9sY79J7kuw8DUg21pIcfR_Qh_yk2 480w, https://images.kick.com/video_thumbnails/87zvBZkYDBdk/H5XiKkFSroOb/160.webp?versionId=V6rdzDbBTCezq0NodaA63HGyPcYRAoWz 284w, https://images.kick.com/video_thumbnails/87zvBZkYDBdk/H5XiKkFSroOb/480.webp?versionId=rVx3zNPcG8Zeyw_djvTHQIMPZRfoPfDn 640w",
      "src": "https://images.kick.com/video_thumbnails/87zvBZkYDBdk/H5XiKkFSroOb/720.webp?versionId=pLm0p272r_l2nZE2NTGDBeehD4PAQczw"
    }
  }
}
```

---

