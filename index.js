require('dotenv').config(); // ✨ Загружаем секретики из .env — теперь магия доступна!

const express = require('express'); // 🧙 Express — наш серверный волшебник
const path = require('path'); // 📦 Для работы с путями
const fs = require('fs'); // 🗂️ Для хранения пользователей
const crypto = require('crypto'); // 🔐 Для PKCE и безопасности
const axios = require('axios'); // 📡 Для обмена кода на токен

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
    client_id: '53336238', 
    redirect_uri: 'https://api.fokusnikaltair.xyz/auth/vk/callback', 
    scope: 'groups', //  нужные права!
    state,
    code_challenge,
    code_challenge_method: 'S256'
  });

  // 5. Телепортируем пользователя на VK ID ✈️
  const vkAuthUrl = `https://id.vk.com/authorize?${params.toString()}`;
  res.redirect(vkAuthUrl);
});

// ===============================================
// 🧙‍♂️ Callback VK ID и обмен кода на access_token + автоматическое сохранение!
// ===============================================
app.get('/auth/vk/callback', async (req, res) => {
  const { code, state } = req.query;

  // 1. Проверяем, что code и state получены
  if (!code || !state) {
    return res.status(400).send('Ошибка: отсутствует code или state! 🥲');
  }

  // 2. Находим ранее сохранённый code_verifier
  const code_verifier = pkceStates.get(state);

  if (!code_verifier) {
    return res.status(400).send('Ошибка: неизвестный или устаревший state! ⏳');
  }

  // 3. Удаляем state из памяти (безопасность)
  pkceStates.delete(state);

  try {
    // 4. Делаем магический обмен code + code_verifier на access_token!
    const tokenUrl = 'https://api.vk.com/oauth/token';
    const params = {
      grant_type: 'authorization_code',
      client_id: '53336238',
      redirect_uri: 'https://api.fokusnikaltair.xyz/auth/vk/callback',
      code,
      code_verifier,
      v: '5.199'
    };

    console.log('[VK TOKEN] Параметры запроса:', params);
    console.log('[VK TOKEN] Как отправляется:', new URLSearchParams(params).toString());
    
    // ⚡ Отправляем POST-запрос к VK (только как application/x-www-form-urlencoded!)
    const tokenRes = await axios.post(tokenUrl, new URLSearchParams(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    // 🎉 Если всё прошло хорошо — access_token получен!
    const data = tokenRes.data;

    // 💾 Сохраняем пользователя сразу в users.json!
    try {
      const usersPath = path.join(__dirname, 'users.json');
      let users = {};

      // Загружаем файл если есть
      if (fs.existsSync(usersPath)) {
        const raw = fs.readFileSync(usersPath, 'utf-8');
        users = raw ? JSON.parse(raw) : {};
      }

      // Сохраняем по VK user_id
      users[data.user_id] = {
        vk_user_id: data.user_id,
        access_token: data.access_token,
        expires_in: data.expires_in,
        saved_at: new Date().toISOString()
      };

      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
      console.log(`💾 Сохранён VK user_id ${data.user_id} с access_token`);

      // Отправляем страницу успеха
      res.send(`
        <h2>Магия сработала! 🎉</h2>
        <p>Ваш VK аккаунт успешно подключён!<br>Можете закрыть это окно и вернуться в Telegram 🪄</p>
        <pre style="font-size:13px">${JSON.stringify({
          user_id: data.user_id,
          expires_in: data.expires_in
        }, null, 2)}</pre>
      `);
    } catch (saveErr) {
      console.error('❌ Ошибка при сохранении пользователя:', saveErr.message);
      res.status(500).send('Не удалось сохранить токен пользователя. Попробуйте снова или обратитесь к Фокуснику Альтаиру! 🧙‍♂️');
    }
  } catch (err) {
    console.error('❌ Ошибка обмена кода на токен:', err.response?.data || err.message);
    res.status(500).send('Не удалось получить access_token. Попробуйте снова или обратитесь к Фокуснику Альтаиру! 🧙‍♂️');
  }
});

// ==========================
// 💌 Приём VK access_token через POST (для будущей интеграции с фронтом/ботом)
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
