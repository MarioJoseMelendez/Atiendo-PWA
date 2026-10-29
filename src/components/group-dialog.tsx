"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestPrefix } from "@/lib/inventory";
import type { Group } from "@/lib/types";

export function GroupDialog({
  open,
  group,
  takenPrefixes,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  group: Group | null;
  takenPrefixes: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (input: { name: string; prefix: string }, id?: string) => string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <GroupForm
          key={group?.id ?? "nuevo"}
          group={group}
          takenPrefixes={takenPrefixes}
          onOpenChange={onOpenChange}
          onSave={onSave}
        />
      ) : null}
    </Dialog>
  );
}

function GroupForm({
  group,
  takenPrefixes,
  onOpenChange,
  onSave,
}: {
  group: Group | null;
  takenPrefixes: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (input: { name: string; prefix: string }, id?: string) => string | null;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [prefix, setPrefix] = useState(group?.prefix ?? suggestPrefix("", takenPrefixes));
  const [prefixTouched, setPrefixTouched] = useState(Boolean(group));
  const [error, setError] = useState<string | null>(null);

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader className="pr-8">
        <DialogTitle className="font-heading text-lg">
          {group ? "Editar grupo" : "Nuevo grupo"}
        </DialogTitle>
        <DialogDescription>
          El prefijo arma el código de cada QR, por ejemplo PA-014. No cambia los códigos que ya
          imprimiste.
        </DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const message = onSave({ name, prefix }, group?.id);
          if (message) {
            setError(message);
            return;
          }
          onOpenChange(false);
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="group-name">Nombre</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(event) => {
              const next = event.target.value;
              setName(next);
              if (!prefixTouched) setPrefix(suggestPrefix(next, takenPrefixes));
            }}
            placeholder="Papelería"
            autoComplete="off"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="group-prefix">Prefijo</Label>
          <Input
            id="group-prefix"
            value={prefix}
            onChange={(event) => {
              setPrefixTouched(true);
              setPrefix(event.target.value.toUpperCase());
            }}
            maxLength={4}
            className="uppercase"
            autoComplete="off"
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" className="h-10">
            Guardar grupo
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
