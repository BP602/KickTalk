import { memo } from "react";
import clsx from "clsx";
import { XIcon, BellIcon } from "@phosphor-icons/react";

const MentionsTab = memo(({ currentChatroomId, onSelectChatroom, onRemoveMentionsTab }) => {
    return (
      <div
        onClick={() => onSelectChatroom("mentions")}
        onMouseDown={(e) => {
          if (e.button === 1) {
            onRemoveMentionsTab();
          }
        }}
      className={clsx("chatroomStreamer", currentChatroomId === "mentions" && "chatroomStreamerActive")}>
        <div className="streamerInfo">
          <BellIcon
            className="profileImage"
            weight="fill" size={20}
            aria-label="Mentions"
          />
          <span>Mentions</span>
        </div>
        <button
          className="closeChatroom"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveMentionsTab();
          }}
        aria-label="Remove mentions tab">
          <XIcon size={12} weight="bold" aria-label="Remove mentions tab" />
        </button>
      </div>
    );
});

MentionsTab.displayName = "MentionsTab";

export default MentionsTab;
