import KickTalkLogo from "../../../assets/logos/KickTalkLogo.svg?asset";
import SignOut from "../../../assets/icons/sign-out-bold.svg?asset";
import clsx from "clsx";
import { useLocation, useNavigate } from "react-router-dom";
import { useMemo, useCallback } from "react";

const sections = [
  { key: "general", label: "General", route: "/settings/general", iconTestId: "general-icon", desc: "Basic application settings" },
  { key: "appearance", label: "Appearance", route: "/settings/appearance", iconTestId: "appearance-icon", desc: "Customize the app appearance" },
  { key: "chat", label: "Chat", route: "/settings/chat", iconTestId: "chat-icon", desc: "Chat display and behavior" },
  { key: "notifications", label: "Notifications", route: "/settings/notifications", iconTestId: "notifications-icon", desc: "Notification preferences" },
  { key: "privacy", label: "Privacy", route: "/settings/privacy", iconTestId: "privacy-icon", desc: "Privacy and security" },
  { key: "advanced", label: "Advanced", route: "/settings/advanced", iconTestId: "advanced-icon", desc: "Advanced configuration" },
];

const SettingsMenu = ({ onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey = useMemo(() => {
    const match = sections.find((s) => location?.pathname?.startsWith(s.route));
    return match?.key || "general";
  }, [location?.pathname]);

  const handleKeyNav = useCallback((e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = Array.from(e.currentTarget.querySelectorAll('.settingsMenuList .settingsMenuSectionItemBtn'));
    const index = buttons.indexOf(document.activeElement);
    if (index === -1) return;
    const next = e.key === "ArrowDown" ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
    e.preventDefault();
  }, []);

  return (
    <nav className="settingsMenu" aria-label="Settings Menu">
      <div className="settingsMenuItems" onKeyDown={handleKeyNav}>
        <div className="settingsMenuSection">
          <div className="settingsMenuSectionItem">
            <button className={clsx("settingsMenuSectionItemBtn", "settingsMenuSectionAppInfo", { active: false })}>
              <span>About KickTalk</span>
              <img src={KickTalkLogo} width={16} height={16} alt="KickTalk Logo" />
            </button>
          </div>
        </div>

        <ul role="list" className="settingsMenuList">
          {sections.map((s) => {
            const active = s.key === activeKey;
            const descId = `${s.key}-desc`;
            return (
              <li key={s.key} className="settingsMenuSection">
                <div className="settingsMenuSectionItem">
                  <button
                    className={clsx("settingsMenuSectionItemBtn", { active })}
                    aria-current={active ? "page" : undefined}
                    aria-describedby={descId}
                    onClick={() => navigate(s.route)}>
                    <span data-testid={s.iconTestId} aria-hidden="true" />
                    {s.label}
                    {/* optional badges/warnings could be conditionally injected here */}
                  </button>
                  <span data-testid={descId} id={descId} hidden>{s.desc}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="settingsMenuFooter">
        <button className="settingsMenuFooterBtn" onClick={onLogout}>
          <span>Sign Out</span>
          <img src={SignOut} width={16} height={16} alt="Sign Out" />
        </button>
      </div>
    </nav>
  );
};

export default SettingsMenu;
