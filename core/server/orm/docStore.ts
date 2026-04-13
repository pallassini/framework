import { MemoryEngine } from "../../client/db/orm/engine";

/** Store process-wide per `ormDoc` (demo / staging; in prod: Postgres o sharding). */
export const ormDocStore = new MemoryEngine();
