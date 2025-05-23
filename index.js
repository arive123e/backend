const express = require('express');
const axios = require('axios');
const path = require('path');
const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Главная страница (по желанию, можно кастомизировать)
// Раздача статических файлов из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Главная страница (опционально)
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
    return res.redirect('/error.html');
  }

  const CLIENT_ID = '53336238'; // твой client_id
@@ -47,15 +35,20 @@
    });

    // Если всё ок — редирект на успех
    return res.redirect('/success');
    return res.redirect('/success.html');
    // Для отладки можно раскомментировать:
    // res.send(JSON.stringify(response.data));
  } catch (error) {
    // Ошибка при обмене кода на токен — редирект на ошибку
    return res.redirect('/error');
    return res.redirect('/error.html');
  }
});

// Необязательно — отдельная ручка для поддержки, если нужен красивый адрес
app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'help.html'));
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
