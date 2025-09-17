# KickTalk v2.0.2 Release Notes

## 🚨 Critical Hotfix for v2.0.1

### 🐛 Bug Fixes & Improvements
- **Fixed telemetry configuration in packaged builds**: Resolved issue where OTEL (OpenTelemetry) environment variables were not properly embedded in production AppImages, causing telemetry to fail when running outside the project directory
- **Improved GitHub Actions workflow**: Combined build and packaging steps to ensure consistent environment variable availability during the build process

*This release ensures that telemetry and monitoring work correctly in production builds distributed via GitHub releases, resolving the "Missing endpoint or headers" error that prevented proper application monitoring.*

---

# 🚀 Major Features from v2.0.0 (Now with Fixed Telemetry)

## 🚀 Major New Features

- **🎉 Support Events System**: Complete overhaul of event handling with comprehensive subscription, donation, and gift tracking - bringing the full Kick experience directly into your chat
<img width="356" height="443" alt="Screenshot From 2025-09-11 21-16-37" src="https://github.com/user-attachments/assets/4d46a169-1e6e-4c20-bf97-5b6112f90458" />
<img width="356" height="443" alt="Screenshot From 2025-09-12 18-50-25" src="https://github.com/user-attachments/assets/7fafe135-e775-4f06-be60-2bf6516a8994" />
<img width="350" height="297" alt="Screenshot From 2025-09-15 21-05-27" src="https://github.com/user-attachments/assets/532dad0e-8ba5-41be-95a9-28567ca00ec1" />
<img width="350" height="297" alt="Screenshot From 2025-09-16 11-04-52" src="https://github.com/user-attachments/assets/bffe3e8c-98ed-4577-b4a8-e0e19f25bcdc" />

- **📺 Streamlink Integration**: External player integration with quality selection, path configuration, and availability checking for enhanced viewing
<img width="356" height="627" alt="Screenshot From 2025-09-16 22-41-28" src="https://github.com/user-attachments/assets/291e6785-98fc-4dfb-a76f-517938a1e5e5" />

- **🎭 Enhanced Emote Support**: Subscriber emotes now show in every chatroom, Unified emote logic with shared hooks for better performance and consistency across all chatrooms
<img width="350" height="297" alt="Screenshot From 2025-09-16 16-13-14" src="https://github.com/user-attachments/assets/2182acb3-db48-4646-9c0a-81aecd81a641" />

- **⚙️ Granular Chat Controls**: Per-event visibility toggles allowing users to customize exactly which events they want to see
<img width="888" height="513" alt="Screenshot From 2025-09-16 22-43-44" src="https://github.com/user-attachments/assets/196e3082-610d-45f4-85aa-153fcb14a06c" />

## 🔧 Technical Improvements

- **Updated environment variable handling**: Replaced `process.env` with `import.meta.env` for `MAIN_VITE_*` prefixed variables to properly embed build-time configuration in packaged applications
- **Enhanced fallback chain**: Maintained backward compatibility by preserving fallback from build-time embedded variables to runtime environment variables
- **Workflow optimization**: Streamlined CI/CD pipeline to reduce potential environment variable gaps between build and packaging phases

This release ensures that telemetry and monitoring work correctly in production builds distributed via GitHub releases, resolving the "Missing endpoint or headers" error that prevented proper application monitoring.

---
**Full Changelog**: [v2.0.1...v2.0.2](https://github.com/BP602/KickTalk/compare/v2.0.1...v2.0.2)