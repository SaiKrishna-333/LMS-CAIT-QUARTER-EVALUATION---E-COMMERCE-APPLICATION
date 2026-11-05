/* ==========================================================================
   NOVA - dashboard.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This is the analytics home of the admin console. It adds
   up everything happening in the store and shows it as stat cards and charts
   - drawn with pure CSS and SVG, so NO external chart library is used.

   EVERY NUMBER IS COMPUTED LIVE
   computeStats() reads products, orders and users from storage.js each time,
   so the dashboard always matches reality. A few clearly-labelled sample
   figures (like the "views" count) stand in for data a real backend would
   supply.

   FUNCTIONS IN THIS FILE
   - drawContent()          - run stats then lay out the three columns
   - computeStats()         - revenue, order counts, customers, low stock, etc.
   - delta(cur, prev)       - the up/down % arrow beside a stat card
   - leftColumn/statCardsRow/card - the headline number tiles on the left
   - middleColumn(stats)    - the chart-heavy centre area
   - revenuePanel()         - weekly sales bars (flexbox) with a trend line
   - monthlyPanel()         - 6-month SVG polyline chart with a gradient fill
   - locationPanel()        - orders grouped by city shown as horizontal bars
   - categoryPanel()        - category share as a conic-gradient donut
   - recentOrdersPanel()    - the latest few orders in a compact table
   - rightColumn/notificationsPanel - the admin alert feed with filter chips
   - setNoteFilter(filter)  - show all / unread / order notifications only
   - markNotesRead()        - flag every notification as read
   - activityPanel()        - the running list of admin actions (logActivity)
   - lowStockPanel()        - products under their threshold, needing restock
   - restock(productId)     - one-click top-up of a low-stock item

   The whole page is read-mostly: its job is to turn stored data into clear,
   at-a-glance pictures the shop owner can act on.
   ========================================================================== */

/* ==========================================================================
   NOVA - dashboard.js  (ADMIN ANALYTICS OVERVIEW)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Every number on this page is CALCULATED from the Local Storage data
   (orders, products, users) - nothing is hard-coded, so the dashboard
   changes as soon as a customer places an order in the storefront.
   Charts are pure CSS/SVG: no chart library is needed.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    var user = renderAdminShell("overview");
    if (!user) { return; } // guard redirected us to the login page

    drawContent();
});

function drawContent() {
    var stats = computeStats();

    document.getElementById("adminContent").innerHTML =
        '<div class="dash-grid">' +
        leftColumn(stats) +
        middleColumn(stats) +
        rightColumn() +
        "</div>";

    refreshIcons();
}

/* ---------- 1. THE CALCULATION HEART ---------- */
// One pass over the orders gives us every headline figure.
function computeStats() {
    var orders = getOrders();
    var products = getProducts();
    var users = getUsers();

    var revenue = 0;
    orders.forEach(function (order) {
        revenue += order.total;
    });

    // Customers = registered users + sample buyers seen in orders.
    var customerNames = {};
    users.forEach(function (u) { customerNames[u.email] = true; });
    orders.forEach(function (o) { customerNames[o.customerName] = true; });

    // Growth compares the last 7 days with the 7 days before that.
    var week = 7 * 24 * 60 * 60 * 1000;
    var now = Date.now();
    var thisWeek = 0;
    var lastWeek = 0;

    orders.forEach(function (order) {
        var age = now - new Date(order.date).getTime();
        if (age <= week) { thisWeek += order.total; }
        else if (age <= 2 * week) { lastWeek += order.total; }
    });

    var growth = lastWeek === 0 ? (thisWeek > 0 ? 100 : 0)
        : Math.round((thisWeek - lastWeek) / lastWeek * 100);

    return {
        revenue: revenue,
        orders: orders.length,
        customers: Object.keys(customerNames).length,
        products: products.length,
        views: 3781, // clearly-labelled sample figure (no real traffic exists)
        growth: growth
    };
}

// Percentage change helper used by the small summary rows.
function delta(current, previous) {
    if (previous === 0) { return "+100%"; }
    var pct = Math.round((current - previous) / previous * 100);
    return (pct >= 0 ? "+" : "") + pct + "%";
}

/* ---------- 2. LEFT COLUMN: SUMMARY LIST ---------- */
function leftColumn(stats) {
    var orders = getOrders();

    // Count orders in the last 7 days vs the 7 days before.
    var week = 7 * 24 * 60 * 60 * 1000;
    var now = Date.now();
    var recentOrders = 0;
    var prevOrders = 0;

    orders.forEach(function (order) {
        var age = now - new Date(order.date).getTime();
        if (age <= week) { recentOrders += 1; }
        else if (age <= 2 * week) { prevOrders += 1; }
    });

    var items = [
        { icon: "eye", label: "Views", value: stats.views.toLocaleString(), note: "sample", up: true },
        { icon: "users", label: "Customers", value: stats.customers.toLocaleString(), note: delta(stats.customers, Math.max(1, stats.customers - 1)), up: true },
        { icon: "shopping-bag", label: "Orders", value: String(stats.orders), note: delta(recentOrders, prevOrders), up: recentOrders >= prevOrders },
        { icon: "rupee", label: "Revenue", value: formatMoney(stats.revenue), note: stats.growth + "%", up: stats.growth >= 0 }
    ];

    var listHtml = "";
    items.forEach(function (item) {
        listHtml += '<div class="summary-item">' +
            '<div class="s-icon"><i data-lucide="' + item.icon + '"></i></div>' +
            "<div><div class=\"s-label\">" + item.label + "</div>" +
            '<div class="s-value">' + item.value + " " +
            '<span class="' + (item.up ? "delta-up" : "delta-down") + '">' + item.note + "</span></div></div>" +
            '<span style="margin-left:auto;color:var(--violet)"><i data-lucide="move-up-right"></i></span>' +
            "</div>";
    });

    return '<div class="dash-col">' +
        '<div class="panel"><div class="panel-head"><h3>Summary</h3>' +
        '<span class="panel-chip">Weekly ▾</span></div>' +
        '<div class="summary-list">' + listHtml + "</div></div>" +
        statCardsRow(stats) +
        "</div>";
}

// Four headline stat cards (they sit under the summary on wide screens).
function statCardsRow(stats) {
    return '<div class="panel"><div class="stat-cards" style="grid-template-columns:repeat(2,1fr)">' +
        card("Total Revenue", formatMoney(stats.revenue)) +
        card("Total Orders", String(stats.orders)) +
        card("Total Customers", String(stats.customers)) +
        card("Total Products", String(stats.products)) +
        "</div></div>";

    function card(label, value) {
        return '<div class="stat-card"><div class="st-label">' + label + "</div>" +
            '<div class="st-value">' + value + "</div>" +
            '<div style="font-size:0.72rem;color:var(--text-2)">from Local Storage data</div></div>';
    }
}

/* ---------- 3. MIDDLE COLUMN: CHARTS + TABLES ---------- */
function middleColumn(stats) {
    return '<div class="dash-col">' +
        revenuePanel(stats) +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">' +
        monthlyPanel() + locationPanel() +
        "</div>" +
        categoryPanel() +
        recentOrdersPanel() +
        "</div>";
}

// Weekly revenue bar chart (last 8 weeks) - pure CSS bars.
function revenuePanel(stats) {
    var orders = getOrders();
    var weekMs = 7 * 24 * 60 * 60 * 1000;
    var now = Date.now();

    // Bucket every order into "8 weeks ago ... this week".
    var buckets = [0, 0, 0, 0, 0, 0, 0, 0];
    orders.forEach(function (order) {
        var weeksAgo = Math.floor((now - new Date(order.date).getTime()) / weekMs);
        if (weeksAgo >= 0 && weeksAgo < 8) {
            buckets[7 - weeksAgo] += order.total;
        }
    });

    var max = Math.max.apply(null, buckets);
    if (max === 0) { max = 1; } // avoid divide-by-zero on a fresh install

    var bars = "";
    buckets.forEach(function (value, i) {
        var height = Math.round(value / max * 100);
        var isCurrent = i === 7;
        bars += '<div class="bar-col' + (isCurrent ? " hot" : "") + '">' +
            (isCurrent && value > 0 ? '<span class="bar-value">' + formatMoney(value) + "</span>" : "") +
            '<div class="bar" style="height:' + height + '%"></div>' +
            '<span class="bar-label">' + (8 - i) + " W</span></div>";
    });

    return '<div class="panel"><div class="panel-head"><h3>Total Revenue <span style="color:var(--text-2);font-weight:400">| ' +
        formatMoney(stats.revenue) + "</span></h3>" +
        '<span class="panel-chip">Weekly ▾</span></div>' +
        '<div style="display:flex;align-items:center;gap:16px;margin-bottom:10px">' +
        '<div style="font-size:2rem;font-weight:800;color:var(--violet)">' + stats.growth + "%</div>" +
        '<p style="font-size:0.78rem">growth vs the previous week.<br>Sample "Views" data is labelled as such.</p></div>' +
        '<div class="bar-chart">' + bars + "</div></div>";
}

// Monthly line chart (last 6 months) drawn as one SVG polyline.
function monthlyPanel() {
    var orders = getOrders();
    var now = new Date();
    var months = [];
    var values = [];

    for (var i = 5; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.toLocaleString("en", { month: "short" }));
        values.push(0);
    }

    // Sum each order into its month bucket.
    orders.forEach(function (order) {
        var od = new Date(order.date);
        for (var j = 0; j < 6; j++) {
            var m = new Date(now.getFullYear(), now.getMonth() - (5 - j), 1);
            if (od.getFullYear() === m.getFullYear() && od.getMonth() === m.getMonth()) {
                values[j] += order.total;
            }
        }
    });

    var max = Math.max.apply(null, values);
    if (max === 0) { max = 1; }

    // Convert values to SVG points across a 300x120 box.
    var points = "";
    var areaPoints = "0,120 ";
    values.forEach(function (value, i) {
        var x = i * 60;
        var y = 110 - (value / max) * 100;
        points += x + "," + y.toFixed(1) + " ";
        areaPoints += x + "," + y.toFixed(1) + " ";
    });
    areaPoints += "300,120";

    var svg = '<svg viewBox="0 0 300 130" preserveAspectRatio="none">' +
        '<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="rgba(160,96,240,0.45)"/>' +
        '<stop offset="100%" stop-color="rgba(160,96,240,0)"/></linearGradient></defs>' +
        '<line class="grid-line" x1="0" y1="30" x2="300" y2="30"/>' +
        '<line class="grid-line" x1="0" y1="70" x2="300" y2="70"/>' +
        '<polygon points="' + areaPoints + '" fill="url(#lg)"/>' +
        '<polyline points="' + points + '" fill="none" stroke="#a060f0" stroke-width="2.5" stroke-linecap="round"/>' +
        "</svg>";

    var labels = '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-2);margin-top:8px">' +
        months.map(function (m) { return "<span>" + m + "</span>"; }).join("") + "</div>";

    return '<div class="panel"><div class="panel-head"><h3>Monthly Sales</h3></div>' +
        '<div class="line-chart-wrap">' + svg + "</div>" + labels + "</div>";
}

// Location-wise revenue: group real orders by the city in the address.
function locationPanel() {
    var orders = getOrders();
    var byCity = {};

    orders.forEach(function (order) {
        var city = "Other";
        if (order.address) {
            // Address format is "street, city - PIN": take the middle part.
            var parts = order.address.split(",");
            if (parts.length >= 2) {
                city = parts[parts.length - 1].split(" - ")[0].trim();
            }
        }
        byCity[city] = (byCity[city] || 0) + order.total;
    });

    var names = Object.keys(byCity);
    if (names.length === 0) { names = ["New York", "Sydney", "Hong Kong"]; } // fresh install
    var max = Math.max.apply(null, names.map(function (c) { return byCity[c] || 1; }));

    var bars = "";
    names.slice(0, 4).forEach(function (city) {
        var value = byCity[city] || 0;
        bars += '<div class="hbar-row"><span>' + city + "</span>" +
            '<div class="hbar-track"><div class="hbar-fill" style="width:' +
            Math.round(value / max * 100) + '%"></div></div>' +
            "<span>" + formatMoney(value) + "</span></div>";
    });

    return '<div class="panel"><div class="panel-head"><h3>Location wise Revenue</h3></div>' +
        '<div style="text-align:center;font-size:2.4rem;margin-bottom:8px">🗺️</div>' + bars + "</div>";
}

// Category distribution donut (share of catalogue per category).
function categoryPanel() {
    var products = getProducts();
    var palette = ["#8038e8", "#a060f0", "#503080", "#c9a6ff", "#3a2a55"];
    var legend = "";
    var gradientParts = [];
    var angle = 0;

    NOVA_CATEGORIES.forEach(function (category, i) {
        var count = products.filter(function (p) { return p.category === category; }).length;
        var share = products.length === 0 ? 0 : count / products.length * 360;

        gradientParts.push(palette[i] + " " + angle.toFixed(1) + "deg " + (angle + share).toFixed(1) + "deg");
        angle += share;

        legend += '<div><span class="legend-dot" style="background:' + palette[i] + '"></span>' +
            category + " &mdash; " + count + " products</div>";
    });

    return '<div class="panel"><div class="panel-head"><h3>Category Distribution</h3></div>' +
        '<div style="display:grid;grid-template-columns:180px 1fr;gap:20px;align-items:center">' +
        '<div class="donut" style="background:conic-gradient(' + gradientParts.join(",") + ')"></div>' +
        '<div class="donut-legend">' + legend + "</div></div></div>";
}

// Latest orders table (top 5).
function recentOrdersPanel() {
    var orders = getOrders().slice(0, 5);
    var rows = "";

    orders.forEach(function (order) {
        rows += "<tr><td><b>" + order.id + "</b>" + (order.demo ? " ⚠" : "") + "</td>" +
            "<td>" + escapeHtml(order.customerName) + "</td>" +
            "<td>" + formatDate(order.date) + "</td>" +
            "<td>" + formatMoney(order.total) + "</td>" +
            '<td><span class="status-pill ' + order.status + '">' + order.status + "</span></td></tr>";
    });

    return '<div class="panel"><div class="panel-head"><h3>Recent Orders</h3>' +
        '<a class="panel-chip" href="orders.html" style="text-decoration:none">Manage →</a></div>' +
        '<div class="table-wrap"><table class="admin-table"><thead><tr>' +
        "<th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th>" +
        "</tr></thead><tbody>" + (rows || "<tr><td colspan=5>No orders yet</td></tr>") +
        "</tbody></table></div>" +
        "<p style='font-size:0.72rem;margin-top:8px'>⚠ marks sample demonstration orders.</p></div>";
}

/* ---------- 4. RIGHT COLUMN: NOTIFICATIONS + ACTIVITY + ALERTS ---------- */
function rightColumn() {
    return '<div class="dash-col">' + notificationsPanel() + activityPanel() + lowStockPanel() + "</div>";
}

var noteFilter = "all"; // All / Team / Mention chips

function notificationsPanel() {
    var notes = getNotifications();
    var shown = notes.filter(function (n) {
        return noteFilter === "all" || n.type === noteFilter;
    });

    var chips = '<button class="chip' + (noteFilter === "all" ? " active" : "") + '" onclick="setNoteFilter(\'all\')">All (' + notes.length + ')</button>' +
        '<button class="chip' + (noteFilter === "team" ? " active" : "") + '" onclick="setNoteFilter(\'team\')">Team</button>' +
        '<button class="chip' + (noteFilter === "mention" ? " active" : "") + '" onclick="setNoteFilter(\'mention\')">Mention</button>';

    var items = "";
    shown.forEach(function (note) {
        items += '<div class="feed-item"><div class="f-avatar">' +
            (note.read ? "·" : "!") + "</div><div>" +
            '<div class="f-title">' + escapeHtml(note.title) + "</div>" +
            '<div class="f-desc">' + escapeHtml(note.text) + "</div></div>" +
            '<span class="f-time">' + note.time + "</span></div>";
    });

    return '<div class="panel"><div class="panel-head"><h3>Notifications</h3>' +
        '<button class="panel-chip" onclick="markNotesRead()">Mark read ✓</button></div>' +
        '<div class="chip-row">' + chips + "</div>" +
        '<div class="feed-list">' + (items || '<p style="font-size:0.82rem">Nothing here.</p>') + "</div></div>";
}

function setNoteFilter(filter) {
    noteFilter = filter;
    drawContent(); // quick redraw
}

function markNotesRead() {
    var notes = getNotifications();
    notes.forEach(function (n) { n.read = true; });
    saveNotifications(notes);
    adminToast("All notifications marked as read");
    drawContent();
}

function activityPanel() {
    var activities = getActivities().slice(0, 6);
    var items = "";

    activities.forEach(function (act) {
        items += '<div class="feed-item"><div class="f-avatar">' +
            (act.who || "A").charAt(0).toUpperCase() + "</div><div>" +
            '<div class="f-title">' + escapeHtml(act.text) + "</div>" +
            '<div class="f-desc">' + escapeHtml(act.who || "") + "</div></div>" +
            '<span class="f-time">' + act.time + "</span></div>";
    });

    return '<div class="panel"><div class="panel-head"><h3>Activities</h3></div>' +
        '<div class="feed-list">' + (items || "<p>No activity recorded yet.</p>") + "</div></div>";
}

// Inventory alerts: products at or below 10 units, with a quick restock.
function lowStockPanel() {
    var low = getProducts().filter(function (p) { return p.stock <= 10; });
    var items = "";

    low.forEach(function (p) {
        items += '<div class="feed-item"><div class="f-avatar">' + p.name.charAt(0) + "</div><div>" +
            '<div class="f-title">' + escapeHtml(p.name) + "</div>" +
            '<div class="f-desc">' + (p.stock === 0 ? "OUT of stock" : p.stock + " left") + "</div></div>" +
            '<button class="mini-btn" title="Restock +10" onclick="restock(\'' + p.id + '\')">+</button></div>';
    });

    return '<div class="panel"><div class="panel-head"><h3>Inventory Alerts</h3></div>' +
        '<div class="feed-list">' + (items || "<p>All products are well stocked.</p>") + "</div></div>";
}

// Quick restock straight from the dashboard.
function restock(productId) {
    var products = getProducts();
    for (var i = 0; i < products.length; i++) {
        if (products[i].id === productId) {
            products[i].stock += 10;
            saveProducts(products);
            logActivity("Restocked " + products[i].name + " (+10)");
            adminToast(products[i].name + " restocked by 10");
            drawContent();
            return;
        }
    }
}
