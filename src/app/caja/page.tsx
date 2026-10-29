import type { Metadata } from "next";
import { Caja } from "@/components/caja";

export const metadata: Metadata = {
  title: "Caja",
};

export default function Page() {
  return <Caja />;
}
