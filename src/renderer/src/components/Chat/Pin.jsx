import { memo, useState } from "react";
import { clsx } from "clsx";
import { MessageParser } from "../../utils/MessageParser";
import { CaretDownIcon, PushPinSlashIcon } from "@phosphor-icons/react";
import dayjs from "dayjs";
import { KickBadges } from "../Cosmetics/Badges";

const Pin = memo(
  ({ showChatters, subscriberBadges, showPinnedMessage, setShowPinnedMessage, pinDetails, chatroomName, canModerate }) => {
    if (!pinDetails) return null;
    const [isPinnedMessageOpen, setIsPinnedMessageOpen] = useState(false);

    const pinnedBy = pinDetails?.pinned_by || pinDetails?.pinnedBy;
    const originalSender = pinDetails?.message?.sender;

    const getUnpinMessage = async () => {
      if (!canModerate) return;
      const response = await window.app.kick.getUnpinMessage(chatroomName);

      if (response?.code === 201) {
        setShowPinnedMessage(false);
      }
    };

    return (
      <div className={clsx("pinnedMessage", showPinnedMessage && !showChatters && "open", isPinnedMessageOpen && "expanded")}>
        <div className="pinnedMessageTop">
          <div className="pinnedMessageHeader">
            <div className="pinnedMessageHeaderInfo">
              <span>Sent by</span>
              {originalSender?.identity?.badges?.length > 0 && (
                <KickBadges badges={originalSender?.identity?.badges} subscriberBadges={subscriberBadges} />
              )}
              <span style={{ color: originalSender?.identity?.color }}>{originalSender?.username}</span>
            </div>
            <div className="pinnedMessageActions">
              <button onClick={() => setIsPinnedMessageOpen(!isPinnedMessageOpen)}>
                <CaretDownIcon
                  size={16}
                  weight="bold"
                  aria-label="Expand Pinned Message"
                  style={{ transform: isPinnedMessageOpen ? "rotate(180deg)" : "none" }}
                />
              </button>
              {canModerate && (
                <button onClick={() => setShowPinnedMessage(false)}>
                  <PushPinSlashIcon size={16} weight="fill" aria-label="Hide Pinned Message" />
                </button>
              )}
            </div>
          </div>
          <div className="pinnedMessageContent">
            <MessageParser message={pinDetails?.message} type="minified" />
          </div>
        </div>
        <div className={clsx("pinnedMessageFooter", isPinnedMessageOpen && "open")}>
          <div className="pinnedMessageFooterContent">
            <span>Pinned by</span>
            {pinnedBy?.identity?.badges?.length > 0 && (
              <KickBadges badges={originalSender?.identity?.badges} subscriberBadges={subscriberBadges} />
            )}
            <span style={{ color: pinnedBy?.identity?.color }}>{pinnedBy?.message?.sender?.username || pinnedBy?.username}</span>
            <span>at {dayjs(pinDetails?.message?.created_at).format("h:mm A")}</span>
          </div>
          <span>{pinDetails?.finishs_at && `Pin expires ${dayjs(pinDetails?.finish_at).fromNow()}`}</span>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.pinDetails === nextProps.pinDetails &&
      prevProps.showPinnedMessage === nextProps.showPinnedMessage &&
      prevProps.chatroomName === nextProps.chatroomName &&
      prevProps.canModerate === nextProps.canModerate
    );
  },
);

export default Pin;
