import { memo } from "react";
import sparkleIcon from "../../assets/icons/sparkle.svg?asset";

const SupportEventMessage = memo(({ message }) => {
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

  // Get reward background color if available
  const rewardBgColor = eventType === "reward" && metadata.reward_background_color 
    ? metadata.reward_background_color 
    : null;

  const messageStyle = rewardBgColor 
    ? { 
        background: `linear-gradient(90deg, ${rewardBgColor}33, rgba(255, 255, 255, 0.05))`,
        borderLeft: `3px solid ${rewardBgColor}`
      }
    : {};

  const supportMessage = formatSupportMessage();
  const isRewardObject = eventType === "reward" && typeof supportMessage === "object";

  return (
    <span className="supportEventMessage" style={messageStyle}>
      {eventType === "reward" && (
        <img src={sparkleIcon} className="supportEventIcon" alt="reward" width="16" height="16" />
      )}
      
      {isRewardObject ? (
        <span className="supportEventContent">
          <span className="supportEventUsername">{supportMessage.username}</span>
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
