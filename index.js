require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000; 

app.get('/test', (req, res) => {
  res.send('Test OK!');
});

// проверка сервера
app.get('/auth/vk', (req, res) => {
  const CLIENT_ID = process.env.VK_CLIENT_ID; 
  const REDIRECT_URI = process.env.VK_REDIRECT_URI; 

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'offline,wall,groups,photos,email,friends,docs,video,status',
    v: '5.131'
  });

  res.redirect(`https://oauth.vk.com/authorize?${params.toString()}`);
});

// === Корневой роут ===
app.get('/', (req, res) => {
  res.send('Добро пожаловать в магический проект Фокусника Альтаира! ✨');
});

// ====== VK CALLBACK: обмен code на access_token ======
app.get('/auth/vk/callback', async (req, res) => {
  try {
  console.log('=== [VK CALLBACK] ===');
  console.log('Вызван /auth/vk/callback');
  console.log('Query:', req.query);

    const { code, state } = req.query;
    if (!code) {
      return res.status(400).send('Ошибка: нет кода авторизации!');
    }

    // Запрос на получение access_token
    const tokenParams = new URLSearchParams({
      client_id: process.env.VK_CLIENT_ID,
      client_secret: process.env.VK_CLIENT_SECRET,
      redirect_uri: process.env.VK_REDIRECT_URI,
      code,
    });

    const vkRes = await axios.get(`https://oauth.vk.com/access_token?${tokenParams.toString()}`);

    // Выведем ответ VK (token, user_id и т.п.)
    console.log('VK access_token response:', vkRes.data);
    
 res.send(`
      <h2>Авторизация прошла!</h2>
      <pre>${JSON.stringify(vkRes.data, null, 2)}</pre>
      <a href="/">На главную</a>
    `);
  } catch (error) {
    console.error('Ошибка при обмене code на token:', error.response?.data || error.message);
    res.status(500).send('Ошибка обмена code на token: ' + (error.response?.data?.error_description || error.message));
  }
});

// ==== Help-страница ====
app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'help.html'));
});

// Ставит public как статику
app.use(express.static('frontend'));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
