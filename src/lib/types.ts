export type SaleKind = "individual" | "paquete";

export type Group = {
  id: string;
  name: string;
  prefix: string;
  nextSeq: number;
};

export type Product = {
  id: string;
  code: string;
  groupId: string;
  name: string;
  kind: SaleKind;
  packageSize: number | null;
  priceCents: number;
  stock: number;
};

export type SaleLine = {
  productId: string;
  code: string;
  name: string;
  kind: SaleKind;
  packageSize: number | null;
  unitCents: number;
  qty: number;
};

export type Sale = {
  id: string;
  at: string;
  dayKey: string;
  whenLabel: string;
  lines: SaleLine[];
  totalCents: number;
  tenderedCents: number;
  changeCents: number;
};

export type Store = {
  version: 1;
  groups: Group[];
  products: Product[];
  sales: Sale[];
};

export type CartLine = {
  productId: string;
  qty: number;
};

export type GroupInput = {
  name: string;
  prefix: string;
};

export type ProductInput = {
  groupId: string;
  name: string;
  kind: SaleKind;
  packageSize: number | null;
  priceCents: number;
  stock: number;
};

export type SaleMeta = {
  id: string;
  at: string;
  dayKey: string;
  whenLabel: string;
};
