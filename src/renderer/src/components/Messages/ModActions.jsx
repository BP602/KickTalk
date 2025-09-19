import { useState, useCallback, useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../Shared/Tooltip";
import { Slider } from "../Shared/Slider";
import { GavelIcon, ClockUserIcon, UserPlusIcon } from "@phosphor-icons/react";
import { convertSecondsToHumanReadable } from "../../utils/ChatUtils";
import useClickOutside from "../../utils/useClickOutside";
import clsx from "clsx";

const ModActions = ({ chatroomName, message }) => {
  if (!chatroomName) return null;

  const timeoutSliderRef = useRef(null);

  const [showTimeoutSlider, setShowTimeoutSlider] = useState(false);
  const [sliderValue, setSliderValue] = useState(20);

  const sliderToDuration = useCallback((value) => {
    const minDuration = 1; // 1 minute
    const maxDuration = 10080; // 7 days in minutes

    // Convert slider value
    const minLog = Math.log(minDuration);
    const maxLog = Math.log(maxDuration);
    const scale = (maxLog - minLog) / 100;

    // Get the raw minutes value
    const minutes = Math.round(Math.exp(minLog + scale * value));

    const days = minutes / (24 * 60);
    if (days >= 1) {
      return Math.round(days) * 24 * 60;
    }

    const hours = minutes / 60;
    if (hours >= 1) {
      return Math.round(hours) * 60;
    }

    return minutes;
  }, []);

  const handleBan = (username, type) => {
    if (!username) return;
    window.app.modActions.getBanUser(chatroomName, username, type);
  };

  const handleTimeoutSlider = (username, value) => {
    if (!username) return;
    const duration = sliderToDuration(value);
    window.app.modActions.getTimeoutUser(chatroomName, username, duration);
    setShowTimeoutSlider(false);
  };

  const handleUnbanUser = (username) => {
    if (!username) return;
    window.app.modActions.getUnbanUser(chatroomName, username);
  };

  // Close slider when clicking outside
  useClickOutside(timeoutSliderRef, () => setShowTimeoutSlider(false));

  return (
    <>
      <TooltipProvider delayDuration={150} skipDelayDuration={0} disableHoverableContent>
        <div className="quickModTools">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={clsx("quickModToolsBtn", showTimeoutSlider && "active")}
                onClick={() => handleUnbanUser(message?.sender?.username)}>
                <UserPlusIcon size={12} aria-label="Unban User" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5}>
              <p>Unban {message?.sender?.username}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={clsx("quickModToolsBtn", showTimeoutSlider && "active")}
                onClick={() => setShowTimeoutSlider(true)}>
                <ClockUserIcon size={13} aria-label="Timeout Slider" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5}>
              <p>Timeout Slider</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={clsx("quickModToolsBtn", showTimeoutSlider && "active")}
                onClick={() => handleBan(message?.sender?.username, "ban")}>
                <GavelIcon weight="fill" size={12} aria-label="Ban User" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5}>
              <p>Ban {message?.sender?.username}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {showTimeoutSlider && (
        <div className="timeoutSlider" ref={timeoutSliderRef}>
          <div className="timeoutSliderContent">
            <div className="timeoutSliderBody">
              <div className="timeoutSliderDuration">
                <span>{convertSecondsToHumanReadable(sliderToDuration(sliderValue) * 60)}</span>
                <button
                  className="timeoutSliderButton"
                  onClick={() => handleTimeoutSlider(message?.sender?.username, sliderValue)}>
                  Confirm
                </button>
              </div>
              <Slider
                value={[sliderValue]}
                onValueChange={(value) => setSliderValue(value[0])}
                min={0}
                max={100}
                step={1}
                className="timeoutSliderInput"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModActions;
