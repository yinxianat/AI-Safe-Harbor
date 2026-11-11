"use client";

import { useParams } from "next/navigation";
import ChatSidebar from "@/components/ChatSidebar";

/**
 * Chat layout wraps the thread page with a desktop-only contact sidebar.
 * On mobile, the sidebar is hidden and Circle serves as the entry point.
 * The negative margins break out of the parent's px-4 and max-w-lg so
 * the chat fills the available viewport width on wider screens.
 */
export default function ChatLayout({ children }) {
  const params = useParams();
  const connectionId = params?.connectionId;

  return (
    <div className="lg:-mx-4 lg:-mt-4 lg:flex lg:h-[calc(100vh-5rem)] overflow-hidden">
      <ChatSidebar activeConnectionId={connectionId} />
      <div className="flex-1 min-w-0 lg:px-4 lg:pt-4 lg:max-w-lg lg:mx-auto lg:w-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
