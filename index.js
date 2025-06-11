// index.js — современный backend VK ID OAuth 2.1 (июнь 2025)
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Для чтения JSON POST-запросов
app.use(express.json());

// Тестовый маршрут
app.get('/test', (req, res) => {
  res.send('Test OK! 🚦');
});

// Главный маршрут обмена кода на токен VK ID
app.post('/auth/vk/token', async (req, res) => {
  const { code, code_verifier, device_id, tg_id } = req.body;

  // Валидация входящих данных
  if (!code || !code_verifier || !device_id) {
    return res.status(400).json({ error: 'Не хватает параметров: code, code_verifier, device_id.' });
  }

  // Данные твоего приложения VK
  const client_id = '53336238';
  const redirect_uri = 'https://api.fokusnikaltair.xyz/auth/vk/callback';

  // Формируем параметры для VK OAuth 2.1
  const params = {
    grant_type: 'authorization_code',
    client_id,
    redirect_uri,
    code,
    code_verifier,
    device_id,
    v: '5.199'
  };

  try {
    // Запрос к VK для обмена кода на токены
    const vkRes = await axios.post(
      'https://id.vk.com/oauth2/token',
      new URLSearchParams(params),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const data = vkRes.data;

    // Сохраняем пользователя: user_id, токены, tg_id (если есть)
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
      tg_id: tg_id || null,
      saved_at: new Date().toISOString()
    };
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    res.json({ success: true, user_id: data.user_id, expires_in: data.expires_in });
    console.log(`💾 VK user_id ${data.user_id} успешно сохранён (TG: ${tg_id || '-'})`);
  } catch (err) {
    console.error('❌ Ошибка обмена кода на токен:', err.response?.data || err.message);
    res.status(500).json({ error: 'Не удалось получить токен VK. Проверьте параметры или попробуйте снова.' });
  }
});

// === VK AUTH CALLBACK ===
app.get('/auth/vk/callback', async (req, res) => {
  const { code, state, code_verifier } = req.query;
  console.log('[VK CALLBACK] Получен код:', code, 'state:', state);

  if (!code) {
    return res.send('<h2>Ошибка: параметр code не найден</h2>');
  }

  // Данные приложения VK ID
  const client_id = 'ТВОЙ_CLIENT_ID';
  const redirect_uri = 'https://api.fokusnikaltair.xyz/auth/vk/callback';

  // --- PKCE: code_verifier если есть, иначе без него ---
  try {
    // Собираем параметры для VK API (PKCE поддерживается автоматически)
    const params = new URLSearchParams({
      client_id,
      redirect_uri,
      code,
      // code_verifier: code_verifier || '', // раскомментируй если точно используешь
    });

    // Если используешь PKCE — обязательно добавляй code_verifier:
    // params.append('code_verifier', code_verifier || '');

    // Отправляем запрос на обмен code на access_token:
    const vkRes = await axios.post(
      'https://api.vk.com/oauth/access_token',
      params, // Для post x-www-form-urlencoded, если будет 400 — попробуй как query string
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // vkRes.data = { access_token, expires_in, user_id, email, ... }
    console.log('[VK TOKEN]', vkRes.data);

    // Можно сохранять токен, tg_id = state, и т.д.

    res.send(`
      <h2>Авторизация завершена!</h2>
      <p>Можешь вернуться в Telegram.<br>state (tg_id): <b>${state}</b></p>
      <pre>${JSON.stringify(vkRes.data, null, 2)}</pre>
    `);

  } catch (err) {
    console.error('[VK ERROR]', err?.response?.data || err);
    res.send(`<h2>Ошибка при обмене кода на токен VK</h2>
    <pre>${JSON.stringify(err?.response?.data || err, null, 2)}</pre>`);
  }
});

// Раздаём фронтенд/публичные файлы
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'public')));

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🪄 Сервер VK ID Auth запущен на http://localhost:${PORT}`);
});
