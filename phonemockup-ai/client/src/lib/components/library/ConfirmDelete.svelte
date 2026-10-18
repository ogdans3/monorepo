<script lang="ts">
  import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
  } from "$lib/components/ui/alert-dialog";
  import { Button } from "$lib/components/ui/button";
  import { Trash2 } from "@lucide/svelte";
  let {
    open = $bindable(false),
    title,
    description,
    actionLabel = "Delete",
    busy = false,
    error = "",
    onconfirm,
    returnFocus,
  }: {
    open: boolean;
    title: string;
    description: string;
    actionLabel?: string;
    busy?: boolean;
    error?: string;
    onconfirm: () => void;
    returnFocus?: HTMLElement;
  } = $props();
  let cancelButton = $state<HTMLButtonElement | null>(null);
</script>

<AlertDialog
  {open}
  onOpenChange={(value) => {
    if (!busy) open = value;
  }}
>
  <AlertDialogContent
    class="app-dialog app-confirm-dialog"
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      cancelButton?.focus();
    }}
    onCloseAutoFocus={(event) => {
      event.preventDefault();
      if (returnFocus?.isConnected) returnFocus.focus();
      else
        (
          document.querySelector(
            "[data-library-new-project], [data-motion-chooser-trigger]",
          ) as HTMLElement | null
        )?.focus();
    }}
    escapeKeydownBehavior={busy ? "ignore" : "close"}
  >
    <div class="app-dialog-symbol"><Trash2 size={22} aria-hidden="true" /></div>
    <AlertDialogHeader
      ><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription
        >{description}</AlertDialogDescription
      ></AlertDialogHeader
    >
    {#if error}<p class="app-form-error" role="alert">{error}</p>{/if}
    <AlertDialogFooter
      ><AlertDialogCancel bind:ref={cancelButton} disabled={busy}
        >Keep it</AlertDialogCancel
      ><Button variant="destructive" disabled={busy} onclick={onconfirm}
        >{busy ? "Deleting…" : actionLabel}</Button
      ></AlertDialogFooter
    >
  </AlertDialogContent>
</AlertDialog>
