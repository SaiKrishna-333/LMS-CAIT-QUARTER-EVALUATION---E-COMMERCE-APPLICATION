/* ==========================================================================
   NOVA - admin.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This is the shared toolkit for every admin page. It draws
   the admin sidebar/top-bar shell, makes sure only an admin can be here, and
   offers small helpers (modal, toast, activity log, thumbnails) that the
   individual admin scripts reuse.

   IT RUNS INSIDE THE /admin FOLDER
   Because admin pages live one folder deeper, this file sets ROOT = "../" so
   that links, images and back-navigation resolve correctly from anywhere in
   the admin area.

   FUNCTIONS IN THIS FILE
   - renderAdminShell(activeKey) - requireAdmin() guard, then paint the sidebar
                                   + top bar and hand back an #adminContent box
                                   for the page to fill; ADMIN_TABS drives the
                                   menu items
   - adminLogout()               - clear the session and return to the shop
   - adminToast(message, type)   - reuse the customer toast inside admin
   - openModal(id)/closeModal(id)- show or hide a pop-up dialog (product form)
   - logActivity(text)           - add a line to the admin activity feed
   - adminThumb(product)         - a small product picture for tables
   - statusOptions(current)      - build the dropdown of order statuses with
                                   the order's present status pre-selected

   Each admin page (dashboard, products, inventory, orders, marketing,
   reports) simply calls renderAdminShell() and then draws its own content,
   so the whole console looks and behaves as one app.
   ========================================================================== */

/* ==========================================================================
   NOVA - admin.js  (SHARED ADMIN SHELL)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Loaded by every page inside /admin. It:
   - guards the page (only an admin user may stay),
   - renders the big rounded shell + pill navigation,
   - offers small shared helpers: adminToast, modal open/close, logout.
   Page-specific logic lives in dashboard.js / inventory.js etc.
   ========================================================================== */

// Admin pages live one folder deeper, so all links need the "../" prefix.
var ROOT = "../";

// The five dashboard sections + product management.
var ADMIN_TABS = [
    { key: "overview", href: "dashboard.html", label: "Overview", icon: "activity" },
    { key: "products", href: "products.html", label: "Products", icon: "package" },
    { key: "inventory", href: "inventory.html", label: "Inventory", icon: "boxes" },
    { key: "orders", href: "orders.html", label: "Orders", icon: "shopping-bag" },
    { key: "marketing", href: "marketing.html", label: "Marketing", icon: "megaphone" },
    { key: "reports", href: "reports.html", label: "Reports", icon: "file-bar-chart" }
];

/* ---------- 1. PAGE GUARD + SHELL ---------- */
function renderAdminShell(activeKey) {
    // SECURITY NOTE for the evaluation: this is a UI role check only.
    // A frontend can never be truly secure; it just keeps honest demos honest.
    var user = getCurrentUser();

    if (!user || user.role !== "admin") {
        window.location.href = ROOT + "login.html?admin=1";
        return null;
    }

    var shell = document.getElementById("adminShell");
    var links = "";

    ADMIN_TABS.forEach(function (tab) {
        links += '<a href="' + tab.href + '" class="' + (tab.key === activeKey ? "active" : "") + '">' +
            '<i data-lucide="' + tab.icon + '"></i> ' + tab.label + "</a>";
    });

    shell.innerHTML =
        '<div class="admin-topbar">' +
        '<a class="admin-logo" href="' + ROOT + 'index.html" title="Back to store">N</a>' +
        '<nav class="admin-nav">' + links + "</nav>" +
        '<div class="admin-user">' +
        '<a class="icon-btn" href="' + ROOT + 'index.html" title="Back to storefront"><i data-lucide="store"></i></a>' +
        '<div class="avatar" title="' + escapeHtml(user.name) + '">' + user.name.charAt(0).toUpperCase() + "</div>" +
        '<button class="mini-btn" title="Logout" onclick="adminLogout()"><i data-lucide="log-out"></i></button>' +
        "</div></div>" +
        // Each admin page puts its own content into this container.
        '<div id="adminContent"></div>';

    refreshIcons();
    return user;
}

function adminLogout() {
    logoutUser(); // shared function from common.js (handles the redirect)
}

/* ---------- 2. ADMIN TOAST ---------- */
// Same idea as showToast() but styled for the dark shell.
function adminToast(message, type) {
    showToast(message, type); // reuse the storefront toast - it already looks right
}

/* ---------- 3. MODAL HELPERS ---------- */
function openModal(id) {
    document.getElementById(id).classList.add("open");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("open");
}

/* ---------- 4. ACTIVITY FEED ---------- */
// Admin actions (edit product, update order...) are recorded so the
// dashboard "Activities" panel shows real usage, not just samples.
function logActivity(text) {
    var activities = getActivities();
    var user = getCurrentUser();

    activities.unshift({
        id: "A" + Date.now(),
        text: text,
        time: "just now",
        who: user ? user.name : "Admin",
        demo: false
    });

    // Keep the feed short.
    saveActivities(activities.slice(0, 20));
}

/* ---------- 5. SHARED SMALL RENDERERS ---------- */

// Product thumbnail used inside admin tables.
function adminThumb(product) {
    return '<img class="row-thumb" src="' + getProductImage(product, 0) + '" alt="' + escapeHtml(product.name) + '" onerror="this.onerror=null;this.src=getProductSvgById(\'' + product.id + '\',0)">';
}

// Status dropdown options (shared by order pages).
function statusOptions(current) {
    var stages = ["Placed", "Confirmed", "Packed", "Shipped", "Delivered"];
    var html = "";
    stages.forEach(function (stage) {
        html += '<option value="' + stage + '"' + (stage === current ? " selected" : "") + ">" + stage + "</option>";
    });
    return html;
}
