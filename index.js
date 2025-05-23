const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Раздача статических файлов из папки public
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.send('Добро пожаловать в магический проект Фокусника Альтаира! ✨');
});

// VK ID Callback
app.get('/auth/vk/callback', async (req, res) => {
  const { code, tg_id } = req.query;
  if (!code) return res.redirect('/error.html');

  const CLIENT_ID = '53336238';
  const CLIENT_SECRET = '7sPy0o7CDAs2qYfBCDJC';
  const REDIRECT_URI = 'https://vk-backend-w0we.onrender.com/auth/vk/callback' + (tg_id ? `?tg_id=${tg_id}` : '');

  try {
    const response = await axios.get('https://oauth.vk.com/access_token', {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      },
    });

    // Сохраняем связку Telegram <-> VK
    if (tg_id) {
      const binding = {
        tg_id,
        vk_id: response.data.user_id,
        access_token: response.data.access_token,
        time: new Date().toISOString()
      };
      fs.appendFileSync('bindings.json', JSON.stringify(binding) + '\n');
    }

    return res.redirect('/success.html');
  } catch (error) {
    return res.redirect('/error.html');
  }
});

// Страница помощи
app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'help.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
