# Atiendo

Inventario, caja y chat para una librería. Cada artículo es **individual** o **paquete** (con su tamaño), tiene su propio precio en quetzales y su propio QR. La caja cobra solo en efectivo, escaneando ese QR con la cámara.

El inventario, las ventas, las claves de IA y los chats se guardan en una base local (`~/.local/share/atiendo/atiendo.json`, configurable con `ATIENDO_DB_PATH`). También hay una copia en el navegador para que la app siga funcionando sin conexión. La app no tiene un botón para borrar las claves ni la base local: sobreviven aunque borres los datos del navegador. El inventario se edita o se borra artículo por artículo. Los chats se pueden limpiar desde su propio botón. No hay cuentas.

## Cómo usarla

1. En **Chat**, arriba hablas del negocio y abajo agregas artículos al inventario. El chat de negocio conoce el inventario y las ventas actuales; el de inventario propone artículos y tú revisas antes de cargarlos.
2. En **Inventario**, abre un grupo y revisa piezas sueltas y paquetes. El precio del paquete es el del paquete completo, no el de cada pieza.
3. En **Etiquetas**, elige todo el inventario, un tipo o un producto, y descarga un PDF o un Word listo para imprimir. También puedes imprimir directo desde el navegador. Debajo de cada QR va el nombre, si es pieza o paquete, el precio y el código.
4. En **Caja**, activa la cámara y apunta al QR. También puedes escribir el código (por ejemplo `PP-002`) o buscar por nombre. Luego **Cobrar en efectivo**, anota el billete y el cambio. La existencia baja al registrar la venta.

La app arranca vacía. Carga tus productos desde el chat de inventario, desde **Claves y carga avanzada** o créalos uno por uno en **Inventario**.

## Chat

- **Hablar del negocio**: preguntas por ventas, precios, compras, márgenes o ideas. El asistente recibe un resumen del inventario, las existencias bajas, los agotados y las ventas guardadas. No modifica el inventario.
- **Agregar al inventario**: describes una lista o una factura y la IA devuelve un borrador. Revisas los artículos y pulsas **Cargar**. Los paquetes y los individuales se guardan como artículos separados.

Los mensajes se guardan en la base local y se recuperan al volver a abrir la app. Cada chat tiene su propio botón **Limpiar**.

## Etiquetas en PDF y Word

En **Etiquetas** puedes descargar:

- todo el inventario;
- un tipo o grupo;
- un producto concreto.

Cada paquete y cada individual aparecen como etiquetas separadas. El PDF y el Word incluyen el QR, el nombre, la presentación, el precio y el código. La descarga usa el inventario guardado en la base local.

## Claves de IA (OpenRouter y NVIDIA)

En **Claves y carga avanzada** (enlace desde **Chat**) puedes pegar una lista, una factura o describir el inventario. La IA lo convierte en artículos y tú revisas antes de cargarlos. Entiende el mismo producto en dos presentaciones, por ejemplo hoja suelta y ciento:

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

La cámara pide permiso y funciona en `localhost` o en un sitio `https`. Si Chrome bloquea la cámara, el escáner muestra un botón para abrir los ajustes del sitio y copia la dirección exacta por si Chrome no permite abrirla desde la página.

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
