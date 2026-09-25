"use client"
import { useState } from "react";
import { Plus } from "lucide-react";
import { MESSAGE_REACTIONS, MORE_MESSAGE_REACTIONS } from "../../config/limits";

interface ReactionPickerProps {
  selected?: string;
  onPick: (emoji: string) => void;
}

// The quick reaction row, with a "+" that expands the longer curated set
// underneath it. Shared by the desktop popover and the mobile action menu in
// messageBubble.tsx, which each supply their own frame around it.
const ReactionPicker = ({ selected, onPick }: ReactionPickerProps) => {
  // Opens already expanded when the user's current reaction is one of the
  // extra ones, so they can see (and tap to remove) what they picked.
  const [expanded, setExpanded] = useState(
    () => !!selected && (MORE_MESSAGE_REACTIONS as readonly string[]).includes(selected)
  );

  const emojiButton = (emoji: string) => (
    <button
      key={emoji}
      type="button"
      onClick={() => onPick(emoji)}
      aria-label={`React with ${emoji}`}
      aria-pressed={selected === emoji}
      className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-xl leading-none hover:bg-foreground/10 ${selected === emoji ? "bg-foreground/15" : ""
        }`}
    >
      {emoji}
    </button>
  );

  return (
    <div role="group" aria-label="Pick a reaction" className="flex flex-col gap-1 p-1">
      <div className="flex items-center justify-between gap-0.5">
        {MESSAGE_REACTIONS.map(emojiButton)}
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          aria-label={expanded ? "Fewer reactions" : "More reactions"}
          aria-expanded={expanded}
          className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground ${expanded ? "bg-foreground/15" : ""
            }`}
        >
          <Plus size={20} className={`transition-transform ${expanded ? "rotate-45" : ""}`} />
        </button>
      </div>
      {expanded && (
        <div className="grid max-h-48 grid-cols-7 justify-items-center gap-0.5 overflow-y-auto border-t border-border pt-1">
          {MORE_MESSAGE_REACTIONS.map(emojiButton)}
        </div>
      )}
    </div>
  );
};

export default ReactionPicker;
