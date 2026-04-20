import type { ServerTables } from "db";

export type Booking = ServerTables["bookings"];
export type Closure = ServerTables["closures"];
export type Item = ServerTables["items"];
export type Resource = ServerTables["resources"];
export type Promotion = ServerTables["promotions"];
export type OpeningHour = ServerTables["openingHours"];
export type User = ServerTables["users"];

export const users: User[] = [
  {
    id: "usr_01",
    email: "mario.rossi@example.com",
    password: "hashed-pw",
    username: "mario",
    role: "user",
  },
  {
    id: "usr_02",
    email: "lucia.bianchi@example.com",
    password: "hashed-pw",
    username: "lucia",
    role: "user",
  },
  {
    id: "usr_03",
    email: "admin@example.com",
    password: "hashed-pw",
    username: "admin",
    role: "admin",
  },
];

export const resources: Resource[] = [
  {
    id: "res_luisa",
    name: "Luisa",
    kind: "operator",
    capacity: 1,
    description: "Estetista senior",
    active: true,
    others: {},
  },
  {
    id: "res_giulia",
    name: "Giulia",
    kind: "operator",
    capacity: 1,
    description: "Estetista junior",
    active: true,
    others: {},
  },
  {
    id: "res_sala_yoga",
    name: "Sala yoga",
    kind: "room",
    capacity: 12,
    description: "Sala al primo piano",
    active: true,
    others: {},
  },
  {
    id: "res_tavolo_7",
    name: "Tavolo 7",
    kind: "table",
    capacity: 4,
    description: undefined,
    active: true,
    others: {},
  },
];

export const items: Item[] = [
  {
    id: "itm_manicure",
    name: "Manicure",
    description: "Manicure classica",
    price: 25,
    duration: 45,
    resources: ["res_luisa", "res_giulia"],
    relations: undefined,
    standalone: true,
    active: true,
  },
  {
    id: "itm_pedicure",
    name: "Pedicure",
    description: "Pedicure estetica",
    price: 30,
    duration: 50,
    resources: ["res_luisa", "res_giulia"],
    relations: undefined,
    standalone: true,
    active: true,
  },
  {
    id: "itm_pack_mani_pedi",
    name: "Pack Manicure + Pedicure",
    description: "Pacchetto completo mani e piedi",
    price: 50,
    duration: 90,
    resources: ["res_luisa", "res_giulia"],
    relations: [
      { itemId: "itm_manicure", kind: "component" },
      { itemId: "itm_pedicure", kind: "component" },
    ],
    standalone: true,
    active: true,
  },
  {
    id: "itm_yoga_class",
    name: "Lezione Yoga",
    description: "Classe di yoga 60min",
    price: 15,
    duration: 60,
    resources: ["res_sala_yoga"],
    relations: undefined,
    standalone: true,
    active: true,
  },
];

export const promotions: Promotion[] = [
  {
    id: "promo_combo_mani_pedi",
    name: "Combo mani+piedi -10%",
    description: "Sconto se prenoti insieme manicure e pedicure",
    kind: "combo",
    requiredItems: ["itm_manicure", "itm_pedicure"],
    minQuantity: undefined,
    minAmount: undefined,
    discountPercent: 10,
    discountAmount: undefined,
    validFrom: undefined,
    validTo: undefined,
    dayOfWeek: undefined,
    startTime: undefined,
    endTime: undefined,
    priority: 10,
    stackable: false,
    active: true,
  },
  {
    id: "promo_happy_hour",
    name: "Happy hour yoga",
    description: undefined,
    kind: "timeWindow",
    requiredItems: undefined,
    minQuantity: undefined,
    minAmount: undefined,
    discountPercent: 20,
    discountAmount: undefined,
    validFrom: undefined,
    validTo: undefined,
    dayOfWeek: "wednesday",
    startTime: "14:00",
    endTime: "16:00",
    priority: 5,
    stackable: true,
    active: true,
  },
];

export const openingHours: OpeningHour[] = [
  {
    id: "oh_mon",
    resourceId: undefined,
    dayOfWeek: "monday",
    startTime: "09:00",
    endTime: "19:00",
    validFrom: undefined,
    validTo: undefined,
  },
  {
    id: "oh_tue",
    resourceId: undefined,
    dayOfWeek: "tuesday",
    startTime: "09:00",
    endTime: "19:00",
    validFrom: undefined,
    validTo: undefined,
  },
  {
    id: "oh_wed",
    resourceId: undefined,
    dayOfWeek: "wednesday",
    startTime: "09:00",
    endTime: "19:00",
    validFrom: undefined,
    validTo: undefined,
  },
  {
    id: "oh_luisa_thu",
    resourceId: "res_luisa",
    dayOfWeek: "thursday",
    startTime: "10:00",
    endTime: "14:00",
    validFrom: undefined,
    validTo: undefined,
  },
];

export const closures: Closure[] = [
  {
    id: "cls_ferie_agosto",
    resourceId: undefined,
    startAt: new Date("2026-08-10T00:00:00.000Z"),
    endAt: new Date("2026-08-20T23:59:59.000Z"),
  },
  {
    id: "cls_luisa_off",
    resourceId: "res_luisa",
    startAt: new Date("2026-04-22T00:00:00.000Z"),
    endAt: new Date("2026-04-23T23:59:59.000Z"),
  },
];

export const bookings: Booking[] = [
  {
    id: "bkg_01",
    customerId: "usr_01",
    startAt: new Date("2026-04-21T09:00:00.000Z"),
    endAt: new Date("2026-04-21T09:45:00.000Z"),
    status: "confirmed",
    items: [{ itemId: "itm_manicure", price: 25 }],
    assignments: ["res_luisa"],
    promotionId: undefined,
    others: {},
  },
  {
    id: "bkg_02",
    customerId: "usr_02",
    startAt: new Date("2026-04-21T10:00:00.000Z"),
    endAt: new Date("2026-04-21T11:30:00.000Z"),
    status: "confirmed",
    items: [
      { itemId: "itm_manicure", price: 25 },
      { itemId: "itm_pedicure", price: 30 },
    ],
    assignments: ["res_giulia"],
    promotionId: "promo_combo_mani_pedi",
    others: {},
  },
  {
    id: "bkg_03",
    customerId: undefined,
    startAt: new Date("2026-04-22T14:00:00.000Z"),
    endAt: new Date("2026-04-22T15:00:00.000Z"),
    status: "pending",
    items: [{ itemId: "itm_yoga_class", price: 15 }],
    assignments: ["res_sala_yoga"],
    promotionId: "promo_happy_hour",
    others: {},
  },
  {
    id: "bkg_04",
    customerId: "usr_01",
    startAt: new Date("2026-04-19T16:00:00.000Z"),
    endAt: new Date("2026-04-19T17:30:00.000Z"),
    status: "done",
    items: [{ itemId: "itm_pack_mani_pedi", price: 50 }],
    assignments: ["res_luisa"],
    promotionId: undefined,
    others: {},
  },
  {
    id: "bkg_05",
    customerId: "usr_02",
    startAt: new Date("2026-04-23T11:00:00.000Z"),
    endAt: new Date("2026-04-23T11:45:00.000Z"),
    status: "cancelled",
    items: [{ itemId: "itm_pedicure", price: 30 }],
    assignments: undefined,
    promotionId: undefined,
    others: {},
  },
];
