import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export const rgbaToString = (rgba) => {
  if (typeof rgba === "string") return rgba;
  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;
};

export const scrollToBottom = (chatBodyRef, setShowScrollToBottom) => {
  if (!chatBodyRef.current) return;
  chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  setShowScrollToBottom(false);
};

export const convertDateToHumanReadable = (date) => {
  const utcTime = dayjs.utc(date, "YYYY-MM-DD HH:mm:ss");

  const now = dayjs();
  const diff = now.diff(utcTime, "minutes");

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  } else {
    return `${minutes}m ago`;
  }
};

export const convertMinutesToHumanReadable = (minutes) => {
  if (minutes < 60) {
    return `${minutes} ${minutes > 1 ? "minutes" : "minute"}`;
  } else if (minutes < 1440) {
    return `${Math.floor(minutes / 60)} ${Math.floor(minutes / 60) > 1 ? "hours" : "hour"}`;
  } else {
    return `${Math.floor(minutes / 1440)} ${Math.floor(minutes / 1440) > 1 ? "days" : "day"}`;
  }
};

export const convertSecondsToHumanReadable = (seconds) => {
  switch (true) {
    case seconds < 60:
      return `${seconds} ${seconds > 1 ? "seconds" : "second"}`;
    case seconds < 3600:
      return `${Math.floor(seconds / 60)} ${Math.floor(seconds / 60) > 1 ? "minutes" : "minute"}`;
    case seconds < 86400:
      return `${Math.floor(seconds / 3600)} ${Math.floor(seconds / 3600) > 1 ? "hours" : "hour"}`;
    case seconds < 604800:
      return `${Math.floor(seconds / 86400)} ${Math.floor(seconds / 86400) > 1 ? "days" : "day"}`;
    case seconds < 2592000:
      return `${Math.floor(seconds / 604800)} ${Math.floor(seconds / 604800) > 1 ? "weeks" : "week"}`;
    case seconds < 31536000:
      return `${Math.floor(seconds / 2592000)} ${Math.floor(seconds / 2592000) > 1 ? "months" : "month"}`;
    case seconds >= 31536000:
      return `${Math.floor(seconds / 31536000)} ${Math.floor(seconds / 31536000) > 1 ? "years" : "year"}`;
    default:
      return "";
  }
};

// Kick can represent mode toggles as booleans or objects with an `enabled` flag.
// Normalize so the rest of the app can treat them uniformly.
export const isModeEnabled = (mode) => {
  if (mode == null) return false;
  if (typeof mode === "boolean") return mode;
  if (typeof mode === "number") return mode > 0;
  if (typeof mode === "string") return mode === "1" || mode.toLowerCase() === "true";
  if (typeof mode === "object") {
    const { enabled } = mode;
    if (typeof enabled === "boolean") return enabled;
    if (typeof enabled === "number") return enabled > 0;
    if (typeof enabled === "string") return enabled === "1" || enabled.toLowerCase() === "true";
  }
  return false;
};

export const chatModeMatches = (value, target) => {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  const expected = String(target).trim().toLowerCase();
  return normalized === expected || normalized.includes(expected);
};

export const getTimestampFormat = (timestamp, format) => {
  if (!timestamp) return "";
  switch (format) {
    case "disabled":
      return "";
    case "h:mm":
      return dayjs(timestamp).format("h:mm");
    case "hh:mm":
      return dayjs(timestamp).format("HH:mm");
    case "h:mm a":
      return dayjs(timestamp).format("h:mm A");
    case "hh:mm a":
      return dayjs(timestamp).format("HH:mm A");
    case "h:mm:ss":
      return dayjs(timestamp).format("h:mm:ss");
    case "hh:mm:ss":
      return dayjs(timestamp).format("HH:mm:ss");
    case "h:mm:ss a":
      return dayjs(timestamp).format("h:mm:ss A");
    case "hh:mm:ss a":
      return dayjs(timestamp).format("HH:mm:ss A");
    default:
      return "";
  }
};
