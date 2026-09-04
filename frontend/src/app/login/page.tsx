"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (username === "admin" && password === "admin") {
      document.cookie = "meridian_auth=1; path=/; max-age=86400";
      router.push("/");
    } else {
      setError("Incorrect username or password.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-serif text-2xl font-semibold text-primary-foreground">Meridian</span>
          <div className="mx-auto mt-2 h-px w-9 bg-primary-foreground/40" />
          <p className="mt-2 text-sm text-primary-foreground/70">Claims adjudication</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-sm bg-card p-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="mt-2">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
