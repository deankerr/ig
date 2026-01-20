import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function JsonViewer({
  data,
  maxHeight = "400px",
  className,
}: {
  data: unknown;
  maxHeight?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("relative rounded border bg-muted/50", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-2 top-2 h-7 w-7 p-0"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <ScrollArea style={{ maxHeight }}>
        <pre className="p-4 text-sm">
          <code>{json}</code>
        </pre>
      </ScrollArea>
    </div>
  );
}
