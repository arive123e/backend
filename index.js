const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

require('dotenv').config(); // теперь .env для бекенда!

const app = express();
const PORT = 3000;

// --- [1] Лок для защиты от параллельных обновлений --- //
const refreshingUsers = {};

// --- [2] Функция логирования ошибок --- //
function logError(message) {
  const time = new Date().toISOString();
  fs.appendFileSync(path.join(__dirname, 'errors.log'), `[${time}] - ${message}\n`);
}

// --- Функция для отправки уведомления пользователю в Telegram
async function notifyUser(tg_id, vkAuthUrl) {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const msg = 'Магическая сила истощилась, нужна новая авторизация! Жми сюда ⬇️';
  try {
    await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      chat_id: tg_id,
      text: msg,
      reply_markup: {
        inline_keyboard: [[
          { text: 'Сотворить заклинание перехода 🌀', url: vkAuthUrl }
        ]]
      }
    });
  } catch (e) {
    logError('Ошибка при отправке сообщения в Telegram: ' + (e.response?.data || e.message));
    console.error('Ошибка при отправке сообщения в Telegram:', e.response?.data || e.message);
  }
}

app.use(express.json());

// --- основной POST-эндпоинт для обмена кода на токен
app.post('/auth/vk/callback', async (req, res) => {
  const { code, state, code_verifier, device_id } = req.body;

  console.log('[VKID CALLBACK] POST:', { code, state, code_verifier, device_id });

  if (!code) return res.send('<h2>Ошибка: не передан code</h2>');
  if (!code_verifier) return res.send('<h2>Ошибка: не передан code_verifier</h2>');
  if (!device_id) return res.send('<h2>Ошибка: не передан device_id</h2>');

  const client_id = '53336238';
  const redirect_uri = 'https://api.fokusnikaltair.xyz/vk-callback.html';

  const params = new URLSearchParams();
  params.append('client_id', client_id);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', redirect_uri);
  params.append('code_verifier', code_verifier);
  params.append('device_id', device_id);

  try {
    const vkRes = await axios.post(
      'https://id.vk.com/oauth2/auth',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log('[VKID CALLBACK] Ответ VK:', vkRes.data);

    const data = vkRes.data;
    const usersPath = path.join(__dirname, 'users.json');
    let users = {};
    if (fs.existsSync(usersPath)) {
      const raw = fs.readFileSync(usersPath, 'utf-8');
      users = raw ? JSON.parse(raw) : {};
    }

    // Проверяем наличие access_token и user_id
    if (data.access_token && data.user_id) {
      // Удаляем все старые записи с этим же tg_id (если были)
      for (const key of Object.keys(users)) {
        if (users[key].tg_id && String(users[key].tg_id) === String(state || null)) {
          delete users[key];
        }
      }
      users[data.user_id] = {
        vk_user_id: data.user_id,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        tg_id: state || null,
        saved_at: new Date().toISOString(),
        status: 'ok',
        device_id: device_id
      };
      // --- [3] Бэкап перед записью
      try {
        fs.copyFileSync(usersPath, usersPath + '.bak');
      } catch (e) {
        logError('[backup] Не удалось сделать бэкап users.json: ' + e.message);
      }
      console.log('[ПРОВЕРКА] users.json перед записью:', JSON.stringify(users, null, 2));
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
      console.log('[ПРОВЕРКА] users.json записан!');

      res.sendFile(path.join(__dirname, 'public/success.html'));
      console.log(`💾 VK user_id ${data.user_id} успешно сохранён (TG: ${state || '-'})`);
    } else {
      // Если access_token нет — это ошибка!
      let failKey = (data.user_id || data.id || `fail_${Date.now()}`);
      users[failKey] = {
        error: data.error || data,
        tg_id: state || null,
        saved_at: new Date().toISOString(),
        status: 'fail'
      };
      try {
        fs.copyFileSync(usersPath, usersPath + '.bak');
      } catch (e) {
        logError('[backup] Не удалось сделать бэкап users.json: ' + e.message);
      }
      console.log('[ПРОВЕРКА] users.json перед записью:', JSON.stringify(users, null, 2));
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
      console.log('[ПРОВЕРКА] users.json записан!');

      res.sendFile(path.join(__dirname, 'public/error.html'));
      console.error('[VKID CALLBACK] Нет токена, а есть:', data);
    }
  } catch (err) {
    logError('❌ Ошибка обмена кода на токен: ' + (err.response?.data || err.message));
    console.error('❌ Ошибка обмена кода на токен:', err.response?.data || err.message);
    res.send('<h2>Ошибка при обмене кода на токен VK<br>' + JSON.stringify(err.response?.data || err.message) + '</h2>');
  }
});

// Проверка — зарегистрирован ли пользователь по tg_id
app.get('/users/check', (req, res) => {
  const tg_id = req.query.tg_id;
  if (!tg_id) {
    return res.status(400).json({ success: false, error: 'Нет tg_id' });
  }

  const usersPath = path.join(__dirname, 'users.json');
  if (!fs.existsSync(usersPath)) {
    return res.json({ success: false });
  }

  const raw = fs.readFileSync(usersPath, 'utf-8');
  let users = {};
  try {
    users = raw ? JSON.parse(raw) : {};
  } catch (e) {
    logError('Ошибка чтения users.json: ' + e.message);
    return res.json({ success: false });
  }

  // Ищем пользователя по tg_id
  const found = Object.values(users).find(user => String(user.tg_id) === String(tg_id) && user.status === 'ok');

  if (found) {
    return res.json({ success: true });
  } else {
    return res.json({ success: false });
  }
});

// --- Функция для автообновления токена --- //
async function ensureFreshAccessToken(user, users, usersPath) {
  if (refreshingUsers[user.vk_user_id]) {
    console.log(`[ensureFreshAccessToken] Обновление уже идёт для user_id=${user.vk_user_id} - пропускаем`);
    return user;
  }
  refreshingUsers[user.vk_user_id] = true;

  const now = Date.now();
  const savedAt = new Date(user.saved_at).getTime();
  const expiresIn = Number(user.expires_in || 0) * 1000;

  try {
    // Проверяем, не пора ли обновить токен (до истечения < 1 минуты)
    if (now - savedAt > expiresIn - 60000) {
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('client_id', '53336238');
      params.append('refresh_token', user.refresh_token);
      params.append('device_id', user.device_id);

      try {
        console.log(`[ensureFreshAccessToken] Запрос обновления для user_id=${user.vk_user_id}`);
        const resp = await axios.post('https://id.vk.com/oauth2/auth', params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        console.log('[ensureFreshAccessToken] VK ответ (raw):', JSON.stringify(resp.data, null, 2));

        // Только если VK реально вернул новый токен - обновляем!
        if (resp.data.access_token && resp.data.refresh_token) {
          user.access_token = resp.data.access_token;
          user.refresh_token = resp.data.refresh_token;
          user.expires_in = resp.data.expires_in;
          user.saved_at = new Date().toISOString();
          user.status = 'ok';
          users[user.vk_user_id] = user;
          try {
            fs.copyFileSync(usersPath, usersPath + '.bak');
          } catch (e) {
            logError('[backup] Не удалось сделать бэкап users.json: ' + e.message);
          }
          console.log('[ПРОВЕРКА] users.json перед записью:', JSON.stringify(users, null, 2));
          fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
          console.log('[ПРОВЕРКА] users.json записан!');
          console.log(`[ensureFreshAccessToken] ✅ Токен успешно обновлён для user_id=${user.vk_user_id}`);
        } else {
          // Не трогаем старый токен, просто меняем статус
          logError(`[ensureFreshAccessToken] VK не вернул новый токен! Ответ: ${JSON.stringify(resp.data)}`);
          console.error(`[ensureFreshAccessToken] ❗️ VK НЕ вернул новый токен! Ответ:`, resp.data);
          user.status = 'fail';
          users[user.vk_user_id] = user;
          try {
            fs.copyFileSync(usersPath, usersPath + '.bak');
          } catch (e) {
            logError('[backup] Не удалось сделать бэкап users.json: ' + e.message);
          }
          fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
          throw new Error('Не удалось обновить токен VK, требуется повторная авторизация');
        }
      } catch (e) {
        logError(`[ensureFreshAccessToken] Ошибка при запросе к VK: ${e.response?.data || e.message}`);
        user.status = 'fail';
        users[user.vk_user_id] = user;
        try {
          fs.copyFileSync(usersPath, usersPath + '.bak');
        } catch (e) {
          logError('[backup] Не удалось сделать бэкап users.json: ' + e.message);
        }
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        throw new Error('Ошибка при обновлении токена: ' + (e.response?.data?.error_description || e.message));
      }
    }
    return user;
  } finally {
    refreshingUsers[user.vk_user_id] = false;
  }
}



app.get('/users/groups', async (req, res) => {
  const tg_id = req.query.tg_id;
  if (!tg_id) {
    return res.status(400).json({ success: false, error: 'Нет tg_id' });
  }

  const usersPath = path.join(__dirname, 'users.json');
  if (!fs.existsSync(usersPath)) {
    return res.json({ success: false, error: 'Нет users.json' });
  }

  const raw = fs.readFileSync(usersPath, 'utf-8');
  let users = {};
  try {
    users = raw ? JSON.parse(raw) : {};
  } catch (e) {
    logError('Ошибка чтения users.json: ' + e.message);
    return res.json({ success: false, error: 'Ошибка users.json' });
  }

  const user = Object.values(users).find(
    u => String(u.tg_id) === String(tg_id) && u.status === 'ok'
  );

  if (!user || !user.access_token) {
    return res.json({ success: false, error: 'Пользователь не найден или нет токена' });
  }

  // --- NEW: Обновляем токен если надо ---
  try {
    await ensureFreshAccessToken(user, users, usersPath);
  } catch (e) {
    return res.json({
      success: false,
      error: 'Не удалось обновить токен. Пожалуйста, авторизуйтесь заново через портал.',
      reauth: true
    });
  }

  try {
    // ======= ЛОГ ЗАПРОСА VK =======
    console.log('VK groups.get params:', {
      access_token: user.access_token ? user.access_token.slice(0, 10) + '... (скрыто)' : undefined,
      extended: 1,
      v: '5.131',
      count: 1000
    });

    const vkResp = await axios.get('https://api.vk.com/method/groups.get', {
      params: {
        access_token: user.access_token,
        extended: 1,
        v: '5.131',
        count: 1000
      }
    });

    // ======= ЛОГ ОТВЕТА VK =======
    console.log('VK ответ:', JSON.stringify(vkResp.data, null, 2));

    if (vkResp.data.error) {
      return res.json({ success: false, error: vkResp.data.error.error_msg });
    }
    return res.json({ success: true, groups: vkResp.data.response.items });
  } catch (err) {
    logError('Ошибка при запросе групп VK: ' + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
    return res.json({ success: false, error: err.message });
  }
});


// --- Фоновое обновление токенов раз в 5 минут --- //
async function refreshAllTokens() {
  const usersPath = path.join(__dirname, 'users.json');
  if (!fs.existsSync(usersPath)) {
    console.log('[refreshAllTokens] Нет файла users.json');
    return;
  }
  let users = {};
  let updated = false;
  try {
    const raw = fs.readFileSync(usersPath, 'utf-8');
    users = raw ? JSON.parse(raw) : {};
  } catch (e) {
    logError('[refreshAllTokens] Ошибка чтения users.json: ' + e.message);
    console.error('[refreshAllTokens] Ошибка чтения users.json:', e.message);
    return;
  }

  for (const uid in users) {
    const user = users[uid];
    if (user.status === 'ok' && user.refresh_token && user.tg_id) {
      const oldAccessToken = user.access_token;
      const oldRefreshToken = user.refresh_token;
      const oldStatus = user.status;
      try {
        await ensureFreshAccessToken(user, users, usersPath);
        if (
          user.access_token !== oldAccessToken ||
          user.refresh_token !== oldRefreshToken ||
          user.status !== oldStatus
        ) {
          updated = true;
          console.log(`[refreshAllTokens] ✅ Токен или статус обновлён для user_id=${user.vk_user_id}`);
        }
      } catch (err) {
        logError(`[refreshAllTokens] ❌ Ошибка обновления токена для user_id=${user.vk_user_id}: ${err.message}`);
        console.error(`[refreshAllTokens] ❌ Ошибка обновления токена для user_id=${user.vk_user_id}:`, err.message);
        const vkAuthUrl = `https://fokusnikaltair.xyz/vkid-auth.html?tg_id=${user.tg_id}`;
        await notifyUser(user.tg_id, vkAuthUrl);
        console.log(`[refreshAllTokens] ⚡️ Оповестили ${user.tg_id} о необходимости новой авторизации`);
        updated = true;
      }
    }
  }
  if (updated) {
    try {
      fs.copyFileSync(usersPath, usersPath + '.bak');
    } catch (e) {
      logError('[backup] Не удалось сделать бэкап users.json: ' + e.message);
    }
    console.log('[ПРОВЕРКА] users.json перед записью:', JSON.stringify(users, null, 2));
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    console.log('[ПРОВЕРКА] users.json записан!');
    console.log(`[refreshAllTokens] Файл users.json перезаписан!`);
  }
}

// Запускать раз в 5 минут
setInterval(refreshAllTokens, 5 * 60 * 1000);

// --- [5] Жёсткое удаление пользователя по user_id --- //
app.post('/users/delete', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ success: false, error: 'Не передан user_id' });
  }
  const usersPath = path.join(__dirname, 'users.json');
  if (!fs.existsSync(usersPath)) {
    return res.status(400).json({ success: false, error: 'Нет файла users.json' });
  }
  let users = {};
  try {
    const raw = fs.readFileSync(usersPath, 'utf-8');
    users = raw ? JSON.parse(raw) : {};
  } catch (e) {
    logError('[deleteUser] Ошибка чтения файла users.json: ' + e.message);
    return res.status(500).json({ success: false, error: 'Ошибка чтения файла users.json' });
  }
  if (users[user_id]) {
    delete users[user_id];
    try {
      fs.copyFileSync(usersPath, usersPath + '.bak');
    } catch (e) {
      logError('[backup] Не удалось сделать бэкап при удалении пользователя: ' + e.message);
    }
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    return res.json({ success: true });
  } else {
    return res.status(404).json({ success: false, error: 'Пользователь не найден' });
  }
});

app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`VK ID Auth backend запущен на http://localhost:${PORT}`);
});
