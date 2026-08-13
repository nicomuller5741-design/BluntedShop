const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");

const products = {
  "Espejos Duke 200": 39999,
  "Arandelas anodizadas": 6999,
  "Manijas regulables Wirtz": 39900,
  "Cubre discos Wirtz": 18900
};

function shippingFromCoords(lat, lng) {
  if (lat >= -35.15 && lat <= -34.20 && lng >= -59.25 && lng <= -57.65)
    return { zone: "CABA / GBA", cost: 4500 };
  if (lat >= -41.20 && lat <= -33.00 && lng >= -63.60 && lng <= -56.50)
    return { zone: "Buenos Aires interior", cost: 6500 };
  return { zone: "Resto del país", cost: 8500 };
}

function shippingFromAddress(address = "") {
  const a = String(address).toLowerCase();
  if (/(caba|capital federal|ciudad autonoma de buenos aires|avellaneda|lanus|lomas de zamora|quilmes|moron|san justo|tigre|san isidro|vicente lopez|san martin|hurlingham|ituzaingo|merlo|la matanza|berazategui|florencio varela)/.test(a))
    return { zone: "CABA / GBA", cost: 4500 };
  if (/(buenos aires|bs\.?\s*as\.?|provincia de buenos aires)/.test(a))
    return { zone: "Buenos Aires interior", cost: 6500 };
  return { zone: "Resto del país", cost: 8500 };
}

function json(res, status, body) {
  res.writeHead(status, {"Content-Type":"application/json; charset=utf-8"});
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || "{}");
}

async function createPreference(req, res) {
  if (!ACCESS_TOKEN) {
    return json(res, 503, {error:"Mercado Pago todavía no está activado: falta configurar MP_ACCESS_TOKEN en el servidor."});
  }

  try {
    const data = await readJson(req);
    const unitPrice = products[data.product];
    if (!unitPrice) return json(res, 400, {error:"Producto no válido."});

    let ship;
    if (data.location && Number.isFinite(Number(data.location.lat)) && Number.isFinite(Number(data.location.lng))) {
      ship = shippingFromCoords(Number(data.location.lat), Number(data.location.lng));
    } else if (data.address && String(data.address).trim().length >= 8) {
      ship = shippingFromAddress(data.address);
    } else {
      return json(res, 400, {error:"Ingresá una dirección o compartí tu ubicación."});
    }

    const orderId = `BLUNTED-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

    const preference = {
      items: [
        {
          id: data.product.toLowerCase().replace(/\s+/g, "-"),
          title: data.product,
          quantity: 1,
          currency_id: "ARS",
          unit_price: unitPrice
        },
        {
          id: "envio",
          title: `Envío estimado - ${ship.zone}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: ship.cost
        }
      ],
      external_reference: orderId,
      statement_descriptor: "BLUNTEDSHOP",
      back_urls: {
        success: `${BASE_URL}/?status=approved`,
        pending: `${BASE_URL}/?status=pending`,
        failure: `${BASE_URL}/?status=failure`
      },
      metadata: {
        shipping_zone: ship.zone,
        shipping_address: String(data.address || ""),
        latitude: data.location?.lat || null,
        longitude: data.location?.lng || null
      }
    };

    // auto_return requires a valid public return URL. Enable it outside localhost.
    if (!BASE_URL.includes("localhost") && BASE_URL.startsWith("https://")) {
      preference.auto_return = "approved";
      preference.notification_url = `${BASE_URL}/api/mercadopago-webhook`;
    }

    const mp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": orderId
      },
      body: JSON.stringify(preference)
    });

    const result = await mp.json();
    if (!mp.ok) {
      console.error("Mercado Pago error:", result);
      return json(res, 502, {error:"Mercado Pago rechazó la creación del checkout. Revisá las credenciales/configuración."});
    }

    // Test credentials usually expose sandbox_init_point; production uses init_point.
    const checkoutUrl = result.init_point || result.sandbox_init_point;
    return json(res, 200, {
      checkout_url: checkoutUrl,
      preference_id: result.id,
      order_id: orderId
    });
  } catch (err) {
    console.error(err);
    return json(res, 500, {error:"Error interno al preparar el pago."});
  }
}

async function webhook(req, res) {
  // This endpoint acknowledges Mercado Pago notifications.
  // Before using it for automatic fulfillment, validate the webhook signature
  // and query the payment/order server-side with Mercado Pago.
  res.writeHead(200);
  res.end("ok");
}

const mime = {
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".svg":"image/svg+xml",
  ".ico":"image/x-icon"
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  if (req.method === "POST" && url.pathname === "/api/create-preference") return createPreference(req, res);
  if (req.method === "POST" && url.pathname === "/api/mercadopago-webhook") return webhook(req, res);

  let filePath = decodeURIComponent(url.pathname);
  if (filePath === "/") filePath = "/index.html";
  filePath = path.join(__dirname, filePath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404); return res.end("Not found");
    }
    res.writeHead(200, {"Content-Type": mime[path.extname(filePath)] || "application/octet-stream"});
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`BLUNTEDSHOP: ${BASE_URL}`);
  console.log(ACCESS_TOKEN ? "Mercado Pago: configurado" : "Mercado Pago: falta MP_ACCESS_TOKEN");
});
