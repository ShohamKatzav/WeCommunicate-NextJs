"use client"
import { RefObject, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Pencil, Reply, Trash2 } from "lucide-react";
import ReactionPicker from "./reactionPicker";

interface MessageActionsMenuProps {
  // The element the menu opens against: the bubble itself on mobile (it's
  // opened by tapping the bubble), the "more" button beside it on desktop.
  anchorRef: RefObject<HTMLElement | null>;
  // Which edge to line the menu up with - the bubble's outer edge, so the
  // menu grows toward the middle of the chat rather than off the screen.
  align: "start" | "end";
  menuRef: RefObject<HTMLDivElement | null>;
  selectedReaction?: string;
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDismiss: () => void;
}

const EDGE_GAP = 8;

// Floats over the chat, like the navbar's theme menu, instead of sitting in
// the message list's flow - an in-flow menu pushed every message under it
// down while open. Portaled to <body> with fixed positioning because the
// message list scrolls (and so clips anything that pokes out of it) and can
// be shorter than the menu with the reaction grid expanded.
const MessageActionsMenu = ({ anchorRef, align, menuRef, selectedReaction, onReact, onReply, onEdit, onDelete, onDismiss }: MessageActionsMenuProps) => {
  // The latest onDismiss, read by the per-frame check below without making
  // every parent re-render tear down and re-place the menu.
  const dismissRef = useRef(onDismiss);
  useLayoutEffect(() => { dismissRef.current = onDismiss; });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    // Written straight to the element rather than through state: the menu
    // has to be measured before it can be placed, and it's re-placed on
    // every frame while open. The message list moves its bubbles without
    // any scroll event (it's bottom-anchored, so a re-render, a receipt or
    // an image finishing loading shifts everything above it), and the menu
    // grows when the "+" grid opens - checking each frame covers all of it.
    let lastKey = "";
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const { width, height } = menu.getBoundingClientRect();
      const key = `${anchor.left},${anchor.top},${anchor.right},${anchor.bottom},${width},${height},${window.innerWidth},${window.innerHeight}`;
      if (key === lastKey) return;
      lastKey = key;
      const maxLeft = window.innerWidth - width - EDGE_GAP;
      const maxTop = window.innerHeight - height - EDGE_GAP;

      const preferredLeft = align === "start" ? anchor.left : anchor.right - width;
      // Below the anchor when it fits, otherwise above it; a bubble taller
      // than the screen leaves neither, so then it's just kept on screen.
      const below = anchor.bottom + 4;
      const above = anchor.top - height - 4;
      const top = below <= maxTop ? below : above >= EDGE_GAP ? above : maxTop;

      menu.style.left = `${Math.max(EDGE_GAP, Math.min(preferredLeft, maxLeft))}px`;
      menu.style.top = `${Math.max(EDGE_GAP, top)}px`;
      menu.style.visibility = "visible";
    };

    // The scrolling message list the anchor lives in. Once the message has
    // been scrolled completely out of it, a menu following it would float
    // over the header or the input, so it closes instead. Not on any scroll
    // at all: a tap during leftover momentum, or one that drags a pixel,
    // scrolls the list too, and would close the menu it just opened.
    let scroller = anchorRef.current?.parentElement ?? null;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const scrolledAway = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const view = scroller?.getBoundingClientRect();
      if (!anchor || !view) return false;
      return anchor.bottom <= view.top || anchor.top >= view.bottom;
    };

    place();
    let frame = requestAnimationFrame(function follow() {
      if (scrolledAway()) {
        dismissRef.current();
        return;
      }
      place();
      frame = requestAnimationFrame(follow);
    });
    return () => cancelAnimationFrame(frame);
  }, [anchorRef, menuRef, align]);

  return createPortal(
    <div
      ref={menuRef}
      role="group"
      aria-label="Message actions"
      data-testid="message-actions-menu"
      // Hidden until place() has measured and positioned it, so it never
      // flashes at the top-left corner first.
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      className="z-50 w-max max-w-[calc(100vw-16px)] overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-lg"
    >
      {onReact && <ReactionPicker selected={selectedReaction} onPick={onReact} />}
      {(onReply || onEdit || onDelete) && (
        <div className={`py-1 ${onReact ? "border-t border-border" : ""}`}>
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <Reply className="h-4 w-4 shrink-0" aria-hidden="true" />
              Reply
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-foreground/10 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>,
    document.body
  );
};

export default MessageActionsMenu;
