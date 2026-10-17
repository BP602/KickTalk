import clsx from "clsx";
import { Switch } from "../../../Shared/Switch";
import { isLiveNotificationEnabled, setLiveNotification } from "../../../../utils/liveNotifications";

// `rooms` is the `{ id, name }` roster the main window passes when it opens this dialog.
const LiveNotificationsSection = ({ settingsData, rooms = [] }) => {
  return (
    <div className="settingsContentSection">
      <div className="settingsSectionHeader">
        <h4>Live Notifications</h4>
        <p>Get a desktop notification when a streamer goes live. You can also right-click a tab to change this.</p>
      </div>

      <div className="settingsItems">
        {rooms.length === 0 && <p>No chatrooms added.</p>}
        {rooms.map((room) => {
          const enabled = isLiveNotificationEnabled(settingsData?.liveNotifications, room.id);
          return (
            <div className="settingsItem" key={room.id}>
              <div className={clsx("settingSwitchItem", { active: enabled })}>
                <span className="settingsItemTitle">{room.name}</span>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) =>
                    setLiveNotification(room.id, checked).catch((error) =>
                      console.error("Failed to update live notification setting:", error),
                    )
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { LiveNotificationsSection };
