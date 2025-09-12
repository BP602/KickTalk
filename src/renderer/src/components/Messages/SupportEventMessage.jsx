import { memo } from "react";
import { useShallow } from "zustand/shallow";
import useCosmeticsStore from "../../providers/CosmeticsProvider";
import sparkleIcon from "../../assets/icons/sparkle.svg?asset";
import giftBoxIcon from "../../assets/icons/gift-box.svg?asset";


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
      const months = metadata.months ? `for ${metadata.months} months` : "";
      const tier = metadata.tier && metadata.tier > 1 ? ` (Tier ${metadata.tier})` : "";
      return `${username} subscribed${tier}${months ? ` ${months}` : ""}!`;
    }
    
    if (eventType === "donation") {
      const amount = metadata.formatted_amount || metadata.amount || "";
      return `${username} donated${amount ? ` ${amount}` : ""}!`;
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
    
    // For all other events, use CSS variable for consistent theming
    return "var(--text-success)";
  };

  const eventColor = getEventColors();
  const messageStyle = eventColor 
    ? { 
        background: `linear-gradient(90deg, ${eventColor}33, rgba(255, 255, 255, 0.05))`,
        borderLeft: `3px solid ${eventColor}`
      }
    : {};

  const supportMessage = formatSupportMessage();
  const isRewardObject = eventType === "reward" && typeof supportMessage === "object";
  const isGiftSubObject = eventType === "subscription" && typeof supportMessage === "object" && supportMessage.type === "gift";

  return (
    <span className="supportEventMessage" style={messageStyle}>
      {(eventType === "reward" || eventType === "subscription" || eventType === "donation") && (
        <img 
          src={isGiftSubObject ? giftBoxIcon : sparkleIcon} 
          className={`supportEventIcon ${isGiftSubObject ? 'giftIcon' : eventType + 'Icon'}`} 
          alt={isGiftSubObject ? 'gift' : eventType} 
          width="24" 
          height="24" 
        />
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
