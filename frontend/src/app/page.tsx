"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentGraph } from "@/components/agent-graph";
import { sendChat, type ChatResponse } from "@/lib/api";
import Link from "next/link";

type Message = {
  role: "user" | "assistant";
  text: string;
  agent?: string;
  traceUrl?: string | null;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);

  async function handleSend() {
    if (!input.trim()) return;
    const userMessage = input;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userMessage }]);
    setStatus("running");

    try {
      const res: ChatResponse = await sendChat(userMessage);
      setActiveAgent(res.agent);
      setStatus("done");
      setMessages((m) => [
        ...m,
        { role: "assistant", text: res.response, agent: res.agent, traceUrl: res.trace_url },
      ]);
    } catch {
      setStatus("idle");
      setMessages((m) => [...m, { role: "assistant", text: "Error: could not reach backend." }]);
    }
  }

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agents Studio</h1>
        <Link href="/evals" className="text-sm text-muted-foreground underline">
          Eval Dashboard →
        </Link>
      </div>

      <AgentGraph activeAgent={activeAgent} status={status} />

      <Card className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-4">
          <div className="flex flex-col gap-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Try: &quot;What&apos;s our refund policy?&quot;, &quot;Is checkout-service healthy?&quot;, &quot;Check
                status of TICKET-101&quot;
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" : "self-start rounded-lg bg-muted px-3 py-2 text-sm"}
              >
                <p>{m.text}</p>
                {m.agent && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary">ran: {m.agent}</Badge>
                    {m.traceUrl && (
                      <a
                        href={m.traceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 underline"
                      >
                        View trace ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask the agents..."
        />
        <Button onClick={handleSend} disabled={status === "running"}>
          {status === "running" ? "Running..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
