# KickTalk v2.0.2 Release Notes

## 🐛 Bug Fixes & Improvements

- **Fixed telemetry configuration in packaged builds**: Resolved issue where OTEL (OpenTelemetry) environment variables were not properly embedded in production AppImages, causing telemetry to fail when running outside the project directory
- **Improved GitHub Actions workflow**: Combined build and packaging steps to ensure consistent environment variable availability during the build process

## 🔧 Technical Improvements

- **Updated environment variable handling**: Replaced `process.env` with `import.meta.env` for `MAIN_VITE_*` prefixed variables to properly embed build-time configuration in packaged applications
- **Enhanced fallback chain**: Maintained backward compatibility by preserving fallback from build-time embedded variables to runtime environment variables
- **Workflow optimization**: Streamlined CI/CD pipeline to reduce potential environment variable gaps between build and packaging phases

This release ensures that telemetry and monitoring work correctly in production builds distributed via GitHub releases, resolving the "Missing endpoint or headers" error that prevented proper application monitoring.

---
**Full Changelog**: [v2.0.1...v2.0.2](https://github.com/BP602/KickTalk/compare/v2.0.1...v2.0.2)