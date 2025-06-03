<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Магический портал авторизации VK ID</title>
  <!-- 📦 VKID SDK -->
  <script src="https://unpkg.com/@vkid/sdk@2.5.2/dist-sdk/umd/index.js"></script>
</head>
<body>
  <h1>Добро пожаловать!</h1>
  <div id="VkIdSdkOneTap"></div>

  <script>
    // ✨ Извлекаем tg_id из параметров строки запроса
    function getQueryParam(name) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(name);
    }

    const tg_id = getQueryParam('tg_id');

    if (!tg_id) {
      document.body.innerHTML = '<p style="color:red;">❌ Ошибка: Telegram ID не передан!</p>';
      throw new Error('tg_id обязателен');
    }

    if ('VKIDSDK' in window) {
      const VKID = window.VKIDSDK;

      VKID.Config.init({
        app: 53336238,
        redirectUrl: window.location.href.split('?')[0], // ⛔ убираем query!
        scope: 'friends,groups,wall,docs,photos,video,email,offline',
        state: tg_id,
        options: {
          disableSilentAuth: true,
          authType: 'pkce' // ✅ только PKCE
        }
      });

      const oneTap = new VKID.OneTap();

      oneTap.onAuth(async (response) => {
        console.log('✅ Успешная авторизация:', response);

        try {
          const result = await fetch('/auth/vk/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: response.accessToken,
              user_id: response.user.id,
              email: response.user.email,
              tg_id
            })
          });

          if (result.ok) {
            window.location.href = '/success.html';
          } else {
            alert('Ошибка при сохранении токена');
          }
        } catch (err) {
          console.error('❌ Ошибка запроса:', err);
          alert('Не удалось сохранить токен');
        }
      });

      const container = document.getElementById('VkIdSdkOneTap');
      if (container) {
        oneTap.render({
          container,
          styles: {
            height: 40,
          },
        });
      }
    } else {
      console.error('❌ VKID SDK не загружен');
    }
  </script>
</body>
</html>
