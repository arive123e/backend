const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000; // Жёстко указанный порт (можно изменить при необходимости)

app.get('/test', (req, res) => {
  res.send('Test OK!');
});

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

app.get('/', (req, res) => {
  res.send('Добро пожаловать в магический проект Фокусника Альтаира! ✨');
});

app.get('/auth/vk/callback', async (req, res) => {
  console.log('=== [VK CALLBACK] ===');
  console.log('Вызван /auth/vk/callback');
  console.log('Query:', req.query);

  res.send('DEBUG: callback получен. Query: ' + JSON.stringify(req.query));
});

app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'help.html'));
});

// Ставит public как статику
app.use(express.static('frontend'));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
