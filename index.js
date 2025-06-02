require('dotenv').config(); // 🔐 Загружаем переменные из .env

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000; 

// 🧠 Память для защиты от повторного использования одного и того же кода VK
const usedCodes = new Set(); // 🆕 защита от повторного использования code
let callCounter = 0; // 📊 Счётчик вызовов /auth/vk/callback (для отладки)

// ✅ Тестовый маршрут для проверки, что сервер жив
app.get('/test', (req, res) => {
  res.send('Test OK!');
});

// ===========================
// 🔗 Генерация ссылки авторизации через VK
// Этот маршрут вызывается, когда пользователь кликает "Войти через VK"
// Он редиректит на oauth.vk.com/authorize с параметрами
// ===========================
app.get('/auth/vk', (req, res) => {
  const CLIENT_ID = process.env.VK_CLIENT_ID; 
  const REDIRECT_URI = process.env.VK_REDIRECT_URI; 

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'offline,wall,groups,photos,email,friends,docs,video,status', // доступы
    v: '5.131'
  });

  res.redirect(`https://oauth.vk.com/authorize?${params.toString()}`);
});

// ===========================
// 🌐 Главная страница (по адресу "/")
// Можно использовать как заглушку или приветствие
// ===========================
app.get('/', (req, res) => {
  res.send('Добро пожаловать в магический проект Фокусника Альтаира! ✨');
});

// ===========================
// 🎯 Основной маршрут VK CALLBACK
// Приходит от VK после авторизации с параметром ?code=...
// Здесь мы обмениваем код на access_token
// ===========================
app.get('/auth/vk/callback', async (req, res) => {
  callCounter++; // 🆕
  console.log(`=== [VK CALLBACK] ВЫЗОВ #${callCounter} ===`); // 🆕
  
  try {
  console.log('Вызван /auth/vk/callback');
  console.log('Query:', req.query);

    const { code, state } = req.query;

    // ❗Если нет кода — значит что-то пошло не так
    if (!code) {
      return res.status(400).send('Ошибка: нет кода авторизации!');
    }

    // ⛔ Блокируем повторное использование кода
    if (usedCodes.has(code)) {
      console.warn('‼️ Код уже использован!');
      return res.sendFile(path.join(__dirname, 'public', 'error.html'));
    }

    usedCodes.add(code);
    
    // 🔄 Формируем параметры для обмена кода на токен
    const tokenParams = new URLSearchParams({
      client_id: process.env.VK_CLIENT_ID,
      client_secret: process.env.VK_CLIENT_SECRET,
      redirect_uri: process.env.VK_REDIRECT_URI,
      code,
    });

    // 🔑 Отправляем запрос на получение access_token от VK
    const vkRes = await axios.get(`https://oauth.vk.com/access_token?${tokenParams.toString()}`);

    // Выведем ответ VK (token, user_id и т.п.)
    console.log('VK access_token response:', vkRes.data);

     // ✅ Показываем страницу успеха
    return res.sendFile(path.join(__dirname, 'public', 'success.html'));
    
  } catch (error) {
    console.error('Ошибка при обмене code на token:', error.response?.data || error.message);
    // ❌ Показываем страницу ошибки
    return res.sendFile(path.join(__dirname, 'public', 'error.html'));
  }
});

// ===========================
// 🆘 Страница помощи (/help)
// ===========================
app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'help.html'));
});

// ===========================
// 📂 Подключение статики (frontend и public папки)
// ===========================
app.use(express.static('frontend'));
app.use(express.static(path.join(__dirname, 'public')));

// ===========================
// 🚀 Запуск сервера на 0.0.0.0:3000
// ===========================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
