// index.js — VK ID OAuth 2.1 PKCE, совместимый с LowCode VKID SDK

const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/test', (req, res) => {
  res.send('Test OK! 🚦');
});

app.get('/auth/vk/callback', async (req, res) => {
  const { code, state, code_verifier } = req.query;

  // Логируем что приходит с фронта (ОЧЕНЬ важно!)
  console.log('[VKID CALLBACK] Запрос от фронта:', { code, state, code_verifier });

  if (!code) return res.send('<h2>Ошибка: не передан code</h2>');
  if (!code_verifier) return res.send('<h2>Ошибка: не передан code_verifier (генерируется на фронте)</h2>');

  const client_id = '53336238';
  const redirect_uri = 'https://api.fokusnikaltair.xyz/auth/vk/callback';

  // Собираем параметры для метода exchangeCode (именно так требует VKID LowCode SDK)
  const params = new URLSearchParams();
  params.append('client_id', client_id);
  params.append('code', code);
  params.append('redirect_uri', redirect_uri);
  params.append('code_verifier', code_verifier);

  try {
    // Новый эндпоинт для обмена кода на токен!
    const vkRes = await axios.post(
      'https://api.vk.com/method/auth.exchangeCode',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Логируем ответ VK для диагностики
    console.log('[VKID CALLBACK] Ответ VK:', vkRes.data);

    const data = vkRes.data;

    if (data.response) {
      // Сохраняем пользователя (users.json)
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
      // Показываем всю ошибку VK на фронте и в логах
      res.send('<h2>Ошибка от VK:<br>' + JSON.stringify(data.error || data) + '</h2>');
      console.error('[VKID CALLBACK] Ошибка от VK:', data.error || data);
    }
  } catch (err) {
    // Логируем ВСЁ тело ошибки для дебага
    console.error('❌ Ошибка обмена кода на токен:', err.response?.data || err.message);
    res.send('<h2>Ошибка при обмене кода на токен VK<br>' + JSON.stringify(err.response?.data || err.message) + '</h2>');
  }
});

app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🪄 Сервер VK ID Auth (LowCode-ready) на http://localhost:${PORT}`);
});
