// ================== CART & USER CONSTANTS ==================
const CART_KEY = "gwDiningCart";
const USER_KEY = "gwDiningUser"; // for simple local auth

// ================== USER AUTH HELPERS ==================
function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Error loading user:", e);
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearUser() {
  localStorage.removeItem(USER_KEY);
}

// ================== CART LOGIC ==================

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

// pending order after ticket is generated, before final “Checkout”
let pendingOrder = null; // { ticketNumber, total, mode }
let checkoutStage = "review"; // "review" | "ready"

function generateTicketNumber(prefix) {
  const base = Date.now().toString().slice(-4);
  const rand = Math.floor(Math.random() * 90 + 10); // 10–99
  return `${prefix}${base}${rand}`;
}

function setCheckoutButtonLabel(label) {
  const btn = document.getElementById("cartCheckoutBtn");
  if (btn) btn.textContent = label;
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

// Reset ticket / payment UI + footer button
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

  pendingOrder = null;
  checkoutStage = "review";
  setCheckoutButtonLabel("Proceed to checkout");
}

// finalize checkout after ticket exists and footer button says “Checkout”
function finalizeCheckout() {
  if (!pendingOrder) return;

  const { ticketNumber, total, mode } = pendingOrder;

  // update user discount + orders if logged in
  const user = loadUser();
  if (user) {
    const currentScore =
      typeof user.discountScore === "number" ? user.discountScore : 0;
    const orders = Array.isArray(user.orders) ? user.orders : [];

    orders.push({
      ticket: ticketNumber,
      mode,
      total,
      date: new Date().toISOString()
    });

    user.discountScore = currentScore + 10; // simple +10 pts per order
    user.orders = orders;
    saveUser(user);
  }

  alert(
    `Checkout successful!\n\nTicket: ${ticketNumber}\nTotal: ${formatMoney(
      total
    )}`
  );

  clearCart();
  pendingOrder = null;
  checkoutStage = "review";
  setCheckoutButtonLabel("Proceed to checkout");

  // close cart offcanvas
  const offcanvasEl = document.getElementById("cartOffcanvas");
  try {
    if (offcanvasEl && window.bootstrap && bootstrap.Offcanvas) {
      const instance = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
      instance.hide();
    }
  } catch (err) {
    console.warn("Offcanvas hide failed:", err);
  }
}

// When user clicks "Proceed to checkout" / "Checkout"
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
  const currentUser = loadUser(); // 👈 grab logged-in user if any
  const userLine = currentUser
    ? `<p class="small mb-1"><strong>Name:</strong> ${currentUser.name} &middot; <strong>GWID:</strong> ${currentUser.gwid}</p>`
    : "";

  if (currentOrderMode === "dinein") {
    // Dine-in: show ticket, then footer button becomes "Checkout"
    if (modeContentEl) {
      modeContentEl.innerHTML = `
        <div class="border rounded p-3 bg-light text-start">
          <p class="text-uppercase small text-muted mb-1">Dine-In Ticket</p>
          <p class="h3 fw-bold mb-1">${ticketNumber}</p>
          ${userLine}
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

    pendingOrder = { ticketNumber, total, mode: "dinein" };
    checkoutStage = "ready";
    setCheckoutButtonLabel("Checkout");
  } else {
    // Pickup: payment form + ticket AFTER Pay button
    if (modeContentEl) {
      modeContentEl.innerHTML = `
        <div class="card border-0 shadow-sm">
          <div class="card-body">
            <h6 class="text-uppercase text-muted mb-2">Pickup payment</h6>
            ${userLine}
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

          const cardName = document.getElementById("cardName");
          const cardNumber = document.getElementById("cardNumber");
          const cardExpiry = document.getElementById("cardExpiry");
          const cardCvv = document.getElementById("cardCvv");

          if (
            !cardName.value.trim() ||
            !cardNumber.value.trim() ||
            !cardExpiry.value.trim() ||
            !cardCvv.value.trim()
          ) {
            alert("Please fill in all card details.");
            return;
          }

          ticketArea.classList.remove("d-none");

          // now footer button becomes "Checkout" and clicking it finalizes
          pendingOrder = { ticketNumber, total, mode: "pickup" };
          checkoutStage = "ready";
          setCheckoutButtonLabel("Checkout");
        });
      }
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
      if (checkoutStage === "review") {
        handleCheckout();
      } else if (checkoutStage === "ready") {
        finalizeCheckout();
      }
    });
  }

  document.addEventListener("shown.bs.offcanvas", (event) => {
    if (event.target.id === "cartOffcanvas") {
      renderCartPanel();
      checkoutStage = "review";
      pendingOrder = null;
      setCheckoutButtonLabel("Proceed to checkout");
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

// ================== USER AUTH UI SETUP ==================
function setupAuthUI() {
  const userMenuButton = document.getElementById("userMenuButton");
  const userMenuIcon = document.getElementById("userMenuIcon");
  const userMenuLabel = document.getElementById("userMenuLabel");
  const loginForm = document.getElementById("loginForm");
  const profileSummary = document.getElementById("profileSummary");
  const profileName = document.getElementById("profileName");
  const profileGwId = document.getElementById("profileGwId");
  const logoutBtn = document.getElementById("logoutBtn");
  const viewProfileBtn = document.getElementById("viewProfileBtn");

  if (!userMenuButton || !userMenuIcon || !userMenuLabel) return;

  function renderProfileExtra(user) {
    if (!profileSummary) return;

    const score =
      typeof user.discountScore === "number" ? user.discountScore : 0;
    const orders = Array.isArray(user.orders) ? user.orders : [];

    let ordersHtml = "";
    if (!orders.length) {
      ordersHtml =
        '<p class="small mb-0 text-muted">No orders yet.</p>';
    } else {
      ordersHtml =
        '<div class="small text-muted mb-1">My Orders</div>' +
        '<ul class="list-unstyled small mb-0">' +
        orders
          .map((o) => {
            const dateStr = new Date(o.date).toLocaleString();
            const modeLabel = o.mode === "pickup" ? "Pickup" : "Dine-In";
            return `<li>Ticket: <strong>${o.ticket}</strong><br>${modeLabel} · ${formatMoney(
              o.total
            )} · ${dateStr}</li>`;
          })
          .join("") +
        "</ul>";
    }

    let extra = document.getElementById("profileExtraInfo");
    if (!extra) {
      extra = document.createElement("div");
      extra.id = "profileExtraInfo";
      extra.className = "mt-2 pt-2 border-top";
      profileSummary.appendChild(extra);
    }

    extra.innerHTML = `
      <div class="small mb-1">
        <strong>Discount Score:</strong> ${score} pts
      </div>
      ${ordersHtml}
    `;
  }

  function clearProfileExtra() {
    const extra = document.getElementById("profileExtraInfo");
    if (extra && extra.parentNode) {
      extra.parentNode.removeChild(extra);
    }
  }

  function syncAuthState() {
    const user = loadUser();

    if (user) {
      // logged in
      userMenuIcon.className = "bi bi-person-circle me-1";
      userMenuLabel.textContent = user.name.split(" ")[0] || "Profile";

      if (loginForm) loginForm.classList.add("d-none");
      if (profileSummary) profileSummary.classList.remove("d-none");
      if (profileName) profileName.textContent = user.name;
      if (profileGwId) profileGwId.textContent = user.gwid;

      // hide "View Profile" button and show inline info instead
      if (viewProfileBtn) viewProfileBtn.classList.add("d-none");

      renderProfileExtra(user);
    } else {
      // logged out
      userMenuIcon.className = "bi bi-box-arrow-in-right me-1";
      userMenuLabel.textContent = "Login";

      if (loginForm) loginForm.classList.remove("d-none");
      if (profileSummary) profileSummary.classList.add("d-none");

      if (viewProfileBtn) viewProfileBtn.classList.remove("d-none");
      clearProfileExtra();
    }
  }

  // Login submit
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const nameInput = document.getElementById("loginUsername");
      const gwidInput = document.getElementById("loginGwId");
      const passInput = document.getElementById("loginPassword");

      const name = nameInput ? nameInput.value.trim() : "";
      const gwid = gwidInput ? gwidInput.value.trim() : "";
      const password = passInput ? passInput.value : "";

      if (!name || !gwid || !password) {
        alert("Please fill in all fields.");
        return;
      }

      // Basic GWID validation: starts with G + 8 digits
      const gwidPattern = /^G\d{8}$/i;
      if (!gwidPattern.test(gwid)) {
        alert("Invalid GWID. It must start with 'G' followed by 8 digits (e.g., G34488884).");
        return;
      }

      // new user object with starter discount + empty orders
      const newUser = {
        name,
        gwid,
        password,
        discountScore: 0,
        orders: []
      };

      saveUser(newUser);
      syncAuthState();

      // Close dropdown if Bootstrap is available
      try {
        if (window.bootstrap && bootstrap.Dropdown) {
          const dd = bootstrap.Dropdown.getOrCreateInstance(userMenuButton);
          dd.hide();
        }
      } catch (err) {
        console.warn("Bootstrap dropdown hide failed:", err);
      }

      alert("Login successful.");
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearUser();
      syncAuthState();
      alert("You have been logged out.");
    });
  }

  // NOTE: viewProfileBtn no longer shows an alert; info is inline in dropdown now

  // Initial state on load
  syncAuthState();
}

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

// Directions + user location
let directionsService = null;
let directionsRenderer = null;
let userLocationMarker = null;
let userPositionLatLng = null;
let currentTravelMode = "WALKING"; // "WALKING" | "DRIVING"

// For reusing last route info when cards re-render
let lastRouteInfo = null; // { locationId, distanceText, durationText }

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

// ---------- ROUTE INFO BOX + TRAVEL MODE TOGGLE ----------
let routeInfoBox = null;
let travelModeControl = null;

function createRouteInfoBox() {
  if (!mapElement || routeInfoBox) return;

  routeInfoBox = document.createElement("div");
  routeInfoBox.id = "routeInfoBox";
  routeInfoBox.style.position = "absolute";
  routeInfoBox.style.top = "80px";
  routeInfoBox.style.left = "20px";
  routeInfoBox.style.zIndex = "9999";
  routeInfoBox.style.background = "white";
  routeInfoBox.style.padding = "10px 14px";
  routeInfoBox.style.borderRadius = "8px";
  routeInfoBox.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  routeInfoBox.style.fontSize = "14px";
  routeInfoBox.style.fontWeight = "500";
  routeInfoBox.style.display = "none";
  routeInfoBox.innerHTML = "";
  mapElement.appendChild(routeInfoBox);
}

function showRouteInfo(distanceText, durationText) {
  createRouteInfoBox();
  routeInfoBox.innerHTML = `
    <div><strong>Distance:</strong> ${distanceText}</div>
    <div><strong>Estimated time:</strong> ${durationText} (${currentTravelMode.toLowerCase()})</div>
  `;
  routeInfoBox.style.display = "block";
}

function hideRouteInfo() {
  if (routeInfoBox) {
    routeInfoBox.style.display = "none";
  }
}

function createTravelModeControl() {
  if (!mapElement || travelModeControl) return;

  travelModeControl = document.createElement("div");
  travelModeControl.id = "travelModeToggle";
  travelModeControl.style.position = "absolute";
  travelModeControl.style.top = "20px";
  travelModeControl.style.right = "20px";
  travelModeControl.style.zIndex = "9999";
  travelModeControl.style.background = "white";
  travelModeControl.style.borderRadius = "999px";
  travelModeControl.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  travelModeControl.style.overflow = "hidden";
  travelModeControl.style.display = "flex";

  const walkBtn = document.createElement("button");
  walkBtn.type = "button";
  walkBtn.textContent = "Walk";
  walkBtn.style.border = "none";
  walkBtn.style.padding = "6px 12px";
  walkBtn.style.fontSize = "13px";
  walkBtn.style.cursor = "pointer";
  walkBtn.style.background = "#005daa";
  walkBtn.style.color = "white";
  walkBtn.dataset.mode = "WALKING";

  const driveBtn = document.createElement("button");
  driveBtn.type = "button";
  driveBtn.textContent = "Drive";
  driveBtn.style.border = "none";
  driveBtn.style.padding = "6px 12px";
  driveBtn.style.fontSize = "13px";
  driveBtn.style.cursor = "pointer";
  driveBtn.style.background = "white";
  driveBtn.style.color = "#333";
  driveBtn.dataset.mode = "DRIVING";

  const setActiveButton = (mode) => {
    if (mode === "WALKING") {
      walkBtn.style.background = "#005daa";
      walkBtn.style.color = "white";
      driveBtn.style.background = "white";
      driveBtn.style.color = "#333";
    } else {
      driveBtn.style.background = "#005daa";
      driveBtn.style.color = "white";
      walkBtn.style.background = "white";
      walkBtn.style.color = "#333";
    }
  };

  walkBtn.addEventListener("click", () => {
    currentTravelMode = "WALKING";
    setActiveButton("WALKING");
    // if there was a last route, re-run it with new mode
    if (lastRouteInfo && lastRouteInfo.locationId) {
      routeFromUserToLocation(lastRouteInfo.locationId);
    }
  });

  driveBtn.addEventListener("click", () => {
    currentTravelMode = "DRIVING";
    setActiveButton("DRIVING");
    if (lastRouteInfo && lastRouteInfo.locationId) {
      routeFromUserToLocation(lastRouteInfo.locationId);
    }
  });

  setActiveButton(currentTravelMode);

  travelModeControl.appendChild(walkBtn);
  travelModeControl.appendChild(driveBtn);
  mapElement.appendChild(travelModeControl);
}

function setUserLocation(latLng) {
  userPositionLatLng = latLng;

  if (!locationsMap) return;

  if (!userLocationMarker) {
    userLocationMarker = new google.maps.Marker({
      position: latLng,
      map: locationsMap,
      title: "You are here",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: "#0066ff",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2
      }
    });
  } else {
    userLocationMarker.setPosition(latLng);
    userLocationMarker.setMap(locationsMap);
  }
}

// Update distance/time text inside the location card
function updateLocationDistanceUI(locationId, distanceText, durationText) {
  const el = document.querySelector(`[data-distance-for="${locationId}"]`);
  if (!el) return;

  const modeLabel =
    currentTravelMode === "DRIVING" ? "driving" : "walking";

  el.innerHTML = `
    <i class="bi bi-geo-alt"></i>
    <span>${distanceText} · ${durationText} (${modeLabel})</span>
  `;
}

// Core routing function used when clicking "Get directions"
function routeFromUserToLocation(locationId) {
  hideRouteInfo();

  if (!locationsMap || !directionsService || !directionsRenderer) {
    focusLocationOnMap(locationId);
    return;
  }

  const loc = locationsData.find((l) => l.id === locationId);
  if (!loc) return;

  const destination = { lat: loc.lat, lng: loc.lng };

  const startRouting = (origin) => {
    setUserLocation(origin);

    directionsRenderer.setMap(locationsMap);
    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode[currentTravelMode]
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);

          const leg = result.routes[0].legs[0];
          const distanceText = leg.distance.text; // e.g., "0.5 mi"
          const durationText = leg.duration.text; // e.g., "9 mins"

          showRouteInfo(distanceText, durationText);
          updateLocationDistanceUI(locationId, distanceText, durationText);

          lastRouteInfo = {
            locationId,
            distanceText,
            durationText
          };

          if (result.routes[0].bounds) {
            locationsMap.fitBounds(result.routes[0].bounds);
          }
        } else {
          console.error("Directions failed:", status);
          alert("Unable to calculate route.");
          focusLocationOnMap(locationId);
        }
      }
    );
  };

  if (userPositionLatLng) {
    startRouting(userPositionLatLng);
  } else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const origin = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        startRouting(origin);
      },
      (err) => {
        console.error(err);
        alert("Cannot access your location. Please enable location services.");
        focusLocationOnMap(locationId);
      }
    );
  } else {
    alert("Geolocation is not supported by your browser.");
    focusLocationOnMap(locationId);
  }
}

// Google Maps callback (used by script tag in dining-locations.html)
function initGWMap() {
  if (!mapElement) return; // not on locations page

  fetch("data/dining-locations.json")
    .then((res) => res.json())
    .then((data) => {
      locationsData = data || [];
      setupLocationsMap();
      setupLocationFilters(); // renders initial cards
      setupLocationCardClicks();

      // NEW: if a specific location is passed via ?loc=, focus it on the map
      const params = new URLSearchParams(window.location.search);
      const locId = params.get("loc");

      if (locId) {
        if (locationMarkers[locId]) {
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
  const gwCenter = { lat: 38.9105, lng: -77.067 };

  locationsMap = new google.maps.Map(mapElement, {
    center: gwCenter,
    zoom: 13,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  locationsInfoWindow = new google.maps.InfoWindow();
  locationMarkers = {};

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: locationsMap,
    suppressMarkers: false,
    preserveViewport: false
  });

  createTravelModeControl();
  createRouteInfoBox();

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
        <div style="
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color:#222 !important;
          padding:12px;
          border-radius:8px;
          border:1px solid #d9d9d9;
          box-shadow:0 4px 12px rgba(0,0,0,0.15);
          max-width:260px;
        ">
          
          <!-- Title -->
          <div style="font-size:15px; font-weight:700; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
            <i class="bi bi-shop" style="font-size:18px; color:#1a73e8;"></i>
            ${loc.name}
          </div>
    
          <!-- Address -->
          <div style="display:flex; align-items:flex-start; gap:6px; margin-bottom:4px;">
            <i class="bi bi-geo-alt-fill" style="color:#d93025;"></i>
            <span style="font-size:13px; color:#444;">
              ${loc.address}
            </span>
          </div>
    
          <!-- Type -->
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
            <i class="bi bi-list-ul" style="color:#6a6a6a;"></i>
            <span style="font-size:13px; color:#555;">
              ${loc.type}
            </span>
          </div>
    
          <!-- Directions Button -->
          <a 
            href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.address)}"
            target="_blank"
            style="
              display:block;
              margin-top:8px;
              background:#1a73e8;
              color:white !important;
              text-align:center;
              padding:8px 10px;
              text-decoration:none;
              border-radius:6px;
              font-size:13px;
              font-weight:600;
            "
          >
            <i class="bi bi-arrow-up-right-circle"></i>
            Get Directions
          </a>
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
          '<p class="small text-muted mb-0">Leave a review. We want to improve our services.</p>';
      }

      const mapsUrl =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(loc.address);

      return `
        <div class="col-md-4">
          <article class="location-card" data-location-id="${loc.id}">
            <!-- TOP IMAGE (pulled from images/locations/) -->
            <div class="ratio ratio-16x9 bg-light">
              <img
                src="images/locations/${loc.id}.jpg"
                alt="${loc.name}"
                class="w-100 h-100 object-fit-cover"
                onerror="this.style.display='none';"
              >
            </div>

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
              <div class="location-distance small text-muted mb-2" data-distance-for="${loc.id}">
                <i class="bi bi-geo-alt"></i>
                <span>Turn on location and click "Get directions" to see distance &amp; time.</span>
              </div>
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

  // if we already had a route for a location, re-apply its distance text
  if (lastRouteInfo && lastRouteInfo.locationId) {
    updateLocationDistanceUI(
      lastRouteInfo.locationId,
      lastRouteInfo.distanceText,
      lastRouteInfo.durationText
    );
  }
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

  // clicks (view on map, review toggle, directions, whole card)
  locationsCardsContainer.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".view-on-map-btn");
    if (viewBtn) {
      const id = viewBtn.dataset.locationId;
      focusLocationOnMap(id);
      return;
    }

    const directionsLink = e.target.closest(".location-directions-link");
    if (directionsLink) {
      e.preventDefault();
      const card = directionsLink.closest(".location-card");
      const id = card ? card.getAttribute("data-location-id") : null;
      if (id) {
        routeFromUserToLocation(id);
      }
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
  // user auth UI
  setupAuthUI();

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

// ================== STUDENT SERVICES FAQ TOGGLE ==================
document.addEventListener("DOMContentLoaded", () => {
  const faqList = document.querySelector(".student-faq-list");
  if (!faqList) return; // not on this page

  faqList.addEventListener("click", (e) => {
    const header = e.target.closest(".student-faq-header");
    if (!header) return;

    const item = header.closest(".student-faq-item");
    if (!item) return;

    const isOpen = item.classList.contains("is-open");

    // Close any currently open item
    faqList.querySelectorAll(".student-faq-item.is-open").forEach((openItem) => {
      openItem.classList.remove("is-open");
    });

    // Re-open the clicked one if it was closed
    if (!isOpen) {
      item.classList.add("is-open");
    }
  });

  // Dietary accommodation slide-out form
  const openBtn = document.getElementById("openDietaryFormBtn");
  const panel = document.getElementById("dietaryFormPanel");
  const closeBtn = document.getElementById("dietaryFormClose");
  const form = document.getElementById("dietaryForm");

  if (openBtn && panel) {
    openBtn.addEventListener("click", () => {
      panel.classList.add("is-visible");
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener("click", () => {
      panel.classList.remove("is-visible");
    });
  }

  if (form && panel) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      // Simple notification
      alert("Your dietary accommodation request has been sent.");

      form.reset();
      panel.classList.remove("is-visible");
    });
  }
});