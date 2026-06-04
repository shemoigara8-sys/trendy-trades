const API_BASE = '';
const form = document.getElementById('itemForm');
const list = document.getElementById('itemsList');
const message = document.getElementById('formMessage');
const imageInput = document.getElementById('image');
const imagePreview = document.getElementById('imagePreview');
const btnRegister = document.getElementById('btnRegister');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const meSpan = document.getElementById('me');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_CONDITIONS = ['New', 'Like New', 'Used', 'For parts'];

function authToken() { return localStorage.getItem('tt_token'); }
function setAuthToken(token) { if (token) localStorage.setItem('tt_token', token); else localStorage.removeItem('tt_token'); }

function showMessage(text, type = 'info') {
  message.textContent = text;
  message.className = text ? `message ${type}` : 'message';
}

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

function validateUsername(username) {
  return typeof username === 'string' && /^[a-zA-Z0-9_]{3,24}$/.test(username);
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

function validateTitle(title) {
  return typeof title === 'string' && title.trim().length >= 3 && title.trim().length <= 100;
}

function validateDescription(description) {
  return typeof description === 'string' && description.trim().length <= 500;
}

function validatePrice(price) {
  const value = Number(price);
  return Number.isFinite(value) && value >= 0 && value <= 100000;
}

function validateCondition(condition) {
  return ALLOWED_CONDITIONS.includes(condition);
}

function validateImage(file) {
  if (!file) return true;
  return ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES;
}

async function fetchItems() {
  const res = await fetch(API_BASE + '/api/items');
  return res.json();
}

function el(tag, cls) {
  const elem = document.createElement(tag);
  if (cls) elem.className = cls;
  return elem;
}

async function render() {
  list.innerHTML = '';
  const data = await fetchItems();
  const items = data.items || [];
  if (!items.length) {
    list.innerHTML = '<li class="item">No listings yet.</li>';
    return;
  }

  const token = authToken();
  const payload = token ? decodeJwt(token) : null;

  items.forEach(item => {
    const li = el('li', 'item');
    const meta = el('div', 'meta');
    const title = document.createElement('strong');
    title.textContent = item.title || '';
    const price = el('span', 'price');
    price.textContent = '$' + (Number(item.price) || 0).toFixed(2);
    meta.appendChild(title);
    meta.appendChild(price);

    const desc = el('div', 'desc');
    desc.textContent = item.description || '';
    li.appendChild(meta);
    li.appendChild(desc);

    if (item.image) {
      const img = el('img');
      img.src = item.image;
      img.alt = item.title || 'Listing image';
      img.style.maxWidth = '100%';
      img.style.marginTop = '10px';
      li.appendChild(img);
    }

    const bottom = el('div', 'meta');
    bottom.style.marginTop = '8px';
    bottom.innerHTML = `<span>${item.condition || ''} • by ${item.username || 'unknown'}</span>`;

    if (payload && payload.id === item.user_id) {
      const removeButton = el('button', 'remove');
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => removeItem(item.id));
      bottom.appendChild(removeButton);
    }

    li.appendChild(bottom);
    list.appendChild(li);
  });
}

async function removeItem(id) {
  const token = authToken();
  if (!token) {
    showMessage('Login before deleting items.', 'error');
    return;
  }

  const res = await fetch('/api/items/' + id, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  });
  if (res.ok) {
    showMessage('Item removed.', 'info');
    render();
  } else {
    const data = await res.json().catch(() => ({}));
    showMessage(data.error || 'Could not delete item.', 'error');
  }
}

function updatePreview() {
  const file = imageInput.files[0];
  if (!file) {
    imagePreview.hidden = true;
    imagePreview.src = '';
    return;
  }
  if (!validateImage(file)) {
    showMessage('Image must be JPG, PNG, or WEBP and under 5MB.', 'error');
    imageInput.value = '';
    imagePreview.hidden = true;
    return;
  }
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.hidden = false;
  showMessage('', 'info');
}

imageInput.addEventListener('change', updatePreview);

form.addEventListener('submit', async e => {
  e.preventDefault();

  const title = document.getElementById('title').value.trim();
  const desc = document.getElementById('desc').value.trim();
  const price = document.getElementById('price').value;
  const condition = document.getElementById('condition').value;
  const file = imageInput.files[0];

  if (!validateTitle(title)) {
    showMessage('Title must be 3-100 characters.', 'error');
    return;
  }
  if (!validateDescription(desc)) {
    showMessage('Description must be 500 characters or less.', 'error');
    return;
  }
  if (!validatePrice(price)) {
    showMessage('Enter a valid price between 0 and 100000.', 'error');
    return;
  }
  if (!validateCondition(condition)) {
    showMessage('Select a valid condition.', 'error');
    return;
  }
  if (!validateImage(file)) {
    showMessage('Image must be JPG, PNG, or WEBP and under 5MB.', 'error');
    return;
  }

  const token = authToken();
  if (!token) {
    showMessage('Please login before adding items.', 'error');
    return;
  }

  const fd = new FormData();
  fd.append('title', title);
  fd.append('description', desc);
  fd.append('price', price || '0');
  fd.append('condition', condition);
  if (file) fd.append('image', file);

  const res = await fetch('/api/items', {
    method: 'POST',
    body: fd,
    headers: { Authorization: 'Bearer ' + token }
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    form.reset();
    imagePreview.hidden = true;
    showMessage('Item added successfully.', 'info');
    render();
  } else {
    showMessage(data.error || 'Could not add item.', 'error');
  }
});

async function register() {
  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value;
  if (!validateUsername(username)) {
    showMessage('Username must be 3-24 characters and only letters, numbers, or underscores.', 'error');
    return;
  }
  if (!validatePassword(password)) {
    showMessage('Password must be at least 8 characters.', 'error');
    return;
  }

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.token) {
    setAuthToken(data.token);
    updateAuthUI();
    render();
    showMessage('Registration successful.', 'info');
  } else {
    showMessage(data.error || 'Registration failed.', 'error');
  }
}

async function login() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  if (!validateUsername(username) || !validatePassword(password)) {
    showMessage('Enter a valid username and password.', 'error');
    return;
  }

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.token) {
    setAuthToken(data.token);
    updateAuthUI();
    render();
    showMessage('Login successful.', 'info');
  } else {
    showMessage(data.error || 'Login failed.', 'error');
  }
}

function logout() {
  setAuthToken(null);
  updateAuthUI();
  showMessage('Logged out.', 'info');
}

function updateAuthUI() {
  const token = authToken();
  if (token) {
    const payload = decodeJwt(token);
    meSpan.textContent = payload?.username ? `Signed in: ${payload.username}` : 'Signed in';
    btnLogout.style.display = 'inline-block';
  } else {
    meSpan.textContent = 'Not signed in';
    btnLogout.style.display = 'none';
  }
}

btnRegister.addEventListener('click', register);
btnLogin.addEventListener('click', login);
btnLogout.addEventListener('click', () => { logout(); render(); });

updateAuthUI();
render();
