import type { Metadata } from "next";
import { Etiquetas } from "@/components/etiquetas";

export const metadata: Metadata = {
  title: "Etiquetas",
};

export default function Page() {
  return <Etiquetas />;
}
