import { memo } from "react";
import { Sparkle as SparkleIcon, Gift as GiftIcon, Record as RecordIcon, EyeSlash as EyeSlashIcon, ClockUser as ClockUserIcon, Gavel as GavelIcon, UserPlus as UserPlusIcon, UsersThree as UsersThreeIcon, FlagCheckered as FlagCheckeredIcon, Target as TargetIcon } from "@phosphor-icons/react";


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

  return (
    <span className="supportEventMessage" style={messageStyle}>
      {(eventType === "reward" || eventType === "subscription" || eventType === "donation" || eventType === "stream_live" || eventType === "stream_end" || eventType === "moderation" || eventType === "host" || eventType === "raid" || eventType === "goal_progress") && (
        <span
          className={`supportEventIcon ${
            isGiftSubObject ? 'giftIcon' :
            eventType === "stream_live" ? 'streamLiveIcon' :
            eventType === "stream_end" ? 'streamEndIcon' :
            eventType === "moderation" ? 'moderationIcon' :
            eventType === "host" ? 'hostIcon' :
            eventType === "raid" ? 'raidIcon' :
            eventType === "goal_progress" ? 'goalProgressIcon' :
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
