import { memo } from "react";

const SupportEventMessage = memo(({ message }) => {
  const metadata = message?.metadata || {};
  const username = metadata.username || message?.sender?.username || "";
  const description = metadata.message || metadata.description || message?.content || "";

  return (
    <span className="supportEventMessage">
      {username && <span className="supportEventUsername">{username}</span>}
      {description && <span className="supportEventDescription">{description}</span>}
    </span>
  );
});

export default SupportEventMessage;
