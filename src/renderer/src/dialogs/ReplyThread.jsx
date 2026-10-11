import "@assets/styles/main.scss";
import "@assets/styles/dialogs/ReplyThreadDialog.scss";
import "@utils/themeUtils";

import React from "react";
import ReactDOM from "react-dom/client";
import ReplyThread from "../components/Dialogs/ReplyThread.jsx";
import SettingsProvider from "../providers/SettingsProvider.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <SettingsProvider>
    <ReplyThread />
  </SettingsProvider>,
);
