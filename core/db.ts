
//SCHEMA
export {table} from "./db/schema/table";

// DB runtime + tipi (`./db` punterebbe a questo stesso file `db.ts`)
export * from "./db/index";

//VALIDATOR
export * from "./client/validator";