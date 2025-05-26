const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Раздача статических файлов из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Главная страница (опционально)
app.get('/', (req, res) => {
  res.send('Добро пожаловать в магический проект Фокусника Альтаира! ✨');
});

// VK ID Callback
app.get('/auth/vk/callback', async (req, res) => {
  const { code, state } = req.query;
  const tg_id = state;

  if (!code) {
    return res.redirect('/error.html');
  }

  const CLIENT_ID = '53336238';
  const CLIENT_SECRET = '7sPy0o7CDAs2qYfBCDJC';
  const REDIRECT_URI = 'https://vk-backend-w0we.onrender.com/auth/vk/callback';

  try {
    const response = await axios.get('https://oauth.vk.com/access_token', {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      },
    });

      // Записываем связку в users.json (без обработки ошибок для простоты, можно доработать)
    const user = {
      tg_id: tg_id,
      vk_id: response.data.user_id,
      access_token: response.data.access_token
    };
    let users = [];
    if (fs.existsSync('users.json')) {
      users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
    }
    // Проверим, есть ли уже такой tg_id — если есть, обновим токен, если нет, добавим
    const existing = users.find(u => u.tg_id === tg_id);
    if (existing) {
      existing.vk_id = user.vk_id;
      existing.access_token = user.access_token;
    } else {
      users.push(user);
    }
    fs.writeFileSync('users.json', JSON.stringify(users, null, 2));

    return res.redirect('/success.html');
  } catch (error) {
    let errText = '';
    if (error.response) {
      errText = JSON.stringify(error.response.data);
    } else {
      errText = error.message;
    }
    res.send('<h2>Ошибка авторизации!</h2><pre>' + errText + '</pre>');
  }
});

// Необязательно — отдельная ручка для поддержки, если нужен красивый адрес
app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'help.html'));
});

// Вот это в самом конце! Не внутри других функций!
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
