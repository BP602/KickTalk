import "@assets/styles/components/SplitPaneChat.scss";
import { XIcon } from "@phosphor-icons/react";
import Chat from "./Chat";
import useChatStore from "../providers/ChatProvider";

const SplitPaneChat = ({ chatroomId, kickUsername, kickId, settings, updateSettings, onClose }) => {
  const chatroom = useChatStore((state) => state.chatrooms.find((room) => room.id === chatroomId));

  if (!chatroom) {
    return (
      <div className="splitPaneChat">
        <div className="splitPaneChatHeader">
          <span className="splitPaneChatTitle">Chatroom not found</span>
          <button className="splitPaneChatClose" onClick={onClose} aria-label="Close split pane">
            <XIcon size={16} />
          </button>
        </div>
        <div className="splitPaneChatContent">
          <div className="splitPaneChatEmpty">
            <p>This chatroom is no longer available.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="splitPaneChat">
      <div className="splitPaneChatContent">
        <Chat
          chatroomId={chatroomId}
          kickUsername={kickUsername}
          kickId={kickId}
          settings={settings}
          updateSettings={updateSettings}
          showCloseButton={true}
          onClose={onClose}
        />
      </div>
    </div>
  );
};

export default SplitPaneChat;