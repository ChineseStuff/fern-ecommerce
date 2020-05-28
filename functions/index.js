const functions = require('firebase-functions');
const app = require('express')();
const { db } = require('./utils/admin');
const cors = require('cors');
const FBAuth = require('./utils/fbAuth');
app.use(cors());

const {
  getAllProducts,
  getProductBySku,
  createProduct,
  uploadImage,
  addProductToCart,
  decreseProductFromCart,
  removeProductFromCart,
  deleteProduct,
} = require('./handlers/products');
const {
  signUpUser,
  loginUser,
  getAuthenticatedUser,
} = require('./handlers/users');

// Products Routes
app.get('/products', getAllProducts);
app.get('/product/:sku', getProductBySku);
app.get('/product/:sku/addToCart', FBAuth, addProductToCart);
app.get('/product/:sku/decreseFromCart', FBAuth, decreseProductFromCart);
app.get('/product/:sku/removeFromCart', FBAuth, removeProductFromCart);
app.post('/product', FBAuth, createProduct);
app.post('/product/uploadImage', FBAuth, uploadImage);
app.delete('/product/:sku', FBAuth, deleteProduct);

//Users Routes
app.post('/signup', signUpUser);
app.post('/login', loginUser);
app.get('/user', FBAuth, getAuthenticatedUser);

exports.onProductDelete = functions.firestore
  .document('/products/{sku}')
  .onDelete((snapshot, context) => {
    const sku = context.params.sku;
    const batch = db.batch();
    return db
      .collection('carts')
      .where('sku', '==', sku)
      .get()
      .then(data => {
        data.forEach(doc => {
          batch.delete(doc.ref);
        });
        return batch.commit();
      })
      .catch(err => console.error(err));
  });

exports.api = functions.https.onRequest(app);
