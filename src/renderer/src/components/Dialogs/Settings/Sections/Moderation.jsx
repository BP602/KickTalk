import { Tooltip, TooltipContent, TooltipTrigger } from "../../../Shared/Tooltip";
import { InfoIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { Switch } from "../../../Shared/Switch";

const ModerationSection = ({ settingsData, onChange }) => {
  return (
    <div className="settingsContentSection">
      <div className="settingsSectionHeader">
        <h4>Moderation</h4>
        <p>Customize your moderation experience.</p>
      </div>

      <div className="settingsItems">
        <div className="settingsItem">
          <div
            className={clsx("settingSwitchItem", {
              active: settingsData?.moderation?.quickModTools,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Quick Mod Tools</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <InfoIcon size={14} weight="fill" aria-label="InfoIcon" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <InfoIcon size={14} weight="fill" aria-label="Quick Mod Tools" />
                  <p>Enable quick moderation tools in chat messages</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Switch
              checked={settingsData?.moderation?.quickModTools || false}
              onCheckedChange={(checked) =>
                onChange("moderation", {
                  ...settingsData?.moderation,
                  quickModTools: checked,
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export { ModerationSection };
