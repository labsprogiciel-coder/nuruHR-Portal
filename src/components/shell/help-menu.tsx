"use client";

import { BookOpenIcon, CalendarHeartIcon, KeyboardIcon, LifeBuoyIcon } from "lucide-react";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { openOverlay } from "@/stores/overlay-store";

/** Shortcuts, policies and a way to reach HR. Lives in the sidebar header. */
export function HelpMenu() {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button size="icon" aria-label="Help">
              <Icon name="help" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Help</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" sideOffset={8} className="w-56">
        <DropdownMenuItem onSelect={() => openOverlay({ kind: "shortcuts" })}>
          <KeyboardIcon /> Keyboard shortcuts
          <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openOverlay({ kind: "policy" })}>
          <BookOpenIcon /> Leave policy
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openOverlay({ kind: "holidays" })}>
          <CalendarHeartIcon /> Holiday list
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => toast("Message sent to HR", { description: "Someone from People Ops will reply by email." })}
        >
          <LifeBuoyIcon /> Contact HR
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
