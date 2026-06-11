"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/AppIcon";

export function AiThinking({ messages, className = "" }: { messages: string[]; className?: string }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % messages.length);
        setVisible(true);
      }, 300);
    }, 2500);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className={`flex flex-col items-center justify-center py-14 gap-4 ${className}`}>
      <div className="relative flex items-center justify-center">
        <div
          className="absolute h-20 w-20 rounded-full animate-ping opacity-15"
          style={{ background: "var(--ios-blue, #0a84ff)" }}
        />
        <div
          className="h-16 w-16 rounded-[22px] flex items-center justify-center text-white relative"
          style={{ background: "linear-gradient(135deg, #16517d, #3aa6b8)" }}
        >
          <AppIcon name="sparkles" size={28} />
        </div>
      </div>

      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full animate-bounce"
            style={{
              background: "var(--ios-blue, #0a84ff)",
              animationDelay: `${i * 0.15}s`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>

      <p
        className="secondary text-[14px] text-center px-6 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {messages[idx]}
      </p>
    </div>
  );
}
