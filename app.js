
const form = document.getElementById('itemForm');
const list = document.getElementById('itemsList');
const message = document.getElementById('formMessage');
const imageInput = document.getElementById('image');
const imagePreview = document.getElementById('imagePreview');

const btnRegister = document.getElementById('btnRegister');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');

const meSpan = document.getElementById('me');
const itemCount = document.getElementById('itemCount');

function showMessage(text, type = 'success') {
  message.textContent = text;
  message.className = `message ${type}`;
}

function saveUsers(users) {
  localStorage.setItem('tt_users', JSON.stringify(users));
}

function getUsers() {
  return JSON.parse(localStorage.getItem('tt_users') || '[]');
}

function saveItems(items) {
  localStorage.setItem('tt_items', JSON.stringify(items));
}

function getItems() {
  return JSON.parse(localStorage.getItem('tt_items') || '[]');
}

function currentUser() {
  return JSON.parse(localStorage.getItem('tt_current_user') || 'null');
}

function setCurrentUser(user) {
  localStorage.setItem('tt_current_user', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('tt_current_user');
  updateAuthUI();
}

function updateAuthUI() {
  const user = currentUser();

  if (user) {
    meSpan.textContent = `Signed in: ${user.username}`;
    btnLogout.style.display = 'inline-block';
  } else {
    meSpan.textContent = 'Not signed in';
    btnLogout.style.display = 'none';
  }
}

btnRegister.addEventListener('click', () => {
  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value;

  if (username.length < 3) {
    return showMessage('Username too short', 'error');
  }

  if (password.length < 6) {
    return showMessage('Password too short', 'error');
  }

  const users = getUsers();

  if (users.find(u => u.username === username)) {
    return showMessage('Username already exists', 'error');
  }

  const user = {
    id: Date.now(),
    username,
    password
  };

  users.push(user);
  saveUsers(users);

  setCurrentUser(user);

  updateAuthUI();
  render();

  showMessage('Registration successful');
});

btnLogin.addEventListener('click', () => {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;

  const user = getUsers().find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return showMessage('Invalid login', 'error');
  }

  setCurrentUser(user);

  updateAuthUI();
  render();

  showMessage('Login successful');
});

btnLogout.addEventListener('click', logout);

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = e => {
    imagePreview.src = e.target.result;
    imagePreview.hidden = false;
  };

  reader.readAsDataURL(file);
});

form.addEventListener('submit', e => {
  e.preventDefault();

  const user = currentUser();

  if (!user) {
    return showMessage('Please login first', 'error');
  }

  const title = document.getElementById('title').value.trim();
  const desc = document.getElementById('desc').value.trim();
  const price = document.getElementById('price').value;
  const condition = document.getElementById('condition').value;

  if (title.length < 3) {
    return showMessage('Enter a valid title', 'error');
  }

  const items = getItems();

  const item = {
    id: Date.now(),
    title,
    description: desc,
    price,
    condition,
    username: user.username,
    userId: user.id,
    image: imagePreview.src || ''
  };

  items.unshift(item);

  saveItems(items);

  form.reset();

  imagePreview.src = '';
  imagePreview.hidden = true;

  render();

  showMessage('Item added successfully');
});

function deleteItem(id) {
  const items = getItems().filter(i => i.id !== id);

  saveItems(items);

  render();
}

function render() {
  const items = getItems();

  list.innerHTML = '';

  itemCount.textContent = items.length;

  if (!items.length) {
    list.innerHTML =
      '<li class="item-card"><div class="item-content">No items yet</div></li>';
    return;
  }

  const user = currentUser();

  items.forEach(item => {
    const li = document.createElement('li');

    li.className = 'item-card';

    li.innerHTML = `
      ${
        item.image
          ? `<img class="item-image" src="${item.image}" alt="">`
          : ''
      }

      <div class="item-content">
        <h3 class="item-title">${item.title}</h3>

        <p class="item-description">
          ${item.description}
        </p>

        <div class="item-meta">
          <span class="item-price">
            KSh ${Number(item.price).toLocaleString()}
          </span>

          <span class="item-condition">
            ${item.condition}
          </span>
        </div>

        <small>
          Seller: ${item.username}
        </small>
      </div>
    `;

    if (user && user.id === item.userId) {
      const btn = document.createElement('button');

      btn.className = 'btn remove';
      btn.textContent = 'Remove';

      btn.onclick = () => deleteItem(item.id);

      li.querySelector('.item-content').appendChild(btn);
    }

    list.appendChild(li);
  });
}

updateAuthUI();
render();
