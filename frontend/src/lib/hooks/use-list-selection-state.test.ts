import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useListSelectionState } from "./use-list-selection-state";

type ListItem = {
  readonly id: number;
  readonly name: string;
};

const firstItem: ListItem = { id: 1, name: "first" };
const secondItem: ListItem = { id: 2, name: "second" };

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve } as const;
};

describe("useListSelectionState", () => {
  it("一覧ロード成功時に先頭行を選択し、選択中IDが残る場合は維持する", async () => {
    const { result } = renderHook(() =>
      useListSelectionState<ListItem, number>({ getId: (item) => item.id }),
    );

    await act(async () => {
      await result.current.loadItems(async () => [firstItem, secondItem]);
    });

    expect(result.current.selectedId).toBe(1);

    act(() => result.current.selectId(2));

    await act(async () => {
      await result.current.loadItems(async () => [firstItem, secondItem]);
    });

    expect(result.current.selectedId).toBe(2);
  });

  it("選択中IDが一覧から消えたら先頭行へ切り替え、空一覧なら選択解除する", async () => {
    const { result } = renderHook(() =>
      useListSelectionState<ListItem, number>({ getId: (item) => item.id }),
    );

    await act(async () => {
      await result.current.loadItems(async () => [firstItem, secondItem]);
    });
    act(() => result.current.selectId(2));

    await act(async () => {
      await result.current.loadItems(async () => [firstItem]);
    });

    expect(result.current.selectedId).toBe(1);

    await act(async () => {
      await result.current.loadItems(async () => []);
    });

    expect(result.current.selectedId).toBeUndefined();
  });

  it("古い一覧ロードのAPI応答が後から返っても現在の一覧と選択状態を上書きしない", async () => {
    const oldLoad = deferred<readonly ListItem[]>();
    const newLoad = deferred<readonly ListItem[]>();
    const { result } = renderHook(() =>
      useListSelectionState<ListItem, number>({ getId: (item) => item.id }),
    );

    let oldResult: unknown;
    let newResult: unknown;
    await act(async () => {
      void result.current.loadItems(() => oldLoad.promise).then((loadResult) => {
        oldResult = loadResult;
      });
      void result.current.loadItems(() => newLoad.promise).then((loadResult) => {
        newResult = loadResult;
      });
    });

    await act(async () => {
      newLoad.resolve([secondItem]);
      await newLoad.promise;
    });

    expect(result.current.items).toEqual([secondItem]);
    expect(result.current.selectedId).toBe(2);

    await act(async () => {
      oldLoad.resolve([firstItem]);
      await oldLoad.promise;
    });

    expect(result.current.items).toEqual([secondItem]);
    expect(result.current.selectedId).toBe(2);
    expect(oldResult).toEqual({ ok: false });
    expect(newResult).toEqual({ ok: true, items: [secondItem] });
  });
});
