const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

// 🔄 NEW: для POST-запросов обязательно нужен json-парсер!
app.use(express.json());

app.get('/test', (req, res) => {
  res.send('Test OK! 🚦');
});

/*
  🔄 NEW: убери или закомментируй старый GET-эндпоинт колбэка!
  app.get('/auth/vk/callback', ... )
*/

// 🔄 NEW: основной POST-эндпоинт для обмена кода на токен
app.post('/auth/vk/callback', async (req, res) => {
  // 🔄 NEW: теперь берём параметры из req.body, а не req.query!
  const { code, state, code_verifier, device_id } = req.body;

  console.log('[VKID CALLBACK] POST:', { code, state, code_verifier, device_id });

  if (!code) return res.send('<h2>Ошибка: не передан code</h2>');
  if (!code_verifier) return res.send('<h2>Ошибка: не передан code_verifier</h2>');
  if (!device_id) return res.send('<h2>Ошибка: не передан device_id</h2>');

  const client_id = '53336238';
  // 🔄 NEW: redirect_uri должен совпадать с тем, что в VK и на фронте!
  const redirect_uri = 'https://api.fokusnikaltair.xyz/vk-callback.html';

  const params = new URLSearchParams();
  params.append('client_id', client_id);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', redirect_uri);
  params.append('code_verifier', code_verifier);
  params.append('device_id', device_id);

  try {
    // 🔄 NEW: endpoint VK ID (оставь /oauth2/auth, если твоя дока требует именно его)
    const vkRes = await axios.post(
      'https://id.vk.com/oauth2/auth',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log('[VKID CALLBACK] Ответ VK:', vkRes.data);

    const data = vkRes.data;

    if (data.response) {
      const usersPath = path.join(__dirname, 'users.json');
      let users = {};
      if (fs.existsSync(usersPath)) {
        const raw = fs.readFileSync(usersPath, 'utf-8');
        users = raw ? JSON.parse(raw) : {};
      }
      users[data.response.user_id] = {
        vk_user_id: data.response.user_id,
        access_token: data.response.access_token,
        refresh_token: data.response.refresh_token,
        expires_in: data.response.expires_in,
        tg_id: state || null,
        saved_at: new Date().toISOString()
      };
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

      res.send('<h2><b>Успешно!</b> Можно закрыть окно и вернуться в Telegram.</h2>');
      console.log(`💾 VK user_id ${data.response.user_id} успешно сохранён (TG: ${state || '-'})`);
    } else {
      res.send('<h2>Ошибка от VK:<br>' + JSON.stringify(data.error || data) + '</h2>');
      console.error('[VKID CALLBACK] Ошибка от VK:', data.error || data);
    }
  } catch (err) {
    console.error('❌ Ошибка обмена кода на токен:', err.response?.data || err.message);
    res.send('<h2>Ошибка при обмене кода на токен VK<br>' + JSON.stringify(err.response?.data || err.message) + '</h2>');
  }
});

// Раздача статики (frontend/public) как и раньше — это правильно!
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`VK ID Auth backend запущен на http://localhost:${PORT}`);
});
