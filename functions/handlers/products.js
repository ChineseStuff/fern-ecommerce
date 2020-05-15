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
        });
      });
      res.json(products);
    })
    .catch(err => console.error(err));
};

exports.getProductBySku = (req, res) => {
  let productData = {};

  db.doc(`/products/${req.params.productSku}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Product not found' });
      }
      productData = doc.data();
      return db
        .collection('likes')
        .where('productSku', '==', req.params.productSku)
        .get();
    })
    .then(data => {
      productData.likes = [];
      data.forEach(doc => {
        productData.likes.push(doc.data());
      });
      return res.json(productData);
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
    likeCount: 0,
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
      return res.status(201).json({
        message: `Product ${newProduct.sku} created successfully`,
      });
    })
    .catch(err => {
      res.status(500).json({ error: 'something went grong' });
      console.error(err);
    });
};
exports.deleteProduct = (req, res) => {
  const productToBeDeleted = db.doc(`/products/${req.params.productSku}`);
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
          message: `Product ${req.params.productSku} removed successfully`,
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
  let productSku;

  busboy.on('field', (fieldname, val) => {
    if (fieldname === 'sku') productSku = val;
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
        return db.doc(`/products/${productSku}`).update({ imageUrl });
      })
      .then(() => {
        res.json({ message: `Image uploaded successfully ${productSku}` });
      })
      .catch(err => {
        console.error(err);
        return res
          .status(500)
          .json({ error: err.code, heders: JSON.stringify(productSku) });
      });
  });
  busboy.end(req.rawBody);
};

exports.likeProduct = (req, res) => {
  const likeDocument = db
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('productSku', '==', req.params.productSku)
    .limit(1);

  const productDocument = db.doc(`/products/${req.params.productSku}`);
  let productData;

  productDocument
    .get()
    .then(doc => {
      if (doc.exists) {
        productData = doc.data();
        return likeDocument.get();
      } else {
        return res
          .status(404)
          .json({ error: `product ${req.params.productSku} not found` });
      }
    })
    .then(data => {
      if (data.empty) {
        return db
          .collection('likes')
          .add({
            userHandle: req.user.handle,
            productSku: req.params.productSku,
          })
          .then(() => {
            productData.likeCount++;
            return productDocument.update({ likeCount: productData.likeCount });
          })
          .then(() => {
            return res.json(productData);
          })
          .catch(err => console.error(err));
      } else {
        return res.status(400).json({ error: 'Product already liked' });
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
exports.unlikeProduct = (req, res) => {
  const likeDocument = db
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('productSku', '==', req.params.productSku)
    .limit(1);

  const productDocument = db.doc(`/products/${req.params.productSku}`);
  let productData;

  productDocument
    .get()
    .then(doc => {
      if (doc.exists) {
        productData = doc.data();
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: 'product not found' });
      }
    })
    .then(data => {
      if (data.empty) {
        return res.status(400).json({ error: 'Product not liked' });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            productData.likeCount--;
            return productDocument.update({ likeCount: productData.likeCount });
          })
          .then(() => {
            res.json(productData);
          });
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
