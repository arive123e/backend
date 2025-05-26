const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs'); // ДОБАВИЛ для работы с users.json
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
  const { code, state } = req.query;  // state — это твой Telegram ID
  const tg_id = state;

 // ЛОГИРУЕМ ПОЛУЧЕННЫЕ ПАРАМЕТРЫ ОТ VK
  console.log('[VK CALLBACK] Получен запрос: code =', code, ', state (tg_id) =', tg_id);

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

   // ЛОГИРУЕМ ПОЛУЧЕННЫЙ ОТВЕТ ОТ VK
    console.log('[VK CALLBACK] Ответ VK:', response.data);

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