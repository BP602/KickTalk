# Kick Event Definitions

Generated: 2025-09-16T10:10:58.386Z
Total Events Processed: 4069
Event Types Discovered: 21
Sample Events for Analysis: 567

## Event Type Statistics

- **App\Events\ChatMessageEvent (regular)**: 14 events
- **GoalProgressUpdateEvent (followers)**: 58 events
- **App\Events\ChatMessageEvent (reply)**: 2857 events
- **App\Events\UserUnbannedEvent**: 18 events
- **App\Events\PinnedMessageCreatedEvent**: 41 events
- **App\Events\MessageDeletedEvent**: 451 events
- **RewardRedeemedEvent**: 13 events
- **App\Events\ChatMessageEvent (celebration - subscription_renewed)**: 9 events
- **App\Events\StreamerIsLive**: 2 events
- **App\Events\UserBannedEvent**: 494 events
- **App\Events\StopStreamBroadcast**: 3 events
- **App\Events\ChatMoveToSupportedChannelEvent**: 1 events
- **App\Events\ChatMessageSentEvent**: 25 events
- **App\Events\SubscriptionEvent**: 22 events
- **App\Events\ChannelSubscriptionEvent**: 21 events
- **GiftedSubscriptionsEvent**: 15 events
- **App\Events\LuckyUsersWhoGotGiftSubscriptionsEvent**: 7 events
- **App\Events\PinnedMessageDeletedEvent**: 7 events
- **App\Events\ChatroomUpdatedEvent**: 1 events
- **App\Events\StreamHostedEvent**: 5 events
- **App\Events\StreamHostEvent**: 5 events

## Channel Type Distribution

- **chatroom**: 3977 events
- **channel**: 92 events

## Event Definitions

### App\Events\ChatMessageEvent (reply)

**Description**: Reply to another chat message

**Count**: 2857

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
  "id": "92ec5757-f497-432e-8009-6f39d0168b4e",
  "chatroom_id": 66973867,
  "content": "é quase infinito [emote:37227:LULW]",
  "type": "reply",
  "created_at": "2025-09-15T20:56:04+00:00",
  "sender": {
    "id": 1867079,
    "username": "BlPOLAR",
    "slug": "blpolar",
    "identity": {
      "color": "#FF9D00",
      "badges": [
        {
          "type": "moderator",
          "text": "Moderator"
        },
        {
          "type": "founder",
          "text": "Founder"
        },
        {
          "type": "sub_gifter",
          "text": "Sub Gifter",
          "count": 1
        }
      ]
    }
  },
  "metadata": {
    "original_sender": {
      "id": 69452322,
      "username": "Cr4zY_7"
    },
    "original_message": {
      "id": "7d66f1d8-bb48-4412-884f-c77c42bddcd0",
      "content": "acaba nuncaaa"
    },
    "message_ref": "1757969724050"
  }
}
```

---

### App\Events\UserBannedEvent

**Description**: User was banned from the chatroom

**Count**: 494

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
  "permanent": "boolean",
  "duration": "number",
  "expires_at": "string"
}
```

**Sample Data**:
```json
{
  "id": "36e33ce7-d2bc-4801-a522-8d61d231a95c",
  "user": {
    "id": 3356871,
    "username": "Mewthat",
    "slug": "mewthat"
  },
  "banned_by": {
    "id": 0,
    "username": "moderator",
    "slug": "moderator"
  },
  "permanent": false,
  "duration": 3,
  "expires_at": "2025-09-15T21:16:02+00:00"
}
```

---

### App\Events\MessageDeletedEvent

**Description**: Chat message was deleted by moderator

**Count**: 451

**Channels**: chatroom

**Data Structure**:
```json
{
  "id": "string",
  "message": {
    "id": "string"
  },
  "aiModerated": "boolean",
  "violatedRules": [
    "string"
  ]
}
```

**Sample Data**:
```json
{
  "id": "78d6e40a-0e5e-4c0b-a556-3d28fa32f608",
  "message": {
    "id": "786da071-c2f5-4593-8427-43c73dc245f2"
  },
  "aiModerated": true,
  "violatedRules": [
    "hate"
  ]
}
```

---

### GoalProgressUpdateEvent (followers)

**Description**: GoalProgressUpdateEvent - followers variant

**Count**: 58

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
  "current_value": 87406,
  "progress_bar_emoji_id": "chnl-goal-emotes/1",
  "status": "active",
  "created_at": "2025-07-17T18:21:12.158724Z",
  "updated_at": "2025-09-15T20:54:48.174178506Z",
  "achieved_at": null,
  "end_date": null,
  "count_from_creation": true
}
```

---

### App\Events\PinnedMessageCreatedEvent

**Description**: Message was pinned in chat

**Count**: 41

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
    "id": "f388e3f5-2806-4772-954a-976d397bab16",
    "chatroom_id": 66973867,
    "content": "Vote no GauGau → https://bit.ly/gaugamerinfluenciador || https://bit.ly/gaustreamerinfluenciador",
    "type": "message",
    "created_at": "2025-09-15T21:00:21+00:00",
    "sender": {
      "id": 62500352,
      "username": "ZacchiGi",
      "slug": "zacchigi",
      "identity": {
        "color": "#75FD46",
        "badges": [
          {
            "type": "moderator",
            "text": "Moderator"
          }
        ]
      }
    },
    "metadata": {
      "message_ref": "1757970042660"
    }
  },
  "duration": "1200",
  "pinnedBy": {
    "id": 62500352,
    "username": "ZacchiGi",
    "slug": "zacchigi",
    "identity": {
      "color": "#75FD46",
      "badges": [
        {
          "type": "moderator",
          "text": "Moderator",
          "active": true
        }
      ]
    }
  }
}
```

---

### App\Events\ChatMessageSentEvent

**Description**: Unknown event type: App\Events\ChatMessageSentEvent

**Count**: 25

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
    "id": "8efc02ce-b023-4125-b0d4-38f2c2ee1e4e",
    "message": null,
    "type": "info",
    "replied_to": null,
    "is_info": null,
    "link_preview": null,
    "chatroom_id": 27670567,
    "role": "user",
    "created_at": 1757975592,
    "action": "subscribe",
    "optional_message": null,
    "months_subscribed": 18,
    "subscriptions_count": 0,
    "giftedUsers": null
  },
  "user": {
    "id": 30389514,
    "username": "Ra_ab",
    "role": "user",
    "isSuperAdmin": null,
    "profile_thumb": null,
    "verified": false,
    "follower_badges": [],
    "is_subscribed": null,
    "is_founder": false,
    "months_subscribed": 18,
    "quantity_gifted": 0
  }
}
```

---

### App\Events\SubscriptionEvent

**Description**: Unknown event type: App\Events\SubscriptionEvent

**Count**: 22

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
  "username": "Ra_ab",
  "months": 18
}
```

---

### App\Events\ChannelSubscriptionEvent

**Description**: Unknown event type: App\Events\ChannelSubscriptionEvent

**Count**: 21

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
    2454627
  ],
  "username": "Chocollate",
  "channel_id": 2587387
}
```

---

### App\Events\UserUnbannedEvent

**Description**: User was unbanned from the chatroom

**Count**: 18

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
  "id": "004a59de-11b9-40a3-ad59-28aa4c22409b",
  "user": {
    "id": 134865,
    "username": "ktran",
    "slug": "ktran"
  },
  "unbanned_by": {
    "id": 518549,
    "username": "4headsbankaccount",
    "slug": "4headsbankaccount"
  },
  "permanent": true
}
```

---

### GiftedSubscriptionsEvent

**Description**: Unknown event type: GiftedSubscriptionsEvent

**Count**: 15

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
  "chatroom_id": 668,
  "gifted_usernames": [
    "Prvncee",
    "64kgol",
    "PolishGarnek",
    "tittfairy",
    "yilmoo",
    "Drazy1up",
    "Billy_Herrington1969",
    "danmukham",
    "Darrk72",
    "Gdott",
    "Rafinhawg",
    "Cybeth",
    "YOUNESS831",
    "Fanboy69420",
    "5BucksLib",
    "snekpourpel",
    "trash_kabam",
    "BANMEIHAVETOOMANYALTS",
    "unkept",
    "prexxuregaming",
    "verfallend",
    "Cmill3452",
    "Briannay",
    "ChowderMain",
    "imoolaa",
    "CURSEDTOROT",
    "Strucnjak93",
    "Janecek11",
    "joe9378alt",
    "Dylanvanloon",
    "bdang7544",
    "subasubaba",
    "voltybolt",
    "Atsuyo_O",
    "Arlene49",
    "KTs3rg1",
    "flonch",
    "TheyLoveMistey",
    "MMonkus",
    "l1ttl3k1ds",
    "Hesht",
    "ctian2",
    "stacyyyt",
    "Hjs3127",
    "megahomo64",
    "brandibunn",
    "MAJID98",
    "Minar1",
    "sonnychibaDOTsamurai",
    "DrenchMyWaffle",
    "Voided",
    "turkey4910",
    "Mightymatt23",
    "Elfadel",
    "Sidyyy75",
    "Nick_Inger117",
    "patriod",
    "Stoic_Grizz_Monkey",
    "Morad79",
    "oJordan",
    "Flokejd",
    "BBCenjoyer",
    "Kareemhaa",
    "Tremo",
    "Niminith1",
    "Bobcats",
    "ElMatrushka",
    "Yadri_pr",
    "Ramb02882",
    "Adan_waaa113",
    "Deppp",
    "MikitaShtydent",
    "joefred2018",
    "Sugmadig",
    "jonsED",
    "Gelo_09",
    "ninalove562",
    "treadwayii",
    "Cerbottamus_Prime",
    "ekarDTV",
    "shadyisback",
    "LostAlice",
    "ITsSoloFTW",
    "Melbatoast1985",
    "adku16",
    "Levievs4",
    "Oxentemaceio",
    "amine290104",
    "Yeimi1",
    "DoYaTe",
    "vladfrosty",
    "TheSentry",
    "maremoto",
    "Diacide",
    "aserri",
    "ARMAJEDONMTZ",
    "I_Mila_I",
    "Biscuit_cg",
    "Rode21",
    "CMGaming"
  ],
  "gifter_username": "jamestonic",
  "gifter_total": 2300
}
```

---

### App\Events\ChatMessageEvent (regular)

**Description**: Regular chat message

**Count**: 14

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
  "id": "284e02f4-c42c-4915-86c2-f2acbe1de95b",
  "chatroom_id": 27670567,
  "content": "where do you think raid 4 will be?",
  "type": "message",
  "created_at": "2025-09-15T20:54:07+00:00",
  "sender": {
    "id": 63914594,
    "username": "SageXzy",
    "slug": "sagexzy",
    "identity": {
      "color": "#B9D6F6",
      "badges": []
    }
  },
  "metadata": {
    "message_ref": "1757969647485"
  }
}
```

---

### RewardRedeemedEvent

**Description**: Unknown event type: RewardRedeemedEvent

**Count**: 13

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
  "reward_title": "TIME OUT",
  "user_id": 7419957,
  "channel_id": 2587387,
  "username": "MyWaffIe",
  "user_input": "4head",
  "reward_background_color": "#75FD46"
}
```

---

### App\Events\ChatMessageEvent (celebration - subscription_renewed)

**Description**: Subscription renewal celebration

**Count**: 9

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
  "id": "3265e459-9924-4151-873a-cb60accdefa8",
  "chatroom_id": 2579856,
  "content": "good to know miggy’s confident lol",
  "type": "celebration",
  "created_at": "2025-09-15T21:04:30+00:00",
  "sender": {
    "id": 49455037,
    "username": "Detergent86",
    "slug": "detergent86",
    "identity": {
      "color": "#BC66FF",
      "badges": [
        {
          "type": "subscriber",
          "text": "Subscriber",
          "count": 10
        }
      ]
    }
  },
  "metadata": {
    "celebration": {
      "id": "chceleb_01K57HZWERA5VKTS1JSZ6TEHRX",
      "type": "subscription_renewed",
      "total_months": 10,
      "created_at": "2025-09-15T20:45:17.656106Z"
    }
  }
}
```

---

### App\Events\LuckyUsersWhoGotGiftSubscriptionsEvent

**Description**: Unknown event type: App\Events\LuckyUsersWhoGotGiftSubscriptionsEvent

**Count**: 7

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
    "id": 668,
    "user_id": 676,
    "slug": "xqc",
    "is_banned": false,
    "playback_url": "https://fa723fc1b171.us-west-2.playback.live-video.net/api/video/v1/us-west-2.196233775518.channel.DsuAwCgUc9Bh.m3u8",
    "name_updated_at": null,
    "vod_enabled": true,
    "subscription_enabled": true,
    "is_affiliate": false,
    "can_host": true,
    "chatroom": {
      "id": 668,
      "chatable_type": "App\\Models\\Channel",
      "channel_id": 668,
      "created_at": "2022-10-22T06:59:51.000000Z",
      "updated_at": "2025-08-21T04:45:02.000000Z",
      "chat_mode_old": "public",
      "chat_mode": "public",
      "slow_mode": true,
      "chatable_id": 668,
      "followers_mode": true,
      "subscribers_mode": false,
      "emotes_mode": false,
      "message_interval": 5,
      "following_min_duration": 10
    }
  },
  "usernames": [
    "CURSEDTOROT",
    "unkept",
    "Cybeth",
    "DrenchMyWaffle",
    "MAJID98",
    "yilmoo",
    "5BucksLib",
    "Dylanvanloon",
    "Darrk72",
    "MMonkus",
    "flonch",
    "Rafinhawg",
    "Prvncee",
    "sonnychibaDOTsamurai",
    "bdang7544",
    "snekpourpel",
    "megahomo64",
    "Billy_Herrington1969",
    "PolishGarnek",
    "Hjs3127",
    "tittfairy",
    "danmukham",
    "ctian2",
    "BANMEIHAVETOOMANYALTS",
    "verfallend",
    "trash_kabam",
    "voltybolt",
    "Hesht",
    "Gdott",
    "Minar1",
    "Fanboy69420",
    "YOUNESS831",
    "64kgol",
    "Cmill3452",
    "Janecek11",
    "TheyLoveMistey",
    "joe9378alt",
    "prexxuregaming",
    "l1ttl3k1ds",
    "brandibunn",
    "stacyyyt",
    "ChowderMain",
    "subasubaba",
    "Atsuyo_O",
    "Briannay",
    "Strucnjak93",
    "imoolaa",
    "KTs3rg1",
    "Arlene49",
    "Drazy1up",
    "Voided",
    "turkey4910",
    "Mightymatt23",
    "oJordan",
    "Morad79",
    "Elfadel",
    "Sidyyy75",
    "Stoic_Grizz_Monkey",
    "Flokejd",
    "patriod",
    "Kareemhaa",
    "Deppp",
    "Nick_Inger117",
    "Sugmadig",
    "Gelo_09",
    "Niminith1",
    "Adan_waaa113",
    "joefred2018",
    "Bobcats",
    "Tremo",
    "jonsED",
    "Ramb02882",
    "MikitaShtydent",
    "ElMatrushka",
    "ninalove562",
    "Yadri_pr",
    "BBCenjoyer",
    "treadwayii",
    "Cerbottamus_Prime",
    "ITsSoloFTW",
    "ekarDTV",
    "Melbatoast1985",
    "LostAlice",
    "adku16",
    "shadyisback",
    "amine290104",
    "Levievs4",
    "Oxentemaceio",
    "DoYaTe",
    "Yeimi1",
    "TheSentry",
    "maremoto",
    "vladfrosty",
    "Diacide",
    "ARMAJEDONMTZ",
    "aserri",
    "I_Mila_I",
    "Biscuit_cg",
    "CMGaming",
    "Rode21"
  ],
  "gifter_username": "jamestonic"
}
```

---

### App\Events\PinnedMessageDeletedEvent

**Description**: Pinned message was removed

**Count**: 7

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

### App\Events\StreamHostedEvent

**Description**: Unknown event type: App\Events\StreamHostedEvent

**Count**: 5

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
    "id": "6c7ff7a9-e386-4c33-bb6f-ef88f2bcdc6e",
    "numberOfViewers": 30,
    "optionalMessage": null,
    "createdAt": "2025-09-16T05:50:06.771733Z"
  },
  "user": {
    "id": 3953291,
    "username": "BrandonDLive",
    "isSuperAdmin": false,
    "verified": false
  }
}
```

---

### App\Events\StreamHostEvent

**Description**: Unknown event type: App\Events\StreamHostEvent

**Count**: 5

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
  "number_viewers": 30,
  "host_username": "BrandonDLive"
}
```

---

### App\Events\StopStreamBroadcast

**Description**: Streamer stopped broadcasting

**Count**: 3

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
    "id": 74409800,
    "channel": {
      "id": 2587387,
      "is_banned": false
    }
  }
}
```

---

### App\Events\StreamerIsLive

**Description**: Streamer went live

**Count**: 2

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
    "id": 74454116,
    "channel_id": 668,
    "session_title": "👏LIVE👏CLICK👏DRAMA👏NEWS👏STUFF👏VIDEOS👏IDK👏BLAH BLAH👏LOCK IN👏",
    "source": null,
    "created_at": "2025-09-15T21:12:45.000000Z"
  }
}
```

---

### App\Events\ChatMoveToSupportedChannelEvent

**Description**: Unknown event type: App\Events\ChatMoveToSupportedChannelEvent

**Count**: 1

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
    "id": 67262278,
    "user_id": 68422390,
    "slug": "gaules",
    "is_banned": false,
    "playback_url": "https://fa723fc1b171.us-west-2.playback.live-video.net/api/video/v1/us-west-2.196233775518.channel.dvkGqjenUGAB.m3u8",
    "name_updated_at": null,
    "vod_enabled": true,
    "subscription_enabled": true,
    "is_affiliate": true,
    "can_host": false,
    "current_livestream": {
      "id": 74394967,
      "slug": "981dccc0-no-mula-sky-episodio-07-socio-vote-siga-at-gaules-nas-redes-sociais",
      "channel_id": 67262278,
      "created_at": "2025-09-15 13:03:23",
      "session_title": "NO MULA SKY Episódio 07 - !socio !vote - Siga @Gaules nas redes sociais!",
      "is_live": true,
      "risk_level_id": null,
      "start_time": "2025-09-15 13:03:22",
      "source": null,
      "twitch_channel": null,
      "duration": 0,
      "language": "Portuguese",
      "is_mature": false,
      "viewer_count": 673
    }
  },
  "slug": "velhovamp",
  "hosted": {
    "id": 59458765,
    "username": "VelhoVamp",
    "slug": "velhovamp",
    "viewers_count": 888,
    "is_live": true,
    "profile_pic": "https://files.kick.com/images/user/60596034/profile_image/conversion/80d01bd7-400c-42ad-9377-574c114131c3-thumb.webp",
    "category": "IRL",
    "preview_thumbnail": {
      "srcset": "https://images.kick.com/video_thumbnails/dVYZ9leemNtj/Is77FJLi2ohC/1080.webp?versionId=OEqwBtKoZsCxsaV4TquJMsRV29PEJj1C 1920w, https://images.kick.com/video_thumbnails/dVYZ9leemNtj/Is77FJLi2ohC/720.webp?versionId=T92ce2FaBVNcVY7IHBOpsZRSk6fIzIcX 1280w, https://images.kick.com/video_thumbnails/dVYZ9leemNtj/Is77FJLi2ohC/360.webp?versionId=ZW4l_zWYuKUlCTk.W2ozC6.Ddl.n3hG5 480w, https://images.kick.com/video_thumbnails/dVYZ9leemNtj/Is77FJLi2ohC/160.webp?versionId=BbsmnN4OoYoGFhyAP_wSQfyiKwdV5Ldg 284w, https://images.kick.com/video_thumbnails/dVYZ9leemNtj/Is77FJLi2ohC/480.webp?versionId=wSdwqRTPYkgH_HN1Jc4x.Rtf0IufUoEy 640w",
      "src": "https://images.kick.com/video_thumbnails/dVYZ9leemNtj/Is77FJLi2ohC/720.webp?versionId=T92ce2FaBVNcVY7IHBOpsZRSk6fIzIcX"
    }
  }
}
```

---

### App\Events\ChatroomUpdatedEvent

**Description**: Chatroom settings were updated

**Count**: 1

**Channels**: chatroom

**Data Structure**:
```json
{
  "id": "number",
  "slow_mode": {
    "enabled": "boolean",
    "message_interval": "number"
  },
  "subscribers_mode": {
    "enabled": "boolean"
  },
  "followers_mode": {
    "enabled": "boolean",
    "min_duration": "number"
  },
  "emotes_mode": {
    "enabled": "boolean"
  },
  "advanced_bot_protection": {
    "enabled": "boolean",
    "remaining_time": "number"
  },
  "account_age": {
    "enabled": "boolean",
    "min_duration": "number"
  }
}
```

**Sample Data**:
```json
{
  "id": 5512091,
  "slow_mode": {
    "enabled": true,
    "message_interval": 1
  },
  "subscribers_mode": {
    "enabled": false
  },
  "followers_mode": {
    "enabled": true,
    "min_duration": 1
  },
  "emotes_mode": {
    "enabled": false
  },
  "advanced_bot_protection": {
    "enabled": false,
    "remaining_time": 0
  },
  "account_age": {
    "enabled": false,
    "min_duration": 0
  }
}
```

---

