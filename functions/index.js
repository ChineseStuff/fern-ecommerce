const functions = require('firebase-functions');
const app = require('express')();
const { db } = require('./utils/admin');

const {
  getAllProducts,
  getProductBySku,
  createProduct,
  uploadImage,
  likeProduct,
  unlikeProduct,
  deleteProduct,
} = require('./handlers/products');
const {
  signUpUser,
  loginUser,
  getAuthenticatedUser,
} = require('./handlers/users');
const FBAuth = require('./utils/fbAuth');

// Screams Routes
app.get('/products', getAllProducts);
app.get('/product/:productSku', getProductBySku);
app.get('/product/:productSku/like', FBAuth, likeProduct);
app.get('/product/:productSku/unlike', FBAuth, unlikeProduct);
app.post('/product', FBAuth, createProduct);
app.post('/product/uploadImage', FBAuth, uploadImage);
app.delete('/product/:productSku', FBAuth, deleteProduct);

//Users Routes
app.post('/signup', signUpUser);
app.post('/login', loginUser);
app.get('/user', FBAuth, getAuthenticatedUser);

exports.onProductDelete = functions.firestore
  .document('/products/{productSku}')
  .onDelete((snapshot, context) => {
    const productSku = context.params.productSku;
    const batch = db.batch();
    return db
      .collection('likes')
      .where('productSku', '==', productSku)
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
