"use client";

import * as React from "react";
import { createPortal } from "react-dom";

interface VaultLayoutContextValue {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  treePanelOpen: boolean;
  toggleTreePanel: () => void;
  mobileTreeOpen: boolean;
  setMobileTreeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  headerSlotEl: HTMLDivElement | null;
  setHeaderSlotEl: (el: HTMLDivElement | null) => void;
  hasCustomHeader: boolean;
  registerCustomHeader: () => () => void;
}

const VaultLayoutContext = React.createContext<VaultLayoutContextValue | null>(
  null
);

const SIDEBAR_STORAGE_KEY = "myvault:sidebar-collapsed";
const TREE_STORAGE_KEY = "myvault:tree-panel-open";
const STORAGE_CHANGE_EVENT = "myvault:layout-pref-change";

function subscribeLayoutPrefs(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_CHANGE_EVENT, onStoreChange);
  };
}

function readBooleanPref(key: string, defaultValue: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === "1";
  } catch {
    return defaultValue;
  }
}

function writeBooleanPref(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
    window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
  } catch {
    // Ignore storage quota/access errors
  }
}

export function VaultLayoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarCollapsed = React.useSyncExternalStore(
    subscribeLayoutPrefs,
    () => readBooleanPref(SIDEBAR_STORAGE_KEY, false),
    () => false
  );

  const treePanelOpen = React.useSyncExternalStore(
    subscribeLayoutPrefs,
    () => readBooleanPref(TREE_STORAGE_KEY, true),
    () => true
  );

  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [mobileTreeOpen, setMobileTreeOpen] = React.useState(false);
  const [headerSlotEl, setHeaderSlotEl] = React.useState<HTMLDivElement | null>(
    null
  );
  const [customHeaderCount, setCustomHeaderCount] = React.useState(0);

  const toggleSidebar = React.useCallback(() => {
    const current = readBooleanPref(SIDEBAR_STORAGE_KEY, false);
    writeBooleanPref(SIDEBAR_STORAGE_KEY, !current);
  }, []);

  const toggleTreePanel = React.useCallback(() => {
    const current = readBooleanPref(TREE_STORAGE_KEY, true);
    writeBooleanPref(TREE_STORAGE_KEY, !current);
  }, []);

  const registerCustomHeader = React.useCallback(() => {
    setCustomHeaderCount((c) => c + 1);
    return () => setCustomHeaderCount((c) => Math.max(0, c - 1));
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "b" &&
        !inEditable
      ) {
        event.preventDefault();
        toggleSidebar();
      } else if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        toggleTreePanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar, toggleTreePanel]);

  const value: VaultLayoutContextValue = {
    sidebarCollapsed,
    toggleSidebar,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    treePanelOpen,
    toggleTreePanel,
    mobileTreeOpen,
    setMobileTreeOpen,
    headerSlotEl,
    setHeaderSlotEl,
    hasCustomHeader: customHeaderCount > 0,
    registerCustomHeader,
  };

  return (
    <VaultLayoutContext.Provider value={value}>
      {children}
    </VaultLayoutContext.Provider>
  );
}

export function useVaultLayout() {
  const ctx = React.useContext(VaultLayoutContext);
  if (!ctx) {
    throw new Error("useVaultLayout must be used within VaultLayoutProvider.");
  }
  return ctx;
}

/**
 * Portals route-specific left/right controls directly into the single unified top header.
 */
export function VaultPageHeader({
  left,
  right,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const { headerSlotEl, registerCustomHeader } = useVaultLayout();

  React.useEffect(() => registerCustomHeader(), [registerCustomHeader]);

  if (!headerSlotEl) return null;

  return createPortal(
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2">{left}</div>
      <div className="flex shrink-0 items-center gap-1.5">{right}</div>
    </>,
    headerSlotEl
  );
}
