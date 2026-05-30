"use client";
import { useState } from "react";
import EventFeed from "@/components/EventFeed";
import NewsFeed from "@/components/NewsFeed";
import type { SimEvent, NewsFeedItem } from "@/lib/types";

interface Props {
  events: SimEvent[];
  onInjectRandomEvent: () => void;
  news: NewsFeedItem[];
  simTime?: number;
}

export default function FeedTabs({ events, onInjectRandomEvent, news, simTime }: Props) {
  const [tab, setTab] = useState<"intel" | "events">("intel");
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-1 p-2 shrink-0">
        <button
          onClick={() => setTab("intel")}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "intel" ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
        >
          Intelligence
        </button>
        <button
          onClick={() => setTab("events")}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "events" ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
        >
          Events {events.length > 0 && <span className="ml-1 text-[10px] opacity-70">{events.length}</span>}
        </button>
      </div>
      <div className="flex-1 min-h-0 px-3 pb-3 overflow-hidden">
        {tab === "intel" ? (
          <NewsFeed items={news} simTime={simTime} />
        ) : (
          <EventFeed events={events} onInjectRandomEvent={onInjectRandomEvent} />
        )}
      </div>
    </div>
  );
}
