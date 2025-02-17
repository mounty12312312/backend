const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  balance: { 
    type: Number, 
    default: 0 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}); 

module.exports = mongoose.model('User', userSchema); 