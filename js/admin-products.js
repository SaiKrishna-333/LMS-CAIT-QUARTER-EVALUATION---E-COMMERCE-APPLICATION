/* ==========================================================================
   NOVA - admin-products.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This page is the product manager. It lists every product
   and lets the admin Add a new one, Edit an existing one, Delete one, or
   Reset the whole catalogue back to the 20 original demo items.

   ADD / EDIT SHARE ONE FORM
   The same pop-up form (an admin modal from admin.js) is reused for both
   creating and editing; openEditForm just pre-fills it with the chosen
   product. On save the script validates the fields, updates novaProducts and
   redraws the table - so changes appear instantly in the customer shop too.

   FUNCTIONS IN THIS FILE
   - buildContent()        - renderAdminShell + draw the table + wire buttons
   - drawTable()           - one row per product (thumb, name, category,
                             price, stock) with Edit / Delete actions
   - fillFormSelects()     - populate the category dropdown in the form
   - openAddForm()         - clear the modal form for a brand-new product
   - openEditForm(id)      - load a product's values into the form
   - clearErrors()         - wipe any red validation notes before re-checking
   - setupForm()           - handle submit: validate, build the object, save
   - error(id, message)    - show a validation note under one form field
   - deleteProduct(id)     - confirm, remove from novaProducts, redraw
   - resetDemoAction()     - call resetDemoData() to restore the originals

   New products are given a shape + hue so the SVG image factory can draw a
   picture for them without any uploaded photo file.
   ========================================================================== */

/* ==========================================================================
   NOVA - admin-products.js  (PRODUCT ADD / EDIT / DELETE)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   Full CRUD over novaProducts. Because the storefront catalogue reads the
   same list, every change here appears in the customer shop immediately.
   ========================================================================== */

// Image styles offered in the product form (must match shapeSvg() cases).
var SHAPE_CHOICES = ["headphones", "earbuds", "monitor", "laptop", "phone", "watch",
    "jacket", "dress", "sneakers", "lamp", "vase", "pillow", "kettle", "backpack",
    "sunglasses", "camera", "yogamat", "bottle", "speaker", "chair"];

var search = "";

document.addEventListener("DOMContentLoaded", function () {
    if (!renderAdminShell("products")) { return; }
    buildContent();
    fillFormSelects();
    setupForm();
});

/* ---------- PAGE CONTENT ---------- */
function buildContent() {
    document.getElementById("adminContent").innerHTML =
        '<div class="panel">' +
        '<div class="toolbar">' +
        '<input class="form-control" id="prodSearch" placeholder="Search products...">' +
        '<div class="spacer"></div>' +
        '<button class="btn btn-outline btn-sm" onclick="resetDemoAction()"><i data-lucide="rotate-ccw"></i> Reset demo data</button>' +
        '<button class="btn btn-primary btn-sm" onclick="openAddForm()"><i data-lucide="plus"></i> Add Product</button>' +
        "</div>" +
        '<div class="table-wrap"><table class="admin-table" id="prodTable"></table></div>' +
        "</div>";

    document.getElementById("prodSearch").addEventListener("input", function () {
        search = this.value.trim().toLowerCase();
        drawTable();
    });

    drawTable();
    refreshIcons();
}

/* ---------- TABLE ---------- */
function drawTable() {
    var list = getProducts().filter(function (p) {
        return p.name.toLowerCase().indexOf(search) !== -1;
    });

    var rows = "";
    list.forEach(function (p) {
        var discount = Math.round((1 - p.price / p.originalPrice) * 100);
        rows += "<tr>" +
            "<td style='display:flex;align-items:center;gap:12px'>" + adminThumb(p) +
            "<div><b>" + escapeHtml(p.name) + "</b>" +
            (p.demo ? ' <span class="stock-tag low">sample</span>' : "") +
            '<div style="font-size:0.75rem;color:var(--text-2)">' + p.id + "</div></div></td>" +
            "<td>" + p.category + "</td>" +
            "<td>" + formatMoney(p.price) +
            (discount > 0 ? ' <span style="color:var(--green);font-size:0.75rem">(-' + discount + "%)</span>" : "") + "</td>" +
            "<td>" + stockLabel(p.stock) + "</td>" +
            '<td><div class="row-actions">' +
            '<button class="mini-btn" title="Edit" onclick="openEditForm(\'' + p.id + '\')"><i data-lucide="pencil"></i></button>' +
            '<button class="mini-btn danger" title="Delete" onclick="deleteProduct(\'' + p.id + '\')"><i data-lucide="trash-2"></i></button>' +
            "</div></td></tr>";
    });

    document.getElementById("prodTable").innerHTML =
        "<thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead>" +
        "<tbody>" + (rows || "<tr><td colspan=5>No products found.</td></tr>") + "</tbody>";
    refreshIcons();
}

/* ---------- FORM SELECTS ---------- */
function fillFormSelects() {
    var categorySelect = document.getElementById("fCategory");
    var shapeSelect = document.getElementById("fShape");

    NOVA_CATEGORIES.forEach(function (c) {
        categorySelect.innerHTML += "<option value='" + c + "'>" + c + "</option>";
    });

    SHAPE_CHOICES.forEach(function (s) {
        shapeSelect.innerHTML += "<option value='" + s + "'>" + s + "</option>";
    });
}

/* ---------- ADD / EDIT MODAL ---------- */
function openAddForm() {
    document.getElementById("modalTitle").textContent = "Add Product";
    document.getElementById("productForm").reset();
    document.getElementById("fId").value = ""; // empty id = creating new
    clearErrors();
    openModal("productModal");
}

function openEditForm(productId) {
    var p = findProduct(productId);
    if (!p) { return; }

    document.getElementById("modalTitle").textContent = "Edit Product";
    document.getElementById("fId").value = p.id;
    document.getElementById("fName").value = p.name;
    document.getElementById("fCategory").value = p.category;
    document.getElementById("fShape").value = p.shape || "headphones";
    document.getElementById("fPrice").value = p.price;
    document.getElementById("fOriginal").value = p.originalPrice;
    document.getElementById("fStock").value = p.stock;
    document.getElementById("fHue").value = p.hue || 270;
    document.getElementById("fDesc").value = p.description;
    document.getElementById("fFeatured").checked = !!p.featured;
    document.getElementById("fNew").checked = !!p.isNew;
    clearErrors();
    openModal("productModal");
}

function clearErrors() {
    document.querySelectorAll("#productForm .field-error").forEach(function (el) {
        el.textContent = "";
    });
}

/* ---------- VALIDATION + SAVE ---------- */
function setupForm() {
    document.getElementById("productForm").addEventListener("submit", function (event) {
        event.preventDefault();

        var name = document.getElementById("fName").value.trim();
        var price = Number(document.getElementById("fPrice").value);
        var original = Number(document.getElementById("fOriginal").value);
        var stock = Number(document.getElementById("fStock").value);
        var desc = document.getElementById("fDesc").value.trim();
        var ok = true;

        // Rules mirror the assignment's validation list.
        if (name.length < 3) {
            error("fName", "Name must be at least 3 characters."); ok = false;
        } else { error("fName", ""); }

        if (!(price > 0)) {
            error("fPrice", "Price must be greater than zero."); ok = false;
        } else { error("fPrice", ""); }

        if (!(original >= price)) {
            error("fOriginal", "Original price must be ≥ selling price."); ok = false;
        } else { error("fOriginal", ""); }

        if (isNaN(stock) || stock < 0) {
            error("fStock", "Stock cannot be negative."); ok = false;
        } else { error("fStock", ""); }

        if (desc.length < 10) {
            error("fDesc", "Please write a description (10+ characters)."); ok = false;
        } else { error("fDesc", ""); }

        if (!ok) { return; }

        var products = getProducts();
        var editingId = document.getElementById("fId").value;

        var data = {
            name: name,
            category: document.getElementById("fCategory").value,
            shape: document.getElementById("fShape").value,
            price: price,
            originalPrice: original,
            stock: stock,
            hue: Number(document.getElementById("fHue").value) || 270,
            description: desc,
            featured: document.getElementById("fFeatured").checked,
            isNew: document.getElementById("fNew").checked
        };

        if (editingId === "") {
            // CREATE: new id = P + timestamp tail, sensible demo defaults.
            data.id = "P" + Date.now().toString().slice(-6);
            data.rating = 4.0;
            data.reviews = 0;
            data.specs = { "Description": desc.slice(0, 40) + "..." };
            data.demo = false;
            products.push(data);
            logActivity("Added product " + name);
            adminToast("Product added to the store");
        } else {
            // UPDATE: merge the form data onto the stored product.
            for (var i = 0; i < products.length; i++) {
                if (products[i].id === editingId) {
                    Object.keys(data).forEach(function (key) {
                        products[i][key] = data[key];
                    });
                }
            }
            logActivity("Updated product " + name);
            adminToast("Product updated");
        }

        saveProducts(products);
        closeModal("productModal");
        drawTable();
    });

    function error(id, message) {
        document.getElementById(id + "Error").textContent = message;
        document.getElementById(id).classList.toggle("input-error", message ? true : false);
    }
}

/* ---------- DELETE ---------- */
// confirm() is acceptable here: it is a destructive, deliberate action.
function deleteProduct(productId) {
    var product = findProduct(productId);
    if (!product) { return; }

    var yes = confirm('Delete "' + product.name + '"?\nIt will disappear from the customer catalogue too.');
    if (!yes) { return; }

    var products = getProducts().filter(function (p) { return p.id !== productId; });
    saveProducts(products);

    // Also clean the cart / wishlist / compare tray so no broken ids remain.
    saveCart(getCart().filter(function (l) { return l.id !== productId; }));
    saveWishlist(getWishlist().filter(function (id) { return id !== productId; }));
    saveData("novaCompare", loadData("novaCompare", []).filter(function (id) { return id !== productId; }));

    logActivity("Deleted product " + product.name);
    adminToast("Product deleted");
    drawTable();
}

/* ---------- RESET DEMO DATA ---------- */
function resetDemoAction() {
    var yes = confirm("Restore the ORIGINAL demonstration data?\nAll products, orders and settings changes made in this browser will be discarded.");
    if (!yes) { return; }

    resetDemoData();
    logActivity("Demo data restored");
    adminToast("Demo data has been reset");
    drawTable();
}
