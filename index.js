require('dotenv').config(); // 🔐 Загружаем переменные из .env

const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

// 🌟 Хранилище пользователей и защита от повторов
const recentIPs = new Map();
let callCounter = 0;

app.use(express.json()); // 💡 Для обработки JSON POST-запросов

// ✅ Тестовый маршрут
app.get('/test', (req, res) => {
  res.send('Test OK!');
});

// ===========================
// 🌐 Приветственная страница
// ===========================
app.get('/', (req, res) => {
  res.send('Добро пожаловать в магический проект Фокусника Альтаира! ✨');
});

// ===========================
// 🔐 Обработка готового access_token от VK SDK (PKCE flow)
// ===========================
app.post('/auth/vk/save', async (req, res) => {
  callCounter++;
  const now = Date.now();
  const ip = req.ip;

  console.log(`=== [VK TOKEN SAVE] ВЫЗОВ #${callCounter} ===`);
  console.log(`[TOKEN] Время: ${new Date().toISOString()}`);
  console.log(`[TOKEN] IP: ${ip}`);
  console.log(`[TOKEN] Данные:`, req.body);

  if (recentIPs.has(ip) && now - recentIPs.get(ip) < 3000) {
    console.warn(`⚠️ Повторный запрос с IP ${ip} — блок`);
    return res.status(429).send('Слишком частые запросы');
  }
  recentIPs.set(ip, now);
  setTimeout(() => recentIPs.delete(ip), 60000);

  try {
    const { access_token, user_id, email, tg_id } = req.body;

    if (!access_token || !user_id || !tg_id) {
      return res.status(400).json({ error: 'Недостаточно данных' });
    }

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

    res.status(200).json({ success: true });
  } catch (error) {
  console.error('❌ Ошибка сохранения VK-токена:', error.message);
  console.log('📛 Ответ НЕ был сохранён. Отправляем 500.');
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
}
});

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
  console.log(`🪄 Сервер запущен на http://localhost:${PORT}`);
});
