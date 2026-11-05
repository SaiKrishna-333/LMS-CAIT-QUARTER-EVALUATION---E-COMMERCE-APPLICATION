/* ==========================================================================
   NOVA - auth.js   ***** FILE GUIDE (MASTER COMMENT) *****
   --------------------------------------------------------------------------
   IN ONE SENTENCE: This single script powers the three account pages -
   login, register and the profile view - checking what the user types and
   talking to Local Storage through storage.js / common.js.

   HOW IT DECIDES WHAT TO DO
   login.html, register.html and profile.html all load this one file. It
   looks at which page it is on and calls the matching setup function, so the
   same file serves three different jobs.

   VALIDATION (friendly, inline - no browser alerts)
   Each field is checked as the form is submitted; problems are shown right
   under the box with setFieldError(), and only when everything is valid does
   the account get created or the shopper signed in.

   FUNCTIONS IN THIS FILE
   - setFieldError(inputId, message)  - show/clear a red note under one field
   - isValidEmail(text)               - simple "name@domain.tld" pattern test
   - isValidPhone(text)               - accepts 10-digit Indian numbers
   - setupLoginPage()                 - check email+password, match a stored
                                        user, save novaCurrentUser, go home
   - setupRegisterPage()              - validate every field, reject duplicate
                                        emails, push the new user, auto-login
   - setupProfilePage()               - greet the signed-in shopper and list
                                        their saved details + order count
   - info(label, value)               - one row of text used on the profile

   DATA FLOW: passwords and profiles are stored in novaUsers; the person
   signed in right now is copied into novaCurrentUser so the header badge and
   every page can greet them.
   ========================================================================== */

/* ==========================================================================
   NOVA - auth.js  (LOGIN / REGISTER / PROFILE LOGIC)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES:
   - Shared form-validation helpers (inline error messages under each field).
   - Login: compare the entered email + password with novaUsers.
   - Register: create a new customer account in novaUsers.
   - Profile: show the signed-in user, their order count and a logout button.

   ACADEMIC NOTE shown to evaluators:
   Passwords here are plain text inside Local Storage because there is no
   server. Real websites hash passwords and verify them on a backend.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    renderHeader("account");

    // The same file serves three pages - react to whichever form exists.
    if (document.getElementById("loginForm")) { setupLoginPage(); }
    if (document.getElementById("registerForm")) { setupRegisterPage(); }
    if (document.getElementById("profileBox")) { setupProfilePage(); }
});

/* ---------- 1. VALIDATION HELPERS ---------- */

// Show (or clear) the red message under one input.
function setFieldError(inputId, message) {
    var input = document.getElementById(inputId);
    var errorBox = document.getElementById(inputId + "Error");

    if (errorBox) { errorBox.textContent = message || ""; }
    if (input) {
        input.classList.toggle("input-error", message ? true : false);
    }
}

// A readable email pattern: something@something.tld
function isValidEmail(text) {
    var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(text);
}

// Indian mobile numbers: exactly 10 digits starting 6-9.
function isValidPhone(text) {
    var pattern = /^[6-9]\d{9}$/;
    return pattern.test(text);
}

/* ---------- 2. LOGIN PAGE ---------- */
function setupLoginPage() {
    var form = document.getElementById("loginForm");

    // If already signed in there is nothing to do here.
    if (getCurrentUser()) {
        window.location.href = "index.html";
        return;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault(); // stop the browser reloading the page

        var email = document.getElementById("email").value.trim().toLowerCase();
        var password = document.getElementById("password").value;
        var ok = true;

        if (email === "") {
            setFieldError("email", "Email is required.");
            ok = false;
        } else if (!isValidEmail(email)) {
            setFieldError("email", "Please enter a valid email address.");
            ok = false;
        } else {
            setFieldError("email", "");
        }

        if (password === "") {
            setFieldError("password", "Password is required.");
            ok = false;
        } else {
            setFieldError("password", "");
        }

        if (!ok) { return; }

        // Look for a user with this email AND this password.
        var users = getUsers();
        var matched = null;

        for (var i = 0; i < users.length; i++) {
            if (users[i].email.toLowerCase() === email && users[i].password === password) {
                matched = users[i];
            }
        }

        if (!matched) {
            setFieldError("password", "Incorrect email or password.");
            showToast("Login failed. Check the demo credentials below the form.", "error");
            return;
        }

        // Save WHO is logged in. Every page reads this on load, which is how
        // the login state survives refreshes.
        saveData("novaCurrentUser", matched);
        showToast("Welcome back, " + matched.name + "!");

        // Where to go next:
        // ?admin=1  -> came from an admin page guard  -> admin dashboard
        // ?next=... -> the page that bounced the user -> back there
        // otherwise -> homepage.
        var params = new URLSearchParams(window.location.search);

        if (params.get("admin") === "1" && matched.role === "admin") {
            window.location.href = "admin/dashboard.html";
        } else if (params.get("admin") === "1" && matched.role !== "admin") {
            setFieldError("password", "This account is not an administrator.");
        } else if (params.get("next")) {
            window.location.href = params.get("next");
        } else {
            window.location.href = "index.html";
        }
    });
}

/* ---------- 3. REGISTER PAGE ---------- */
function setupRegisterPage() {
    var form = document.getElementById("registerForm");

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        var name = document.getElementById("name").value.trim();
        var email = document.getElementById("email").value.trim().toLowerCase();
        var phone = document.getElementById("phone").value.trim();
        var password = document.getElementById("password").value;
        var confirm = document.getElementById("confirm").value;
        var ok = true;

        // --- validate every field, one clear message per problem ---
        if (name.length < 3) {
            setFieldError("name", "Please enter your full name (3+ characters).");
            ok = false;
        } else { setFieldError("name", ""); }

        if (!isValidEmail(email)) {
            setFieldError("email", "Please enter a valid email address.");
            ok = false;
        } else { setFieldError("email", ""); }

        if (!isValidPhone(phone)) {
            setFieldError("phone", "Enter a valid 10-digit mobile number.");
            ok = false;
        } else { setFieldError("phone", ""); }

        if (password.length < 6) {
            setFieldError("password", "Password must be at least 6 characters.");
            ok = false;
        } else { setFieldError("password", ""); }

        if (confirm !== password) {
            setFieldError("confirm", "Passwords do not match.");
            ok = false;
        } else { setFieldError("confirm", ""); }

        if (!ok) { return; }

        // --- duplicate check ---
        var users = getUsers();
        for (var i = 0; i < users.length; i++) {
            if (users[i].email.toLowerCase() === email) {
                setFieldError("email", "This email is already registered. Please sign in.");
                return;
            }
        }

        // --- create the account ---
        // New sign-ups are ALWAYS customers; admin is only the demo account.
        var newUser = {
            id: "U" + Date.now(),       // timestamp keeps ids unique
            name: name,
            email: email,
            password: password,
            phone: phone,
            role: "customer",
            joined: new Date().toISOString(),
            demo: false                 // not a sample record
        };

        users.push(newUser);
        saveUsers(users);

        // Sign the new user straight in.
        saveData("novaCurrentUser", newUser);
        showToast("Account created. Welcome to NOVA, " + name + "!");
        window.location.href = "index.html";
    });
}

/* ---------- 4. PROFILE PAGE ---------- */
function setupProfilePage() {
    var user = getCurrentUser();
    var box = document.getElementById("profileBox");

    // Guests are asked to log in first.
    if (!user) {
        box.innerHTML = '<div class="empty-state"><div class="empty-icon"><i data-lucide="user"></i></div>' +
            '<h3>You are not signed in</h3><p>Sign in to see your profile and orders.</p>' +
            '<a href="login.html" class="btn btn-primary">Sign In</a></div>';
        refreshIcons();
        return;
    }

    // Count this user's orders from the shared order list.
    var myOrders = getOrders().filter(function (order) {
        return order.userId === user.id;
    });

    var adminLink = user.role === "admin"
        ? '<a href="admin/dashboard.html" class="btn btn-outline"><i data-lucide="layout-dashboard"></i> Open Admin Dashboard</a>'
        : "";

    box.innerHTML =
        '<div class="profile-head"><div class="avatar-lg">' + user.name.charAt(0).toUpperCase() + '</div>' +
        '<div><h1>' + escapeHtml(user.name) + '</h1>' +
        '<p>' + (user.role === "admin" ? "Administrator account" : "Customer account") +
        (user.demo ? ' &middot; <span class="stock-tag low">demo record</span>' : "") + '</p></div></div>' +
        '<div class="info-grid">' +
        info("Email", user.email) +
        info("Phone", user.phone || "-") +
        info("Member since", formatDate(user.joined)) +
        info("Orders placed", String(myOrders.length)) +
        info("Cart items", String(getCart().length)) +
        info("Wishlist items", String(getWishlist().length)) +
        '</div><div style="display:flex;gap:12px;margin-top:24px;flex-wrap:wrap">' +
        '<a href="orders.html" class="btn btn-primary"><i data-lucide="package"></i> My Orders</a>' +
        adminLink +
        '<button class="btn btn-outline" onclick="logoutUser()"><i data-lucide="log-out"></i> Logout</button>' +
        '</div>';

    refreshIcons();

    // Small builder for one label/value pair.
    function info(label, value) {
        return '<div><div class="label">' + label + '</div><b>' + escapeHtml(value) + '</b></div>';
    }
}
