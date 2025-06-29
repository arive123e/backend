// index.js — VK ID OAuth 2.1, LowCode-ready (июнь 2025)

const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(express.json());

// Тестовый маршрут
app.get('/test', (req, res) => {
  res.send('Test OK! 🚦');
});

// ⚡ ГЛАВНЫЙ ЭНДПОИНТ: обмен кода на токен (для LowCode VKID SDK)
app.get('/auth/vk/callback', async (req, res) => {
  const { code, state } = req.query; // Никаких code_verifier!

  if (!code) {
    return res.send('<h2>Ошибка: не передан code</h2>');
  }

  // VK APP
  const client_id = '53336238';
  const redirect_uri = 'https://api.fokusnikaltair.xyz/auth/vk/callback';

  // Параметры для обмена кода на токен
  const postParams = new URLSearchParams();
  postParams.append('grant_type', 'authorization_code');
  postParams.append('client_id', client_id);
  postParams.append('redirect_uri', redirect_uri);
  postParams.append('code', code);
  postParams.append('v', '5.199');

  try {
    // Запрос к VK
    const vkRes = await axios.post(
      'https://id.vk.com/oauth2/token',
      postParams.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const data = vkRes.data;

    // Сохраняем пользователя (users.json)
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
      tg_id: state || null,
      saved_at: new Date().toISOString()
    };
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    res.send('<h2><b>Успешно!</b> Можно закрыть окно и вернуться в Telegram.</h2>');
    console.log(`💾 VK user_id ${data.user_id} успешно сохранён (TG: ${state || '-'})`);
  } catch (err) {
    console.error('❌ Ошибка обмена кода на токен:', err.response?.data || err.message);
    res.send('<h2>Ошибка при обмене кода на токен VK<br>' + JSON.stringify(err.response?.data || err.message) + '</h2>');
  }
});

// ⚡ Раздаём статику
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🪄 Сервер VK ID Auth (LowCode-ready) на http://localhost:${PORT}`);
});
