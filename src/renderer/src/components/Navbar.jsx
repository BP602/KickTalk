import "@assets/styles/components/Navbar.scss";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useChatStore, { MAX_SPLIT_PANE_COUNT } from "../providers/ChatProvider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./Shared/Tooltip";
import { PlusIcon, XIcon, BellIcon, ChatCenteredTextIcon, SquareSplitHorizontalIcon } from "@phosphor-icons/react";
import useClickOutside from "../utils/useClickOutside";
import { useSettings } from "../providers/SettingsProvider";
import { dropTargetForElements, monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import ChatroomTab from "./Navbar/ChatroomTab";
import MentionsTab from "./Navbar/MentionsTab";

const Navbar = ({ currentChatroomId, kickId, onSelectChatroom }) => {
  const { settings } = useSettings();
  const addChatroom = useChatStore((state) => state.addChatroom);
  const removeChatroom = useChatStore((state) => state.removeChatroom);
  const renameChatroom = useChatStore((state) => state.renameChatroom);
  const reorderChatrooms = useChatStore((state) => state.reorderChatrooms);
  const chatrooms = useChatStore((state) => state.chatrooms);
  const orderedChatrooms = useMemo(() => {
    return [...chatrooms].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [chatrooms]);
  const hasMentionsTab = useChatStore((state) => state.hasMentionsTab);
  const addMentionsTab = useChatStore((state) => state.addMentionsTab);
  const removeMentionsTab = useChatStore((state) => state.removeMentionsTab);
  const addToSplitPane = useChatStore((state) => state.addToSplitPane);
  const splitPaneChatrooms = useChatStore((state) => state.splitPaneChatrooms);
  const canAcceptMoreSplitPanes = splitPaneChatrooms.length < MAX_SPLIT_PANE_COUNT;

  const [editingChatroomId, setEditingChatroomId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [showNavbarDialog, setShowNavbarDialog] = useState(false);
  const [activeSection, setActiveSection] = useState("chatroom");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSubmitError, setIsSubmitError] = useState(null);
  const [isDraggingOverSplit, setIsDraggingOverSplit] = useState(false);

  const inputRef = useRef(null);
  const renameInputRef = useRef(null);
  const addChatroomDialogRef = useRef(null);
  const splitZoneRef = useRef(null);
  const navbarContainerRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const username = inputRef.current?.value.toLowerCase();
    if (!username) return;

    setIsConnecting(true);

    try {
      const newChatroom = await addChatroom(username);

      if (newChatroom?.username) {
        inputRef.current.value = "";
        setShowNavbarDialog(false);
        setTimeout(() => {
          onSelectChatroom(newChatroom.id);
        }, 0);

        return;
      }

      // Handle errors from addChatroom
      if (newChatroom?.error) {
        setIsSubmitError(newChatroom.message);
        setTimeout(() => {
          setIsSubmitError(null);
        }, 3000);
        return;
      }

      if (newChatroom?.status)
        setTimeout(() => {
          setIsSubmitError(null);
        }, 2000);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRemoveChatroom = async (chatroomId) => {

    const currentIndex = orderedChatrooms.findIndex((chatroom) => chatroom.id === chatroomId);
    await removeChatroom(chatroomId);

    // Get the remaining chatrooms after removal
    const remainingChatrooms = orderedChatrooms.filter((chatroom) => chatroom.id !== chatroomId);

    // If there are chatrooms available select next in list else select one behind
    if (remainingChatrooms.length) {
      const nextChatroom = remainingChatrooms[currentIndex] || remainingChatrooms[currentIndex - 1];
      if (nextChatroom) {
        onSelectChatroom(nextChatroom.id);
      }
    } else {
      onSelectChatroom(null);
    }
  };

  // Setup drag and drop monitoring
  useEffect(() => {
    return monitorForElements({
      onDragStart: ({ source }) => {
        if (source.data.type === 'chatroom-tab') {
          setIsDraggingOverSplit(false);
        }
      },
      onDrop: ({ source, location }) => {
        setIsDraggingOverSplit(false);

        if (source.data.type !== 'chatroom-tab') return;

        const destination = location.current.dropTargets[0];
        if (!destination) return;

        // Handle chatroom reordering
        if (destination.data.type === 'chatroom-list') {
          const sourceIndex = source.data.index;
          const destinationIndex = destination.data.index;

          if (sourceIndex !== destinationIndex) {
            const reordered = Array.from(orderedChatrooms);
            const [removed] = reordered.splice(sourceIndex, 1);
            reordered.splice(destinationIndex, 0, removed);
            reorderChatrooms(reordered);
          }
        }
      },
    });
  }, [orderedChatrooms, reorderChatrooms]);

  // Select first chatroom on mount if no chatroom is currently selected
  useEffect(() => {
    if (orderedChatrooms.length > 0 && !currentChatroomId) {
      onSelectChatroom(orderedChatrooms[0].id);
    }
  }, [orderedChatrooms, currentChatroomId, onSelectChatroom]);

  // Setup horizontal mouse wheel scrolling
  useEffect(() => {
    const handleWheel = (e) => {
      const navbarContainer = navbarContainerRef.current;
      if (!navbarContainer) return;

      // Only handle vertical wheel events (convert to horizontal scroll)
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();

        // Scroll horizontally based on vertical wheel movement
        // Increase scroll amount for more responsive scrolling
        const scrollAmount = e.deltaY > 0 ? 60 : -60;

        navbarContainer.scrollBy({
          left: scrollAmount,
          behavior: 'smooth'
        });
      }
    };

    const navbarContainer = navbarContainerRef.current;
    if (navbarContainer) {
      navbarContainer.addEventListener("wheel", handleWheel, { passive: false });
    }

    return () => {
      if (navbarContainer) {
        navbarContainer.removeEventListener("wheel", handleWheel);
      }
    };
  }, []);

  useClickOutside(addChatroomDialogRef, () => {
    setActiveSection("chatroom");
    setShowNavbarDialog(false);
  });

  // Handle Add Mentions Tab
  const handleAddMentions = () => {
    if (!kickId) return window.app.authDialog.open();

    addMentionsTab();
    setShowNavbarDialog(false);
    setTimeout(() => {
      onSelectChatroom("mentions");
    }, 0);
  };

  const handleRemoveMentionsTab = () => {
    removeMentionsTab();

    // Handle chatroom switching if mentions tab was active
    if (currentChatroomId === "mentions") {
      if (orderedChatrooms.length > 0) {
        onSelectChatroom(orderedChatrooms[0].id);
      } else {
        onSelectChatroom(null);
      }
    }
  };

  // Handle new chatroom key press (ctrl + t) and close dialog (escape)
  const handleNewChatroomKeyPress = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "t" || e.key.toLowerCase() === "j")) {
      e.preventDefault();

      setShowNavbarDialog(true);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }

    if (e.key === "Escape") {
      setActiveSection("chatroom");
      setShowNavbarDialog(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleNewChatroomKeyPress);
    return () => {
      window.removeEventListener("keydown", handleNewChatroomKeyPress);
    };
  }, [handleNewChatroomKeyPress]);

  // Rename Chatroom
  const handleRename = ({ chatroomId, currentDisplayName }) => {
    setEditingChatroomId(chatroomId);
    setEditingName(currentDisplayName);
    setTimeout(() => {
      renameInputRef.current?.focus();
    }, 250);
  };

  const handleRenameSubmit = (chatroomId) => {
    if (editingName.trim()) {
      renameChatroom(chatroomId, editingName.trim());
    }
    setEditingChatroomId(null);
    setEditingName("");
  };

  const wrapChatroomsList = settings?.general?.wrapChatroomsList;

  // Setup split zone drop target
  useEffect(() => {
    const element = splitZoneRef.current;
    if (!element) return;

    return dropTargetForElements({
      element,
      getData: () => ({ type: 'split-zone' }),
      canDrop: ({ source }) => {
        return source.data.type === 'chatroom-tab' && canAcceptMoreSplitPanes;
      },
      onDragEnter: () => {
        if (canAcceptMoreSplitPanes) {
          setIsDraggingOverSplit(true);
        }
      },
      onDragLeave: () => {
        setIsDraggingOverSplit(false);
      },
      onDrop: ({ source }) => {
        setIsDraggingOverSplit(false);
        if (source.data.type === 'chatroom-tab' && canAcceptMoreSplitPanes) {
          addToSplitPane(source.data.chatroomId);
        }
      },
    });
  }, [canAcceptMoreSplitPanes, addToSplitPane]);

  // Setup auto-scroll for navbar container (the actual scrollable element)
  useEffect(() => {
    const element = navbarContainerRef.current;
    if (!element) return;

    return autoScrollForElements({
      element,
      // Configure scroll zones - this makes it trigger sooner from the edge
      scrollSpeed: {
        // How fast to scroll (default is based on distance from edge)
        up: { maximum: 600 },
        down: { maximum: 600 },
        left: { maximum: 600 },
        right: { maximum: 600 }
      },
      // Make the scroll trigger zones larger (default is 50px from edge)
      threshold: {
        top: 80,
        bottom: 80,
        left: 80,
        right: 80
      }
    });
  }, []);

  const renderSplitPaneDropZone = () => (
    <div className="splitPaneDropZoneContainer">
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <div
            ref={splitZoneRef}
            className={clsx(
              "splitPaneDropZone",
              !canAcceptMoreSplitPanes && "disabled",
              isDraggingOverSplit && canAcceptMoreSplitPanes && "active",
            )}
          >
            <span>Split</span>
            <SquareSplitHorizontalIcon weight="bold" size={16} aria-label="Split pane" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          {canAcceptMoreSplitPanes
            ? "Drag a chatroom here to open it in a split pane"
            : `Split pane limit reached (${MAX_SPLIT_PANE_COUNT})`}
        </TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <TooltipProvider>
      <>
        <div
          className={clsx(
            "navbarContainer",
            wrapChatroomsList && "wrapChatroomList",
            settings?.general?.compactChatroomsList && "compactChatroomList",
        )}
          ref={navbarContainerRef}
      >
        <div className="chatroomsList">
          <div
            className={clsx(
              "chatroomsContainer",
              wrapChatroomsList && "chatroomsContainerWrapMode",
            )}
          >
            {orderedChatrooms.map((chatroom, index) => (
              <ChatroomTab
                key={chatroom.id}
                chatroom={chatroom}
                index={index}
                currentChatroomId={currentChatroomId}
                onSelectChatroom={onSelectChatroom}
                onRemoveChatroom={handleRemoveChatroom}
                onRename={handleRename}
                editingChatroomId={editingChatroomId}
                editingName={editingName}
                setEditingName={setEditingName}
                onRenameSubmit={handleRenameSubmit}
                setEditingChatroomId={setEditingChatroomId}
                renameInputRef={renameInputRef}
                settings={settings}
              />
            ))}

            {/* Always show separator if we have chatrooms */}
            {orderedChatrooms.length > 0 && <span className="chatroomsSeparator" />}

            {/* Mentions tab flows with chatrooms */}
            {hasMentionsTab && (
              <MentionsTab
                currentChatroomId={currentChatroomId}
                onSelectChatroom={onSelectChatroom}
                onRemoveMentionsTab={handleRemoveMentionsTab}
              />
            )}

            {/* Add button flows with chatrooms when wrapping */}
            {wrapChatroomsList && (
              <div className="navbarAddChatroomContainer">
                <button
                  className="navbarAddChatroomButton"
                  onClick={() => {
                    setActiveSection("chatroom");
                    setShowNavbarDialog(!showNavbarDialog);
                    if (!showNavbarDialog) {
                      setTimeout(() => {
                        inputRef.current?.focus();
                      }, 0);
                    }
                  }}
                  disabled={isConnecting}>
                  <span>Add</span>
                  <PlusIcon weight="bold" size={16} aria-label="Add chatroom" />
                </button>
              </div>
            )}

            {/* Split zone flows with chatrooms */}
            {renderSplitPaneDropZone()}
          </div>

        </div>

        <div className={clsx("navbarDialog", showNavbarDialog && "open")}>
          <div className="navbarDialogBody" ref={addChatroomDialogRef}>
            <div className="navbarDialogOptions">
              <div className="navbarDialogOptionBtns">
                <button
                  onClick={() => setActiveSection("chatroom")}
                  className={clsx("navbarDialogOptionBtn", activeSection === "chatroom" && "active")}>
                  <ChatCenteredTextIcon weight="fill" size={24} aria-label="Add chatroom" />
                  <span>Chatroom</span>
                </button>
                <button
                  onClick={() => setActiveSection("mentions")}
                  className={clsx("navbarDialogOptionBtn", activeSection === "mentions" && "active")}>
                  <BellIcon weight="fill" size={24} aria-label="Notifications" />
                  <span>Mentions</span>
                </button>
              </div>

              <button className="navbarDialogClose" onClick={() => setShowNavbarDialog(false)} aria-label="Close Add Mentions">
                <XIcon weight="bold" size={16} aria-label="Close Add Mentions" />
              </button>
            </div>

            <div className={clsx("navbarAddChatroomDialog", activeSection === "chatroom" && "active")}>
              <div className="navbarAddChatroomDialogHead">
                <div className="navbarAddChatroomDialogHeadInfo">
                  <h2>Add Chatroom</h2>
                  <p>Enter a channel name to add a new chatroom</p>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="navbarAddForm">
                <div>
                  <input ref={inputRef} placeholder="Enter streamer name..." disabled={isConnecting} />
                </div>
                {isSubmitError && (
                  <div className="navbarAddError">
                    {isSubmitError}
                  </div>
                )}
                <button className="navbarAddChatroomBtn navbarDialogBtn" type="submit" disabled={isConnecting}>
                  {isConnecting ? "Connecting..." : "Add Chatroom"}
                </button>
              </form>
            </div>

            <div className={clsx("navbarAddMentionsDialog", activeSection === "mentions" && "active")}>
              <div className="navbarAddMentionsDialogHead">
                <div className="navbarAddMentionsDialogHeadInfo">
                  <h2>Add Mentions Tab</h2>
                  <p>Add a tab to view all your mentions & highlights in all chats in one place</p>
                </div>
                <div className="navbarAddMentionsForm">
                  <button className="navbarAddMentionsBtn navbarDialogBtn" onClick={handleAddMentions}>
                    Add Mentions Tab
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="dialogBackgroundOverlay" />
        </div>

        {/* Add chatroom button */}
        {!settings?.general?.wrapChatroomsList && (
          <div className="navbarAddChatroomContainer">
            <button
              className="navbarAddChatroomButton"
              onClick={() => {
                setShowNavbarDialog(!showNavbarDialog);
                if (!showNavbarDialog) {
                  setTimeout(() => {
                    inputRef.current?.focus();
                  }, 0);
                }
              }}
              disabled={isConnecting}>
              Add
              <PlusIcon weight="bold" size={16} aria-label="Add chatroom" />
            </button>
          </div>
        )}
      </div>
      </>
    </TooltipProvider>
  );
};

export default Navbar;
