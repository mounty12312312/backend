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

// Обновляем обработчик заказа
app.post('/api/order', async (req, res) => {
  console.log('Получен запрос на создание заказа');
  try {
    const { telegramId, products, totalCost, date, deliveryInfo } = req.body;
    const telegramIdStr = String(telegramId);

    // Проверяем остатки перед оформлением заказа
    const currentProducts = await readData('product!A2:F');
    for (const productId in products) {
      const product = currentProducts.find(p => p[0] === productId);
      if (!product) {
        return res.status(400).json({ 
          success: false, 
          message: 'Product not found',
          needsReload: true 
        });
      }
      const currentStock = parseInt(product[2]); // Остаток из столбца C
      const orderQuantity = products[productId].quantity;
      if (currentStock < orderQuantity) {
        return res.status(400).json({ 
          success: false, 
          message: 'Insufficient stock',
          needsReload: true 
        });
      }
    }

    // Проверяем баланс пользователя
    const users = await readData('user!A2:B');
    const user = users.find(u => u[0] === telegramIdStr);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentBalance = parseFloat(user[1]);
    if (currentBalance < totalCost) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Обновляем баланс пользователя
    const newBalance = currentBalance - totalCost;
    const userRowIndex = users.findIndex(u => u[0] === telegramIdStr) + 2;
    await writeData(`user!B${userRowIndex}`, [[newBalance]]);

    // Обновляем остатки товаров
    for (const productId in products) {
      const productIndex = currentProducts.findIndex(p => p[0] === productId);
      if (productIndex !== -1) {
        const currentStock = parseInt(currentProducts[productIndex][2]);
        const newStock = currentStock - products[productId].quantity;
        await writeData(`product!C${productIndex + 2}`, [[newStock]]);
      }
    }

    // Сохраняем заказ
    const orders = await readData('order!A2:E');
    const nextRow = orders.length + 2;
    const orderData = { products, deliveryInfo };

    await writeData(`order!A${nextRow}:D${nextRow}`, [[
      telegramIdStr,
      date,
      JSON.stringify(orderData),
      totalCost
    ]]);

    res.json({
      success: true,
      newBalance,
      message: 'Order processed successfully'
    });

  } catch (error) {
    console.error('Ошибка при обработке заказа:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});

// Обновляем получение заказов
app.get('/api/orders/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const orders = await readData('order!A2:E'); // Добавляем столбец E с трек-номером

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
          totalCost: parseFloat(order[3]),
          trackNumber: order[4] || 'Трек-номер не назначен'
        };
      })
      .reverse(); // Просто разворачиваем массив

    console.log(`Fetching orders for telegramId: ${telegramId}`);
    console.log('Found orders:', userOrders);

    res.json(userOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 