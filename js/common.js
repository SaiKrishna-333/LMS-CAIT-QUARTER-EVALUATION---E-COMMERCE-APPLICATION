/* ==========================================================================
   NOVA - common.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This file holds everything that is repeated on many
   storefront pages - the header, the footer, the product card, the toast
   pop-ups, and ALL cart / wishlist / compare operations - so that logic is
   written once and reused everywhere.

   WHY THIS FILE EXISTS
   Without it every page would duplicate the navigation bar and the "add to
   cart" maths. Centralising it keeps the code small, consistent and easy to
   explain. It is loaded on every customer page AFTER storage.js (it calls
   storage.js functions) and BEFORE the page-specific script.

   PATH HANDLING
   Admin pages live in a subfolder, so each page may define ROOT ("" on the
   storefront, "../" inside /admin). If a page does not set it, this file
   defaults ROOT to "" so all links still work.

   FUNCTIONS IN THIS FILE
   1. Current-user + access helpers
      getCurrentUser()      - the signed-in user object or null
      isAdminLoggedIn()     - true when an admin is signed in
      requireLogin()        - bounce guests to login.html, remembering target
      requireAdmin()        - keep non-admins out of admin pages (UI check)
   2. Shared chrome (the look every page shares)
      renderHeader(active)  - builds the sticky nav bar + search + badges
      navLink(...)          - one nav link, highlighted when active
      attachHeaderEvents()  - wires search box + mobile hamburger menu
      renderFooter()        - builds the footer columns
   3. Icons + notifications
      refreshIcons()        - asks Lucide to draw its icons (safe if offline)
      showToast(msg, type)  - bottom-right pop-up that fades after 3 seconds
   4. Small display helpers
      starsHtml(rating)     - number -> ★★★★★ text
      stockLabel(stock)     - green/amber/red availability text
      escapeHtml(text)      - makes user text safe before inserting in HTML
   5. The product card
      buildProductCard(p)   - the reusable card used on every grid
      compareButtonAttr(p)  - shows the compare button as done/available
   6. CART operations (persisted through storage.js)
      addToCart(id, qty)    - respects stock caps, merges duplicate lines,
                              returns true/false so callers can react
      changeQuantity(id,d)  - +1 / -1 a line, clamped to available stock
      removeFromCart(id)    - delete one line
      cartTotals()          - {subtotal, discount, delivery, total} maths
   7. WISHLIST + COMPARE
      toggleWishlist(id)    - add/remove a saved product id
      addToCompare(id)      - put a product in the 3-slot compare tray
   8. Header counters + logout
      updateBadges()        - refresh the cart / wishlist number pills
      logoutUser()          - clear the session and return to the homepage

   HOW DATA MOVES: a button on a card calls addToCart(); that writes the cart
   to Local Storage via storage.js and repaints the badge. The cart page reads
   the same storage through cartTotals(), so both always agree.
   ========================================================================== */

/* ==========================================================================
   NOVA - common.js  (SHARED UI LOGIC)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Code used by (almost) every storefront page lives here so it is written
   only once:
   - renderHeader() / renderFooter(): build the nav bar and footer HTML.
   - Toast notifications (instead of browser alerts).
   - Cart / wishlist add-remove functions (used by cards and detail pages).
   - Login helpers (who is the current user? are they an admin?).
   - buildProductCard(): the product card reused on every grid.

   PATH NOTE: admin pages live in a subfolder, so each page defines a small
   variable ROOT ("", or "../" inside /admin) before loading this file.
   ========================================================================== */

if (typeof ROOT === "undefined") { var ROOT = ""; }

/* ---------- 1. CURRENT USER ---------- */

// The logged-in user object, or null when nobody is logged in.
function getCurrentUser() {
    return loadData("novaCurrentUser", null);
}

// Is an admin currently logged in? (used to guard admin pages)
function isAdminLoggedIn() {
    var user = getCurrentUser();
    return user !== null && user.role === "admin";
}

// Send a not-logged-in visitor to the login page, remembering where
// they wanted to go so they come back after logging in.
function requireLogin() {
    if (getCurrentUser() === null) {
        window.location.href = ROOT + "login.html?next=" +
            encodeURIComponent(window.location.pathname);
    }
}

// Admin pages call this: customers (and guests) are bounced to the login.
// NOTE: this is a UI convenience for the demo, NOT real security - a frontend
// cannot truly protect a page because all code runs inside the browser.
function requireAdmin() {
    if (!isAdminLoggedIn()) {
        showToast("Admin access only. Please sign in with the admin account.", "error");
        window.location.href = ROOT + "login.html?admin=1";
    }
}

/* ---------- 2. HEADER + FOOTER (shared HTML) ---------- */

// Build the storefront header. active = which link should glow violet.
function renderHeader(active) {
    var user = getCurrentUser();
    var cartCount = getCart().length;
    var wishCount = getWishlist().length;

    // When logged in show the profile initial, otherwise a login link.
    var profileHtml = user
        ? '<a class="icon-btn" href="' + ROOT + 'profile.html" title="' + user.name + '">' +
        user.name.charAt(0).toUpperCase() + '</a>'
        : '<a class="icon-btn" href="' + ROOT + 'login.html" title="Login"><i data-lucide="user"></i></a>';

    var html =
        '<div class="container header-inner">' +
        '<a class="logo" href="' + ROOT + 'index.html"><span class="logo-mark">&#10006;</span>NOVA</a>' +
        '<button class="icon-btn menu-toggle" id="menuToggle" aria-label="Menu"><i data-lucide="menu"></i></button>' +
        '<nav class="main-nav" id="mainNav">' +
        navLink(ROOT + 'index.html', 'Home', active === 'home') +
        navLink(ROOT + 'products.html', 'Shop', active === 'shop') +
        navLink(ROOT + 'products.html?filter=categories', 'Categories', active === 'categories') +
        navLink(ROOT + 'products.html?sort=new', 'New Arrivals', active === 'new') +
        navLink(ROOT + 'products.html?deals=1', 'Deals', active === 'deals') +
        navLink(ROOT + 'compare.html', 'Compare', active === 'compare') +
        '</nav>' +
        '<div class="header-search">' +
        '<input type="text" id="headerSearch" placeholder="Search products..." aria-label="Search">' +
        '<span class="search-icon" id="headerSearchBtn"><i data-lucide="search"></i></span>' +
        '</div>' +
        '<div class="header-icons">' +
        profileHtml +
        '<a class="icon-btn" href="' + ROOT + 'wishlist.html" title="Wishlist"><i data-lucide="heart"></i>' +
        '<span class="count-badge" id="wishBadge">' + wishCount + '</span></a>' +
        '<a class="icon-btn" href="' + ROOT + 'cart.html" title="Cart"><i data-lucide="shopping-cart"></i>' +
        '<span class="count-badge" id="cartBadge">' + cartCount + '</span></a>' +
        '</div></div>';

    document.getElementById("siteHeader").innerHTML = html;
    attachHeaderEvents();
    refreshIcons();
}

// Small helper that creates one navigation link.
function navLink(href, text, isActive) {
    return '<a href="' + href + '"' + (isActive ? ' class="active"' : '') + '>' + text + '</a>';
}

// Search box behaviour: Enter or the magnifier goes to the catalogue.
function attachHeaderEvents() {
    var searchInput = document.getElementById("headerSearch");
    var searchBtn = document.getElementById("headerSearchBtn");
    var menuToggle = document.getElementById("menuToggle");

    function goSearch() {
        var term = searchInput.value.trim();
        window.location.href = ROOT + "products.html?search=" + encodeURIComponent(term);
    }

    searchBtn.addEventListener("click", goSearch);
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") { goSearch(); }
    });

    // Mobile hamburger: slide the nav panel in and out.
    menuToggle.addEventListener("click", function () {
        document.getElementById("mainNav").classList.toggle("open");
    });
}

function renderFooter() {
    var html =
        '<div class="container">' +
        '<div class="footer-grid">' +
        '<div><a class="logo" href="' + ROOT + 'index.html"><span class="logo-mark">&#10006;</span>NOVA</a>' +
        '<p style="margin-top:12px">Discover. Compare. Experience. Shop.<br>' +
        'A premium student project built with plain HTML, CSS, JavaScript and Local Storage.</p></div>' +
        '<div><h4>Shop</h4>' +
        '<a href="' + ROOT + 'products.html">All Products</a>' +
        '<a href="' + ROOT + 'products.html?deals=1">Flash Deals</a>' +
        '<a href="' + ROOT + 'products.html?sort=new">New Arrivals</a>' +
        '<a href="' + ROOT + 'compare.html">Compare Studio</a></div>' +
        '<div><h4>Account</h4>' +
        '<a href="' + ROOT + 'login.html">Login</a>' +
        '<a href="' + ROOT + 'register.html">Register</a>' +
        '<a href="' + ROOT + 'orders.html">My Orders</a>' +
        '<a href="' + ROOT + 'wishlist.html">Wishlist</a></div>' +
        '<div><h4>Support</h4>' +
        '<p>2-Year Warranty</p><p>30-Day Returns</p><p>Free Shipping over ' + formatMoney(getSettings().freeDeliveryMin) + '</p></div>' +
        '</div>' +
        '<div class="footer-bottom">NOVA &ndash; Quarterly Evaluation I (Nov 2026) &middot; Academic demo project &middot; No real payments are processed.</div>' +
        '</div>';

    document.getElementById("siteFooter").innerHTML = html;
}

/* ---------- 3. ICONS ---------- */
// NOVA uses Lucide icons from a CDN. If the CDN is unavailable offline the
// app still works - buttons keep their text labels.
function refreshIcons() {
    if (window.lucide && typeof lucide.createIcons === "function") {
        lucide.createIcons();
    }
}

/* ---------- 4. TOAST NOTIFICATIONS ---------- */
// A small message that appears bottom-right and fades after 3 seconds.
function showToast(message, type) {
    var area = document.getElementById("toast-area");

    if (!area) {
        area = document.createElement("div");
        area.id = "toast-area";
        document.body.appendChild(area);
    }

    var toast = document.createElement("div");
    toast.className = "toast " + (type || "success");
    toast.innerHTML = '<i data-lucide="' + (type === "error" ? "alert-triangle" : "check-circle-2") + '"></i><span>' + message + '</span>';
    area.appendChild(toast);
    refreshIcons();

    setTimeout(function () {
        toast.classList.add("leaving");
        setTimeout(function () { toast.remove(); }, 320);
    }, 3000);
}

/* ---------- 5. STAR RATINGS ---------- */
// Convert a number like 4.6 into "★★★★½" style text.
function starsHtml(rating) {
    var full = Math.round(rating);
    var text = "";
    for (var i = 1; i <= 5; i++) {
        text += i <= full ? "★" : "☆";
    }
    return '<span class="stars">' + text + '</span>';
}

/* ---------- 6. PRODUCT CARD BUILDER ---------- */
// One function builds the card used on the homepage, catalogue, wishlist...
// Buttons call the global addToCart / toggleWishlist functions below, so the
// same card works on every page.
function buildProductCard(product) {
    var discount = Math.round((1 - product.price / product.originalPrice) * 100);
    var wishlisted = getWishlist().some(function (id) { return id === product.id; });
    var stockHtml = stockLabel(product.stock);

    return '<article class="product-card" data-id="' + product.id + '">' +
        '<div class="card-image">' +
        (discount > 0 ? '<span class="discount-pill">-' + discount + '%</span>' : '') +
        '<div class="card-actions">' +
        '<button title="Wishlist" class="' + (wishlisted ? "done" : "") + '" ' +
        (wishlisted ? 'disabled' : 'onclick="toggleWishlist(\'' + product.id + '\')"') +
        '><i data-lucide="heart"></i></button>' +
        '<button title="Add to comparison" ' + compareButtonAttr(product) + '><i data-lucide="scale"></i></button>' +
        '<button title="View details" onclick="location.href=\'' + ROOT + 'product-details.html?id=' + product.id + '\'"><i data-lucide="eye"></i></button>' +
        '</div>' +
        '<img src="' + getProductImage(product, 0) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" onerror="this.onerror=null;this.src=getProductSvgById(\'' + product.id + '\',0)">' +
        '</div>' +
        '<div class="card-body">' +
        '<span class="card-category">' + product.category + '</span>' +
        '<h3 class="card-title"><a href="' + ROOT + 'product-details.html?id=' + product.id + '">' + product.name + '</a></h3>' +
        '<div class="rating">' + starsHtml(product.rating) + ' ' + product.rating.toFixed(1) + ' (' + product.reviews + ')</div>' +
        '<div class="price-row"><span class="price-now">' + formatMoney(product.price) + '</span>' +
        '<span class="price-old">' + formatMoney(product.originalPrice) + '</span></div>' +
        '<div>' + stockHtml + '</div>' +
        '<button class="btn btn-primary btn-sm" ' + (product.stock === 0 ? "disabled" : "") +
        ' onclick="addToCart(\'' + product.id + '\')">' +
        (product.stock === 0 ? "Out of Stock" : "Add to Cart") + '</button>' +
        '</div></article>';
}

// Green / amber / red stock text used on cards and detail pages.
function stockLabel(stock) {
    if (stock === 0) { return '<span class="stock-tag out">Out of stock</span>'; }
    if (stock <= 10) { return '<span class="stock-tag low">Only ' + stock + ' left</span>'; }
    return '<span class="stock-tag in">In stock</span>';
}

// Comparison button: greyed-out "done" when the product is already inside
// the Compare Studio tray.
function compareButtonAttr(product) {
    var tray = loadData("novaCompare", []);
    if (tray.indexOf(product.id) !== -1) {
        return 'class="done" disabled';
    }
    return 'onclick="addToCompare(\'' + product.id + '\')"';
}

// Escape user text before inserting into HTML (keeps quotes/brackets safe).
function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- 7. CART OPERATIONS ---------- */

// Add a product to the cart (qty defaults to 1; the details page passes
// the number chosen in its quantity stepper).
// The cart stores {id, quantity} pairs - prices are always read fresh from
// the product list so old prices can never be saved by mistake.
function addToCart(productId, quantity) {
    if (quantity === undefined) { quantity = 1; }

    var product = findProduct(productId);
    if (!product) { return false; }

    if (product.stock === 0) {
        showToast("Sorry, this product is out of stock.", "error");
        return false;
    }

    var cart = getCart();
    var existing = null;

    for (var i = 0; i < cart.length; i++) {
        if (cart[i].id === productId) { existing = cart[i]; }
    }

    var currentQty = existing ? existing.quantity : 0;

    // Never allow more than the available stock.
    if (currentQty + quantity > product.stock) {
        showToast("Only " + product.stock + " units available in stock.", "error");
        quantity = product.stock - currentQty;
        if (quantity <= 0) { return false; }
    }

    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({ id: productId, quantity: quantity });
    }

    saveCart(cart);
    updateBadges();
    showToast(product.name + " added to cart");
    return true;
}

// Change a cart line's quantity (+1 / -1 buttons on the cart page).
function changeQuantity(productId, delta) {
    var cart = getCart();
    var product = findProduct(productId);

    for (var i = 0; i < cart.length; i++) {
        if (cart[i].id === productId) {
            cart[i].quantity += delta;

            if (product && cart[i].quantity > product.stock) {
                showToast("Only " + product.stock + " units available.", "error");
                cart[i].quantity = product.stock;
            }
            if (cart[i].quantity <= 0) {
                cart.splice(i, 1); // quantity 0 means: remove the line
            }
            break;
        }
    }

    saveCart(cart);
    updateBadges();
}

function removeFromCart(productId) {
    var cart = getCart().filter(function (line) { return line.id !== productId; });
    saveCart(cart);
    updateBadges();
    showToast("Item removed from cart");
}

// Cart total maths: subtotal, saved-money and delivery.
// Returns an object so several pages can display the same numbers.
function cartTotals() {
    var cart = getCart();
    var settings = getSettings();
    var subtotal = 0;
    var original = 0;

    cart.forEach(function (line) {
        var product = findProduct(line.id);
        if (product) {
            subtotal += product.price * line.quantity;
            original += product.originalPrice * line.quantity;
        }
    });

    var discount = Math.round((original - subtotal) * 100) / 100;
    var delivery = 0;
    if (subtotal > 0 && subtotal < settings.freeDeliveryMin) {
        delivery = settings.deliveryCharge;
    }

    return {
        subtotal: subtotal,
        discount: discount,
        delivery: delivery,
        total: Math.round((subtotal + delivery) * 100) / 100
    };
}

/* ---------- 8. WISHLIST OPERATIONS ---------- */
// The wishlist simply stores product ids.
function toggleWishlist(productId) {
    var list = getWishlist();
    var position = list.indexOf(productId);

    if (position === -1) {
        list.push(productId);
        showToast("Added to wishlist");
    } else {
        list.splice(position, 1);
        showToast("Removed from wishlist");
    }

    saveWishlist(list);
    updateBadges();

    // If a page shows the "wishlisted" heart state, let it re-paint itself.
    if (typeof window.onWishlistChanged === "function") {
        window.onWishlistChanged();
    }
}

/* ---------- 9. COMPARE TRAY ---------- */
// Compare Studio keeps up to 3 product ids in novaCompare.
function addToCompare(productId) {
    var tray = loadData("novaCompare", []);

    if (tray.indexOf(productId) !== -1) { return; }

    if (tray.length >= 3) {
        showToast("Compare Studio holds 3 products. Open it to remove one.", "error");
        return;
    }

    tray.push(productId);
    saveData("novaCompare", tray);
    showToast("Added to Compare Studio");
}

/* ---------- 10. BADGE REFRESH ---------- */
// Keep the cart / wishlist counters in the header up to date.
function updateBadges() {
    var cartBadge = document.getElementById("cartBadge");
    var wishBadge = document.getElementById("wishBadge");

    if (cartBadge) { cartBadge.textContent = getCart().length; }
    if (wishBadge) { wishBadge.textContent = getWishlist().length; }
}

/* ---------- 11. LOGOUT ---------- */
function logoutUser() {
    removeData("novaCurrentUser");
    showToast("Logged out. See you soon!");
    // ROOT is "" on storefront pages and "../" inside /admin, so we build
    // an absolute address that works from any folder depth.
    window.location.href = window.location.origin + ROOT + "index.html";
}
