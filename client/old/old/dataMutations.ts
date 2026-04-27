import { server } from "client";

export async function loadAdminData() {
  const [ic, it, re, op, cl] = await Promise.all([
    server.user.itemCategory.get(),
    server.user.item.get({}),
    server.user.resource.get(),
    server.user.opening.get({ resourceId: undefined, itemId: undefined }),
    server.user.closures.get({}),
  ]);
  return {
    itemCategories: ic,
    items: it.items,
    resources: re.resources,
    openingHours: op.openingHours,
    closures: cl.closures,
  };
}

export type AdminData = Awaited<ReturnType<typeof loadAdminData>>;

export type AdminDataSignal = {
  (): AdminData | undefined;
  (updater: (prev: AdminData | undefined) => AdminData | undefined): void;
};

type RowWithId = { id: string };

export type AdminCollectionKey = {
  [K in keyof AdminData]: NonNullable<AdminData[K]> extends ReadonlyArray<RowWithId> ? K : never;
}[keyof AdminData];

export type AdminCollectionRow<K extends AdminCollectionKey> =
  NonNullable<AdminData[K]> extends ReadonlyArray<infer R> ? (R & RowWithId) : never;

function optimisticId(): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `optimistic_${Date.now()}_${r}`;
}

function updateCollection<K extends AdminCollectionKey>(
  store: AdminDataSignal,
  key: K,
  map: (rows: AdminCollectionRow<K>[]) => AdminCollectionRow<K>[],
): void {
  store((d) => {
    if (!d) return d;
    const current = (d[key] ?? []) as AdminCollectionRow<K>[];
    const next = map(current);
    return { ...d, [key]: next } as AdminData;
  });
}

function singularFromCollectionKey(key: string): string {
  return key.endsWith("s") ? key.slice(0, -1) : key;
}

export async function optimisticCreate<K extends AdminCollectionKey, TResult>(args: {
  store: AdminDataSignal;
  key: K;
  input: Omit<AdminCollectionRow<K>, "id"> & { id?: string };
  create: () => Promise<TResult>;
  pickCreated?: (result: TResult) => AdminCollectionRow<K> | undefined;
}): Promise<AdminCollectionRow<K> | undefined> {
  const { store, key, input, create } = args;
  const pickCreated =
    args.pickCreated ??
    ((result: TResult) => {
      const rows = (result as Record<string, unknown>)[key as string];
      if (!Array.isArray(rows)) return undefined;
      return rows[0] as AdminCollectionRow<K> | undefined;
    });
  const tempId = optimisticId();
  const optimistic = { ...(input as AdminCollectionRow<K>), id: tempId };

  updateCollection(store, key, (rows) => [...rows, optimistic]);

  try {
    const result = await create();
    const created = pickCreated(result);
    if (!created) {
      updateCollection(store, key, (rows) => rows.filter((r) => r.id !== tempId));
      return undefined;
    }
    updateCollection(store, key, (rows) => rows.map((r) => (r.id === tempId ? created : r)));
    return created;
  } catch (error) {
    updateCollection(store, key, (rows) => rows.filter((r) => r.id !== tempId));
    throw error;
  }
}

export async function optimisticCreateCall<K extends AdminCollectionKey, TResult>(
  store: AdminDataSignal,
  key: K,
  input: Omit<AdminCollectionRow<K>, "id"> & { id?: string },
  create: () => Promise<TResult>,
): Promise<AdminCollectionRow<K> | undefined> {
  return optimisticCreate({ store, key, input, create });
}

export async function optimisticPatch<K extends AdminCollectionKey, TPatch, TResult>(args: {
  store: AdminDataSignal;
  key: K;
  id: string;
  patch: TPatch;
  mergeOptimistic?: (row: AdminCollectionRow<K>, patch: TPatch) => AdminCollectionRow<K>;
  update: () => Promise<TResult>;
  pickUpdated?: (result: TResult) => AdminCollectionRow<K>;
}): Promise<AdminCollectionRow<K> | undefined> {
  const { store, key, id, patch, update, mergeOptimistic } = args;
  const pickUpdated =
    args.pickUpdated ??
    ((result: TResult) =>
      (result as Record<string, unknown>)[
        singularFromCollectionKey(key as string)
      ] as AdminCollectionRow<K>);
  let previous: AdminCollectionRow<K> | undefined;
  const merge =
    mergeOptimistic ??
    ((row: AdminCollectionRow<K>, p: TPatch) => ({ ...row, ...(p as object) }) as AdminCollectionRow<K>);

  updateCollection(store, key, (rows) =>
    rows.map((r) => {
      if (r.id !== id) return r;
      previous = r;
      return merge(r, patch);
    }),
  );

  try {
    const result = await update();
    const updated = pickUpdated(result);
    updateCollection(store, key, (rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
    return updated;
  } catch (error) {
    if (previous) {
      updateCollection(store, key, (rows) => rows.map((r) => (r.id === id ? previous! : r)));
    }
    throw error;
  }
}

export async function optimisticPatchCall<K extends AdminCollectionKey, TPatch, TResult>(
  store: AdminDataSignal,
  key: K,
  id: string,
  patch: TPatch,
  update: () => Promise<TResult>,
): Promise<AdminCollectionRow<K> | undefined> {
  return optimisticPatch({ store, key, id, patch, update });
}

export async function optimisticDeleteCall<K extends AdminCollectionKey>(
  store: AdminDataSignal,
  key: K,
  id: string,
  del: () => Promise<unknown>,
): Promise<void> {
  let previousRows: AdminCollectionRow<K>[] | undefined;
  store((d) => {
    if (!d) return d;
    const current = (d[key] ?? []) as unknown as AdminCollectionRow<K>[];
    previousRows = [...current];
    return {
      ...d,
      [key]: current.filter((r) => r.id !== id),
    } as AdminData;
  });
  try {
    await del();
  } catch (error) {
    if (previousRows) {
      store((d) => (d ? { ...d, [key]: previousRows! } as AdminData : d));
    }
    throw error;
  }
}

export function useAdminDataMutations(store: AdminDataSignal) {
  return {
    dataCreate: <K extends AdminCollectionKey, TResult>(
      key: K,
      input: Omit<AdminCollectionRow<K>, "id"> & { id?: string },
      create: () => Promise<TResult>,
    ) => optimisticCreateCall(store, key, input, create),
    dataUpdate: <K extends AdminCollectionKey, TPatch, TResult>(
      key: K,
      id: string,
      patch: TPatch,
      update: () => Promise<TResult>,
    ) => optimisticPatchCall(store, key, id, patch, update),
    dataDelete: <K extends AdminCollectionKey>(key: K, id: string, del: () => Promise<unknown>) =>
      optimisticDeleteCall(store, key, id, del),
  };
}

