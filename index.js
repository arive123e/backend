require('dotenv').config(); // 🔐 Загружаем переменные из .env

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

// ✨ Храним использованные VK-коды с временем
const usedCodes = new Map();
const recentIPs = new Map(); // 🔮 Храним IP для защиты от повторных запросов
let callCounter = 0; // 🔮 Счётчик вызовов callback

// ✅ Тестовый маршрут
app.get('/test', (req, res) => {
  res.send('Test OK!');
});

// ===========================
// 🔗 Генерация ссылки авторизации через VK
// ===========================
app.get('/auth/vk', (req, res) => {
  const CLIENT_ID = process.env.VK_CLIENT_ID;
  const REDIRECT_URI = process.env.VK_REDIRECT_URI;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'offline,wall,groups,photos,email,friends,docs,video,status',
    v: '5.131'
  });

  console.log(`[VK LINK] Сформирована в ${new Date().toISOString()}`); // 🪄 Лог времени генерации ссылки
  res.redirect(`https://oauth.vk.com/authorize?${params.toString()}`);
});

// ===========================
// 🌐 Приветственная страница
// ===========================
app.get('/', (req, res) => {
  res.send('Добро пожаловать в магический проект Фокусника Альтаира! ✨');
});

// ===========================
// 🎯 Основной VK CALLBACK
// ===========================
app.get('/auth/vk/callback', async (req, res) => {
  callCounter++;
  const now = Date.now();
  const ip = req.ip;

  console.log(`=== [VK CALLBACK] ВЫЗОВ #${callCounter} === 🌟`);
  console.log(`[CALLBACK] Время: ${new Date().toISOString()}`);
  console.log(`[CALLBACK] code: ${req.query.code}`);
  console.log(`[CALLBACK] state: ${req.query.state}`);
  console.log(`[CALLBACK] IP: ${ip}`);
  console.log(`[CALLBACK] User-Agent: ${req.headers['user-agent']}`);
  console.log(`[CALLBACK] Referer: ${req.headers['referer']}`);

  // 🔮 Защита от частых повторов по IP
  if (recentIPs.has(ip) && now - recentIPs.get(ip) < 5000) {
    console.warn(`🔁 Повторный запрос с IP ${ip} — заблокирован`);
    return res.status(429).send('Слишком частые запросы');
  }
  recentIPs.set(ip, now);
  setTimeout(() => recentIPs.delete(ip), 60000); // 🧙‍♂️ Очистка IP через 1 мин

  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).send('Ошибка: нет кода авторизации!');
    }

    // ✨ Проверка: код уже использован?
    if (usedCodes.has(code)) {
      console.warn('‼️ Код уже использован!');
      return res.sendFile(path.join(__dirname, 'public', 'error.html'));
    }

    usedCodes.set(code, now); // 🧷 Отмечаем код

    // 📥 Запрашиваем access_token
    const tokenParams = new URLSearchParams({
      client_id: process.env.VK_CLIENT_ID,
      client_secret: process.env.VK_CLIENT_SECRET,
      redirect_uri: process.env.VK_REDIRECT_URI,
      code,
    });

    const vkRes = await axios.get(`https://oauth.vk.com/access_token?${tokenParams.toString()}`);
    console.log('🗝️ VK access_token response:', vkRes.data);

    // 📌 Сохраняем пользователя в файл
    const { user_id, access_token, email } = vkRes.data;
    const tg_id = state || 'unknown';

    const usersPath = path.join(__dirname, 'users.json');
    let users = {};

    if (fs.existsSync(usersPath)) {
      const raw = fs.readFileSync(usersPath, 'utf-8');
      users = raw ? JSON.parse(raw) : {};
    }

    users[user_id] = {
      vk_user_id: user_id,
      access_token,
      email,
      tg_id
    };

    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    console.log(`💾 Сохранён пользователь VK ${user_id} (TG ${tg_id})`);

    // 🟢 Страница успеха
    return res.sendFile(path.join(__dirname, 'public', 'success.html'));

  } catch (error) {
    console.error('❌ Ошибка при обмене кода:', error.response?.data || error.message);
    return res.sendFile(path.join(__dirname, 'public', 'error.html'));
  }
});

// ===========================
// 🧹 Очистка просроченных кодов
// ===========================
setInterval(() => {
  const now = Date.now();
  const TTL = 2 * 60 * 1000;

  for (const [code, timestamp] of usedCodes.entries()) {
    if (now - timestamp > TTL) {
      usedCodes.delete(code);
      console.log(`🧼 Удалён просроченный code: ${code}`);
    }
  }
}, 60000);

// ===========================
// 🆘 Страница помощи
// ===========================
app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'help.html'));
});

// ===========================
// 📂 Статика без /auth
// ===========================
app.use((req, res, next) => {
  console.log('[STATIC MIDDLEWARE] Запрос:', req.url);
  next();
});

app.use((req, res, next) => {
  if (req.url.startsWith('/auth')) return next();
  express.static('frontend')(req, res, next);
});
app.use((req, res, next) => {
  if (req.url.startsWith('/auth')) return next();
  express.static(path.join(__dirname, 'public'))(req, res, next);
});

// ===========================
// 🚀 Запуск сервера
// ===========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔮 Сервер запущен на http://localhost:${PORT}`);
});
