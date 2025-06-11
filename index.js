// index.js — backend VK ID OAuth 2.1 PKCE (июнь 2025)
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Для чтения JSON POST-запросов
app.use(express.json());

// Проверка сервера
app.get('/test', (req, res) => {
  res.send('Test OK! 🚦');
});

// Главный маршрут обмена кода на токен VK ID (используем PKCE)
app.post('/auth/vk/token', async (req, res) => {
  const { code, code_verifier, device_id, tg_id } = req.body;

  // Подробное логирование
  console.log('[VK TOKEN] Получен POST /auth/vk/token');
  console.log({ code, code_verifier, device_id, tg_id });

  if (!code || !code_verifier || !device_id) {
    console.log('❌ Не хватает параметров!');
    return res.status(400).json({ error: 'Не хватает параметров: code, code_verifier, device_id.' });
  }

  // ТВОЙ client_id и redirect_uri!
  const client_id = '53336238';
  const redirect_uri = 'https://api.fokusnikaltair.xyz/auth/vk/callback';

  // Формируем параметры строго по VK ID PKCE (2025)
  const postParams = new URLSearchParams();
  postParams.append('grant_type', 'authorization_code');
  postParams.append('client_id', client_id);
  postParams.append('redirect_uri', redirect_uri);
  postParams.append('code', code);
  postParams.append('code_verifier', code_verifier);
  postParams.append('device_id', device_id);
  postParams.append('v', '5.199');

  console.log('[VK TOKEN] Отправляем на VK:', postParams.toString());

  try {
    const vkRes = await axios.post(
      'https://id.vk.com/oauth2/token',
      postParams.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const data = vkRes.data;

    console.log('[VK TOKEN] Ответ VK:', data);

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
      tg_id: tg_id || null,
      saved_at: new Date().toISOString()
    };
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    res.json({ success: true, user_id: data.user_id, expires_in: data.expires_in });
    console.log(`💾 VK user_id ${data.user_id} успешно сохранён (TG: ${tg_id || '-'})`);
  } catch (err) {
    // Подробно выводим ошибку
    console.error('❌ Ошибка обмена кода на токен:', err.response?.data || err.message);
    res.status(500).json({ error: 'Не удалось получить токен VK. Проверьте параметры или попробуйте снова.', vk: err.response?.data || err.message });
  }
});

// Коллбэк — только заглушка для VK ID
app.get('/auth/vk/callback', (req, res) => {
  res.send('<h2><b>Завершено!</b> Теперь можно закрыть окно и вернуться в Telegram.</h2>');
});

// Раздаём фронтенд/публичные файлы
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'public')));

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🪄 Сервер VK ID Auth запущен на http://localhost:${PORT}`);
});
