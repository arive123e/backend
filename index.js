// index.js — VK ID OAuth 2.1 PKCE backend-only (июнь 2025)
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Для чтения JSON POST-запросов (на будущее)
app.use(express.json());

// Тестовый маршрут
app.get('/test', (req, res) => {
  res.send('Test OK! 🚦');
});

// Главный VK ID CALLBACK — тут происходит обмен кода на токен и сохранение пользователя!
app.get('/auth/vk/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.send('<h2>Ошибка: параметр code не найден</h2>');
  }

  // Данные твоего приложения VK
  const client_id = '53336238';
  const redirect_uri = 'https://api.fokusnikaltair.xyz/auth/vk/callback';

  // Собираем параметры для VK OAuth2.1 PKCE
  const postParams = new URLSearchParams();
  postParams.append('grant_type', 'authorization_code');
  postParams.append('client_id', client_id);
  postParams.append('redirect_uri', redirect_uri);
  postParams.append('code', code);
  postParams.append('v', '5.199');

  try {
    // Отправляем запрос к VK
    const vkRes = await axios.post(
      'https://id.vk.com/oauth2/token',
      postParams.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const data = vkRes.data;

    // Сохраняем пользователя
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
      tg_id: state || null, // state = tg_id
      saved_at: new Date().toISOString()
    };
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    res.send('<h2><b>Завершено!</b> Теперь можно закрыть окно и вернуться в Telegram.</h2>');
    console.log(`💾 VK user_id ${data.user_id} успешно сохранён (TG: ${state || '-'})`);
  } catch (err) {
    console.error('❌ Ошибка обмена кода на токен:', err.response?.data || err.message);
    res.send('<h2>Ошибка при обмене кода на токен VK<br>' + JSON.stringify(err.response?.data || err.message) + '</h2>');
  }
});

// Раздаём фронтенд/публичные файлы (index.html, стили и т.д.)
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'public')));

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🪄 Сервер VK ID Auth запущен на http://localhost:${PORT}`);
});
