// ================== CART LOGIC ==================
const CART_KEY = "gwDiningCart";

// ---------- Cart helpers ----------
function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error loading cart:", e);
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function getCartCount(cart) {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function getCartTotal(cart) {
  return cart.reduce((sum, item) => sum + item.qty * item.price, 0);
}

function formatMoney(num) {
  return `$${num.toFixed(2)}`;
}

// update badge (supports either #cart-count or .cart-count-badge)
function updateCartCountDisplay() {
  const cart = loadCart();
  const count = getCartCount(cart);

  const idBadge = document.getElementById("cart-count");
  if (idBadge) idBadge.textContent = count;

  const classBadge = document.querySelector(".cart-count-badge");
  if (classBadge) classBadge.textContent = count;
}

function addToCart(name, price) {
  const cart = loadCart();
  const existing = cart.find((i) => i.name === name);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, price: Number(price), qty: 1 });
  }
  saveCart(cart);
  updateCartCountDisplay();
  renderCartPanel();
}

function updateItemQty(name, delta) {
  const cart = loadCart();
  const item = cart.find((i) => i.name === name);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    const idx = cart.indexOf(item);
    if (idx !== -1) cart.splice(idx, 1);
  }
  saveCart(cart);
  updateCartCountDisplay();
  renderCartPanel();
}

function removeItem(name) {
  const cart = loadCart();
  const filtered = cart.filter((i) => i.name !== name);
  saveCart(filtered);
  updateCartCountDisplay();
  renderCartPanel();
}

function clearCart() {
  saveCart([]);
  updateCartCountDisplay();
  renderCartPanel();
  resetCheckoutUI();
}

// ================== CART OFFCANVAS RENDERING ==================

let currentOrderMode = null; // "dinein" or "pickup"

function generateTicketNumber(prefix) {
  const base = Date.now().toString().slice(-4);
  const rand = Math.floor(Math.random() * 90 + 10); // 10–99
  return `${prefix}${base}${rand}`;
}

// main render of items + summary
function renderCartPanel() {
  const cart = loadCart();
  const itemsContainer = document.getElementById("cartItemsContainer");
  const summaryEl = document.getElementById("cartSummary");
  const itemCountEl = document.getElementById("cartItemCount");
  const totalAmountEl = document.getElementById("cartTotalAmount");

  if (!itemsContainer) return; // not on this page

  if (!cart.length) {
    itemsContainer.innerHTML =
      '<p class="text-muted mb-0">Your cart is empty. Add some items from the menu.</p>';
    if (summaryEl) summaryEl.innerHTML = "";
    if (itemCountEl) itemCountEl.textContent = "0";
    if (totalAmountEl) totalAmountEl.textContent = "$0.00";

    const modeContentEl = document.getElementById("cartModeContent");
    if (modeContentEl) {
      modeContentEl.innerHTML =
        '<p class="text-muted mb-0">Select items to see dine-in or pickup options.</p>';
    }
    resetCheckoutUI();
    return;
  }

  // Build items list with qty controls
  itemsContainer.innerHTML = cart
    .map((item) => {
      const lineTotal = item.qty * item.price;
      return `
        <div class="cart-item d-flex justify-content-between align-items-center mb-3">
          <div class="me-2">
            <div class="fw-semibold">${item.name}</div>
            <div class="small text-muted">${formatMoney(item.price)} each</div>
          </div>
          <div class="text-end">
            <div class="btn-group btn-group-sm mb-1" role="group" aria-label="Quantity">
              <button
                type="button"
                class="btn btn-outline-secondary cart-qty-minus"
                data-name="${item.name}"
              >-</button>
              <span class="px-2 align-self-center">${item.qty}</span>
              <button
                type="button"
                class="btn btn-outline-secondary cart-qty-plus"
                data-name="${item.name}"
              >+</button>
            </div>
            <div class="fw-semibold">${formatMoney(lineTotal)}</div>
            <button
              type="button"
              class="btn btn-link btn-sm text-danger p-0 cart-remove"
              data-name="${item.name}"
            >
              Remove
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  // Summary
  const total = getCartTotal(cart);
  const count = getCartCount(cart);

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="d-flex justify-content-between">
        <span>Items:</span>
        <span>${count}</span>
      </div>
      <div class="d-flex justify-content-between fw-semibold mt-1">
        <span>Order Total:</span>
        <span>${formatMoney(total)}</span>
      </div>

      <!-- Delivery partners -->
      <div class="mt-3">
        <p class="small text-muted mb-1">Order with</p>
        <div class="d-flex flex-wrap gap-2">
          <a href="https://www.ubereats.com/" target="_blank" rel="noopener"
             class="btn btn-outline-secondary btn-sm">
            Uber Eats
          </a>
          <a href="https://www.doordash.com/" target="_blank" rel="noopener"
             class="btn btn-outline-secondary btn-sm">
            DoorDash
          </a>
          <a href="https://www.grubhub.com/" target="_blank" rel="noopener"
             class="btn btn-outline-secondary btn-sm">
            Grubhub
          </a>
          <a href="https://www.lyft.com/delivery" target="_blank" rel="noopener"
             class="btn btn-outline-secondary btn-sm">
            Lyft Delivery
          </a>
        </div>
      </div>
    `;
  }

  if (itemCountEl) itemCountEl.textContent = count;
  if (totalAmountEl) totalAmountEl.textContent = formatMoney(total);

  const modeContentEl = document.getElementById("cartModeContent");
  if (modeContentEl) {
    modeContentEl.innerHTML =
      '<p class="small text-muted mb-0">Choose <strong>Dine In</strong> or <strong>Pickup</strong> above, then click <strong>Proceed to checkout</strong>.</p>';
  }

  // also reset previous tickets/payment when cart changes
  resetCheckoutUI();
}

// Reset ticket / payment UI
function resetCheckoutUI() {
  const modeContentEl = document.getElementById("cartModeContent");
  if (modeContentEl && loadCart().length) {
    modeContentEl.innerHTML =
      '<p class="small text-muted mb-0">Choose <strong>Dine In</strong> or <strong>Pickup</strong> above, then click <strong>Proceed to checkout</strong>.</p>';
  }

  const dinePanel = document.getElementById("dineInTicketPanel");
  const pickupPanel = document.getElementById("pickupPaymentPanel");
  const pickupTicket = document.getElementById("pickupTicketPanel");
  if (dinePanel) dinePanel.classList.add("d-none");
  if (pickupPanel) pickupPanel.classList.add("d-none");
  if (pickupTicket) pickupTicket.classList.add("d-none");
}

// When user clicks "Proceed to checkout"
function handleCheckout() {
  const cart = loadCart();
  if (!cart.length) {
    alert("Your cart is empty.");
    return;
  }
  if (!currentOrderMode) {
    alert("Please select Dine In or Pickup first.");
    return;
  }

  const total = getCartTotal(cart);
  const ticketNumber =
    currentOrderMode === "dinein"
      ? generateTicketNumber("D")
      : generateTicketNumber("P");

  const modeContentEl = document.getElementById("cartModeContent");

  if (currentOrderMode === "dinein") {
    // Dine-in: just show ticket
    if (modeContentEl) {
      modeContentEl.innerHTML = `
        <div class="border rounded p-3 bg-light text-start">
          <p class="text-uppercase small text-muted mb-1">Dine-In Ticket</p>
          <p class="h3 fw-bold mb-1">${ticketNumber}</p>
          <p class="small mb-3">
            Show this ticket number at the cashier to complete payment and receive your order.
          </p>
          <p class="small mb-1">
            <span class="fw-semibold">Order total:</span> ${formatMoney(total)}
          </p>
          <p class="small text-muted mb-0">
            You may also use this ticket as your reference if paying through the campus
            online payment portal.
          </p>
        </div>
      `;
    }

    const dinePanel = document.getElementById("dineInTicketPanel");
    const codeEl = document.getElementById("dineInTicketCode");
    const totalEl = document.getElementById("dineInTicketTotal");
    if (dinePanel && codeEl && totalEl) {
      codeEl.textContent = ticketNumber;
      totalEl.textContent = formatMoney(total);
      dinePanel.classList.remove("d-none");
    }
  } else {
    // Pickup: payment form + ticket
    if (modeContentEl) {
      modeContentEl.innerHTML = `
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <h6 class="text-uppercase text-muted mb-2">Pickup payment</h6>
            <p class="small text-muted">
              Enter your card details to pay online and receive a pickup ticket.
            </p>

            <div class="mb-2">
              <label class="form-label form-label-sm">Name on card</label>
              <input type="text" class="form-control form-control-sm" id="cardName">
            </div>
            <div class="mb-2">
              <label class="form-label form-label-sm">Card number</label>
              <input type="text" class="form-control form-control-sm" id="cardNumber" placeholder="•••• •••• •••• ••••">
            </div>
            <div class="row g-2 mb-3">
              <div class="col-6">
                <label class="form-label form-label-sm">Expiry</label>
                <input type="text" class="form-control form-control-sm" id="cardExpiry" placeholder="MM/YY">
              </div>
              <div class="col-6">
                <label class="form-label form-label-sm">CVV</label>
                <input type="password" class="form-control form-control-sm" id="cardCvv" placeholder="•••">
              </div>
            </div>

            <button class="btn btn-primary w-100 mb-3" id="pickupPayBtn">
              Pay &amp; Get Pickup Ticket
            </button>

            <div id="pickupTicketArea" class="border-top pt-3 d-none">
              <h6 class="text-uppercase text-muted mb-2">Pickup ticket</h6>
              <p class="mb-1 fw-bold fs-5" id="pickupTicketCode">${ticketNumber}</p>
              <p class="mb-0">
                <strong>Order total:</strong> ${formatMoney(total)}
              </p>
              <p class="mt-2 small text-muted">
                Show this ticket at the pickup counter to receive your order.
              </p>
            </div>
          </div>
        </div>
      `;

      const payBtn = document.getElementById("pickupPayBtn");
      const ticketArea = document.getElementById("pickupTicketArea");
      if (payBtn && ticketArea) {
        payBtn.addEventListener("click", (e) => {
          e.preventDefault();
          ticketArea.classList.remove("d-none");
        });
      }
    }

    const pickupPanel = document.getElementById("pickupPaymentPanel");
    const pickupTicketPanel = document.getElementById("pickupTicketPanel");
    const pickupCodeEl = document.getElementById("pickupTicketCode");
    const pickupTotalEl = document.getElementById("pickupTicketTotal");
    const pickupPayBtn2 = document.getElementById("pickupPayBtn");

    if (pickupPanel) pickupPanel.classList.remove("d-none");
    if (pickupTicketPanel) pickupTicketPanel.classList.add("d-none");

    if (pickupPayBtn2 && pickupTicketPanel && pickupCodeEl && pickupTotalEl) {
      pickupPayBtn2.onclick = (e) => {
        e.preventDefault();
        pickupCodeEl.textContent = ticketNumber;
        pickupTotalEl.textContent = formatMoney(total);
        pickupTicketPanel.classList.remove("d-none");
      };
    }
  }
}

// ---------- Offcanvas setup ----------
function setupCartOffcanvasEvents() {
  const dineInBtn = document.getElementById("btnDineIn");
  const pickupBtn = document.getElementById("btnPickup");
  const clearBtn = document.getElementById("clearCartBtn");
  const checkoutBtn = document.getElementById("cartCheckoutBtn");

  if (dineInBtn && pickupBtn) {
    dineInBtn.addEventListener("click", () => {
      currentOrderMode = "dinein";
      dineInBtn.classList.add("active");
      pickupBtn.classList.remove("active");
      resetCheckoutUI();
    });

    pickupBtn.addEventListener("click", () => {
      currentOrderMode = "pickup";
      pickupBtn.classList.add("active");
      dineInBtn.classList.remove("active");
      resetCheckoutUI();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (confirm("Clear all items from your cart?")) {
        clearCart();
      }
    });
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleCheckout();
    });
  }

  document.addEventListener("shown.bs.offcanvas", (event) => {
    if (event.target.id === "cartOffcanvas") {
      renderCartPanel();
    }
  });
}

// ---------- Global click handlers for cart ----------
document.addEventListener("click", (e) => {
  const addBtn = e.target.closest(".add-to-cart-btn");
  if (addBtn) {
    const name = addBtn.dataset.name || "Item";
    const price = parseFloat(addBtn.dataset.price || "0");
    addToCart(name, price);
  }
});

document.addEventListener("click", (e) => {
  const minusBtn = e.target.closest(".cart-qty-minus");
  if (minusBtn) {
    const name = minusBtn.dataset.name;
    if (name) updateItemQty(name, -1);
    return;
  }

  const plusBtn = e.target.closest(".cart-qty-plus");
  if (plusBtn) {
    const name = plusBtn.dataset.name;
    if (name) updateItemQty(name, 1);
    return;
  }

  const removeBtn = e.target.closest(".cart-remove");
  if (removeBtn) {
    const name = removeBtn.dataset.name;
    if (name) removeItem(name);
  }
});

// ================== MENU + FILTER LOGIC (Menus & Hours) ==================
let allMenuItems = [];
let activeTagFilter = "all";

const menuContainer = document.getElementById("menuContainer");
const menuTitleEl = document.getElementById("menuResultsTitle");
const filterLocationEl = document.getElementById("filterLocation");
const filterMealEl = document.getElementById("filterMeal");
const filterSearchEl = document.getElementById("filterSearch");
const filterGoBtn = document.getElementById("filterGoBtn");
const legendButtons = document.querySelectorAll(".legend-filter-btn");

function renderTagBadges(tags = []) {
  if (!tags.length) return "";
  return tags
    .map((tag) => {
      let cls = "";
      if (tag === "vegetarian") cls = "tag-vegetarian";
      if (tag === "vegan") cls = "tag-vegan";
      if (tag === "spicy") cls = "tag-spicy";
      if (tag === "healthy") cls = "tag-healthy";
      if (tag === "glutenfree") cls = "tag-glutenfree";
      return `<span class="menu-tag ${cls}">${tag}</span>`;
    })
    .join(" ");
}

function renderStars(rating) {
  const full = Math.round(rating);
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html +=
      i <= full
        ? '<i class="bi bi-star-fill"></i>'
        : '<i class="bi bi-star"></i>';
  }
  return html;
}

function renderMenuCards(items) {
  if (!menuContainer) return;

  if (!items.length) {
    menuContainer.innerHTML =
      '<p class="text-muted">No menu items match your filters.</p>';
    if (menuTitleEl) menuTitleEl.textContent = "Menu Results (0 items)";
    return;
  }

  menuContainer.innerHTML = items
    .map((item) => {
      const tags = item.tags || [];
      return `
        <div class="col-md-4">
          <article class="menu-card"
                   data-tags="${tags.join(" ")}"
                   data-location="${item.location}"
                   data-meal="${item.meal}">
            <div class="menu-card-top d-flex justify-content-between align-items-start mb-2">
              <h5 class="mb-1">${item.name}</h5>
              <span class="badge bg-light text-muted border">${item.station}</span>
            </div>
            <div class="mb-2">
              <a href="dining-locations.html" class="menu-hall-link">${item.location}</a>
            </div>
            <p class="menu-desc">
              ${item.description}
            </p>
            <div class="menu-tags mb-2">
              ${renderTagBadges(tags)}
            </div>
            <div class="menu-rating mb-2">
              <span class="text-warning">
                ${renderStars(item.rating)}
              </span>
              <span class="ms-1 small text-muted">
                ${item.rating.toFixed(1)} (${item.reviews} reviews)
              </span>
            </div>
            <hr>
            <div class="d-flex justify-content-between align-items-center">
              <span class="menu-price">${formatMoney(item.price)}</span>
              <button class="btn btn-sm add-to-cart-btn"
                      data-name="${item.name}"
                      data-price="${item.price.toFixed(2)}">
                + Add to Cart
              </button>
            </div>
          </article>
        </div>
      `;
    })
    .join("");

  if (menuTitleEl) {
    menuTitleEl.textContent = `Menu Results (${items.length} items)`;
  }
}

function applyFilters() {
  if (!allMenuItems.length || !menuContainer) return;

  const loc = filterLocationEl ? filterLocationEl.value.toLowerCase() : "all";
  const meal = filterMealEl ? filterMealEl.value.toLowerCase() : "all";
  const search = filterSearchEl
    ? filterSearchEl.value.trim().toLowerCase()
    : "";

  const filtered = allMenuItems.filter((item) => {
    const itemLoc = (item.location || "").toLowerCase();
    const itemMeal = (item.meal || "").toLowerCase();
    const tags = item.tags || [];
    const haystack = `${item.name} ${item.description}`.toLowerCase();

    const byLoc = loc === "all" || itemLoc === loc;
    const byMeal = meal === "all" || itemMeal === meal;
    const byTag =
      activeTagFilter === "all" || tags.includes(activeTagFilter);
    const bySearch = !search || haystack.includes(search);

    return byLoc && byMeal && byTag && bySearch;
  });

  renderMenuCards(filtered);
}

function setupFilterEvents() {
  // Only apply filters when Go is clicked
  if (filterGoBtn) {
    filterGoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      applyFilters();
    });
  }

  // Tag legend still filters immediately
  legendButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag || "all";
      activeTagFilter = tag;

      legendButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      applyFilters();
    });
  });
}

// ================== DINING LOCATIONS MAP + CARDS + REVIEWS ==================

// DOM elements (only exist on dining-locations.html)
const mapElement = document.getElementById("gwMap");
const locationsCardsContainer = document.getElementById("locationsCards");
const campusFilterButtons = document.querySelectorAll("[data-campus-filter]");

// map state
let locationsData = [];
let locationsMap = null;
let locationsInfoWindow = null;
let locationMarkers = {};
let activeCampusFilter = "all";

// ---- Reviews (localStorage) ----
const REVIEWS_KEY = "gwDiningLocationReviews";

function loadLocationReviews() {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Error loading location reviews:", e);
    return {};
  }
}

function saveLocationReviews(data) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(data));
}

// Google Maps callback (used by script tag in dining-locations.html)
function initGWMap() {
    if (!mapElement) return; // not on locations page
  
    fetch("data/dining-locations.json")
      .then((res) => res.json())
      .then((data) => {
        locationsData = data || [];
        setupLocationsMap();
        setupLocationFilters();     // renders initial cards
        setupLocationCardClicks();
  
        // NEW: if a specific location is passed via ?loc=, focus it on the map
        const params = new URLSearchParams(window.location.search);
        const locId = params.get("loc");
  
        if (locId) {
          // make sure the marker exists before trying to focus
          if (locationMarkers[locId]) {
            // small timeout just to let layout/fitBounds settle
            setTimeout(() => {
              focusLocationOnMap(locId); // pans + zooms + selects card
            }, 300);
          }
        }
      })
      .catch((err) => {
        console.error("Error loading dining locations:", err);
      });
  }
// expose for Google Maps callback
window.initGWMap = initGWMap;

function setupLocationsMap() {
  const gwCenter = { lat: 38.9105, lng: -77.0670 };

  locationsMap = new google.maps.Map(mapElement, {
    center: gwCenter,
    zoom: 13,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  locationsInfoWindow = new google.maps.InfoWindow();
  locationMarkers = {};

  locationsData.forEach((loc) => {
    const marker = new google.maps.Marker({
      position: { lat: loc.lat, lng: loc.lng },
      map: locationsMap,
      title: loc.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#b58a3a",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2
      }
    });

    locationMarkers[loc.id] = marker;

    marker.addListener("click", () => {
      const infoHtml = `
        <div class="gw-map-info">
          <h6 class="mb-1">${loc.name}</h6>
          <p class="mb-1 small text-muted">${loc.address}</p>
          <p class="small mb-0">${loc.type}</p>
        </div>
      `;
      locationsInfoWindow.setContent(infoHtml);
      locationsInfoWindow.open(locationsMap, marker);
      highlightLocationCard(loc.id);
    });
  });

  fitMapToVisibleLocations();
}

function fitMapToVisibleLocations() {
  if (!locationsMap || !locationsData.length) return;

  const bounds = new google.maps.LatLngBounds();
  let hasVisible = false;

  locationsData.forEach((loc) => {
    const marker = locationMarkers[loc.id];
    if (marker && marker.getVisible()) {
      bounds.extend(marker.getPosition());
      hasVisible = true;
    }
  });

  if (hasVisible) {
    locationsMap.fitBounds(bounds);
  }
}

// Focus helper used by "View on map" and card click
function focusLocationOnMap(id) {
  const marker = locationMarkers[id];
  if (!marker || !locationsMap) return;

  locationsMap.panTo(marker.getPosition());
  locationsMap.setZoom(16);
  google.maps.event.trigger(marker, "click");
}

function renderLocationCards(items) {
  if (!locationsCardsContainer) return;

  if (!items.length) {
    locationsCardsContainer.innerHTML =
      '<p class="text-muted mb-0">No locations match this filter.</p>';
    return;
  }

  const allReviews = loadLocationReviews();

  locationsCardsContainer.innerHTML = items
    .map((loc) => {
      const paymentBadges = (loc.payment || [])
        .map(
          (p) =>
            `<span class="badge rounded-pill bg-light text-muted border me-1 mb-1">${p}</span>`
        )
        .join("");

      const hoursHtml = (loc.hours || "").replace(/\n/g, "<br>");
      const ratingHtml =
        typeof renderStars === "function" ? renderStars(loc.rating) : "";

      const stored = allReviews[loc.id] || [];
      const lastReview = stored.length ? stored[stored.length - 1] : null;

      let lastReviewHtml = "";
      if (lastReview) {
        lastReviewHtml = `
          <div class="location-last-review small text-muted">
            <span class="d-block fw-semibold">${lastReview.name || "Student"}</span>
            <span>${lastReview.text}</span>
          </div>
        `;
      } else {
        lastReviewHtml =
          '<p class="small text-muted mb-0">No reviews yet. Be the first to review.</p>';
      }

      const mapsUrl =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(loc.address);

      return `
        <div class="col-md-4">
          <article class="location-card" data-location-id="${loc.id}">
            <div class="location-card-top"></div>

            <div class="location-card-body">
              <p class="text-uppercase text-muted small mb-1">${loc.campus}</p>
              <h5 class="mb-1">${loc.name}</h5>
              <p class="small text-muted mb-1">${loc.type}</p>

              <div class="location-rating small mb-2">
                <span class="text-warning me-1">${ratingHtml}</span>
                <span class="fw-semibold">${loc.rating.toFixed(1)}</span>
                <span class="text-muted">(${loc.reviews} reviews)</span>
              </div>

              <p class="small mb-2">
                <strong>Hours:</strong><br>${hoursHtml}
              </p>

              <p class="small mb-2">${loc.description}</p>

              <div class="location-badges mb-2">
                ${paymentBadges}
              </div>

              <div class="location-review-block mb-2">
                ${lastReviewHtml}
              </div>

              <button
                type="button"
                class="btn btn-link btn-sm p-0 location-review-toggle"
                data-location-id="${loc.id}">
                Write a review
              </button>

              <form
                class="location-review-form d-none mt-2"
                data-location-id="${loc.id}">
                <input
                  type="text"
                  class="form-control form-control-sm mb-1"
                  name="name"
                  placeholder="Your name (optional)">
                <textarea
                  class="form-control form-control-sm mb-1"
                  name="text"
                  rows="2"
                  placeholder="Share your experience..."></textarea>
                <button type="submit" class="btn btn-primary btn-sm">
                  Post
                </button>
              </form>
            </div>

            <div class="location-card-footer">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm view-on-map-btn"
                  data-location-id="${loc.id}">
                  View on map
                </button>
                <a
                  href="${mapsUrl}"
                  target="_blank"
                  rel="noopener"
                  class="btn btn-link btn-sm location-directions-link">
                  Get directions
                </a>
              </div>
              <div class="location-address-box">
                <i class="bi bi-geo-alt-fill"></i>
                <span>${loc.address}</span>
              </div>
            </div>
          </article>
        </div>
      `;
    })
    .join("");
}

function setupLocationFilters() {
  if (!campusFilterButtons.length) {
    // still need initial render even if there are no filter buttons
    renderLocationCards(locationsData);
    return;
  }

  campusFilterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const campus = btn.getAttribute("data-campus-filter") || "all";
      activeCampusFilter = campus;

      campusFilterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      applyLocationFilter();
    });
  });

  // initial render with "All"
  applyLocationFilter();
}

function applyLocationFilter() {
  const filtered =
    activeCampusFilter === "all"
      ? locationsData
      : locationsData.filter((loc) => loc.campus === activeCampusFilter);

  renderLocationCards(filtered);

  // update marker visibility
  locationsData.forEach((loc) => {
    const marker = locationMarkers[loc.id];
    if (!marker) return;

    const visible =
      activeCampusFilter === "all" || loc.campus === activeCampusFilter;
    marker.setVisible(visible);
  });

  fitMapToVisibleLocations();
}

function setupLocationCardClicks() {
  if (!locationsCardsContainer) return;

  // clicks (view on map, review toggle, whole card)
  locationsCardsContainer.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".view-on-map-btn");
    if (viewBtn) {
      const id = viewBtn.dataset.locationId;
      focusLocationOnMap(id);
      return;
    }

    const reviewToggle = e.target.closest(".location-review-toggle");
    if (reviewToggle) {
      const id = reviewToggle.dataset.locationId;
      const form = locationsCardsContainer.querySelector(
        `.location-review-form[data-location-id="${id}"]`
      );
      if (form) {
        form.classList.toggle("d-none");
      }
      return;
    }

    // Clicking the card (but not on links / buttons) also focuses the map
    const card = e.target.closest(".location-card");
    if (
      card &&
      !e.target.closest(".location-directions-link") &&
      !e.target.closest(".location-review-form") &&
      !e.target.closest(".view-on-map-btn") &&
      !e.target.closest(".location-review-toggle")
    ) {
      const id = card.getAttribute("data-location-id");
      focusLocationOnMap(id);
    }
  });

  // review form submit
  locationsCardsContainer.addEventListener("submit", (e) => {
    const form = e.target.closest(".location-review-form");
    if (!form) return;

    e.preventDefault();

    const locationId = form.getAttribute("data-location-id");
    const nameInput = form.querySelector('input[name="name"]');
    const textInput = form.querySelector('textarea[name="text"]');
    const name = (nameInput.value || "Student").trim();
    const text = (textInput.value || "").trim();

    if (!text) {
      alert("Please write a short review before posting.");
      return;
    }

    const all = loadLocationReviews();
    const arr = all[locationId] || [];
    arr.push({
      name,
      text,
      time: new Date().toISOString()
    });
    all[locationId] = arr;
    saveLocationReviews(all);

    // clear form and collapse
    nameInput.value = "";
    textInput.value = "";
    form.classList.add("d-none");

    // re-render cards for current filter (so last review updates)
    applyLocationFilter();
  });
}

function highlightLocationCard(id) {
  if (!locationsCardsContainer) return;

  const cards = locationsCardsContainer.querySelectorAll(".location-card");
  cards.forEach((card) => {
    if (card.getAttribute("data-location-id") === id) {
      card.classList.add("active");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      card.classList.remove("active");
    }
  });
}

// ================== INIT (runs on every page) ==================
document.addEventListener("DOMContentLoaded", () => {
  // cart
  updateCartCountDisplay();
  setupCartOffcanvasEvents();
  renderCartPanel();

  // Menus & Hours page
  if (menuContainer) {
    fetch("data/menu-data.json")
      .then((res) => res.json())
      .then((data) => {
        allMenuItems = data || [];
        setupFilterEvents();
        applyFilters();
      })
      .catch((err) => {
        console.error("Error loading menu items:", err);
        menuContainer.innerHTML =
          '<p class="text-danger">Unable to load menu items.</p>';
      });
  }

  // Dining Locations map is initialized separately by Google Maps callback
});