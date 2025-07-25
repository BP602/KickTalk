import { useEffect, useState } from "react";
import clsx from "clsx";
import log from "electron-log";
import downloadIcon from "../../src/assets/icons/cloud-arrow-down-fill.svg?asset";

const Updater = () => {
  const [updateStatus, setUpdateStatus] = useState("idle");
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    const callbackFunction = (update) => {
      setUpdateStatus(update?.event);
      setUpdateInfo(update);
    };

    const cleanup = window.app.update.onUpdate(callbackFunction);

    return () => {
      cleanup();
    };
  }, []);

  // Listen for auto-update dismiss when user disables auto-update in settings
  useEffect(() => {
    const handleDismiss = () => {
      setUpdateStatus("idle");
      setUpdateInfo(null);
    };

    const cleanup = window.app.update.onDismiss(handleDismiss);

    return () => {
      cleanup();
    };
  }, []);

  const handleCheckForUpdate = async () => {
    setUpdateStatus("checking");

    try {
      const result = await window.app.update.checkForUpdates();

      if (result?.success) {
        setUpdateStatus("available");
      } else {
        setUpdateStatus("error");
      }
    } catch (error) {
      log.error("[Updater] Error checking for updates:", error);
      setUpdateStatus("error");
      setUpdateInfo({ error: error.message });
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      const result = await window.app.update.downloadUpdate();
      if (!result?.success) {
        setUpdateStatus("error");
        setUpdateInfo({ error: result?.error });
        return;
      }
    } catch (error) {
      log.error("[Updater] Error downloading update:", error);
      setUpdateStatus("error");
      setUpdateInfo({ error: error.message });
    }
  };

  const handleInstallUpdate = () => {
    window.app.update.installUpdate();
  };

  const getButtonConfig = () => {
    switch (updateStatus) {
      case "ready":
        return { text: "Update Now", action: handleInstallUpdate, disabled: false, show: true };
      case "download-failed":
        return { text: "Retry Update", action: handleDownloadUpdate, disabled: false, show: true };
      case "error":
        return { text: "Error - Retry Update", action: handleCheckForUpdate, disabled: false, show: true };
      default:
        return { show: false };
    }
  };

  const { text, action, disabled, show } = getButtonConfig();

  return (
    <>
      <div className={clsx("updater", (updateInfo?.files?.length || show) && "updateAvailable")}>
        {show && (
          <button onClick={action} disabled={disabled}>
            <span>v {updateInfo?.version}</span>
            <div className="updaterMainContent">
              <h4>{text}</h4>
              <img src={downloadIcon} alt="download" />
            </div>
          </button>
        )}
      </div>
    </>
  );
};

export default Updater;
