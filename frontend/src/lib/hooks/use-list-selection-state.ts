"use client";

import { useCallback, useRef, useState } from "react";
import { formatApiError } from "@/lib/api";

export type ListLoadResult<TItem> =
  | {
      readonly ok: true;
      readonly items: readonly TItem[];
    }
  | {
      readonly ok: false;
    };

type ListLoadOptions = {
  readonly preserveSelectionOnError?: boolean;
};

type ReplaceItemsOptions<TId> = {
  readonly preferredSelectedId?: TId;
};

type UseListSelectionStateOptions<TItem, TId extends string | number> = {
  readonly getId: (item: TItem) => TId;
  readonly onSelectionChange?: (selectedId: TId | undefined) => void;
};

const hasItem = <TItem, TId extends string | number>(
  items: readonly TItem[],
  getId: (item: TItem) => TId,
  id: TId | undefined,
) => id !== undefined && items.some((item) => getId(item) === id);

export const useListSelectionState = <
  TItem,
  TId extends string | number,
>({
  getId,
  onSelectionChange,
}: UseListSelectionStateOptions<TItem, TId>) => {
  const [items, setItems] = useState<readonly TItem[]>([]);
  const [selectedId, setSelectedIdState] = useState<TId>();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const selectedIdRef = useRef<TId>();
  const requestIdRef = useRef(0);

  const selectId = useCallback(
    (nextSelectedId: TId | undefined) => {
      if (selectedIdRef.current === nextSelectedId) {
        return;
      }

      selectedIdRef.current = nextSelectedId;
      setSelectedIdState(nextSelectedId);
      onSelectionChange?.(nextSelectedId);
    },
    [onSelectionChange],
  );

  const replaceItems = useCallback(
    (nextItems: readonly TItem[], options: ReplaceItemsOptions<TId> = {}) => {
      setItems(nextItems);

      const current = selectedIdRef.current;
      const preferred = options.preferredSelectedId;
      const firstItem = nextItems[0];
      const nextSelectedId = hasItem(nextItems, getId, preferred)
        ? preferred
        : hasItem(nextItems, getId, current)
          ? current
          : firstItem === undefined
            ? undefined
            : getId(firstItem);

      selectId(nextSelectedId);
    },
    [getId, selectId],
  );

  const clearItems = useCallback(() => {
    setItems([]);
    selectId(undefined);
  }, [selectId]);

  const loadItems = useCallback(
    async (
      fetchItems: () => Promise<readonly TItem[]>,
      options: ListLoadOptions = {},
    ): Promise<ListLoadResult<TItem>> => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsLoading(true);
      setError("");

      try {
        const nextItems = await fetchItems();
        if (requestIdRef.current !== requestId) {
          return { ok: false };
        }

        replaceItems(nextItems);
        return { ok: true, items: nextItems };
      } catch (loadError) {
        if (requestIdRef.current !== requestId) {
          return { ok: false };
        }

        setError(formatApiError(loadError));
        if (!options.preserveSelectionOnError) {
          clearItems();
        }
        return { ok: false };
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [clearItems, replaceItems],
  );

  return {
    clearItems,
    error,
    isLoading,
    items,
    loadItems,
    replaceItems,
    selectedId,
    selectedIdRef,
    selectedItem: items.find((item) => getId(item) === selectedId),
    selectId,
    setError,
  } as const;
};
