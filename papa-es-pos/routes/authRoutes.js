const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/login', authController.getLogin);    // login page
router.post('/login', authController.postLogin);  // process the login form
router.get('/logout', authController.logout);     // send the user back to login

module.exports = router;
