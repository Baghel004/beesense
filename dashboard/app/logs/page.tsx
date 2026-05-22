"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchLogs, clearLogs, type LogEntry } from "@/lib/api";
import { usePolling } from "@/lib/use-polling";

const LINE_COLORS: Record<string, string> = {
  "[SD]": "text-yellow-400",
  "[SD-DIAG]": "text-yellow-500",
  "[CLOUD]": "text-cyan-400",
  "[REC]": "text-green-400",
  "[WAV]": "text-green-300",
  "[VERIFY]": "text-green-500",
  "[DHT]": "text-orange-400",
  "[WIFI]": "text-blue-400",
  "[TIME]": "text-purple-400",
  "[I2S]": "text-pink-400",
  "[ERROR]": "text-red-500",
  "[WARN]": "text-red-400",
  "[CSV]": "text-gray-400",
  "[WAIT]": "text-gray-500",
  "[COUNTDOWN]": "text-gray-500",
  "[OK]": "text-green-500",
  "[TEST]": "text-cyan-300",
  "[LOG]": "text-gray-400",
  "=": "text-gray-600",
};

function getLineColor(msg: string): string {
  for (const [prefix, color] of Object.entries(LINE_COLORS)) {
    if (msg.trimStart().startsWith(prefix)) return color;
  }
  return "text-gray-300";
}

export default function LogsPage() {
  const fetcher = useCallback(() => fetchLogs(), []);
  const { data: logs, loading, refresh } = usePolling(fetcher, 10000);

  const [autoScroll, setAutoScroll] = useState(true);
  const [clearing, setClearing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearLogs();
      refresh();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Device Logs</h1>
          <p className="text-sm text-muted-foreground">
            Live serial monitor output from the ESP32
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {logs ? `${logs.length} lines` : ""}
          </span>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClear}
            disabled={clearing || !logs?.length}
          >
            {clearing ? "Clearing..." : "Clear Logs"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Serial Output</span>
            {!autoScroll && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setAutoScroll(true);
                  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Scroll to bottom
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !logs ? (
            <Skeleton className="h-[500px] w-full rounded-lg" />
          ) : !logs?.length ? (
            <div className="flex h-[500px] items-center justify-center text-muted-foreground">
              No logs yet. Logs appear after the device completes a recording cycle.
            </div>
          ) : (
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="h-[600px] overflow-y-auto rounded-lg bg-black p-4 font-mono text-xs leading-relaxed"
            >
              {logs.map((entry: LogEntry, i: number) => (
                <div key={i} className="flex gap-3 hover:bg-white/5">
                  <span className="shrink-0 select-none text-gray-600">
                    {new Date(entry.ts).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })}
                  </span>
                  <span className={getLineColor(entry.msg)}>{entry.msg}</span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
