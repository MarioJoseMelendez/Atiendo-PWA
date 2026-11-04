import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atiendo",
    short_name: "Atiendo",
    description: "Inventario, etiquetas QR, caja y chat para tu negocio.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#f3ead7",
    theme_color: "#173328",
    lang: "es",
    dir: "ltr",
    orientation: "any",
    categories: ["business", "shopping"],
    prefer_related_applications: false,
    shortcuts: [
      {
        name: "Chat",
        short_name: "Chat",
        description: "Hablar del negocio o agregar productos",
        url: "/chat",
      },
      {
        name: "Caja",
        short_name: "Caja",
        description: "Cobrar en efectivo",
        url: "/caja",
      },
      {
        name: "Etiquetas",
        short_name: "Etiquetas",
        description: "Descargar o imprimir QRs",
        url: "/etiquetas",
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
