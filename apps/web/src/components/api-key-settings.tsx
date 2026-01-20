import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearApiKey, getApiKey, setApiKey } from "@/utils/orpc";

export function ApiKeySettings() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const hasKey = !!getApiKey();

  function handleSave() {
    if (!key.trim()) {
      toast.error("API key cannot be empty");
      return;
    }
    setApiKey(key.trim());
    setKey("");
    setOpen(false);
    toast.success("API key saved");
  }

  function handleClear() {
    clearApiKey();
    setKey("");
    setOpen(false);
    toast.success("API key cleared");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />}>
        <KeyRound className={hasKey ? "text-green-500" : "text-muted-foreground"} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API Key</DialogTitle>
          <DialogDescription>
            Enter your API key to enable mutations (create, delete, etc).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder={hasKey ? "••••••••" : "Enter API key"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
        </div>
        <DialogFooter>
          {hasKey && (
            <Button variant="outline" onClick={handleClear}>
              Clear
            </Button>
          )}
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
