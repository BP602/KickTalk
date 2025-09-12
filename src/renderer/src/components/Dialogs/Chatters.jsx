import { useCallback, useEffect, useState, useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { XIcon } from "@phosphor-icons/react";
import { useDebounceValue } from "../../utils/hooks";
import { KickBadges } from "../Cosmetics/Badges";

const Chatters = () => {
  const [chattersData, setChattersData] = useState(null);
  const [debouncedValue, setDebouncedValue] = useDebounceValue("", 200);

  useEffect(() => {
    const updateChatters = (data) => {
      setChattersData(data);
    };

    const chattersDataCleanup = window.app.chattersDialog.onData(updateChatters);
    return () => chattersDataCleanup();
  }, []);

  const filteredChatters = useMemo(() => {
    if (!chattersData?.chatters) return [];

    if (!debouncedValue.trim()) {
      return chattersData.chatters;
    }

    return chattersData.chatters.filter((chatter) => chatter.username.toLowerCase().includes(debouncedValue.toLowerCase()));
  }, [chattersData?.chatters, debouncedValue]);

  const handleOpenUserDialog = useCallback(
    async (chatter) => {
      const user = await window.app.kick.getUserChatroomInfo(chattersData?.streamerData?.user?.username, chatter.username);
      if (!user?.data?.id) return;

      const sender = {
        id: user.data.id,
        username: user.data.username,
        slug: user.data.slug,
      };

      window.app.userDialog.open({
        sender,
        fetchedUser: user?.data,
        chatroomId: chattersData?.chatroomId,
        sevenTVEmotes: chattersData?.channel7TVEmotes,
        subscriberBadges: chattersData?.streamerData?.subscriber_badges,
        userChatroomInfo: chattersData?.userChatroomInfo,
        cords: [0, 300],
      });
    },
    [chattersData],
  );

  const ChatterItem = useCallback(
    (index) => {
      const chatter = filteredChatters[index];

      return (
        <button key={chatter.id} onClick={() => handleOpenUserDialog(chatter)} className="chatterListItem">
          <div className="chatterListItemUser">
            {chatter?.identity?.badges?.length ? (
              <div className="chatterListItemBadges">
                <KickBadges
                  badges={chatter.identity.badges}
                  subscriberBadges={chattersData?.streamerData?.subscriber_badges}
                  tooltip={false}
                />
              </div>
            ) : null}
            <span style={{ color: chatter?.identity?.color }}>{chatter.username}</span>
          </div>
          <span className="chatterListItemOpenBtn">OPEN</span>
        </button>
      );
    },
    [filteredChatters, handleOpenUserDialog, chattersData?.streamerData?.subscriber_badges],
  );

  return (
    <div className="chattersContainer">
      <div className="chattersHead">
        <h2>
          <p>
            Chatters: <span>{chattersData?.streamerData?.user?.username || ""}</span>
          </p>
          <p>
            {debouncedValue ? (
              <>
                Showing: <span>{filteredChatters.length}</span> of <span>{chattersData?.chatters?.length || 0}</span>
              </>
            ) : (
              <>
                Total: <span>{chattersData?.chatters?.length || 0}</span>
              </>
            )}
          </p>
        </h2>

        <button className="chattersCloseBtn" onClick={() => window.app.chattersDialog.close()}>
          <XIcon weight="bold" size={18} aria-label="Close" />
        </button>
      </div>

      <div className="chattersSearch">
        <input type="text" placeholder="Search..." onChange={(e) => setDebouncedValue(e.target.value.trim())} />
      </div>

      {chattersData?.chatters?.length ? (
        <div className="chattersList">
          {!filteredChatters?.length && debouncedValue ? (
            <div className="chatterListItem">
              <span>No results found</span>
            </div>
          ) : (
            <Virtuoso
              style={{ height: "100%" }}
              totalCount={filteredChatters.length}
              itemContent={ChatterItem}
              overscan={5}
              className="virtualChattersList"
            />
          )}
        </div>
      ) : (
        <div className="chattersListEmpty">
          <p>No chatters tracked yet</p>
          <span>As users type their username will appear here.</span>
        </div>
      )}
    </div>
  );
};

export default Chatters;
