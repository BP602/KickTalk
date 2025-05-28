import { MessageParser } from "../../utils/MessageParser";
import RegularMessage from "./RegularMessage";
import ArrowReplyLineIcon from "../../assets/icons/arrow_reply_line.svg?asset";
import useChatStore from "../../providers/ChatProvider";
import { useShallow } from "zustand/shallow";

const ReplyMessage = ({
  message,
  sevenTVEmotes,
  subscriberBadges,
  filteredKickTalkBadges,
  handleOpenUserDialog,
  userStyle,
  chatroomId,
  chatroomName,
  userChatroomInfo,
  sevenTVSettings,
  handleOpenReplyThread,
}) => {
  const chatStoreMessageThread = useChatStore(
    useShallow((state) =>
      state.messages[chatroomId]?.filter((m) => m?.metadata?.original_message?.id === message?.metadata?.original_message?.id),
    ),
  );

  return (
    <div className="chatMessageReply">
      <span className="chatMessageReplyText">
        <img className="chatMessageReplySymbol" src={ArrowReplyLineIcon} />
        <span className="chatMessageReplyTextSender">{message?.metadata?.original_sender?.username}:</span>
        <span
          className="chatMessageReplyTextContent"
          onClick={() => handleOpenReplyThread(chatStoreMessageThread)}
          title={message?.metadata?.original_message?.content}>
          <MessageParser
            type="reply"
            message={message?.metadata?.original_message}
            sevenTVEmotes={sevenTVEmotes}
            userChatroomInfo={userChatroomInfo}
            chatroomId={chatroomId}
            chatroomName={chatroomName}
            subscriberBadges={subscriberBadges}
          />
        </span>
      </span>

      <RegularMessage
        message={message}
        subscriberBadges={subscriberBadges}
        filteredKickTalkBadges={filteredKickTalkBadges}
        sevenTVEmotes={sevenTVEmotes}
        handleOpenUserDialog={handleOpenUserDialog}
        userStyle={userStyle}
        sevenTVSettings={sevenTVSettings}
        chatroomId={chatroomId}
        chatroomName={chatroomName}
        userChatroomInfo={userChatroomInfo}
      />
    </div>
  );
};

export default ReplyMessage;
