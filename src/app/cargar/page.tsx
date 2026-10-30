import type { Metadata } from "next";
import { Cargar } from "@/components/cargar";

export const metadata: Metadata = {
  title: "Carga rápida",
};

export default function Page() {
  return <Cargar />;
}
