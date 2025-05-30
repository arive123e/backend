const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000; // Жёстко указанный порт (можно изменить при необходимости)

// Ставит public как статику
app.use(express.static(path.join(__dirname, 'public')));

// ===== Старт авторизации VK ID =====
app.get('/auth/vk', (req, res) => {
  const CLIENT_ID = '53336238'; // ← твой client_id
  const REDIRECT_URI = 'https://api.fokusnikaltair.xyz/auth/vk/callback'; 

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'offline,wall,groups,photos,email,friends,docs,video,status',
    v: '5.131'
  });

  res.redirect(`https://oauth.vk.com/authorize?${params.toString()}`);
});
// ====================================

app.get('/', (req, res) => {
  res.send('Добро пожаловать в магический проект Фокусника Альтаира! ✨');
});

app.get('/auth/vk/callback', async (req, res) => {
  const { code, state } = req.query;
  const tg_id = state;

  console.log('🟠 [VK CALLBACK] Попытка входа!');
  console.log('🟠 [VK CALLBACK] URL:', req.url);
  console.log('🟠 [VK CALLBACK] query:', req.query);

  console.log('🟡 [VK CALLBACK] Вызван /auth/vk/callback');
  console.log('🟡 [VK CALLBACK] req.query:', req.query);

  if (!code) {
    console.log('[VK CALLBACK] Нет кода!');
    return res.redirect('/error.html');
  }

  const CLIENT_ID = '53336238'; // ← твой client_id
  const CLIENT_SECRET = '7sPy0o7CDAs2qYfBCDJC'; // ← твой client_secret
  const REDIRECT_URI = 'https://api.fokusnikaltair.xyz/auth/vk/callback'; // ← твой поддомен и путь

  try {
    const response = await axios.get('https://oauth.vk.com/access_token', {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      },
    });

    console.log('[VK CALLBACK] Ответ VK:', response.data);

    // Запись пользователей (оставляем твою логику)
    try {
      let users = [];
      if (fs.existsSync('users.json')) {
        users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
      }
      const user = {
        tg_id: tg_id,
        vk_id: response.data.user_id,
        access_token: response.data.access_token
      };
      const existing = users.find(u => u.tg_id === tg_id);
      if (existing) {
        existing.vk_id = user.vk_id;
        existing.access_token = user.access_token;
      } else {
        users.push(user);
      }
      fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
      console.log('[VK CALLBACK] User записан:', user);
    } catch (e) {
      console.error('[VK CALLBACK] Ошибка записи файла:', e);
    }

    return res.send('Авторизация прошла. Скопируй ссылку из адресной строки.');
  } catch (error) {
    let errText = '';
    if (error.response) {
      errText = JSON.stringify(error.response.data);
    } else {
      errText = error.message;
    }
    console.error('[VK CALLBACK] Ошибка авторизации:', errText);
    res.redirect('/error.html'); // Редиректим на error.html
  }
});

app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'help.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
