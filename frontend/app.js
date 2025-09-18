// ✅ Correct base URL for production:
const API_ROOT = "https://ecommerce-backend-arnu.onrender.com/api/v1";


let currentPage = 1;
let nextPage = null;
let prevPage = null;

// --- Helper: Update cart count ---
function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const el = document.getElementById("cart-count");
  if (el) el.textContent = cart.length;
}

// --- Helper: Fetch with auto-refresh token ---
async function fetchWithToken(url, options = {}) {
  let access = localStorage.getItem("access");
  let res = await fetch(url, {
    ...options,
    headers: {
      "Authorization": "Bearer " + access,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (res.status === 401) { // token expired
    const refresh = localStorage.getItem("refresh");
    if (refresh) {
      const r = await fetch(`${API_ROOT}/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh })
      });
      if (r.ok) {
        const data = await r.json();
        localStorage.setItem("access", data.access);
        return fetchWithToken(url, options); // retry
      } else {
        alert("Session expired. Please login again.");
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        window.location.href = "login.html";
      }
    } else {
      alert("Session expired. Please login again.");
      window.location.href = "login.html";
    }
  }
  return res;
}

async function loadCurrentUser() {
  const headerRight = document.getElementById("header-right");
  headerRight.innerHTML = ""; // clear first

  const token = localStorage.getItem("access");
  if (token) {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/users/me/", {
        headers: { "Authorization": "Bearer " + token }
      });

      if (res.ok) {
        const user = await res.json();

        // Show username
        const nameSpan = document.createElement("span");
        nameSpan.textContent = user.username;
        nameSpan.style.marginRight = "10px";
        nameSpan.style.fontWeight = "600";

        // Logout button
        const logoutBtn = document.createElement("button");
        logoutBtn.textContent = "Logout";
        logoutBtn.className = "btn";
        logoutBtn.onclick = () => {
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
          window.location.reload();
        };

        headerRight.appendChild(nameSpan);
        headerRight.appendChild(logoutBtn);

      } else {
        showLoginLink();
      }

    } catch (err) {
      console.error(err);
      showLoginLink();
    }
  } else {
    showLoginLink();
  }
}

function showLoginLink() {
  const headerRight = document.getElementById("header-right");
  headerRight.innerHTML = "";
  const loginLink = document.createElement("a");
  loginLink.href = "login.html";
  loginLink.textContent = "Login";
  headerRight.appendChild(loginLink);
}
window.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  loadCurrentUser();
  loadCategories();
  loadProducts();
});



// --- Load categories into dropdown ---
async function loadCategories() {
  try {
    const res = await fetch(`${API_ROOT}/categories/`); 
    if (!res.ok) throw new Error("Failed to fetch categories");
    const data = await res.json();
    const categorySelect = document.getElementById("category");
    categorySelect.innerHTML = '<option value="">All Categories</option>'; // reset
    data.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat.id;      // must match your ProductFilter field
      option.textContent = cat.name;
      categorySelect.appendChild(option);
    });
  } catch (err) {
    console.error("Failed to load categories:", err);
  }
}



// Load products with filters, search, sort, pagination
async function loadProducts() {
  const search = document.getElementById("search")?.value || "";
  const category = document.getElementById("category")?.value || "";
  const minPrice = document.getElementById("minPrice")?.value || "";
  const maxPrice = document.getElementById("maxPrice")?.value || "";
  const ordering = document.getElementById("sort")?.value || "name";

  let url = `${API_ROOT}/products/?page=${currentPage}&ordering=${ordering}`;
  if(search) url += `&search=${search}`;
  if(category) url += `&category=${category}`;
  if(minPrice) url += `&min_price=${minPrice}`;
  if(maxPrice) url += `&max_price=${maxPrice}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    nextPage = data.next;
    prevPage = data.previous;
    document.getElementById("currentPage").textContent = currentPage;

    const container = document.getElementById("products");
    container.innerHTML = "";
    (data.results || data).forEach(p => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div>
          <img src="${p.image || 'https://via.placeholder.com/400x300'}" alt="${p.name}">
        </div>
        <div>
          <h3>${p.name}</h3>
          <p>${p.description || ''}</p>
          <div class="price">$${parseFloat(p.price).toFixed(2)}</div>
          <button class="btn" 
            onclick="addToCart(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${p.price}, '${p.image || 'https://via.placeholder.com/400x300'}')">
            Add to Cart
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load products", err);
  }
}

// --- Add product to cart ---
function addToCart(id, name, price, image) {
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const idx = cart.findIndex(it => it.id === id);
  if (idx > -1) cart[idx].qty += 1;
  else cart.push({ id, name, price: parseFloat(price), qty: 1, image });

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  alert(`${name} added to cart`);
}

// --- Cart rendering & actions ---
function renderCart() {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  const tbody = document.getElementById("cart-body");
  if (!tbody) return;

  tbody.innerHTML = "";
  cart.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="display:flex;gap:12px;align-items:center;">
        <img src="${item.image}" width="64" style="border-radius:6px;">
        <div><div style="font-weight:600">${item.name}</div></div>
      </td>
      <td>${item.qty}</td>
      <td>$${(item.price * item.qty).toFixed(2)}</td>
      <td><button class="btn" onclick="removeFromCart(${idx})">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function removeFromCart(index) {
  let cart = JSON.parse(localStorage.getItem("cart") || "[]");
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
  updateCartCount();
}

async function placeOrder() {
  const token = localStorage.getItem("access");
  if (!token) {
    alert("Please login first.");
    window.location.href = "login.html";
    return;
  }

  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
  if (!cart.length) {
    alert("Cart is empty.");
    return;
  }

  const payload = {
    order_items: cart.map(i => ({ product: i.id, quantity: i.qty }))
  };

  try {
    const res = await fetch(`${API_ROOT}/orders/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      localStorage.removeItem("cart");
      updateCartCount();
      document.getElementById("msg").textContent = "Order placed successfully!";
      renderCart();
    } else {
      const err = await res.json();
      console.error("Order error:", err);
      alert("Failed to place order. Check console for details.");
    }
  } catch (err) {
    console.error(err);
    alert("Error placing order. See console for details.");
  }
}

