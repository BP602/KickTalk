import { useState, useEffect, useCallback } from "react";

import { MinusIcon, SquareIcon, XIcon, GearIcon } from "@phosphor-icons/react";

import "@assets/styles/components/TitleBar.scss";
import clsx from "clsx";
import Updater from "./Updater";
import useChatStore from "../providers/ChatProvider";

const TitleBar = () => {
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [appInfo, setAppInfo] = useState({});
  const currentUser = useChatStore((state) => state.currentUser);
  const cacheCurrentUser = useChatStore((state) => state.cacheCurrentUser);

  useEffect(() => {
    const getAppInfo = async () => {
      const appInfo = await window.app.getAppInfo();
      setAppInfo(appInfo);
    };

    getAppInfo();
    
    // Cache user info if not already cached
    if (!currentUser) {
      cacheCurrentUser();
    }
  }, [currentUser, cacheCurrentUser]);

  const handleAuthBtn = useCallback((e) => {
    const cords = [e.clientX, e.clientY];

    window.app.authDialog.open({ cords });
  }, []);

  return (
    <div className="titleBar">
      <div className="titleBarLeft">
        <span>KickTalk {appInfo.appVersion}</span>
      </div>

      <div className={clsx("titleBarSettings", settingsModalOpen && "open")}>
        {currentUser?.id ? (
          <button
            className="titleBarSettingsBtn"
            onClick={() =>
              window.app.settingsDialog.open({
                userData: currentUser,
              })
            }>
            <span className="titleBarUsername">{currentUser?.username || "Loading..."}</span>
            <div className="titleBarDivider" />
            <GearIcon weight="fill" className="titleBarSettingsIcon" size={16} aria-label="Settings" />
          </button>
        ) : (
          <div className="titleBarLoginBtn">
            <button className="titleBarSignInBtn" onClick={handleAuthBtn}>
              Sign In
            </button>
            <div className="titleBarDivider" />
            <button
              className="titleBarSettingsBtn"
              onClick={() =>
                window.app.settingsDialog.open({
                  userData: currentUser,
                })
              }>
              <GearIcon weight="fill" size={16} aria-label="Settings" />
            </button>
          </div>
        )}

        {settingsModalOpen && (
          <Settings settingsModalOpen={settingsModalOpen} setSettingsModalOpen={setSettingsModalOpen} appInfo={appInfo} />
        )}
      </div>

      <Updater />

      <div className="titleBarRight">
        <div className="titleBarControls">
          <button className="minimize" onClick={() => window.app.minimize()}>
            <MinusIcon weight="bold" size={12} aria-label="Minimize" />
          </button>
          <button className="maximize" onClick={() => window.app.maximize()}>
            <SquareIcon weight="bold" size={12} aria-label="Maximize" />
          </button>
          <button className="close" onClick={() => window.app.close()}>
            <XIcon weight="bold" size={14} aria-label="Close" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TitleBar;
