require('dotenv').config(); // ✨ Загружаем секретики из .env — теперь магия доступна!

const express = require('express'); // 🧙 Express — наш серверный волшебник
const path = require('path'); // 📦 Для работы с путями
const fs = require('fs'); // 🗂️ Для хранения пользователей
const crypto = require('crypto'); // 🔐 Для PKCE и безопасности

const app = express();
const PORT = 3000;

// ====================
// 🎩 PKCE-мастерская
// ====================

// Волшебная карта "state → code_verifier" (только пока сервер жив)
const pkceStates = new Map();

// 🪄 Создаём секретный code_verifier для PKCE
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

// ✨ Превращаем code_verifier в code_challenge (SHA256 и спец. кодировка)
function generateCodeChallenge(verifier) {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

// =======================
// 💾 Память пользователей
// =======================
const recentIPs = new Map(); // Защита от повторов
let callCounter = 0; // Счётчик вызовов для отладки

app.use(express.json()); // 🌟 Чтобы получать JSON-запросы

// ====================
// 🧪 Тестовый маршрут
// ====================
app.get('/test', (req, res) => {
  res.send('Test OK! 🚦');
});

// ==============================
// 🏠 Главная — магия приветствия
// ==============================
app.get('/', (req, res) => {
  res.send('Добро пожаловать в магический проект Фокусника Альтаира! 🪄✨');
});

// =============================================
// 🔑 Старт PKCE-авторизации через VK ID (magic)
// =============================================
app.get('/auth/vk', (req, res) => {
  // 1. Создаём секретные ключи для PKCE
  const code_verifier = generateCodeVerifier();
  const code_challenge = generateCodeChallenge(code_verifier);

  // 2. Генерируем state (секретная печать защиты 🛡️)
  const state = crypto.randomBytes(12).toString('hex');

  // 3. Сохраняем state и code_verifier (только для обмена токена)
  pkceStates.set(state, code_verifier);

  // 4. Готовим волшебный портал VK ID
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.VK_CLIENT_ID,
    redirect_uri: process.env.VK_REDIRECT_URI,
    scope: 'groups', // только нужные права!
    state,
    code_challenge,
    code_challenge_method: 'S256'
  });

  // 5. Телепортируем пользователя на VK ID ✈️
  const vkAuthUrl = `https://id.vk.com/authorize?${params.toString()}`;
  res.redirect(vkAuthUrl);
});

// =====================================
// 🪄 Страница успеха после авторизации
// =====================================
app.get('/auth/vk/callback', (req, res) => {
  // Пока только заглушка — будет обмен кода на токен! ✨
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// ==========================
// 💌 Приём VK access_token
// ==========================
app.post('/auth/vk/save', async (req, res) => {
  callCounter++;
  const now = Date.now();
  const ip = req.ip;

  console.log(`=== [VK TOKEN SAVE] ВЫЗОВ #${callCounter} ===`);
  console.log(`[TOKEN] Время: ${new Date().toISOString()}`);
  console.log(`[TOKEN] IP: ${ip}`);
  console.log(`[TOKEN] Данные:`, req.body);

  // 👮 Защита от частых запросов с одного IP (anti-spam)
  if (recentIPs.has(ip) && now - recentIPs.get(ip) < 3000) {
    console.warn(`⚠️ Повторный запрос с IP ${ip} — блокируем`);
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
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ===================
// 📖 Страница помощи
// ===================
app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'help.html'));
});

// =======================
// 📦 Статика (frontend)
// =======================
app.use((req, res, next) => {
  console.log('[STATIC] Запрос:', req.url);
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

// ================
// 🚀 Запуск сервера
// ================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🪄 Сервер запущен на http://localhost:${PORT} — магия началась!`);
});
