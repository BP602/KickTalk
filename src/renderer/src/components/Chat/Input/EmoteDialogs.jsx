import { useRef, useEffect, useMemo } from "react";
import clsx from "clsx";
import KickLogoFull from "../../../assets/logos/kickLogoFull.svg?asset";
import { memo, useCallback, useState } from "react";
import STVLogo from "../../../assets/logos/stvLogo.svg?asset";
import { CaretDownIcon, GlobeIcon, LockIcon, UserIcon } from "@phosphor-icons/react";
import useClickOutside from "../../../utils/useClickOutside";
import KickLogoIcon from "../../../assets/logos/kickLogoIcon.svg?asset";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../Shared/Tooltip";
import { useAccessibleKickEmotes } from "./useAccessibleKickEmotes";
import { useAllStvEmotes } from "../hooks/useAllStvEmotes";

const EmoteSection = ({ emotes, title, handleEmoteClick, type, allowSubscriberEmotes, userChatroomInfo }) => {
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);
  const loadMoreTriggerRef = useRef(null);
  const observerRef = useRef(null);

  const loadMoreEmotes = () => {
    setVisibleCount((prev) => Math.min(prev + 20, emotes.length));
  };

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreEmotes();
        }
      },
      { threshold: 0.5, rootMargin: "20px" },
    );

    if (loadMoreTriggerRef.current) {
      observerRef.current.observe(loadMoreTriggerRef.current);
    }

    return () => {
      if (loadMoreTriggerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [loadMoreEmotes]);

  const canUseSubscriberEmotes =
    type !== "kick"
      ? true
      : typeof allowSubscriberEmotes === "boolean"
        ? allowSubscriberEmotes
        : Boolean(userChatroomInfo?.subscription);

  return (
    <div className={clsx("dialogBodySection", isSectionOpen && "opened")}>
      <div className="dialogRowHead">
        <span>{title}</span>
        <button onClick={() => setIsSectionOpen(!isSectionOpen)} className="dialogRowHeadBtn">
          <CaretDownIcon size={20} weight="bold" aria-label="Caret Down" />
        </button>
      </div>
      <div className="emoteItems">
        {emotes?.slice(0, visibleCount).map((emote, i) => (
          <Tooltip key={`${emote.id}-${emote.name}-${i}`} delayDuration={500}>
            <TooltipTrigger asChild>
              <button
                disabled={
                  type === "kick" &&
                  emote?.subscribers_only &&
                  (emote?.__allowUse === false || !canUseSubscriberEmotes)
                }
                onClick={() => handleEmoteClick(emote)}
                className={clsx(
                  "emoteItem",
                  emote?.subscribers_only &&
                    (emote?.__allowUse === false || !canUseSubscriberEmotes) &&
                    "emoteItemSubscriberOnly",
                )}>
                {type === "kick" ? (
                  <img
                    src={`https://files.kick.com/emotes/${emote.id}/fullsize`}
                    alt={emote.name}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <img
                    src={"https://cdn.7tv.app/emote/" + emote.id + "/1x.webp"}
                    alt={emote.name}
                    loading="lazy"
                    decoding="async"
                  />
                )}

                {emote?.subscribers_only &&
                  (emote?.__allowUse === false || !canUseSubscriberEmotes) && (
                  <div className="emoteItemSubscriberLock">
                    <LockIcon size={16} weight="fill" aria-label="Subscriber" />
                  </div>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{emote.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {visibleCount < emotes.length && <div ref={loadMoreTriggerRef} className="loadMoreTrigger" />}
      </div>
    </div>
  );
};

const SevenTVEmoteDialog = memo(
  ({ isDialogOpen, sevenTVEmotes, handleEmoteClick }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentSection, setCurrentSection] = useState(null);

    const searchResults = useMemo(() => {
      if (!sevenTVEmotes) return [];

      return sevenTVEmotes
        .map((emoteSection) => ({
          ...emoteSection,
          emotes: (emoteSection.emotes || []).filter((emote) => emote.name.toLowerCase().includes(searchTerm.toLowerCase())),
        }))
        .filter((section) => section.emotes && section.emotes.length > 0)
        .sort((a, b) => {
          // Sort order: channel (streamer) first, then global, then others
          const order = { channel: 0, global: 1 };
          const aOrder = order[a.type] ?? 2;
          const bOrder = order[b.type] ?? 2;
          return aOrder - bOrder;
        });
    }, [sevenTVEmotes, searchTerm]);

    // Compute a safe avatar URL for the channel section (if present)
    const channelSet = useMemo(() => sevenTVEmotes?.find((set) => set.type === "channel"), [sevenTVEmotes]);
    const channelAvatar = channelSet?.user?.avatar_url;
    const channelAvatarSrc = useMemo(() => {
      if (!channelAvatar) return STVLogo; // fallback to 7TV logo if missing
      // If it's a full URL or Twitch CDN URL, use as-is; otherwise, prefix https:
      if (channelAvatar.startsWith("http") || channelAvatar.includes("static-cdn.jtvnw.net")) return channelAvatar;
      return `https:${channelAvatar}`;
    }, [channelAvatar]);

    return (
      <>
        {isDialogOpen && (
          <div className={clsx("emoteDialog", isDialogOpen && "show")}>
            <div className={clsx("dialogHead", !searchResults?.length && "dialogHeadEmpty")}>
              <div className="dialogHeadTitle">
                <img src={STVLogo} height={20} alt="7TV Emotes" />
              </div>
              <div className="dialogHeadSearch">
                <input
                  type="text"
                  placeholder="Search emotes..."
                  onChange={(e) => setSearchTerm(e.target.value.trim())}
                  value={searchTerm}
                />
              </div>
              <div className="dialogHeadMenuItems">
                {sevenTVEmotes?.find((set) => set.type === "personal" && set?.emotes?.length > 0) && (
                  <button
                    className={clsx("dialogHeadMenuItem", currentSection === "personal" && "active")}
                    onClick={() => setCurrentSection(currentSection === "personal" ? null : "personal")}>
                    <UserIcon size={24} weight="fill" aria-label="Personal Emotes" />
                  </button>
                )}
                {sevenTVEmotes?.find((set) => set.type === "channel" && set?.emotes?.length > 0) && (
                  <button
                    className={clsx("dialogHeadMenuItem", currentSection === "channel" && "active")}
                    onClick={() => setCurrentSection(currentSection === "channel" ? null : "channel")}>
                    <img src={channelAvatarSrc} height={24} width={24} alt="Channel Emotes" />
                  </button>
                )}
                {sevenTVEmotes?.find((set) => set.type === "global" && set?.emotes?.length > 0) && (
                  <button
                    className={clsx("dialogHeadMenuItem", currentSection === "global" && "active")}
                    onClick={() => setCurrentSection(currentSection === "global" ? null : "global")}>
                    <GlobeIcon size={24} weight="fill" aria-label="Global Emotes" />
                  </button>
                )}
              </div>
            </div>
            <div className="dialogBody">
              {!searchResults.length && searchTerm ? (
                <div className="dialogBodyEmpty">
                  <p>No 7TV Emotes found</p>
                </div>
              ) : (
                <>
                  {searchResults
                    ?.filter((emoteSection) => (currentSection ? emoteSection.type === currentSection : true))
                    ?.map((emoteSection, index) => {
                      return (
                        <EmoteSection
                          key={`${emoteSection?.setInfo?.name || "7tv_emotes"}-${index}`}
                          emotes={emoteSection.emotes}
                          title={`${emoteSection?.setInfo?.name || "7TV Emotes"} ${searchTerm ? `[${emoteSection.emotes.length} matches]` : ""}`}
                          type={"7tv"}
                          handleEmoteClick={handleEmoteClick}
                        />
                      );
                    })}
                </>
              )}
            </div>
          </div>
        )}
      </>
    );
  },
  (prev, next) => prev.sevenTVEmotes === next.sevenTVEmotes && prev.isDialogOpen === next.isDialogOpen,
);

const KickEmoteDialog = memo(
  ({ isDialogOpen, kickEmotes, handleEmoteClick, userChatroomInfo }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentSection, setCurrentSection] = useState(null);

    const searchResults = useMemo(() => {
      if (!kickEmotes) return [];

      return kickEmotes
        .map((emoteSection) => ({
          ...emoteSection,
          emotes: (emoteSection.emotes || []).filter((emote) =>
            emote.name.toLowerCase().includes(searchTerm.toLowerCase()),
          ),
        }))
        .filter((section) => section.emotes.length > 0);
    }, [kickEmotes, searchTerm]);

    const channelSections = useMemo(
      () => kickEmotes?.filter((section) => section.sectionKind === "channel") || [],
      [kickEmotes],
    );
    const globalSections = useMemo(
      () => kickEmotes?.filter((section) => section.sectionKind === "global") || [],
      [kickEmotes],
    );
    const emojiSections = useMemo(
      () => kickEmotes?.filter((section) => section.sectionKind === "emoji") || [],
      [kickEmotes],
    );

    return (
      <>
        {isDialogOpen && (
          <div className={clsx("emoteDialog", isDialogOpen && "show")}>
            <div className={clsx("dialogHead", !searchResults?.length && "dialogHeadEmpty")}>
              <div className="dialogHeadTitle">
                <img src={KickLogoFull} height={16} alt="Kick.com" />
              </div>
              <div className="dialogHeadSearch">
                <input
                  type="text"
                  placeholder="Search..."
                  onChange={(e) => setSearchTerm(e.target.value.trim())}
                  value={searchTerm}
                />
              </div>
              <div className="dialogHeadMenuItems">
                {channelSections.map((section) => (
                  <button
                    key={section.sectionKey}
                    className={clsx("dialogHeadMenuItem", currentSection === section.sectionKey && "active")}
                    onClick={() =>
                      setCurrentSection(currentSection === section.sectionKey ? null : section.sectionKey)
                    }
                    title={section.sectionLabel || "Channel Emotes"}>
                    {section?.user?.profile_pic ? (
                      <img src={section.user.profile_pic} height={24} width={24} alt={section.sectionLabel} />
                    ) : (
                      <UserIcon size={24} weight="fill" aria-label="Channel Emotes" />
                    )}
                  </button>
                ))}
                {globalSections.map((section) => (
                  <button
                    key={section.sectionKey}
                    className={clsx("dialogHeadMenuItem", currentSection === section.sectionKey && "active")}
                    onClick={() =>
                      setCurrentSection(currentSection === section.sectionKey ? null : section.sectionKey)
                    }
                    title={section.sectionLabel || "Global Emotes"}>
                    <GlobeIcon size={24} weight="fill" aria-label="Global Emotes" />
                  </button>
                ))}
                {emojiSections.map((section) => (
                  <button
                    key={section.sectionKey}
                    className={clsx("dialogHeadMenuItem", currentSection === section.sectionKey && "active")}
                    onClick={() =>
                      setCurrentSection(currentSection === section.sectionKey ? null : section.sectionKey)
                    }
                    title={section.sectionLabel || "Emojis"}>
                    <img src={KickLogoIcon} height={16} width={16} alt={section.sectionLabel || "Emojis"} />
                  </button>
                ))}
              </div>
            </div>

            <div className="dialogBody">
              {!searchResults.length && searchTerm ? (
                <div className="dialogBodyEmpty">
                  <p>No Kick Emotes found</p>
                </div>
              ) : (
                searchResults
                  ?.filter((emoteSection) => (currentSection ? emoteSection.sectionKey === currentSection : true))
                  ?.map((emoteSection, index) => (
                    <EmoteSection
                      key={emoteSection.sectionKey || `${emoteSection.sectionKind}-${index}`}
                      emotes={emoteSection.emotes}
                      title={`${emoteSection.sectionLabel || emoteSection.name || "Kick Emotes"} ${
                        searchTerm ? `[${emoteSection.emotes.length} matches]` : ""
                      }`}
                      type={"kick"}
                      handleEmoteClick={handleEmoteClick}
                      allowSubscriberEmotes={emoteSection.allowSubscriberEmotes}
                      userChatroomInfo={userChatroomInfo}
                    />
                  ))
              )}
            </div>
          </div>
        )}
      </>
    );
  },
  (prev, next) =>
    prev.kickEmotes === next.kickEmotes &&
    prev.isDialogOpen === next.isDialogOpen &&
    prev.userChatroomInfo === next.userChatroomInfo,
);

const EmoteDialogs = memo(
  ({ chatroomId, handleEmoteClick, userChatroomInfo }) => {
    const kickEmotes = useAccessibleKickEmotes(chatroomId);
    const allStvEmotes = useAllStvEmotes(chatroomId);

    const [activeDialog, setActiveDialog] = useState(null);
    const [currentHoverEmote, setCurrentHoverEmote] = useState({});

    const emoteDialogRef = useRef(null);
    useClickOutside(emoteDialogRef, () => setActiveDialog(null));

    const [randomEmotes, setRandomEmotes] = useState([]);

    // Initialize random emotes array once when kickEmotes changes
    useEffect(() => {
      if (!kickEmotes?.length) return;

      const newRandomEmotes = [];
      const globalSet = kickEmotes.find((set) => set.sectionKind === "emoji");
      if (!globalSet?.emotes?.length) return;

      for (let i = 0; i < 10; i++) {
        const randomEmoteIndex = Math.floor(Math.random() * globalSet.emotes.length);
        newRandomEmotes.push(globalSet.emotes[randomEmoteIndex]);
      }

      setRandomEmotes(newRandomEmotes);
      if (newRandomEmotes.length > 0) {
        setCurrentHoverEmote(newRandomEmotes[Math.floor(Math.random() * newRandomEmotes.length)]);
      }
    }, [kickEmotes]);

    const getRandomKickEmote = useCallback(() => {
      if (!randomEmotes.length) return;

      setCurrentHoverEmote(randomEmotes[Math.floor(Math.random() * randomEmotes.length)]);
    }, [randomEmotes]);

    return (
      <TooltipProvider>
        <div className={clsx("chatEmoteBtns", activeDialog !== null && "activeDialog")}>
          <button
            className={clsx("emoteBtn", activeDialog === "7tv" && "activeDialog")}
            onClick={() => setActiveDialog(activeDialog === "7tv" ? null : "7tv")}>
            <img src={STVLogo} height="24px" width="24px" alt="7TV Emotes" />
          </button>
          <span className="emoteBtnSeparator" />
          <button
            className={clsx("emoteBtn", "kickEmoteButton", activeDialog === "kick" && "activeDialog")}
            onMouseEnter={getRandomKickEmote}
            onClick={() => setActiveDialog(activeDialog === "kick" ? null : "kick")}>
            <img
              className="kickEmote emote"
              src={`https://files.kick.com/emotes/${currentHoverEmote?.id || "1730762"}/fullsize`}
              loading="lazy"
              fetchpriority="low"
              decoding="async"
            />
          </button>
        </div>

        <div className="emoteDialogs" ref={emoteDialogRef}>
          <SevenTVEmoteDialog
            isDialogOpen={activeDialog === "7tv"}
            sevenTVEmotes={allStvEmotes}
            handleEmoteClick={handleEmoteClick}
          />
          <KickEmoteDialog
            isDialogOpen={activeDialog === "kick"}
            kickEmotes={kickEmotes}
            handleEmoteClick={handleEmoteClick}
            userChatroomInfo={userChatroomInfo}
          />
        </div>
      </TooltipProvider>
    );
  },
  (prev, next) => prev.chatroomId === next.chatroomId && prev.userChatroomInfo === next.userChatroomInfo,
);

export default EmoteDialogs;
