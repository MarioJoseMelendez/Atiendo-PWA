# Atiendo

Inventario y caja para una librería. Cada artículo es **individual** o **paquete** (con su tamaño), tiene su propio precio en quetzales, y se puede etiquetar con un QR. La caja cobra solo en efectivo, escaneando ese QR con la cámara.

El inventario, las ventas y las claves de IA se guardan en una base local (`~/.local/share/atiendo/atiendo.json`, configurable con `ATIENDO_DB_PATH`). También hay una copia en el navegador para que la app siga funcionando sin conexión. La app no tiene un botón para borrar las claves ni la base local: sobreviven aunque borres los datos del navegador. El inventario se edita o se borra artículo por artículo. No hay cuentas.

## Cómo usarla

1. En **Carga IA**, pega una lista o describe tu inventario y revisa lo que la IA entendió antes de cargarlo.
2. En **Inventario**, abre un grupo y revisa piezas sueltas y paquetes. El precio del paquete es el del paquete completo, no el de cada pieza.
3. En **Etiquetas**, elige un grupo —o todo el inventario— y pulsa **Imprimir etiquetas**. Debajo de cada QR va el nombre, si es pieza o paquete, el precio y el código.
4. En **Caja**, activa la cámara y apunta al QR. También puedes escribir el código (por ejemplo `PP-002`) o buscar por nombre. Luego **Cobrar en efectivo**, anota el billete y el cambio. La existencia baja al registrar la venta.

La app arranca vacía. Carga tus productos desde **Carga IA** o créalos uno por uno en **Inventario**.

## Carga rápida con IA (OpenRouter y NVIDIA)

En **Carga IA** puedes pegar una lista, una factura o describir el inventario. La IA lo convierte en artículos y tú revisas antes de cargarlos. Entiende el mismo producto en dos presentaciones, por ejemplo hoja suelta y ciento:

> Hoja carta: la hoja a Q0.25 y el ciento a Q20. Tengo 300 hojas sueltas y 5 cientos.

Puedes usar una clave de [OpenRouter](https://openrouter.ai/keys) o de [build.nvidia.com](https://build.nvidia.com). Si tienes las dos, la app usa la que elijas como preferida y la otra como respaldo; si solo tienes una, usa esa. Las claves se guardan en la base local de la app y no se borran desde la interfaz. También puedes definirlas en `.env.local`:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
NVIDIA_API_KEY=nvapi-...
# opcionales
OPENROUTER_MODEL=openrouter/auto
NVIDIA_MODEL=nvidia/llama-3.1-nemotron-70b-instruct
```

## Instalarla desde Chrome

Atiendo es una PWA. En Chrome de escritorio:

1. Abre la app.
2. Pulsa el menú de los **tres puntos**.
3. Elige **Instalar Atiendo**.

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
