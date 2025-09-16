import { Switch } from "../../../Shared/Switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../Shared/Tooltip";
import { InfoIcon } from "@phosphor-icons/react";
import clsx from "clsx";

export const ChatEventsSection = ({ settingsData, onChange }) => {
  return (
    <div className="settingsContentGeneral">
      <div className="settingsContentSection">
        <div className="settingsSectionHeader">
          <h4>Chat Events</h4>
          <p>Configure which chat events are displayed in the chat window.</p>
        </div>

        <div className="settingsItems">
          {/* Individual event type controls */}
          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.chatrooms?.eventVisibility?.subscriptions !== false,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Subscriptions</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <InfoIcon size={14} weight="fill" aria-label="InfoIcon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Channel subscription events and gift subscriptions</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.chatrooms?.eventVisibility?.subscriptions !== false}
                onCheckedChange={(checked) =>
                  onChange("chatrooms", {
                    ...settingsData?.chatrooms,
                    eventVisibility: {
                      ...settingsData?.chatrooms?.eventVisibility,
                      subscriptions: checked,
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.chatrooms?.eventVisibility?.rewards !== false,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Rewards</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <InfoIcon size={14} weight="fill" aria-label="InfoIcon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Channel point rewards and redemptions</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.chatrooms?.eventVisibility?.rewards !== false}
                onCheckedChange={(checked) =>
                  onChange("chatrooms", {
                    ...settingsData?.chatrooms,
                    eventVisibility: {
                      ...settingsData?.chatrooms?.eventVisibility,
                      rewards: checked,
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.chatrooms?.eventVisibility?.kickGifts !== false,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Kick Gifts</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <InfoIcon size={14} weight="fill" aria-label="InfoIcon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Kick gift notifications (Hell Yeah, Hype, etc.)</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.chatrooms?.eventVisibility?.kickGifts !== false}
                onCheckedChange={(checked) =>
                  onChange("chatrooms", {
                    ...settingsData?.chatrooms,
                    eventVisibility: {
                      ...settingsData?.chatrooms?.eventVisibility,
                      kickGifts: checked,
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.chatrooms?.eventVisibility?.hosts !== false,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Hosts</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <InfoIcon size={14} weight="fill" aria-label="InfoIcon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Channel hosting events from other streamers</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.chatrooms?.eventVisibility?.hosts !== false}
                onCheckedChange={(checked) =>
                  onChange("chatrooms", {
                    ...settingsData?.chatrooms,
                    eventVisibility: {
                      ...settingsData?.chatrooms?.eventVisibility,
                      hosts: checked,
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.chatrooms?.eventVisibility?.raids !== false,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Raids</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <InfoIcon size={14} weight="fill" aria-label="InfoIcon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Raid events when viewers are sent from another channel</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.chatrooms?.eventVisibility?.raids !== false}
                onCheckedChange={(checked) =>
                  onChange("chatrooms", {
                    ...settingsData?.chatrooms,
                    eventVisibility: {
                      ...settingsData?.chatrooms?.eventVisibility,
                      raids: checked,
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.chatrooms?.eventVisibility?.goalProgress !== false,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Goal Progress</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <InfoIcon size={14} weight="fill" aria-label="InfoIcon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Follower and subscriber goal progress updates</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.chatrooms?.eventVisibility?.goalProgress !== false}
                onCheckedChange={(checked) =>
                  onChange("chatrooms", {
                    ...settingsData?.chatrooms,
                    eventVisibility: {
                      ...settingsData?.chatrooms?.eventVisibility,
                      goalProgress: checked,
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.chatrooms?.eventVisibility?.streamStatus !== false,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Stream Status</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <InfoIcon size={14} weight="fill" aria-label="InfoIcon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stream online/offline and category change notifications</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.chatrooms?.eventVisibility?.streamStatus !== false}
                onCheckedChange={(checked) =>
                  onChange("chatrooms", {
                    ...settingsData?.chatrooms,
                    eventVisibility: {
                      ...settingsData?.chatrooms?.eventVisibility,
                      streamStatus: checked,
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.chatrooms?.eventVisibility?.timeouts !== false,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Timeouts</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <InfoIcon size={14} weight="fill" aria-label="InfoIcon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Temporary user timeouts and mutes</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.chatrooms?.eventVisibility?.timeouts !== false}
                onCheckedChange={(checked) =>
                  onChange("chatrooms", {
                    ...settingsData?.chatrooms,
                    eventVisibility: {
                      ...settingsData?.chatrooms?.eventVisibility,
                      timeouts: checked,
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.chatrooms?.eventVisibility?.bans !== false,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Bans</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <InfoIcon size={14} weight="fill" aria-label="InfoIcon" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Permanent user bans and unbans</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.chatrooms?.eventVisibility?.bans !== false}
                onCheckedChange={(checked) =>
                  onChange("chatrooms", {
                    ...settingsData?.chatrooms,
                    eventVisibility: {
                      ...settingsData?.chatrooms?.eventVisibility,
                      bans: checked,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
