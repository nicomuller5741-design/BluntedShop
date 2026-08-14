
const CONFIG = {
  whatsappNumber: "5491157418056", // Reemplazar por tu número real con código de país y área, sin + ni espacios.
  shipping: {
    amba: 4500,
    buenosAiresInterior: 6500,
    restoPais: 8500
  }
};

const money = n => new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", maximumFractionDigits: 0
}).format(n);

const modal = document.getElementById("checkoutModal");
const productEl = document.getElementById("checkoutProduct");
const priceEl = document.getElementById("checkoutPrice");
const shippingEl = document.getElementById("shippingCost");
const totalEl = document.getElementById("totalCost");
const addressEl = document.getElementById("address");
const geoStatus = document.getElementById("geoStatus");

let selectedProduct = null;
let selectedPrice = 0;
let selectedCoords = null;
let shipping = null;

let shippingZone = null;

function estimateShippingFromCoords(lat, lng) {
  // Zonas aproximadas para el prototipo.
  // AMBA: bounding box amplio alrededor de CABA y GBA.
  if (lat >= -35.15 && lat <= -34.20 && lng >= -59.25 && lng <= -57.65) {
    return { zone: "CABA / GBA", cost: CONFIG.shipping.amba };
  }
  // Provincia de Buenos Aires (aproximación por coordenadas).
  if (lat >= -41.20 && lat <= -33.00 && lng >= -63.60 && lng <= -56.50) {
    return { zone: "Buenos Aires interior", cost: CONFIG.shipping.buenosAiresInterior };
  }
  return { zone: "Resto del país", cost: CONFIG.shipping.restoPais };
}

function estimateShippingFromAddress(address) {
  const a = address.toLowerCase();
  if (/(caba|capital federal|ciudad autonoma de buenos aires|avellaneda|lanus|lomas de zamora|quilmes|moron|san justo|tigre|san isidro|vicente lopez|san martin|hurlingham|ituzaingo|merlo|la matanza|berazategui|florencio varela)/.test(a)) {
    return { zone: "CABA / GBA", cost: CONFIG.shipping.amba };
  }
  if (/(buenos aires|bs\.?\s*as\.?|provincia de buenos aires)/.test(a)) {
    return { zone: "Buenos Aires interior", cost: CONFIG.shipping.buenosAiresInterior };
  }
  return { zone: "Resto del país", cost: CONFIG.shipping.restoPais };
}

function updateShippingEstimate(result) {
  shippingZone = result.zone;
  shipping = result.cost;
  shippingEl.textContent = `${money(shipping)} · ${shippingZone}`;
  totalEl.textContent = money(selectedPrice + shipping);
}

function openCheckout(product, price) {
  selectedProduct = product;
  selectedPrice = Number(price);
  selectedCoords = null;
  shipping = null;
  shippingZone = null;
  addressEl.value = "";
  productEl.textContent = product;
  priceEl.textContent = money(selectedPrice);
  shippingEl.textContent = "A calcular";
  totalEl.textContent = "—";
  geoStatus.textContent = "También podés escribir tu dirección.";
  modal.showModal();
}

document.querySelectorAll(".priceBtn").forEach(btn => {
  btn.addEventListener("click", () => openCheckout(btn.dataset.product, btn.dataset.price));
});

document.querySelectorAll(".productTitle").forEach(title => {
  title.addEventListener("click", () => {
    openCheckout(title.dataset.product, title.dataset.price);
  });
});

document.getElementById("menuBtn").addEventListener("click", () => {
  document.getElementById("nav").classList.toggle("open");
});

document.getElementById("geoBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    geoStatus.textContent = "Tu navegador no permite ubicación. Ingresá tu dirección.";
    return;
  }

  geoStatus.textContent = "Buscando tu ubicación...";
  navigator.geolocation.getCurrentPosition(
    pos => {
      selectedCoords = {
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6)
      };
      geoStatus.textContent = "Ubicación detectada ✓";
      const estimate = estimateShippingFromCoords(
        pos.coords.latitude,
        pos.coords.longitude
      );
      updateShippingEstimate(estimate);
    },
    () => {
      geoStatus.textContent = "No pudimos acceder a tu ubicación. Ingresá tu dirección.";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

addressEl.addEventListener("input", () => {
  if (addressEl.value.trim().length >= 8) {
    const estimate = estimateShippingFromAddress(addressEl.value);
    updateShippingEstimate(estimate);
  } else {
    shipping = null;
    shippingZone = null;
    shippingEl.textContent = "A calcular";
    totalEl.textContent = "—";
  }
});

function waUrl(message) {
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

document.getElementById("continueWhatsApp").addEventListener("click", () => {
  const address = addressEl.value.trim();
  const locationText = selectedCoords
    ? `https://maps.google.com/?q=${selectedCoords.lat},${selectedCoords.lng}`
    : (address || "A coordinar");

  const shippingText = shipping === null ? "A confirmar" : `${money(shipping)} (${shippingZone})`;
  const totalText = shipping === null ? "A confirmar" : money(selectedPrice + shipping);

  const msg = `Hola, quiero comprar:
• ${selectedProduct} - ${money(selectedPrice)}

Ubicación / dirección:
${locationText}

Envío estimado: ${shippingText}
Total estimado: ${totalText}

¿Me confirmás disponibilidad, envío y forma de pago?`;

  window.open(waUrl(msg), "_blank", "noopener,noreferrer");
});

document.getElementById("whatsappFloat").addEventListener("click", () => {
  const msg = "Hola, necesito ayuda con una compra en BLUNTEDSHOP.";
  window.open(waUrl(msg), "_blank", "noopener,noreferrer");
});


// ---- Mercado Pago Checkout Pro ----
const paymentStatus = document.getElementById("paymentStatus");
const payMercadoPagoBtn = document.getElementById("payMercadoPago");

payMercadoPagoBtn.addEventListener("click", async () => {
  if (!selectedProduct || !selectedPrice) return;

  if (shipping === null) {
    paymentStatus.textContent = "Primero compartí tu ubicación o ingresá tu dirección para calcular el envío.";
    return;
  }

  const address = addressEl.value.trim();
  const location = selectedCoords
    ? { lat: Number(selectedCoords.lat), lng: Number(selectedCoords.lng) }
    : null;

  paymentStatus.textContent = "Preparando el pago seguro…";
  payMercadoPagoBtn.disabled = true;

  try {
    const response = await fetch("/api/create-preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: selectedProduct,
        address,
        location
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo iniciar el pago.");

    window.location.href = data.checkout_url;
  } catch (err) {
    paymentStatus.textContent = err.message + " Podés continuar por WhatsApp.";
    payMercadoPagoBtn.disabled = false;
  }
});

(function showPaymentReturnStatus(){
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  if (!status) return;
  const box = document.getElementById("paymentResult");
  box.hidden = false;
  if (status === "approved") {
    box.textContent = "✓ Pago aprobado. ¡Gracias por tu compra!";
  } else if (status === "pending") {
    box.textContent = "Tu pago quedó pendiente. Mercado Pago te informará cuando se acredite.";
  } else {
    box.textContent = "El pago no se completó. Podés intentarlo nuevamente.";
  }
})();
