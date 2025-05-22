const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Главная страница (по желанию, можно кастомизировать)
app.get('/', (req, res) => {
  res.send('Добро пожаловать в магический проект Фокусника Альтаира! ✨');
});

// Красивая страница успеха
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'success.html'));
});

// Красивая страница ошибки
app.get('/error', (req, res) => {
  res.sendFile(path.join(__dirname, 'error.html'));
});

// Страница поддержки/помощи
app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, 'help.html'));
});

// VK ID Callback
app.get('/auth/vk/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    // Нет кода авторизации — редиректим на красивую ошибку
    return res.redirect('/error');
  }

  const CLIENT_ID = '53336238'; // твой client_id
  const CLIENT_SECRET = '7sPy0o7CDAs2qYfBCDJC'; // твой client_secret
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

    // Если всё ок — редирект на успех
    return res.redirect('/success');
    // Для отладки можно раскомментировать:
    // res.send(JSON.stringify(response.data));
  } catch (error) {
    // Ошибка при обмене кода на токен — редирект на ошибку
    return res.redirect('/error');
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
