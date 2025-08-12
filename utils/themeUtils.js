export const applyTheme = (customTheme) => {
  // customTheme can be an object { current: 'dark' } or a string like 'default'
  const themeValue = typeof customTheme === "string" ? customTheme : customTheme?.current;

  if (themeValue && themeValue !== "default") {
    document.documentElement.setAttribute("data-theme", themeValue);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
};

export const initTheme = async () => {
  try {
    const theme = await window.app.store.get("customTheme");
    applyTheme(theme);
  } catch (error) {
    console.error("[Theme]: Failed to load theme:", error);
    applyTheme("default");
  }
};

if (typeof window !== "undefined" && window.app) {
  initTheme();
}
