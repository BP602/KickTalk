import React, { useState, useCallback, useEffect } from "react";
import { Switch } from "../../../Shared/Switch";
import { Slider } from "../../../Shared/Slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../Shared/Tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../Shared/Dropdown";
import InfoIcon from "../../../../assets/icons/info-fill.svg?asset";
import CaretDownIcon from "../../../../assets/icons/caret-down-fill.svg?asset";
import ColorPicker from "../../../Shared/ColorPicker";
import folderOpenIcon from "../../../../assets/icons/folder-open-fill.svg?asset";
import playIcon from "../../../../assets/icons/play-fill.svg?asset";
import NotificationFilePicker from "../../../Shared/NotificationFilePicker";
import clsx from "clsx";
import { DEFAULT_CHAT_HISTORY_LENGTH } from "@utils/constants";

const GeneralSection = ({ settingsData, onChange }) => {
  return (
    <div className="settingsContentGeneral">
      <div className="settingsContentSection">
        <div className="settingsSectionHeader">
          <h4>General</h4>
          <p>Select what general app settings you want to change.</p>
        </div>

        <div className="settingsItems">
          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.general?.alwaysOnTop,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Always on Top</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <img src={InfoIcon} width={14} height={14} alt="Info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Keep the KickTalk window always visible above other applications</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.general?.alwaysOnTop || false}
                onCheckedChange={(checked) =>
                  onChange("general", {
                    ...settingsData?.general,
                    alwaysOnTop: checked,
                  })
                }
              />
            </div>
          </div>
          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.general?.autoUpdate !== false,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Auto Update</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <img src={InfoIcon} width={14} height={14} alt="Info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Automatically check for and download KickTalk updates on startup</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.general?.autoUpdate !== false}
                onCheckedChange={(checked) =>
                  onChange("general", {
                    ...settingsData?.general,
                    autoUpdate: checked,
                  })
                }
              />
            </div>
          </div>
          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.general?.wrapChatroomsList,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Wrap Chatrooms List</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <img src={InfoIcon} width={14} height={14} alt="Info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Allow chatroom tabs to wrap to multiple lines when there are many open</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.general?.wrapChatroomsList || false}
                onCheckedChange={(checked) =>
                  onChange("general", {
                    ...settingsData?.general,
                    wrapChatroomsList: checked,
                  })
                }
              />
            </div>
          </div>
          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.general?.compactChatroomsList,
              })}
            >
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Compact Chatroom List</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <img src={InfoIcon} width={14} height={14} alt="Info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Display chatroom tabs in a more compact layout to save
                      space
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.general?.compactChatroomsList || false}
                onCheckedChange={(checked) =>
                  onChange("general", {
                    ...settingsData?.general,
                    compactChatroomsList: checked,
                  })
                }
              />
            </div>
          </div>
          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.general?.showTabImages,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Show Tab Images</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <img src={InfoIcon} width={14} height={14} alt="Info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Display streamer profile pictures in chatroom tabs</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.general?.showTabImages || false}
                onCheckedChange={(checked) =>
                  onChange("general", {
                    ...settingsData?.general,
                    showTabImages: checked,
                  })
                }
              />
            </div>
          </div>
          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.general?.timestampFormat !== "disabled",
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Show Timestamps</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <img src={InfoIcon} width={14} height={14} alt="Info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Display timestamps next to chat messages (12-hour vs 24-hour, with/without seconds)</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <DropdownMenu value={settingsData?.general?.timestampFormat}>
                <DropdownMenuTrigger asChild>
                  <button className="timestampFormat">
                    {settingsData?.general?.timestampFormat === "disabled" ? "Disabled" : settingsData?.general?.timestampFormat}
                    <img src={CaretDownIcon} width={14} height={14} alt="Chevron" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom">
                  <DropdownMenuItem
                    onClick={() => onChange("general", { ...settingsData?.general, timestampFormat: "disabled" })}
                    value="disabled">
                    Disabled
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("general", { ...settingsData?.general, timestampFormat: "h:mm" })}
                    value="h:mm">
                    h:mm
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("general", { ...settingsData?.general, timestampFormat: "hh:mm" })}
                    value="hh:mm">
                    hh:mm
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("general", { ...settingsData?.general, timestampFormat: "h:mm a" })}
                    value="h:mm a">
                    h:mm a
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("general", { ...settingsData?.general, timestampFormat: "hh:mm a" })}
                    value="hh:mm a">
                    hh:mm a
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("general", { ...settingsData?.general, timestampFormat: "h:mm:ss" })}
                    value="h:mm:ss">
                    h:mm:ss
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("general", { ...settingsData?.general, timestampFormat: "hh:mm:ss" })}
                    value="hh:mm:ss">
                    hh:mm:ss
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("general", { ...settingsData?.general, timestampFormat: "h:mm:ss a" })}
                    value="h:mm:ss a">
                    h:mm:ss a
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("general", { ...settingsData?.general, timestampFormat: "hh:mm:ss a" })}
                    value="hh:mm:ss a">
                    hh:mm:ss a
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.customTheme?.current !== "default",
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Theme</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <img src={InfoIcon} width={14} height={14} alt="Info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Select the theme you want to use for the app</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <DropdownMenu value={settingsData?.customTheme?.current || "default"}>
                <DropdownMenuTrigger asChild>
                  <button className="timestampFormat">
                    {settingsData?.customTheme?.current === "default"
                      ? "Default"
                      : settingsData?.customTheme?.current.charAt(0).toUpperCase() + settingsData?.customTheme?.current.slice(1)}
                    <img src={CaretDownIcon} width={14} height={14} alt="Chevron" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom">
                  <DropdownMenuItem
                    onClick={() => onChange("customTheme", { ...settingsData?.customTheme, current: "default" })}
                    value="default">
                    Default
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("customTheme", { ...settingsData?.customTheme, current: "dark" })}
                    value="dark">
                    Dark
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("customTheme", { ...settingsData?.customTheme, current: "blue" })}
                    value="blue">
                    Blue
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("customTheme", { ...settingsData?.customTheme, current: "purple" })}
                    value="purple">
                    Purple
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("customTheme", { ...settingsData?.customTheme, current: "red" })}
                    value="red">
                    Red
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatroomSection = ({ settingsData, onChange }) => {
  return (
    <div className="settingsContentSection">
      <div className="settingsSectionHeader">
        <h4>Chatroom</h4>
        <p>Select what chatroom settings you want to change.</p>
      </div>

      <div className="settingsItems">
        <div className="settingsItem">
          <div
            className={clsx("settingSwitchItem", {
              active: settingsData?.chatrooms?.batching,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Enable Batching</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Enable <b>Visual</b> batching of messages. This means that messages will be displayed in a batch, rather than
                    one by one.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Switch
              checked={settingsData?.chatrooms?.batching || false}
              onCheckedChange={(checked) =>
                onChange("chatrooms", {
                  ...settingsData?.chatrooms,
                  batching: checked,
                })
              }
            />
          </div>
        </div>
        <div className="settingsItem">
          <div
            className={clsx("settingSwitchItem", {
              active: settingsData?.chatrooms?.batching,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Batching Interval</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>The interval at which the chatroom will batch messages (in milliseconds)</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Slider
              className="settingsSlider"
              defaultValue={[settingsData?.chatrooms?.batchingInterval || 0]}
              max={1000}
              min={0}
              step={100}
              disabled={!settingsData?.chatrooms?.batching}
              showTooltip={true}
              onValueChange={(value) => {
                if (!value.length) return;
                onChange("chatrooms", { ...settingsData?.chatrooms, batchingInterval: value[0] });
              }}
            />
          </div>
        </div>
        <div className="settingsItem">
          <div
            className={clsx("settingSwitchItem", {
              active: settingsData?.chatrooms?.showModActions,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Show Mod Actions</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Display moderation actions (timeouts, bans, etc.) in chat</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Switch
              checked={settingsData?.chatrooms?.showModActions || false}
              onCheckedChange={(checked) =>
                onChange("chatrooms", {
                  ...settingsData?.chatrooms,
                  showModActions: checked,
                })
              }
            />
          </div>
        </div>
        <div className="settingsItem">
          <div
            className={clsx("settingSwitchItem", {
              active: settingsData?.chatrooms?.showInfoBar,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Show Chat Mode Info Bar</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Display the info bar above chat input showing current chat modes (emote only, followers only, etc.)</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Switch
              checked={settingsData?.chatrooms?.showInfoBar || false}
              onCheckedChange={(checked) =>
                onChange("chatrooms", {
                  ...settingsData?.chatrooms,
                  showInfoBar: checked,
                })
              }
            />
          </div>
        </div>
        <div className="settingsItem">
          <div className={clsx("settingNumericItem", {
            active: (settingsData?.chatHistory?.chatHistoryLength || DEFAULT_CHAT_HISTORY_LENGTH) !== DEFAULT_CHAT_HISTORY_LENGTH,
          })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Chat History Length</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Number of messages to keep in chat history. Higher values use more memory but let you scroll back further.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <input
              type="number"
              min="1"
              max="2000"
              step="1"
              value={settingsData?.chatHistory?.chatHistoryLength || DEFAULT_CHAT_HISTORY_LENGTH}
              onChange={(e) => {
                const value = Math.min(2000, Math.max(1, parseInt(e.target.value) || DEFAULT_CHAT_HISTORY_LENGTH));
                onChange("chatHistory", { 
                  ...settingsData?.chatHistory, 
                  chatHistoryLength: value 
                });
              }}
              className={clsx("numericInput", {
                active: (settingsData?.chatHistory?.chatHistoryLength || DEFAULT_CHAT_HISTORY_LENGTH) !== DEFAULT_CHAT_HISTORY_LENGTH,
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const CosmeticsSection = ({ settingsData, onChange }) => {
  return (
    <div className="settingsContentSection">
      <div className="settingsSectionHeader">
        <h4>Cosmetics</h4>
        <p>Select what cosmetics you want rendered in the chatrooms.</p>
      </div>

      <div className="settingsItems">
        <div className="settingsItem">
          <div
            className={clsx("settingSwitchItem", {
              active: settingsData?.sevenTV?.emotes,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">7TV Emotes</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enable 7TV emotes in chat messages and emote picker</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Switch
              checked={settingsData?.sevenTV?.emotes || false}
              onCheckedChange={(checked) =>
                onChange("sevenTV", {
                  ...settingsData?.sevenTV,
                  emotes: checked,
                })
              }
            />
          </div>
        </div>
        {/* <div className="settingsItem">
                    <div
                      className={clsx("settingSwitchItem", {
                        active: settingsData?.sevenTV?.paints,
                      })}>
                      <span className="settingsItemTitle">7TV Paints</span>

                      <Switch
                        checked={settingsData?.sevenTV?.paints || false}
                        onCheckedChange={(checked) =>
                          changeSetting("sevenTV", {
                            ...settingsData?.sevenTV,
                            paints: checked,
                          })
                        }
                      />
                    </div>
                  </div> */}
        {/* <div className="settingsItem">
                    <div
                      className={clsx("settingSwitchItem", {
                        active: settingsData?.sevenTV?.badges,
                      })}>
                      <span className="settingsItemTitle">7TV Badges</span>

                      <Switch
                        checked={settingsData?.sevenTV?.badges || false}
                        onCheckedChange={(checked) =>
                          changeSetting("sevenTV", {
                            ...settingsData?.sevenTV,
                            badges: checked,
                          })
                        }
                      />
                    </div>
                  </div> */}
      </div>
    </div>
  );
};

const NotificationsSection = ({ settingsData, onChange }) => {
  const [openColorPicker, setOpenColorPicker] = useState(false);

  const handleColorChange = useCallback(
    (color) => {
      onChange("notifications", {
        ...settingsData?.notifications,
        backgroundRgba: color,
      });
    },
    [settingsData, onChange],
  );

  const handleAddPhrase = useCallback(
    (e) => {
      const value = e.target.value.trim();
      if ((settingsData?.notifications?.phrases || []).includes(value)) return;
      if (e.key === "Enter" && value.length > 0) {
        onChange("notifications", {
          ...settingsData?.notifications,
          phrases: [...(settingsData?.notifications?.phrases || []), value],
        });
        e.target.value = "";
      }
    },
    [settingsData?.notifications?.phrases, onChange],
  );

  const getNotificationFiles = useCallback(async () => {
    const files = await window.app.notificationSounds.getAvailable();
    return files;
  }, []);

  return (
    <div className="settingsContentSection">
      <div className="settingsSectionHeader">
        <h4>Notifications</h4>
        <p>Select what notifications you want to receive.</p>
      </div>

      <div className="settingsItems">
        <div className="settingsItem">
          <div
            className={clsx("settingSwitchItem", {
              active: settingsData?.notifications?.enabled,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Enable Notifications</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enable desktop notifications when mentioned or highlighted phrases are detected</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Switch
              checked={settingsData?.notifications?.enabled || false}
              onCheckedChange={(checked) =>
                onChange("notifications", {
                  ...settingsData?.notifications,
                  enabled: checked,
                })
              }
            />
          </div>
        </div>

        <div className="settingsItem extended">
          <div
            className={clsx("settingSwitchItem", {
              active: settingsData?.notifications?.sound,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Play Sound</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Play a sound when notifications are triggered</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Switch
              checked={settingsData?.notifications?.sound || false}
              onCheckedChange={(checked) =>
                onChange("notifications", {
                  ...settingsData?.notifications,
                  sound: checked,
                })
              }
            />
          </div>

          <div
            className={clsx("settingSliderItem settingsExtendedItem", {
              active: settingsData?.notifications?.sound,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Volume</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Adjust the volume level for notification sounds</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Slider
              className="settingsSlider"
              defaultValue={[settingsData?.notifications?.volume || 0.1]}
              max={1}
              min={0}
              step={0.1}
              disabled={!settingsData?.notifications?.sound}
              showTooltip={true}
              onValueChange={(value) => {
                if (!value.length) return;
                onChange("notifications", {
                  ...settingsData?.notifications,
                  volume: value[0],
                });
              }}
            />
          </div>
          <div
            className={clsx("settingSliderItem settingsExtendedItem", {
              active: settingsData?.notifications?.sound,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Upload Sound</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Upload a custom sound file to play when notifications are triggered (mp3 or wav)</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <button
              className="soundFileName"
              disabled={!settingsData?.notifications?.sound}
              onClick={() => window.app.notificationSounds.openFolder()}>
              Select File <img src={folderOpenIcon} width={14} height={14} alt="Caret Down" />
            </button>
          </div>
          <div
            className={clsx("settingSliderItem settingsExtendedItem", {
              active: settingsData?.notifications?.sound,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Sound File</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select the sound file to play when notifications are triggered</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <NotificationFilePicker
              disabled={!settingsData?.notifications?.sound}
              getOptions={getNotificationFiles}
              onChange={onChange}
              settingsData={settingsData}
            />
          </div>
        </div>

        <div className="settingsItem extended">
          <div
            className={clsx("settingSwitchItem", {
              active: settingsData?.notifications?.background,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Show Highlights</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Highlight messages containing your username or custom phrases with a background color</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Switch
              checked={settingsData?.notifications?.background || false}
              onCheckedChange={(checked) =>
                onChange("notifications", {
                  ...settingsData?.notifications,
                  background: checked,
                })
              }
            />
          </div>

          <div
            className={clsx("settingSwitchItem settingsExtendedItem", {
              active: settingsData?.notifications?.background,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Highlight Color</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Choose the background color for highlighted messages</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <ColorPicker
              initialColor={settingsData?.notifications?.backgroundRgba || { r: 255, g: 255, b: 0, a: 0.5 }}
              isColorPickerOpen={openColorPicker}
              setIsColorPickerOpen={setOpenColorPicker}
              handleColorChange={handleColorChange}
              disabled={!settingsData?.notifications?.background}
            />
          </div>

          <div
            className={clsx("settingInputItem settingsExtendedItem", {
              active: settingsData?.notifications?.background,
            })}>
            <div className="highlightPhrasesHeader">
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Highlight Phrases</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <img src={InfoIcon} width={14} height={14} alt="Info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add custom words or phrases that will trigger highlights and notifications</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="highlightAddPhrase">
                <input type="text" placeholder="Add new phrase..." onKeyDown={handleAddPhrase} />
              </div>
            </div>

            <div className="highlightPhrases">
              {settingsData?.notifications?.phrases.length > 0 ? (
                <>
                  {settingsData?.notifications?.phrases.map((phrase) => (
                    <div
                      key={phrase}
                      onMouseDown={(e) => {
                        if (e.button === 1) {
                          onChange("notifications", {
                            ...settingsData?.notifications,
                            phrases: settingsData?.notifications?.phrases.filter((p) => p !== phrase),
                          });
                        }
                      }}
                      className="highlightPhrase"
                      title={phrase}>
                      <span>{phrase}</span>
                      <button
                        onClick={() => {
                          onChange("notifications", {
                            ...settingsData?.notifications,
                            phrases: settingsData?.notifications?.phrases.filter((p) => p !== phrase),
                          });
                        }}>
                        &times;
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <p>No highlight phrases added.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Telemetry Section */}
      <div className="settingsContentSection">
        <div className="settingsSectionHeader">
          <h4>Telemetry & Analytics</h4>
          <p>Control data collection and usage analytics.</p>
        </div>

        <div className="settingsItems">
          <div className="settingsItem">
            <div
              className={clsx("settingSwitchItem", {
                active: settingsData?.telemetry?.enabled,
              })}>
              <div className="settingsItemTitleWithInfo">
                <span className="settingsItemTitle">Enable Telemetry</span>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <button className="settingsInfoIcon">
                      <img src={InfoIcon} width={14} height={14} alt="Info" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Allow KickTalk to collect anonymous usage data to help improve the application. This includes app performance metrics, error reports, and feature usage statistics. No personal chat data is collected.</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Switch
                checked={settingsData?.telemetry?.enabled || false}
                onCheckedChange={(checked) =>
                  onChange("telemetry", {
                    ...settingsData?.telemetry,
                    enabled: checked,
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

const ExternalPlayersSection = ({ settingsData, onChange }) => {
  const [streamlinkInfo, setStreamlinkInfo] = useState({ available: false, path: "", checking: false });

  const checkAvailability = async () => {
    try {
      setStreamlinkInfo((s) => ({ ...s, checking: true }));
      const res = await window.app.utils.checkStreamlinkAvailable();
      setStreamlinkInfo({ available: !!res?.available, path: res?.path || "", checking: false });
      return res;
    } catch (e) {
      console.warn("[Settings]: Streamlink availability check failed:", e);
      setStreamlinkInfo({ available: false, path: "", checking: false });
      return { available: false };
    }
  };

  useEffect(() => {
    // Initial probe
    checkAvailability();
    // Recheck when user enables the feature
  }, []);

  useEffect(() => {
    if (settingsData?.streamlink?.enabled) {
      checkAvailability();
    }
  }, [settingsData?.streamlink?.enabled]);

  return (
    <div className="settingsContentSection">
      <div className="settingsSectionHeader">
        <h4>External Players</h4>
        <p>Configure external media players like Streamlink for better streaming performance.</p>
      </div>

      <div className="settingsItems">
        <div className="settingsItem">
          <div
            className={clsx("settingSwitchItem", {
              active: settingsData?.streamlink?.enabled,
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Enable Streamlink</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Enable Streamlink integration to open streams in external media players. Requires Streamlink to be installed.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <Switch
              checked={settingsData?.streamlink?.enabled || false}
              onCheckedChange={async (checked) => {
                if (checked) {
                  try {
                    const { available, path } = await window.app.utils.checkStreamlinkAvailable();
                    setStreamlinkInfo({ available: !!available, path: path || "", checking: false });
                    if (!available) {
                      window.alert("Streamlink not found. Please install Streamlink, then enable this setting.");
                      // Force disable in settings if user attempted to enable
                      onChange("streamlink", {
                        ...settingsData?.streamlink,
                        enabled: false,
                      });
                      return;
                    }
                  } catch (e) {
                    console.error("[Settings]: Failed to check Streamlink availability:", e);
                    window.alert("Could not verify Streamlink availability. Please try again.");
                    onChange("streamlink", {
                      ...settingsData?.streamlink,
                      enabled: false,
                    });
                    return;
                  }
                }
                onChange("streamlink", {
                  ...settingsData?.streamlink,
                  enabled: checked,
                });
              }}
            />
          </div>
        </div>

        <div className="settingsItem">
          <div className={clsx("settingNumericItem")}> 
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Streamlink Path</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Detected Streamlink executable path. Click Refresh after installing or updating your PATH.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                readOnly
                placeholder={streamlinkInfo.checking ? "Checking..." : (streamlinkInfo.available ? streamlinkInfo.path : "Not found")}
                value={streamlinkInfo.available ? (streamlinkInfo.path || "") : ""}
                disabled={!settingsData?.streamlink?.enabled}
                className={clsx("settingTextInput")}
                style={{ width: 300 }}
              />
              <button
                className="timestampFormat"
                disabled={!settingsData?.streamlink?.enabled || streamlinkInfo.checking}
                onClick={checkAvailability}
              >
                {streamlinkInfo.checking ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        <div className="settingsItem">
          <div
            className={clsx("settingSwitchItem", {
              active: settingsData?.streamlink?.enabled && settingsData?.streamlink?.quality !== "best",
            })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Stream Quality</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select preferred stream quality. Falls back to "best" if unavailable.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {settingsData?.streamlink?.enabled ? (
              <DropdownMenu value={settingsData?.streamlink?.quality || "best"}>
                <DropdownMenuTrigger asChild>
                  <button className="timestampFormat">
                    {settingsData?.streamlink?.quality || "best"}
                    <img src={CaretDownIcon} width={14} height={14} alt="Chevron" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom">
                  <DropdownMenuItem
                    onClick={() => onChange("streamlink", { ...settingsData?.streamlink, quality: "best" })}
                    value="best">
                    best
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("streamlink", { ...settingsData?.streamlink, quality: "1080p60" })}
                    value="1080p60">
                    1080p60
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("streamlink", { ...settingsData?.streamlink, quality: "1080p" })}
                    value="1080p">
                    1080p
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("streamlink", { ...settingsData?.streamlink, quality: "720p60" })}
                    value="720p60">
                    720p60
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("streamlink", { ...settingsData?.streamlink, quality: "720p" })}
                    value="720p">
                    720p
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("streamlink", { ...settingsData?.streamlink, quality: "480p" })}
                    value="480p">
                    480p
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("streamlink", { ...settingsData?.streamlink, quality: "360p" })}
                    value="360p">
                    360p
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("streamlink", { ...settingsData?.streamlink, quality: "160p" })}
                    value="160p">
                    160p
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("streamlink", { ...settingsData?.streamlink, quality: "audio_only" })}
                    value="audio_only">
                    audio_only
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onChange("streamlink", { ...settingsData?.streamlink, quality: "worst" })}
                    value="worst">
                    worst
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button className="timestampFormat" disabled>
                {settingsData?.streamlink?.quality || "best"}
                <img src={CaretDownIcon} width={14} height={14} alt="Chevron" />
              </button>
            )}
          </div>
        </div>

        <div className="settingsItem">
          <div className={clsx("settingNumericItem", {
            active: settingsData?.streamlink?.enabled && settingsData?.streamlink?.player,
          })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Player Command</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Specify the media player command (e.g., "vlc", "mpv", "/usr/bin/vlc"). Leave empty to use Streamlink's automatic player detection.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <input
              type="text"
              placeholder="Empty uses auto-detect (e.g., vlc, mpv)"
              value={settingsData?.streamlink?.player || ""}
              disabled={!settingsData?.streamlink?.enabled}
              onChange={(e) =>
                onChange("streamlink", {
                  ...settingsData?.streamlink,
                  player: e.target.value,
                })
              }
              className={clsx("settingTextInput", {
                active: settingsData?.streamlink?.enabled && settingsData?.streamlink?.player,
              })}
            />
          </div>
        </div>

        <div className="settingsItem">
          <div className={clsx("settingNumericItem", {
            active: settingsData?.streamlink?.enabled && settingsData?.streamlink?.customArgs,
          })}>
            <div className="settingsItemTitleWithInfo">
              <span className="settingsItemTitle">Custom Arguments</span>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button className="settingsInfoIcon">
                    <img src={InfoIcon} width={14} height={14} alt="Info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Additional Streamlink arguments. Default includes optimized low-latency settings for minimal stream delay. Advanced users can modify or add more arguments.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <input
              type="text"
              placeholder="Default: --hls-live-edge 2 --hls-segment-stream-data --stream-segment-threads 5"
              value={settingsData?.streamlink?.customArgs || ""}
              disabled={!settingsData?.streamlink?.enabled}
              onChange={(e) =>
                onChange("streamlink", {
                  ...settingsData?.streamlink,
                  customArgs: e.target.value,
                })
              }
              className={clsx("settingTextInput", {
                active: settingsData?.streamlink?.enabled && settingsData?.streamlink?.customArgs,
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export { GeneralSection, ChatroomSection, CosmeticsSection, NotificationsSection, ExternalPlayersSection };
