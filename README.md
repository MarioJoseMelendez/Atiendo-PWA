# Estante

Inventario y caja para una librería. Cada artículo es **individual** o **paquete** (con su tamaño), tiene su propio precio en quetzales, y se puede etiquetar con un QR. La caja cobra solo en efectivo, escaneando ese QR con la cámara.

Los datos se quedan en este navegador. No hay cuentas ni servidor de inventario.

## Cómo usarla

1. En **Inventario**, abre un grupo y revisa piezas sueltas y paquetes. El precio del paquete es el del paquete completo, no el de cada pieza.
2. En **Etiquetas**, elige un grupo —o todo el inventario— y pulsa **Imprimir etiquetas**. Debajo de cada QR va el nombre, si es pieza o paquete, el precio y el código.
3. En **Caja**, activa la cámara y apunta al QR. También puedes escribir el código (por ejemplo `PP-002`) o buscar por nombre. Luego **Cobrar en efectivo**, anota el billete y el cambio. La existencia baja al registrar la venta.

La primera vez carga un catálogo de ejemplo (novela, infantil, texto, papelería y revistas). Puedes editarlo o volver a ese catálogo desde el final del inventario.

## Instalarla desde Chrome

Estante es una PWA. En Chrome de escritorio:

1. Abre la app.
2. Pulsa el menú de los **tres puntos**.
3. Elige **Instalar Estante**.

Si no aparece a la primera, recarga la página: Chrome la ofrece cuando el manifiesto y el service worker ya están activos. En el teléfono el mismo menú dice **Instalar aplicación** o **Agregar a la pantalla principal**.

La cámara pide permiso y funciona en `localhost` o en un sitio `https`.

## Correrla en local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run lint
npm run build
```

Los iconos de la PWA se regeneran con `npm run icons`.
