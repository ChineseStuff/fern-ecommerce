const functions = require('firebase-functions');
const app = require('express')();

const {
  getAllProducts,
  getProductBySku,
  createProduct,
  uploadImage,
  likeProduct,
  unlikeProduct,
} = require('./handlers/products');
const { signUpUser, loginUser } = require('./handlers/users');
const FBAuth = require('./utils/fbAuth');

// Screams Routes
app.get('/products', getAllProducts);
app.get('/product/:productSku', getProductBySku);
app.post('/product', FBAuth, createProduct);
app.post('/product/uploadImage', FBAuth, uploadImage);
app.get('/product/:productSku/like', FBAuth, likeProduct);
app.get('/product/:productSku/unlike', FBAuth, unlikeProduct);

//Users Routes
app.post('/signup', signUpUser);
app.post('/login', loginUser);

exports.api = functions.https.onRequest(app);
