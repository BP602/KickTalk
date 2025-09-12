import darkProfilePic from "../../../../assets/app/darkProfilePic.jpg";
import ftkProfilePic from "../../../../assets/app/ftk789ProfilePic.jpg";
import XLogo from "../../../../assets/logos/XLogo.svg?asset";
import kickLogoIcon from "../../../../assets/logos/kickLogoIcon.svg?asset";

const AboutSection = ({ appInfo }) => {
  return (
    <div className="settingsContentAbout">
      <div className="settingsContentSection">
        <div className="settingsSectionHeader">
          <h4>About KickTalk</h4>
          <p>A chat client for Kick.com.</p>
        </div>

        <div className="settingsContentAboutDevsContainer">
          <div className="settingsContentHeader">
            <h5>Meet the Creators</h5>
          </div>
          <div className="settingsContentAboutDevs">
            <div className="settingsContentAboutDev">
              <div className="settingsContentAboutDevInfo">
                <img src={darkProfilePic} alt="dark Profile Pic" width={80} height={80} />
                <div className="settingsContentAboutDevSections">
                  <span>
                    <p>Kick Username:</p>
                    <h5>DRKNESS_x</h5>
                  </span>
                  <span>
                    <p>Role:</p>
                    <h5>Developer & Designer</h5>
                  </span>
                </div>
              </div>

              <div className="settingsContentAboutDevSocials">
                <a href="https://x.com/drkerco" target="_blank" rel="noopener noreferrer">
                  <span>Open Twitter</span>
                  <img src={XLogo} width={12} height={12} alt="XIcon-Twitter Logo" />
                </a>
                <a href="https://kick.com/drkness-x" target="_blank" rel="noopener noreferrer">
                  <span>Open Channel</span>
                  <img src={kickLogoIcon} width={12} height={12} alt="Kick Logo" />
                </a>
              </div>
            </div>
            <div className="settingsContentAboutDevSeparator" />
            <div className="settingsContentAboutDev">
              <div className="settingsContentAboutDevInfo">
                <img src={ftkProfilePic} alt="ftk789 Profile Pic" width={80} height={80} />
                <div className="settingsContentAboutDevSections">
                  <span>
                    <p>Kick Username:</p>
                    <h5>ftk789</h5>
                  </span>
                  <span>
                    <p>Role:</p>
                    <h5>Developer</h5>
                  </span>
                </div>
              </div>

              <div className="settingsContentAboutDevSocials">
                <a href="https://x.com/ftk789yt" target="_blank" rel="noopener noreferrer">
                  <span>Open Twitter</span>
                  <img src={XLogo} width={12} height={12} alt="XIcon-Twitter Logo" />
                </a>
                <a href="https://kick.com/ftk789" target="_blank" rel="noopener noreferrer">
                  <span>Open Channel</span>
                  <img src={kickLogoIcon} width={12} height={12} alt="Kick Logo" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="settingsContentSection">
        <div className="settingsContentAboutApp">
          <div className="settingsContentHeader">
            <h5>About KickTalk</h5>
          </div>

          <div className="settingsContentAboutAppContent">
            <p>
              We created this application because we felt the current solution Kick was offering couldn't meet the needs of users
              who want more from their chatting experience. From multiple chatrooms to emotes and native Kick functionality all in
              one place.
            </p>
          </div>
        </div>
      </div>

      <div className="settingsContentSection">
        <div className="settingsAppDetailsSection">
          <div className="settingsAppDetailsInfo">
            <h5>Current Version:</h5>
            <p>{appInfo?.appVersion}</p>
          </div>
          {/* <UpdateButton /> */}
        </div>
      </div>
    </div>
  );
};

export default AboutSection;
