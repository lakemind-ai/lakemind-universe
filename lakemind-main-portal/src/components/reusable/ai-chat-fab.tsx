import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AiChatDrawer } from "@/components/entity/ai-chat-drawer";

export function AiChatFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#1E3A5F] text-white shadow-lg hover:bg-[#162D4A] hover:shadow-xl transition-all z-[90] flex items-center justify-center"
          title="LakeMind AI Chat"
        >
          <Sparkles className="w-5 h-5" />
        </button>
      )}

      {/* Drawer — global mode (no entity pre-selected) */}
      <AiChatDrawer
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
