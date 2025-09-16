import { useMemo, memo, useState } from "react";
import clsx from "clsx";
import { convertSecondsToHumanReadable, isModeEnabled, chatModeMatches } from "../../../utils/ChatUtils";
import { InfoIcon } from "@phosphor-icons/react";

const InfoBar = memo(
  ({ chatroomInfo, initialChatroomInfo }) => {
    const [showInfoBarTooltip, setShowInfoBarTooltip] = useState(false);

    const { modeLabel: chatroomMode, activeModes, accountAgeSeconds } = useMemo(() => {
      const initialChatroom = initialChatroomInfo?.chatroom ?? {};

      const chatModeValue =
        chatroomInfo?.chat_mode ??
        initialChatroom?.chat_mode ??
        initialChatroomInfo?.chat_mode ??
        initialChatroomInfo?.chatroom?.chat_mode;

      const emoteModeEnabled =
        isModeEnabled(chatroomInfo?.emotes_mode) ||
        isModeEnabled(initialChatroom?.emotes_mode) ||
        chatModeMatches(chatModeValue, "emote");
      const followersModeEnabled =
        isModeEnabled(chatroomInfo?.followers_mode) ||
        isModeEnabled(initialChatroom?.followers_mode) ||
        chatModeMatches(chatModeValue, "follower");
      const subscribersModeEnabled =
        isModeEnabled(chatroomInfo?.subscribers_mode) ||
        isModeEnabled(initialChatroom?.subscribers_mode) ||
        chatModeMatches(chatModeValue, "subscriber");
      const accountAgeModeEnabled =
        isModeEnabled(chatroomInfo?.account_age) ||
        isModeEnabled(initialChatroom?.account_age) ||
        chatModeMatches(chatModeValue, "account");
      const slowModeEnabled =
        isModeEnabled(chatroomInfo?.slow_mode) ||
        isModeEnabled(initialChatroom?.slow_mode) ||
        chatModeMatches(chatModeValue, "slow");

      const followersDurationMinutes =
        chatroomInfo?.followers_mode?.min_duration ??
        initialChatroom?.followers_mode?.min_duration ??
        initialChatroom?.following_min_duration ??
        0;

      const accountAgeDurationMinutes =
        chatroomInfo?.account_age?.min_duration ??
        initialChatroom?.account_age?.min_duration ??
        0;

      const slowModeIntervalSeconds =
        chatroomInfo?.slow_mode?.message_interval ??
        initialChatroom?.slow_mode?.message_interval ??
        initialChatroom?.message_interval ??
        0;

      let label = "";

      if (emoteModeEnabled) {
        label = "Emote Only Mode";
      } else if (followersModeEnabled) {
        label = `Followers Only Mode [${convertSecondsToHumanReadable(followersDurationMinutes * 60)}]`;
      } else if (subscribersModeEnabled) {
        label = "Subscribers Only Mode";
      } else if (accountAgeModeEnabled) {
        label = `Account Age Mode [${convertSecondsToHumanReadable(accountAgeDurationMinutes * 60)}]`;
      } else if (slowModeEnabled) {
        label = `Slow Mode [${convertSecondsToHumanReadable(slowModeIntervalSeconds)}]`;
      }

      return {
        modeLabel: label,
        activeModes: {
          emotes: emoteModeEnabled,
          followers: followersModeEnabled,
          subscribers: subscribersModeEnabled,
          accountAge: accountAgeModeEnabled,
          slow: slowModeEnabled,
        },
        accountAgeSeconds: accountAgeDurationMinutes * 60,
      };
    }, [chatroomInfo, initialChatroomInfo]);

    return (
      <>
        {chatroomMode && (
          <div className="chatInfoBar">
            <span>{chatroomMode}</span>

            <div className="chatInfoBarIcon">
              <div className={clsx("chatInfoBarIconTooltipContent", showInfoBarTooltip && "show")}>
                {activeModes.followers && (
                  <div className="chatInfoBarTooltipItem">
                    <span>Followers Only Mode Enabled</span>
                  </div>
                )}
                {activeModes.accountAge && (
                  <div className="chatInfoBarTooltipItem">
                    <span>
                      Account Age Restriction Enabled [
                      {convertSecondsToHumanReadable(accountAgeSeconds)}]
                    </span>
                  </div>
                )}
                {activeModes.subscribers && (
                  <div className="chatInfoBarTooltipItem">
                    <span>Subscribers Only Mode Enabled</span>
                  </div>
                )}
                {activeModes.emotes && (
                  <div className="chatInfoBarTooltipItem">
                    <span>Emote Only Mode Enabled</span>
                  </div>
                )}
                {activeModes.slow && (
                  <div className="chatInfoBarTooltipItem">
                    <span>Slow Mode Enabled</span>
                  </div>
                )}
              </div>
              <div
                className="chatInfoBarIconTooltip"
                onMouseOver={() => setShowInfoBarTooltip(true)}
                onMouseLeave={() => setShowInfoBarTooltip(false)}>
                <InfoIcon size={16} weight="fill" aria-label="InfoIcon" />
              </div>
            </div>
          </div>
        )}
      </>
    );
  },
  (prev, next) => prev.chatroomInfo === next.chatroomInfo && prev.initialChatroomInfo === next.initialChatroomInfo,
);

export default InfoBar;
