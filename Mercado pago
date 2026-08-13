# BLUNTEDSHOP — web con Mercado Pago Checkout Pro

La integración ya está preparada para crear una preferencia de pago en el backend y enviar al comprador a Checkout Pro de Mercado Pago.

## Activación

1. Creá/abrí tu aplicación en Mercado Pago > Tus integraciones.
2. Copiá primero un **Access Token de prueba**.
3. En el servidor configurá la variable:
   `MP_ACCESS_TOKEN=TU_ACCESS_TOKEN`
4. Configurá:
   `BASE_URL=https://tu-dominio.com.ar`
5. Iniciá la tienda:
   `npm start`

**No pongas el Access Token dentro de `app.js`, `index.html` ni en ningún archivo público.**

## Prueba local

En macOS/Linux:
`MP_ACCESS_TOKEN="TU_TOKEN_DE_PRUEBA" BASE_URL="http://localhost:3000" npm start`

Luego abrí:
`http://localhost:3000`

En producción usá HTTPS y las credenciales productivas.

## Flujo actual

Producto → ubicación/dirección → envío estimado → **Pagar con Mercado Pago** → Checkout Pro → retorno a BLUNTEDSHOP.

Precios del servidor:
- Espejos Duke 200: $39.999
- Arandelas anodizadas: $6.999
- Manijas regulables Wirtz: $39.900
- Cubre discos Wirtz: $18.900

Envío aproximado:
- CABA / GBA: $4.500
- Buenos Aires interior: $6.500
- Resto del país: $8.500

También queda disponible la compra/consulta por WhatsApp.

## Importante antes de despachar automáticamente

El endpoint `/api/mercadopago-webhook` ya existe para recibir notificaciones, pero **no marca pedidos como pagados ni dispara despachos automáticamente**. Para eso hay que validar la firma del webhook y verificar el pago server-side con Mercado Pago antes de entregar mercadería.
