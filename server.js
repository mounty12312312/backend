require('dotenv').config();

const express = require('express');
const cors = require('cors'); // Импортируем cors
const { readData, writeData } = require('./googleSheets');
const app = express();
const PORT = process.env.PORT || 3000;
const User = require('./models/User');
const Order = require('./models/Order');

// Настройка CORS
app.use(cors({
  origin: 'https://mounty12312312.github.io',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept', 'Origin']
}));

app.use(express.json());

// Добавим логирование всех запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  next();
});

// Проверочный эндпоинт
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ message: 'API is working' });
});

// Получение списка товаров
app.get('/api/products', async (req, res) => {
  console.log('Products endpoint hit');
  try {
    const products = await readData('product!A2:E');
    console.log('Products fetched:', products);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
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
    // Преобразуем telegramId в строку
    const telegramIdStr = String(telegramId);
    console.log('Данные заказа:', { telegramId: telegramIdStr, products, totalCost, date, deliveryInfo });

    // 1. Проверяем баланс пользователя
    console.log('Получаем данные пользователей');
    const users = await readData('user!A2:B');
    console.log('Полученные пользователи:', users);
    
    // Ищем пользователя, сравнивая строковые значения
    const user = users.find(u => u[0] === telegramIdStr);
    console.log('Найденный пользователь:', user);
    
    if (!user) {
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

// Обработка баланса
app.post('/api/balance', async (req, res) => {
  try {
    const { telegramId } = req.body;
    console.log('Получен запрос баланса для telegramId:', telegramId);

    if (!telegramId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Не указан telegramId' 
      });
    }

    // Получаем баланс из базы данных
    const user = await User.findOne({ telegramId });
    console.log('Найден пользователь:', user);

    if (!user) {
      // Если пользователь не найден, создаем нового с нулевым балансом
      const newUser = new User({ telegramId, balance: 0 });
      await newUser.save();
      return res.json({ success: true, balance: 0 });
    }

    res.json({ success: true, balance: user.balance });

  } catch (error) {
    console.error('Ошибка при получении баланса:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера при получении баланса' 
    });
  }
});

// Обработка истории заказов
app.post('/api/orders', async (req, res) => {
  try {
    const { telegramId } = req.body;
    console.log('Получен запрос истории заказов для telegramId:', telegramId);

    if (!telegramId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Не указан telegramId' 
      });
    }

    // Получаем заказы из базы данных
    const orders = await Order.find({ telegramId })
      .sort({ createdAt: -1 }) // Сортировка по убыванию даты
      .limit(10); // Ограничиваем количество последних заказов

    console.log('Найдены заказы:', orders);

    res.json({ 
      success: true, 
      orders: orders.map(order => ({
        id: order._id,
        date: order.createdAt,
        products: order.products,
        totalCost: order.totalCost,
        status: order.status
      }))
    });

  } catch (error) {
    console.error('Ошибка при получении истории заказов:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера при получении истории заказов' 
    });
  }
});

// Добавляем обработку ошибок
app.use((err, req, res, next) => {
  console.error('Необработанная ошибка:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Внутренняя ошибка сервера' 
  });
});

// Проверяем подключение к базе данных
mongoose.connection.on('error', (err) => {
  console.error('Ошибка подключения к MongoDB:', err);
});

mongoose.connection.once('open', () => {
  console.log('Успешное подключение к MongoDB');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});