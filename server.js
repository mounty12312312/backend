require('dotenv').config();

const express = require('express');
const cors = require('cors'); // Импортируем cors
const { readData, writeData } = require('./googleSheets');
const app = express();
const PORT = process.env.PORT || 3000;
const corsOptions = {
  origin: 'https://mounty12312312.github.io', // Разрешаем только этот домен
  optionsSuccessStatus: 200 // Настраиваем статус для предварительных запросов
};
app.use(cors(corsOptions)); // Используем cors для всех маршрутов
app.use(express.json());

// Добавляем middleware для логирования запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  if (req.body) {
    console.log('Body:', req.body);
  }
  next();
});

// Получение списка товаров
app.get('/api/products', async (req, res) => {
  try {
    const products = await readData('product!A2:F');
    res.json(products);
    console.log('Products:', products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Получение информации о пользователе
app.get('/api/user/:telegramId', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    const users = await readData('user!A2:B');
    const user = users.find(u => u[0] === telegramId);
    if (user) {
      res.json(user);
      console.log('Telegram ID:', telegramId);
    } else {
      res.status(404).send('User not found');
      console.log('Telegram ID:', telegramId);
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Обновление баланса пользователя
app.post('/api/user/:telegramId/updateBalance', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    const newBalance = req.body.balance;

    // Получаем текущих пользователей
    const users = await readData('user!A2:B');
    const rowIndex = users.findIndex(u => u[0] === telegramId) + 2; // +2 для учета заголовка

    if (rowIndex > 1) {
      // Обновляем баланс в таблице
      await writeData(`user!B${rowIndex}`, [[newBalance]]);
      res.json({ success: true, newBalance });
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Обновляем обработчик заказа с логами
app.post('/api/order', async (req, res) => {
  console.log('Получен запрос на создание заказа');
  try {
    const { telegramId, products, totalCost, date, deliveryInfo } = req.body;
    console.log('Данные заказа:', { telegramId, products, totalCost, date, deliveryInfo });
    // Преобразуем telegramId в строку
    const telegramIdStr = String(telegramId);
    console.log('Данные заказа:', { telegramId: telegramIdStr, products, totalCost, date, deliveryInfo });

    // 1. Проверяем баланс пользователя
    console.log('Получаем данные пользователей');
    const users = await readData('user!A2:B');
    console.log('Полученные пользователи:', users);

    const user = users.find(u => u[0] === telegramId);
    // Ищем пользователя, сравнивая строковые значения
    const user = users.find(u => u[0] === telegramIdStr);
    console.log('Найденный пользователь:', user);

    if (!user) {
      console.error('Пользователь не найден:', telegramId);
      console.error('Пользователь не найден:', telegramIdStr);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentBalance = parseFloat(user[1]);
    console.log('Текущий баланс:', currentBalance);
    console.log('Стоимость заказа:', totalCost);

    if (currentBalance < totalCost) {
      console.error('Недостаточно средств:', { currentBalance, totalCost });
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // 2. Обновляем баланс пользователя
    const newBalance = currentBalance - totalCost;
    console.log('Новый баланс:', newBalance);

    const userRowIndex = users.findIndex(u => u[0] === telegramId) + 2;
    const userRowIndex = users.findIndex(u => u[0] === telegramIdStr) + 2;
    console.log('Индекс строки пользователя:', userRowIndex);

    console.log('Обновляем баланс в таблице');
    await writeData(`user!B${userRowIndex}`, [[newBalance]]);

    // 3. Сохраняем заказ
    console.log('Получаем текущие заказы');
    const orders = await readData('order!A2:D');
    const nextRow = orders.length + 2;
    console.log('Следующая строка для заказа:', nextRow);

    const orderData = {
      products,
      deliveryInfo
    };
    console.log('Подготовленные данные заказа:', orderData);

    console.log('Сохраняем заказ в таблицу');
    await writeData(`order!A${nextRow}:D${nextRow}`, [[
      telegramId,
      telegramIdStr, // Сохраняем как строку
      date,
      JSON.stringify(orderData),
      totalCost
    ]]);

    console.log('Заказ успешно сохранен');
    res.json({
      success: true,
      newBalance,
      message: 'Order processed successfully'
    });

  } catch (error) {
    console.error('Ошибка при обработке заказа:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});

// Обновляем получение заказов
app.get('/api/orders', async (req, res) => {
  try {
    const telegramId = req.query.telegramId;
    const orders = await readData('order!A2:D');

    // Фильтруем и форматируем заказы для конкретного пользователя
    const userOrders = orders
      .filter(order => order[0] === telegramId)
      .map(order => {
        const orderData = JSON.parse(order[2]);
        return {
          telegramId: order[0],
          date: order[1],
          products: orderData.products,
          deliveryInfo: orderData.deliveryInfo,
          totalCost: parseFloat(order[3])
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(userOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 