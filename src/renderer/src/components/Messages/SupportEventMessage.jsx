import { memo } from "react";
import { Sparkle as SparkleIcon, Gift as GiftIcon, Record as RecordIcon, EyeSlash as EyeSlashIcon, ClockUser as ClockUserIcon, Gavel as GavelIcon, UserPlus as UserPlusIcon, UsersThree as UsersThreeIcon, FlagCheckered as FlagCheckeredIcon, Target as TargetIcon } from "@phosphor-icons/react";

const KinkIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path
      d="M7.67318 0.0611465L3.07733 1.75287C2.86614 1.8344 2.68512 1.98726 2.5745 2.18089L0.130751 6.47134C0.0201286 6.67516 -0.0200977 6.89936 0.0201286 7.13376L0.86488 12.0051C0.905107 12.2293 1.02579 12.4331 1.19675 12.586L4.93779 15.7656C5.10875 15.9083 5.33 15.9898 5.5613 15.9898H10.4488C10.6801 15.9898 10.8913 15.9083 11.0723 15.7656L14.8133 12.586C14.9843 12.4433 15.105 12.2293 15.1452 12.0051L15.99 7.13376C16.0302 6.90955 15.99 6.67516 15.8793 6.47134L13.4356 2.18089C13.325 1.97707 13.1439 1.8344 12.9328 1.75287L8.32685 0.0611465C8.11566 -0.0203822 7.88436 -0.0203822 7.66312 0.0611465H7.67318Z"
      fill="url(#kink_paint0)"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.8926 12.9936L10.7203 14.8484C10.5293 15.0115 10.2879 15.093 10.0365 15.093H5.85297C5.60156 15.093 5.3602 15.0115 5.16912 14.8484L3.34888 13.2994L3.94222 12.6165L10.8109 10.8739L12.8926 12.9834V12.9936Z"
      fill="url(#kink_paint1)"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14.6122 9.92612L14.3407 11.4854C14.3005 11.7299 14.1698 11.9541 13.9787 12.1172L12.9529 12.9834L10.8712 10.8739L14.6223 9.92612H14.6122Z"
      fill="url(#kink_paint2)"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15.0648 7.30702L14.6122 9.92612L10.8611 10.8739L7.99501 7.96944L13.9988 4.9325L14.934 6.58345C15.0547 6.79746 15.105 7.05224 15.0547 7.29683L15.0648 7.30702Z"
      fill="url(#kink_paint3)"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.1584 2.39491L4.42493 4.3516L3.09747 3.00638L3.14775 2.90447C3.26843 2.69046 3.46956 2.5274 3.70086 2.43568L7.63298 0.988545C7.86428 0.907017 8.11569 0.907017 8.34699 0.988545L12.1484 2.39491H12.1584Z"
      fill="url(#kink_paint4)"
    />
    <path d="M13.9988 4.94267L7.99502 7.97961L12.611 2.62929C12.7015 2.70063 12.7819 2.80254 12.8423 2.91464L13.9988 4.94267Z" fill="url(#kink_paint5)" />
    <path d="M7.99502 7.97961L1.6091 11.2102L0.925249 7.307C0.885022 7.06241 0.925249 6.80764 1.04593 6.59362L1.97113 4.97324L4.41488 4.36178L7.99502 7.9898L7.99502 7.97961Z" fill="url(#kink_paint6)" />
    <path d="M4.42493 4.3516L1.98119 4.96305L3.09747 3.00638L4.42493 4.3516Z" fill="url(#kink_paint7)" />
    <path d="M12.611 2.62929L7.99502 7.97961L4.41488 4.35159L12.1484 2.39491L12.2791 2.43566C12.3998 2.47643 12.5004 2.54776 12.6009 2.62929H12.611Z" fill="url(#kink_paint8)" />
    <path d="M10.8611 10.8739L3.9925 12.6166L7.99502 7.97961L10.8611 10.8739Z" fill="url(#kink_paint9)" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3.84165 3.23056H6.95919V5.34011H7.99501V4.29043H9.03084V3.24075H12.1484V6.39999H11.1126V7.44967H10.0667V8.49935H11.1126V9.54903H12.1484V12.7083H9.03084V11.6586H7.99501V10.6089H6.95919V12.7185H3.84165V3.23056Z"
      fill="black"
    />
    <defs>
      <linearGradient id="kink_paint0" x1="0" y1="8" x2="16" y2="8" gradientUnits="userSpaceOnUse">
        <stop offset="0.02" stopColor="#FFFF00" />
        <stop offset="0.4" stopColor="#53FC18" />
        <stop offset="1" stopColor="#01FFFF" />
      </linearGradient>
      <linearGradient id="kink_paint1" x1="0.021743" y1="7.9949" x2="16.0052" y2="7.9949" gradientUnits="userSpaceOnUse">
        <stop stopColor="#53FC18" />
        <stop offset="0.99" stopColor="#00BA61" />
      </linearGradient>
      <linearGradient id="kink_paint2" x1="-0.0380135" y1="7.99491" x2="15.9623" y2="7.99491" gradientUnits="userSpaceOnUse">
        <stop stopColor="#53FC18" />
        <stop offset="0.99" stopColor="#00FF8C" />
      </linearGradient>
      <linearGradient id="kink_paint3" x1="0.00488281" y1="8.00862" x2="16.0296" y2="8.00862" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00C6C1" />
        <stop offset="0.99" stopColor="#00FF8C" />
      </linearGradient>
      <linearGradient id="kink_paint4" x1="0.00488281" y1="7.9949" x2="16.0052" y2="7.9949" gradientUnits="userSpaceOnUse">
        <stop stopColor="#01FFFF" stopOpacity="0" />
        <stop offset="1" stopColor="white" stopOpacity="0.6" />
      </linearGradient>
      <linearGradient id="kink_paint5" x1="0.00488281" y1="7.97968" x2="16.0052" y2="7.97968" gradientUnits="userSpaceOnUse">
        <stop stopColor="#53FC18" />
        <stop offset="0.99" stopColor="#00FF8C" />
      </linearGradient>
      <linearGradient id="kink_paint6" x1="0.0162386" y1="7.99491" x2="16.0052" y2="7.99491" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00C6C1" />
        <stop offset="0.99" stopColor="#00FF8C" />
      </linearGradient>
      <linearGradient id="kink_paint7" x1="0.00488281" y1="7.9949" x2="16.0052" y2="7.9949" gradientUnits="userSpaceOnUse">
        <stop stopColor="#53FC18" />
        <stop offset="0.99" stopColor="#00FF8C" />
      </linearGradient>
      <linearGradient id="kink_paint8" x1="0.0245151" y1="7.9949" x2="16.0052" y2="7.9949" gradientUnits="userSpaceOnUse">
        <stop stopColor="#53FC18" />
        <stop offset="0.99" stopColor="#00BA61" />
      </linearGradient>
      <linearGradient id="kink_paint9" x1="0.00488281" y1="7.97733" x2="16.0052" y2="7.97733" gradientUnits="userSpaceOnUse">
        <stop stopColor="#01FFFF" stopOpacity="0" />
        <stop offset="1" stopColor="white" stopOpacity="0.6" />
      </linearGradient>
    </defs>
  </svg>
);


const SupportEventMessage = memo(({ message, handleOpenUserDialog }) => {
  const metadata = message?.metadata || {};
  const username = metadata.username || message?.sender?.username || "";
  const description = metadata.message || metadata.description || message?.content || "";
  const eventType = message?.type;



  // Format the support event message based on type
  const formatSupportMessage = () => {
    if (eventType === "reward") {
      // Handle actual reward data structure from Kick
      const rewardTitle = metadata.reward_title || metadata.reward?.title || metadata.title || "";
      const rewardCost = metadata.reward?.cost || metadata.cost || "";
      const userInput = metadata.user_input || "";
      
      if (rewardTitle) {
        return { username, rewardTitle, rewardCost, userInput };
      }
      return `${username} has redeemed a reward`;
    }
    
    if (eventType === "subscription") {
      // Handle gift subscriptions
      if (metadata.gifted_usernames && metadata.gifted_usernames.length > 0) {
        const giftedUsers = metadata.gifted_usernames.join(", ");
        const count = metadata.gifted_usernames.length;
        const total = metadata.gifter_total ? metadata.gifter_total : null;
        return {
          gifterUsername: username,
          giftedUsers,
          count,
          total,
          type: 'gift'
        };
      }
      
      // Regular subscription
      const months = metadata.months;
      const tier = metadata.tier && metadata.tier > 1 ? metadata.tier : null;
      return {
        username,
        months,
        tier,
        type: 'regular'
      };
    }
    
    if (eventType === "donation") {
      const amount = metadata.formatted_amount || metadata.amount || "";
      return `${username} donated${amount ? ` ${amount}` : ""}!`;
    }
    
    if (eventType === "stream_live") {
      const streamer = metadata.streamer || username || "";
      const streamTitle = metadata.stream_title;
      return {
        streamer: streamer,
        action: "is now live",
        streamTitle: streamTitle,
        type: 'stream_live'
      };
    }
    
    if (eventType === "stream_end") {
      const streamer = metadata.streamer || username || "";
      return {
        streamer: streamer,
        action: "has ended the stream",
        type: 'stream_end'
      };
    }

    if (eventType === "moderation") {
      const action = metadata.action;
      const targetUser = metadata.target_user;
      const moderator = metadata.moderator;
      const duration = metadata.duration;

      return {
        action,
        targetUser,
        moderator,
        permanent: metadata.permanent,
        duration,
        type: 'moderation'
      };
    }

    if (eventType === "host") {
      const viewers = metadata.numberOfViewers ?? metadata.number_viewers ?? metadata.viewers_count ?? metadata.hosted?.viewers_count ?? null;
      const optionalMessage = metadata.optionalMessage || metadata.optional_message || null;
      const hostContext = metadata.type || null;

      return {
        username,
        viewers,
        optionalMessage,
        hostContext,
        type: 'host'
      };
    }

    if (eventType === "raid") {
      const raider = metadata.hosted?.username || metadata.hosted_channel?.username || username;
      const targetChannel = metadata.current_channel?.slug || metadata.channel?.slug || metadata.channel?.user?.username || null;
      const viewers = metadata.hosted?.viewers_count ?? metadata.number_viewers ?? metadata.channel?.current_livestream?.viewer_count ?? null;

      return {
        raider,
        targetChannel,
        viewers,
        type: 'raid'
      };
    }

    if (eventType === "goal_progress") {
      const goalType = metadata.goal_type || metadata.type || "goal";
      const current = Number(metadata.current_value ?? metadata.current ?? 0);
      const target = Number(metadata.target_value ?? metadata.target ?? 0);
      const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : null;

      return {
        goalType,
        current,
        target,
        percent,
        type: 'goal_progress'
      };
    }

    if (eventType === "kick_gift") {
      const gift = metadata.gift || {};
      return {
        sender: username,
        giftName: gift.name,
        amount: gift.amount,
        tier: gift.tier,
        message: metadata.message,
        imageUrl: metadata.gift_image_url,
        type: 'kick_gift'
      };
    }

    // Fallback to original format
    if (description) {
      return `${username}: ${description}`;
    }
    
    return username;
  };

  // Get background color based on event type  
  const getEventColors = () => {
    // Rewards always use the channel owner's custom color
    if (eventType === "reward" && metadata.reward_background_color) {
      return metadata.reward_background_color;
    }
    
    // Stream live uses red from navbar (live indicator color)
    if (eventType === "stream_live") {
      return "#ff4757"; // Red color for live
    }
    
    // Stream end uses gray
    if (eventType === "stream_end") {
      return "#6c757d"; // Gray color for offline
    }

    // Moderation events use warning/danger colors
    if (eventType === "moderation") {
      return "#ffc107"; // Yellow/orange for moderation actions
    }

    if (eventType === "host") {
      return "#4dabf7";
    }

    if (eventType === "raid") {
      return "#ff922b";
    }

    if (eventType === "goal_progress") {
      return "#20c997";
    }

    if (eventType === "kick_gift") {
      return "#d6336c";
    }

    // For all other events, use CSS variable for consistent theming
    return "var(--text-success)";
  };

  const eventColor = getEventColors();

  const messageStyle = eventColor
    ? {
        background: eventColor.startsWith('var(')
          ? `linear-gradient(90deg, color-mix(in srgb, ${eventColor} 20%, transparent), rgba(255, 255, 255, 0.05))`
          : `linear-gradient(90deg, ${eventColor}33, rgba(255, 255, 255, 0.05))`,
        borderLeft: `3px solid ${eventColor}`
      }
    : {};

  const supportMessage = formatSupportMessage();
  const isRewardObject = eventType === "reward" && typeof supportMessage === "object";
  const isGiftSubObject = eventType === "subscription" && typeof supportMessage === "object" && supportMessage.type === "gift";
  const isRegularSubObject = eventType === "subscription" && typeof supportMessage === "object" && supportMessage.type === "regular";
  const isStreamObject = (eventType === "stream_live" || eventType === "stream_end") && typeof supportMessage === "object";
  const isModerationObject = eventType === "moderation" && typeof supportMessage === "object";
  const isHostObject = eventType === "host" && typeof supportMessage === "object";
  const isRaidObject = eventType === "raid" && typeof supportMessage === "object";
  const isGoalProgressObject = eventType === "goal_progress" && typeof supportMessage === "object";
  const isKickGiftObject = eventType === "kick_gift" && typeof supportMessage === "object";

  return (
    <span className="supportEventMessage" style={messageStyle}>
      {(eventType === "reward" || eventType === "subscription" || eventType === "donation" || eventType === "stream_live" || eventType === "stream_end" || eventType === "moderation" || eventType === "host" || eventType === "raid" || eventType === "goal_progress" || eventType === "kick_gift") && (
        <span
          className={`supportEventIcon ${
            isGiftSubObject ? 'giftIcon' :
            eventType === "stream_live" ? 'streamLiveIcon' :
            eventType === "stream_end" ? 'streamEndIcon' :
            eventType === "moderation" ? 'moderationIcon' :
            eventType === "host" ? 'hostIcon' :
            eventType === "raid" ? 'raidIcon' :
            eventType === "goal_progress" ? 'goalProgressIcon' :
            eventType === "kick_gift" ? 'kickGiftIcon' :
            eventType + 'Icon'
          }`}
          style={{
            color: eventColor,
            opacity: 1,
            filter: 'none',
            transform: 'translateY(3px)'
          }}
          aria-hidden
        >
          {isGiftSubObject ? (
            <GiftIcon size={24} aria-label="gift" />
          ) : eventType === "stream_live" ? (
            <RecordIcon size={24} weight="fill" aria-label="stream live" />
          ) : eventType === "stream_end" ? (
            <EyeSlashIcon size={24} weight="fill" aria-label="stream end" />
          ) : eventType === "moderation" ? (
            isModerationObject && supportMessage.action === "timed_out" ? (
              <ClockUserIcon size={24} weight="fill" aria-label="timeout" />
            ) : isModerationObject && supportMessage.action === "unbanned" ? (
              <UserPlusIcon size={24} weight="fill" aria-label="unban" />
            ) : (
              <GavelIcon size={24} weight="fill" aria-label="ban" />
            )
          ) : eventType === "host" ? (
            <UsersThreeIcon size={24} weight="fill" aria-label="host" />
          ) : eventType === "raid" ? (
            <FlagCheckeredIcon size={24} weight="fill" aria-label="raid" />
          ) : eventType === "goal_progress" ? (
            <TargetIcon size={24} weight="fill" aria-label="goal progress" />
          ) : eventType === "kick_gift" ? (
            supportMessage.imageUrl ? (
              <img
                src={supportMessage.imageUrl}
                alt={supportMessage.giftName || 'Kick gift'}
                style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }}
              />
            ) : (
              <GiftIcon size={24} weight="fill" aria-label="kick gift" />
            )
          ) : (
            <SparkleIcon size={24} aria-label={eventType} />
          )}
        </span>
      )}
      
      {isRewardObject ? (
        <span className="supportEventContent">
          <button 
            className="supportEventUsername" 
            onClick={(e) => handleOpenUserDialog?.(e, supportMessage.username)}
          >
            {supportMessage.username}
          </button>
          <span className="supportEventAction"> has redeemed </span>
          <span className="supportEventReward">{supportMessage.rewardTitle}</span>
          {supportMessage.rewardCost && (
            <span className="supportEventCost"> ({supportMessage.rewardCost} points)</span>
          )}
          {supportMessage.userInput && (
            <span className="supportEventInput">: {supportMessage.userInput}</span>
          )}
          {description && (
            <span className="supportEventSystemMessage"> ({description})</span>
          )}
        </span>
      ) : isGiftSubObject ? (
        <span className="supportEventContent">
          <button 
            className="supportEventUsername" 
            onClick={(e) => handleOpenUserDialog?.(e, supportMessage.gifterUsername)}
          >
            {supportMessage.gifterUsername}
          </button>
          <span className="supportEventAction"> gifted </span>
          <span className="supportEventCount">{supportMessage.count}</span>
          <span className="supportEventAction"> subscription{supportMessage.count > 1 ? 's' : ''} to </span>
          {supportMessage.giftedUsers.split(', ').map((username, index, array) => (
            <span key={username}>
              <button 
                className="supportEventUsername" 
                onClick={(e) => handleOpenUserDialog?.(e, username.trim())}
              >
                {username.trim()}
              </button>
              {index < array.length - 1 && <span className="supportEventAction">, </span>}
            </span>
          ))}
          {supportMessage.total && (
            <span className="supportEventTotal"> ({supportMessage.total} total)</span>
          )}
          <span className="supportEventAction">!</span>
        </span>
      ) : isRegularSubObject ? (
        <span className="supportEventContent">
          <button 
            className="supportEventUsername" 
            onClick={(e) => handleOpenUserDialog?.(e, supportMessage.username)}
          >
            {supportMessage.username}
          </button>
          <span className="supportEventAction"> subscribed</span>
          {supportMessage.tier && (
            <>
              <span className="supportEventAction"> (Tier </span>
              <span className="supportEventCount">{supportMessage.tier}</span>
              <span className="supportEventAction">)</span>
            </>
          )}
          {supportMessage.months && (
            <>
              <span className="supportEventAction"> for </span>
              <span className="supportEventCount">{supportMessage.months}</span>
              <span className="supportEventAction"> month{supportMessage.months > 1 ? 's' : ''}</span>
            </>
          )}
          <span className="supportEventAction">!</span>
        </span>
      ) : isStreamObject ? (
        <span className="supportEventContent">
          <button 
            className="supportEventUsername" 
            onClick={(e) => handleOpenUserDialog?.(e, supportMessage.streamer)}
          >
            {supportMessage.streamer}
          </button>
          {supportMessage.type === 'stream_live' ? (
            <>
              <span className="supportEventAction"> is now </span>
              <span className="supportEventAction" style={{ fontWeight: 'bold' }}>live</span>
            </>
          ) : (
            <>
              <span className="supportEventAction"> has </span>
              <span className="supportEventAction" style={{ fontWeight: 'bold' }}>ended</span>
              <span className="supportEventAction"> the stream</span>
            </>
          )}
          {supportMessage.streamTitle && (
            <>
              <span className="supportEventAction">: </span>
              <span className="supportEventReward">{supportMessage.streamTitle}</span>
            </>
          )}
        </span>
      ) : isModerationObject ? (
        <span className="supportEventContent">
          <button
            className="supportEventUsername"
            onClick={(e) => handleOpenUserDialog?.(e, supportMessage.moderator)}
          >
            {supportMessage.moderator}
          </button>
          <span className="supportEventAction"> {
            supportMessage.action === "timed_out" ? "timed out" :
            supportMessage.action === "unbanned" ? "unbanned" : "banned"
          } </span>
          <button
            className="supportEventUsername"
            onClick={(e) => handleOpenUserDialog?.(e, supportMessage.targetUser)}
          >
            {supportMessage.targetUser}
          </button>
          {supportMessage.action === "timed_out" && supportMessage.duration && (
            <>
              <span className="supportEventAction"> for </span>
              <span className="supportEventCount">{supportMessage.duration}</span>
              <span className="supportEventAction"> minute{supportMessage.duration !== 1 ? 's' : ''}</span>
            </>
          )}
          {supportMessage.action === "timed_out" && !supportMessage.duration && (
            <span className="supportEventAction"> temporarily</span>
          )}
        </span>
      ) : isHostObject ? (
        <span className="supportEventContent">
          <button
            className="supportEventUsername"
            onClick={(e) => handleOpenUserDialog?.(e, supportMessage.username)}
          >
            {supportMessage.username}
          </button>
          <span className="supportEventAction">
            {supportMessage.hostContext === 'hosting' ? ' is now hosting' : ' is hosting this channel'}
          </span>
          {typeof supportMessage.viewers === "number" && (
            <>
              <span className="supportEventAction"> for </span>
              <span className="supportEventCount">{supportMessage.viewers}</span>
              <span className="supportEventAction"> viewer{supportMessage.viewers === 1 ? '' : 's'}</span>
            </>
          )}
          {supportMessage.optionalMessage && (
            <span className="supportEventAction"> — {supportMessage.optionalMessage}</span>
          )}
        </span>
      ) : isRaidObject ? (
        <span className="supportEventContent">
          <button
            className="supportEventUsername"
            onClick={(e) => handleOpenUserDialog?.(e, supportMessage.raider)}
          >
            {supportMessage.raider}
          </button>
          <span className="supportEventAction"> is raiding</span>
          {supportMessage.targetChannel && (
            <>
              <span className="supportEventAction"> </span>
              <span className="supportEventReward">{supportMessage.targetChannel}</span>
            </>
          )}
          {typeof supportMessage.viewers === "number" && (
            <>
              <span className="supportEventAction"> with </span>
              <span className="supportEventCount">{supportMessage.viewers}</span>
              <span className="supportEventAction"> viewer{supportMessage.viewers === 1 ? '' : 's'}</span>
            </>
          )}
          <span className="supportEventAction">!</span>
        </span>
      ) : isGoalProgressObject ? (
        <span className="supportEventContent">
          <span className="supportEventAction" style={{ fontWeight: 'bold' }}>
            {supportMessage.goalType === 'followers' ? 'Follower Goal' : `${supportMessage.goalType ?? 'Goal'}`}
          </span>
          <span className="supportEventAction"> progress: </span>
          <span className="supportEventCount">{supportMessage.current}</span>
          {supportMessage.target > 0 && (
            <>
              <span className="supportEventAction"> / </span>
              <span className="supportEventCount">{supportMessage.target}</span>
            </>
          )}
          {typeof supportMessage.percent === "number" && (
            <span className="supportEventAction"> ({supportMessage.percent}% complete)</span>
          )}
        </span>
      ) : isKickGiftObject ? (
        <span className="supportEventContent">
          <button
            className="supportEventUsername"
            onClick={(e) => handleOpenUserDialog?.(e, supportMessage.sender)}
          >
            {supportMessage.sender}
          </button>
          <span className="supportEventAction"> sent </span>
          {supportMessage.giftName ? (
            <span className="supportEventReward">{supportMessage.giftName}</span>
          ) : (
            <span className="supportEventAction">a Kick Gift</span>
          )}
          {typeof supportMessage.amount === 'number' && supportMessage.amount >= 1 && (
            <span
              className="supportEventAction"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <KinkIcon />
              <span className="supportEventCount">{supportMessage.amount}</span>
            </span>
          )}
          {supportMessage.message && (
            <span className="supportEventAction"> — {supportMessage.message}</span>
          )}
        </span>
      ) : (
        <span className="supportEventContent">{supportMessage}</span>
      )}
      
      {description && description !== supportMessage && !isRewardObject && (
        <span className="supportEventDescription"> - {description}</span>
      )}
    </span>
  );
});

export default SupportEventMessage;
