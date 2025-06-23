// index.js — VK ID OAuth 2.1 PKCE backend-only (июнь 2025) с поддержкой PKCE

const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto'); // ⬅️ Добавлено для PKCE

const app = express();
const PORT = 3000;

// Для чтения JSON POST-запросов (на будущее)
app.use(express.json());

// 1. Для хранения временных PKCE параметров
// (В production желательно хранить в БД или Redis, здесь — в файле для простоты)
const pkcePath = path.join(__dirname, 'pkce.json');
function savePKCE(state, code_verifier) {
  let pkce = {};
  if (fs.existsSync(pkcePath)) {
    const raw = fs.readFileSync(pkcePath, 'utf-8');
    pkce = raw ? JSON.parse(raw) : {};
  }
  pkce[state] = { code_verifier, created_at: Date.now() };
  fs.writeFileSync(pkcePath, JSON.stringify(pkce, null, 2));
}
function popPKCE(state) {
  if (!fs.existsSync(pkcePath)) return null;
  const raw = fs.readFileSync(pkcePath, 'utf-8');
  let pkce = raw ? JSON.parse(raw) : {};
  const record = pkce[state];
  delete pkce[state];
  fs.writeFileSync(pkcePath, JSON.stringify(pkce, null, 2));
  return record?.code_verifier || null;
}

// Тестовый маршрут
app.get('/test', (req, res) => {
  res.send('Test OK! 🚦');
});


// --------------------
// 2. Новый endpoint: Генерация PKCE параметров и выдача URL для VK авторизации
//    (Можно использовать вместо "жёсткой" ссылки на VK OAuth в фронте)
app.get('/auth/vk/link', (req, res) => {
  const client_id = '53336238';
  const redirect_uri = 'https://api.fokusnikaltair.xyz/auth/vk/callback';
  const tg_id = req.query.tg_id;
  if (!tg_id) return res.status(400).send('Нет tg_id');

  // === [PKCE] Генерируем code_verifier и code_challenge ===
  const code_verifier = crypto.randomBytes(64).toString('base64url').slice(0, 128);
  const code_challenge = crypto.createHash('sha256')
    .update(code_verifier)
    .digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // Сохраняем code_verifier по state (tg_id)
  savePKCE(tg_id, code_verifier);

  // Собираем ссылку для авторизации VK
  const auth_url = `https://id.vk.com/auth?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=groups,offline&v=5.199&state=${tg_id}&code_challenge=${code_challenge}&code_challenge_method=S256`;

  res.json({ auth_url }); // фронтенд может редиректить по этому адресу
});
// --------------------


// Главный VK ID CALLBACK — тут происходит обмен кода на токен и сохранение пользователя!
app.get('/auth/vk/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.send('<h2>Ошибка: параметр code не найден</h2>');
  }

  // Данные твоего приложения VK
  const client_id = '53336238';
  const redirect_uri = 'https://api.fokusnikaltair.xyz/auth/vk/callback';

  // === [PKCE] Достаём code_verifier по state (tg_id) ===
  const code_verifier = popPKCE(state);
  if (!code_verifier) {
    return res.send('<h2>Ошибка: не найден code_verifier для этого state (tg_id). Возможно, срок действия истёк или ссылка использована дважды.</h2>');
  }

  // Собираем параметры для VK OAuth2.1 PKCE
  const postParams = new URLSearchParams();
  postParams.append('grant_type', 'authorization_code');
  postParams.append('client_id', client_id);
  postParams.append('redirect_uri', redirect_uri);
  postParams.append('code', code);
  postParams.append('code_verifier', code_verifier); // ⬅️ Обязательный для PKCE!
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

/*
============================================
  🔥  ВАЖНОЕ МЕСТО с PKCE!
  1. Генерация code_verifier/code_challenge в /auth/vk/link
  2. Сохранение code_verifier по state (tg_id)
  3. Использование code_verifier при обмене code на токен (в /auth/vk/callback)
============================================
*/
