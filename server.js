const express = require('express');

const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const PassportStrategy = require('passport-local').Strategy;
const knex = require('./db');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.set('view engine', 'pug');

const sessionConf = {
  secret: 'Bugfree is c00l!',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60,
  },
};

if (app.get('env') === 'production') {
  app.set('trust proxy', 1);
  sessionConf.cookie.secure = true;
}
app.use(session(sessionConf));

const port = 3001;
module.exports = app.listen(port, () => {
  console.log('Bugfree: listening on localhost: %d', port);
});

passport.use(new PassportStrategy((username, password, cb) => {
  let user = null;
  knex('users').where({ username }).first()
  .then(item => {
    if (item) {
      user = item;
      const hash = user.hash;
      return bcrypt.compare(password, hash);
    }
    cb(null, false);
    throw new Error('PassportStrategy: Username not found!');
  })
  .then(isMatch => {
    if (isMatch) {
      return cb(null, user);
    }
    return cb(null, false);
  })
  .catch(err => cb(err));
}));

passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

passport.deserializeUser((id, cb) => {
  knex('users').select().where({ id }).first()
  .then(user => {
    if (user) {
      return cb(null, user);
    }
    throw new Error('deserializeUser: user not found!');
  })
  .catch(err => cb(err)
  );
});

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  if (req.isAuthenticated()) {
    res.locals.full_name = `${req.user.first_name} ${req.user.last_name}`;
  }
  next();
});

function authorizeUser(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect('/login/');
  }
}

app.get('/', (req, res) => {
  res.render('main');
});

app.get('/login/', (req, res) => {
  res.render('login');
});

app.post('/login/', passport.authenticate('local', { failureRedirect: '/login/' }), (req, res) => {
  res.redirect('/');
});

app.get('/logout/', (req, res) => req.session.destroy(() => res.redirect('/')));

app.get('/projects/', (req, res) => {
  knex('projects').select()
  .then(projects => res.render('projects', { projects }))
  .catch(err => res.json({ data: err, status: 500 }));
});

app.get('/profile/', (req, res) => {
  res.render('profile');
});

app.get('/publish/', authorizeUser, (req, res) => {
  res.render('publish');
});

app.post('/publish/', authorizeUser, (req, res) => {
  const article = {
    title: req.body.title,
    author_id: req.user.id,
    content: req.body.editor,
  };
  knex('articles').insert(article)
  .then(() => res.render('preview', { content: req.body }))
  .catch(err => {
    console.log(err);
    return res.redirect('/');
  });
});

app.get('/articles/', (req, res) => {
  knex('articles')
  .join('users', 'users.id', 'articles.author_id')
  .select('title', 'content', 'timestamp', 'first_name', 'last_name')
  .orderBy('timestamp', 'desc')
  .then(articles => res.render('articles', { articles }))
  .catch(err => {
    console.log(err);
    return res.redirect('/');
  });
});

app.get('/api/articles/', (req, res) => {
  knex('articles')
  .join('users', 'users.id', 'articles.author_id')
  .select('title', 'content', 'timestamp', 'first_name', 'last_name')
  .orderBy('timestamp', 'desc')
  .then(articles => res.json(articles))
  .catch(err => {
    console.log(err);
    return res.json(err);
  });
});

app.get('/api/articles/:articleId', (req, res) => {
  const articleId = req.params.articleId;
  knex('articles')
  .select('title', 'content', 'timestamp', 'first_name', 'last_name')
  .join('users', 'users.id', 'articles.author_id')
  .where({ 'articles.id': articleId })
  .first()
  .then(articles => res.json(articles))
  .catch(err => {
    console.log(err);
    return res.json(err);
  });
});

app.get('/api/projects/', (req, res) => {
  knex('projects').select()
  .then(projects => res.json(projects))
  .catch(err => res.json({ data: err, status: 500 }));
});

app.get('/api/projects/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  knex('projects').select().where({ id: projectId }).first()
  .then(project => res.json(project))
  .catch(err => res.json({ data: err, status: 500 }));
});
