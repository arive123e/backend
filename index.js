const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Добро пожаловать на мой сервер!');
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

// Новый обработчик для VK ID
app.get('/auth/vk/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.send('Код авторизации не получен!');
  }

  // !!! Вставь свои данные приложения VK !!!
  const CLIENT_ID = '53336238';
  const CLIENT_SECRET = '7sPy0o7CDAs2qYfBCDJC';
  const REDIRECT_URI = 'https://vk-backend-w0we.onrender.com/auth/vk/callback';

  try {
    const response = await axios.get('https://oauth.vk.com/access_token', {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code
      }
    });

    const data = response.data;
    res.send('VK вернул: <pre>' + JSON.stringify(data, null, 2) + '</pre>');
  } catch (error) {
    res.send('Ошибка при обмене кода: ' + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
