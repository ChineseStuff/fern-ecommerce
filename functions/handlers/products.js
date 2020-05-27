const { admin, db } = require('../utils/admin');
const config = require('../utils/config');

exports.getAllProducts = (req, res) => {
  db.collection('products')
    .orderBy('createdAt', 'desc')
    .get()
    .then(data => {
      let products = [];
      data.forEach(doc => {
        products.push({
          userHandle: doc.data().userHandle,
          name: doc.data().name,
          description: doc.data().description,
          price: doc.data().price,
          sku: doc.data().sku,
          createdAt: doc.data().createdAt,
          imageUrl: doc.data().imageUrl,
        });
      });
      res.json(products);
    })
    .catch(err => console.error(err));
};

exports.getProductBySku = (req, res) => {
  let productData = {};

  db.doc(`/products/${req.params.sku}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Product not found' });
      }
      return res.json(doc.data());
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.createProduct = (req, res) => {
  const newProduct = {
    userHandle: req.user.handle,
    name: req.body.name,
    description: req.body.description,
    price: req.body.price,
    sku: req.body.sku,
    imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/new-product.png?alt=media`,
    createdAt: new Date().toISOString(),
  };

  //Validate if products exist
  db.doc(`/products/${newProduct.sku}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        return res
          .status(400)
          .json({ sku: 'This product sku is already taken' });
      } else {
        return db.doc(`/products/${newProduct.sku}`).set(newProduct);
      }
    })
    .then(doc => {
      db.doc(`/products/${newProduct.sku}`)
        .get()
        .then(doc => {
          return res.status(201).json(doc.data());
        })
        .catch(err => {
          console.error(err);
          return res.status(500).json({ error: err.code });
        });
    })
    .catch(err => {
      res.status(500).json({ error: 'something went grong' });
      console.error(err);
    });
};
exports.deleteProduct = (req, res) => {
  const productToBeDeleted = db.doc(`/products/${req.params.sku}`);
  productToBeDeleted
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Product Not Found' });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return res
          .status(403)
          .json({ error: `You don't have permission to delete this product` });
      }
      productToBeDeleted.delete().then(() => {
        return res.status(200).json({
          message: `Product ${req.params.sku} removed successfully`,
        });
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.uploadImage = (req, res) => {
  const BusBoy = require('busboy');
  const path = require('path');
  const os = require('os');
  const fs = require('fs');

  const busboy = new BusBoy({ headers: req.headers });

  let imageFileName;
  let imageToBeUploaded = {};
  let sku;

  busboy.on('field', (fieldname, val) => {
    if (fieldname === 'sku') sku = val;
  });

  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png')
      return res.status(400).json({ error: 'Wrong file type submitted' });

    const imageExt = filename.split('.')[filename.split('.').length - 1];
    imageFileName = `${Math.round(
      Math.random() * 100000000000
    ).toString()}.${imageExt}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filepath, mimetype };
    file.pipe(fs.createWriteStream(filepath));
  });

  busboy.on('finish', () => {
    admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetype,
          },
        },
      })
      .then(() => {
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
        return db.doc(`/products/${sku}`).update({ imageUrl });
      })
      .then(() => {
        res.json({ message: `Image uploaded successfully ${sku}` });
      })
      .catch(err => {
        console.error(err);
        return res
          .status(500)
          .json({ error: err.code, heders: JSON.stringify(sku) });
      });
  });
  busboy.end(req.rawBody);
};

exports.addProductToCart = (req, res) => {
  const cartDocuments = db
    .collection('carts')
    .where('userHandle', '==', req.user.handle)
    .where('sku', '==', req.params.sku)
    .limit(1);

  cartDocuments
    .get()
    .then(data => {
      if (data.empty) {
        return db
          .collection('carts')
          .add({
            userHandle: req.user.handle,
            sku: req.params.sku,
            qty: 1,
          })
          .then(() => {
            return res.status(200).json({ sku: req.params.sku });
          })
          .catch(err => {
            return res.status(500).json({ error: err.code });
          });
      } else {
        const prodId = data.docs[0].id;
        return db
          .doc(`/carts/${prodId}`)
          .update({ qty: data.docs[0].data().qty + 1 })
          .then(doc => {
            return res.json({ sku: req.params.sku });
          })
          .catch(err => {
            return res.status(500).json({ error: err.code });
          });
      }
    })
    .catch(err => {
      console.error(err.code);
      res.status(500).json({ error: err.code });
    });
};
exports.decreseProductFromCart = (req, res) => {
  const cartDocuments = db
    .collection('carts')
    .where('userHandle', '==', req.user.handle)
    .where('sku', '==', req.params.sku)
    .limit(1);

  cartDocuments
    .get()
    .then(data => {
      if (data.empty) {
        return res.status(400).json({ error: 'Product not in cart' });
      } else {
        const prod = data.docs[0];
        if (prod.data().qty > 1) {
          return db
            .doc(`/carts/${prod.id}`)
            .update({ qty: prod.data().qty - 1 })
            .then(doc => {
              return res.status(200).json({ sku: req.params.sku });
            })
            .catch(err => res.status(500).json({ error: err.code }));
        } else {
          return db
            .doc(`/carts/${prod.id}`)
            .delete()
            .then(() => {
              return res.status(200).json({ sku: req.params.sku });
            })
            .catch(err => res.status(500).json({ error: err.code }));
        }
      }
    })
    .catch(err => {
      console.error(err.code);
      res.status(500).json({ error: err.code });
    });
};
exports.removeProductFromCart = (req, res) => {
  const cartDocuments = db
    .collection('carts')
    .where('userHandle', '==', req.user.handle)
    .where('sku', '==', req.params.sku)
    .limit(1);

  cartDocuments
    .get()
    .then(data => {
      if (data.empty) {
        return res.status(400).json({ error: 'Product not in cart' });
      } else {
        const prod = data.docs[0];
        return db
          .doc(`/carts/${prod.id}`)
          .delete()
          .then(() => {
            return res.status(200).json({ sku: req.params.sku });
          })
          .catch(err => res.status(500).json({ error: err.code }));
      }
    })
    .catch(err => {
      console.error(err.code);
      res.status(500).json({ error: err.code });
    });
};
