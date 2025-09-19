/**
 * DONATION EVENT REPLAY - Copy/Paste into Browser Console
 * 
 * 🎯 USAGE:
 * 1. Copy this entire script
 * 2. Paste into DevTools Console in running KickTalk app
 * 3. Use: replayDonation()
 */

window.replayDonation = (amount = '$25', username = 'GenerousDonor', message = 'Keep up the great work! 💰') => {
  console.log('🔄 Replaying donation event...');
  
  // Create donation event data structure based on Kick's format
  const donationEventData = {
    id: 'replay-donation-' + Date.now(),
    username: username,
    formatted_amount: amount,
    amount: parseFloat(amount.replace('$', '')),
    message: message,
    currency: 'USD',
    timestamp: new Date().toISOString()
  };

  console.log('📤 Dispatching donation event:', donationEventData);

  // Dispatch the event through the SharedKickPusher
  try {
    // Access the global shared pusher instance
    const sharedPusher = window.sharedKickPusher;
    if (sharedPusher) {
      // Create and dispatch the message event through the pusher
      const messageEvent = new CustomEvent('message', {
        detail: {
          chatroomId: '69188411',
          event: 'App\\Events\\DonationEvent',
          data: JSON.stringify(donationEventData),
          channel: 'chatrooms.69188411'
        }
      });
      
      sharedPusher.dispatchEvent(messageEvent);
      console.log('✅ Donation event dispatched through SharedKickPusher');
    } else {
      console.error('❌ SharedKickPusher not found. Make sure you\'re connected to a chatroom.');
    }
  } catch (error) {
    console.error('❌ Failed to replay donation:', error);
  }
};

window.replayGiftSub = (gifterUsername = 'GiftMaster', recipientUsername = 'LuckyViewer', total = 50) => {
  console.log('🔄 Replaying gift subscription event...');
  
  const giftSubEventData = {
    chatroom_id: 69188411,
    gifted_usernames: [recipientUsername],
    gifter_username: gifterUsername,
    gifter_total: total
  };

  console.log('📤 Dispatching gift subscription event:', giftSubEventData);

  try {
    const sharedPusher = window.sharedKickPusher;
    if (sharedPusher) {
      const messageEvent = new CustomEvent('message', {
        detail: {
          chatroomId: '69188411',
          event: 'App\\Events\\GiftedSubscriptionsEvent', 
          data: JSON.stringify(giftSubEventData),
          channel: 'chatrooms.69188411'
        }
      });
      
      sharedPusher.dispatchEvent(messageEvent);
      console.log('✅ Gift subscription event dispatched through SharedKickPusher');
    } else {
      console.error('❌ SharedKickPusher not found. Make sure you\'re connected to a chatroom.');
    }
  } catch (error) {
    console.error('❌ Failed to replay gift subscription:', error);
  }
};

console.log('🎭 Donation Replay Ready!');
console.log('');
console.log('📋 Commands:');
console.log('• replayDonation() - Replay a $25 donation');
console.log('• replayDonation("$100", "BigDonor", "Amazing stream!") - Custom donation');
console.log('• replayGiftSub() - Replay a gift subscription');
console.log('• replayGiftSub("Gifter123", "Recipient456", 75) - Custom gift sub');
console.log('');