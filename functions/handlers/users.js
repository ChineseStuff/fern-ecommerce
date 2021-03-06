const { db } = require('../utils/admin');
const firebase = require('firebase');
const config = require('../utils/config');

firebase.initializeApp(config);

exports.signUpUser = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle,
  };

  //Validate if user exist
  let token, userId;
  db.doc(`/users/${newUser.handle}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        return res
          .status(400)
          .json({ handle: 'This user handle is already taken' });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })
    .then(data => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })
    .then(_token => {
      token = _token;
      const userToCreate = {
        email: newUser.email,
        handle: newUser.handle,
        createAt: new Date().toISOString(),
        userId: userId,
      };
      return db.doc(`/users/${userToCreate.handle}`).set(userToCreate);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch(err => {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        return res.status(400).json({ email: 'Email is already in use' });
      } else {
        return res
          .status(500)
          .json({ general: 'Something went grong, please try again' });
      }
    });
};

exports.loginUser = (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password,
  };

  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then(data => {
      return data.user.getIdToken();
    })
    .then(token => {
      return res.json({ token });
    })
    .catch(err => {
      console.error(err);
      return res
        .status(400)
        .json({ general: 'Wrong credentials, please try again' });
    });
};

exports.getAuthenticatedUser = (req, res) => {
  let userData = {};

  db.doc(`/users/${req.user.handle}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        userData.credentials = doc.data();
        return db
          .collection('carts')
          .where('userHandle', '==', req.user.handle)
          .get();
      }
    })
    .then(data => {
      userData.cart = [];
      let promises = [];
      data.forEach(doc => {
        userData.cart.push(doc.data());
        promises.push(db.doc(`/products/${doc.data().sku}`).get());
      });
      return Promise.all(promises);
    })
    .then(snapshots => {
      snapshots.forEach(doc => {
        userData.cart = userData.cart.map(item =>
          item.sku === doc.data().sku ? { ...item, ...doc.data() } : item
        );
      });
      return res.json(userData);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
