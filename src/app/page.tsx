import type { Metadata } from "next";
import { Inventario } from "@/components/inventario";

export const metadata: Metadata = {
  title: "Inventario · Atiendo",
};

export default function Page() {
  return <Inventario />;
}
