import { memo } from "react";
import { XIcon } from "@phosphor-icons/react";

const SettingsHeader = memo(
  ({ onClose, appInfo }) => {
    return (
      <div className="settingsDialogHeader">
        <h2>
          Settings <span className="settingsDialogVersion">v {appInfo?.appVersion || "0.0.0"}</span>
        </h2>

        <button className="settingsDialogCloseBtn" onClick={onClose}>
          <XIcon size={16} weight="bold" aria-label="Close" />
        </button>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.appInfo?.appVersion === nextProps.appInfo?.appVersion;
  },
);

export default SettingsHeader;
