const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(express.json());

// Путь для хранения code_verifier по state (tg_id)
const pkceFile = path.join(__dirname, 'pkce.json');

function loadPkce() {
  if (!fs.existsSync(pkceFile)) return {};
  const raw = fs.readFileSync(pkceFile, 'utf-8');
  return raw ? JSON.parse(raw) : {};
}

function savePkce(data) {
  fs.writeFileSync(pkceFile, JSON.stringify(data, null, 2));
}

function setPkce(state, verifier) {
  const data = loadPkce();
  data[state] = { verifier, createdAt: Date.now() };
  savePkce(data);
}

function getAndRemovePkce(state) {
  const data = loadPkce();
  if (!data[state]) return null;
  const verifier = data[state].verifier;
  delete data[state];
  savePkce(data);
  return verifier;
}

// Тестовый роут
app.get('/test', (req, res) => res.send('Test OK! 🚦'));

// Генерация PKCE и отдача ссылки авторизации
app.get('/auth/vk/link', (req, res) => {
  const client_id = '53336238';
  const redirect_uri = 'https://api.fokusnikaltair.xyz/auth/vk/callback';
  const tg_id = req.query.tg_id;
  if (!tg_id) return res.status(400).send('Не передан tg_id');

  // Генерируем code_verifier и code_challenge (PKCE)
  const code_verifier = crypto.randomBytes(64).toString('base64url').slice(0, 128);
  const hash = crypto.createHash('sha256').update(code_verifier).digest();
  const code_challenge = hash.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // Сохраняем code_verifier под state = tg_id
  setPkce(tg_id, code_verifier);

  // Формируем ссылку для VK авторизации
  const authUrl = `https://id.vk.com/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=groups,offline&state=${tg_id}&code_challenge=${code_challenge}&code_challenge_method=S256`;

  res.json({ authUrl });
});

// Callback — обмен кода на токен
app.get('/auth/vk/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) return res.send('<h2>Ошибка: не передан code</h2>');
  if (!state) return res.send('<h2>Ошибка: не передан state</h2>');

  const client_id = '53336238';
  const redirect_uri = 'https://api.fokusnikaltair.xyz/auth/vk/callback';

  // Берём code_verifier по state (tg_id)
  const code_verifier = getAndRemovePkce(state);
  if (!code_verifier) {
    return res.send('<h2>Ошибка: code_verifier не найден или истёк</h2>');
  }

  // Параметры для обмена кода на токен
  const params = new URLSearchParams();
  params.append('client_id', client_id);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', redirect_uri);
  params.append('code_verifier', code_verifier);

  try {
    const tokenRes = await axios.post('https://id.vk.com/oauth/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const data = tokenRes.data;

    // Сохраняем пользователя в users.json
    const usersPath = path.join(__dirname, 'users.json');
    let users = {};
    if (fs.existsSync(usersPath)) {
      const raw = fs.readFileSync(usersPath, 'utf-8');
      users = raw ? JSON.parse(raw) : {};
    }
    users[data.user_id] = {
      vk_user_id: data.user_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      tg_id: state,
      saved_at: new Date().toISOString()
    };
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    res.send('<h2><b>Авторизация прошла успешно!</b> Можно закрыть окно и вернуться в Telegram.</h2>');
    console.log(`💾 Пользователь VK ID ${data.user_id} сохранён (TG ID: ${state})`);
  } catch (e) {
    console.error('Ошибка обмена кода на токен:', e.response?.data || e.message);
    res.send(`<h2>Ошибка при обмене кода на токен:<br>${JSON.stringify(e.response?.data || e.message)}</h2>`);
  }
});

// Раздача фронтенда
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Сервер VK ID запущен на http://localhost:${PORT}`);
});
