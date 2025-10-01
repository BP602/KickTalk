import { memo, useCallback, useState, useMemo } from "react";
import EmoteTooltip from "./EmoteTooltip";

// Progressive Loading Hook for Emotes
const useProgressiveEmoteLoading = (emote, type) => {
  const [loadState, setLoadState] = useState('loading'); // loading, loaded, error
  const [showFallback, setShowFallback] = useState(false);

  // Define fallback placeholder (prevents layout shift)
  const placeholder = useMemo(() => {
    const placeholderWidth = type === "stv" ? (emote.width || 28) : 32;
    const placeholderHeight = type === "stv" ? (emote.height || 28) : 32;

    return {
      width: placeholderWidth,
      height: placeholderHeight,
      backgroundColor: '#2a2a2a',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '4px',
      color: '#666',
      fontSize: '10px',
      fontFamily: 'monospace'
    };
  }, [emote, type]);

  const handleImageLoad = useCallback(() => {
    setLoadState('loaded');
    setShowFallback(false);
  }, []);

  const handleImageError = useCallback(() => {
    setLoadState('error');
    setShowFallback(true);
  }, []);

  return {
    loadState,
    showFallback,
    placeholder,
    handleImageLoad,
    handleImageError
  };
};

const Emote = memo(({ emote, overlaidEmotes = [], scale = 1, type }) => {
  const { id, name, width, height } = emote;

  const [showEmoteInfo, setShowEmoteInfo] = useState(false);
  const [mousePos, setMousePos] = useState({ x: null, y: null });

  // Use progressive loading hook
  const {
    loadState,
    showFallback,
    placeholder,
    handleImageLoad,
    handleImageError
  } = useProgressiveEmoteLoading(emote, type);

  const emoteSrcSet = useCallback(
    (emote) => {
      if (type === "stv") {
        const baseUrl = `https://cdn.7tv.app/emote/${emote.id}`;
        return `${baseUrl}/1x.webp 1x, ${baseUrl}/2x.webp 2x, ${baseUrl}/3x.webp 3x, ${baseUrl}/4x.webp 4x`;
      }
      return `https://files.kick.com/emotes/${emote.id}/fullsize`;
    },
    [type],
  );

  const emoteImageSrc = useMemo(() => {
    return type === "stv" ? `https://cdn.7tv.app/emote/${id}/1x.webp` : `https://files.kick.com/emotes/${id}/fullsize`;
  }, [type, id]);

  // Optimize event handlers with useCallback
  const handleMouseEnter = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    setShowEmoteInfo(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowEmoteInfo(false);
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (showEmoteInfo) {
        setMousePos({ x: e.clientX, y: e.clientY });
      }
    },
    [showEmoteInfo],
  );

  return (
    <>
      <EmoteTooltip
        type={type}
        showEmoteInfo={showEmoteInfo}
        emoteSrc={emoteImageSrc}
        mousePos={mousePos}
        emoteInfo={emote}
        overlaidEmotes={overlaidEmotes}
      />
      <div
        className="chatroomEmoteWrapper"
        style={{
          width: type === "stv" ? width : "32px",
          height: type === "stv" ? height : "32px",
        }}>
        <div
          className={`chatroomEmote emote-progressive ${loadState}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}>
          {showFallback || loadState === 'error' ? (
            // Fallback placeholder to prevent layout shift
            <div
              className={`emote-placeholder error`}
              style={placeholder}
              title={`${name} (failed to load)`}
            >
              {name.slice(0, 2)}
            </div>
          ) : null}

          {/* Always render image but control visibility with CSS */}
          <img
            className={`${type === "stv" ? "stvEmote" : "kickEmote"} emote ${loadState}`}
            src={emoteImageSrc}
            srcSet={type === "stv" ? emoteSrcSet(emote) : null}
            alt={name}
            loading="lazy"
            fetchpriority="low"
            decoding="async"
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{
              opacity: loadState === 'loaded' ? 1 : 0,
              transition: 'opacity 0.2s ease-in-out'
            }}
          />
        </div>

        {/* Overlaid zero-width emotes */}
        {overlaidEmotes.map((overlaidEmote) => (
          <div key={overlaidEmote.id} className="chatroomEmote zeroWidthEmote">
            <img
              className={`${type === "stv" ? "stvEmote" : "kickEmote"} emote`}
              src={
                type === "stv"
                  ? `https://cdn.7tv.app/emote/${overlaidEmote.id}/1x.webp`
                  : `https://files.kick.com/emotes/${overlaidEmote.id}/fullsize`
              }
              alt={` ${overlaidEmote.name}`}
              loading="lazy"
              decoding="async"
            />
          </div>
        ))}
      </div>
    </>
  );
});

export default Emote;
